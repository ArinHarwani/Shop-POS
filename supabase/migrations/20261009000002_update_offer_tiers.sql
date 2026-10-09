-- ==========================================================
-- TRENDY POS: Offer Engine Update Migration
-- Delete old offer structure and establish new 4-tier model
-- ==========================================================

-- 1. Delete all existing old seed rows
DELETE FROM offer_tiers;

-- 2. Insert exactly the 4 new offer tiers
INSERT INTO offer_tiers (
  name, 
  threshold, 
  voucher_count, 
  voucher_value, 
  min_purchase, 
  valid_days, 
  gift_count, 
  gift_description, 
  terms, 
  is_active
)
VALUES 
  ('Tier 1', 499,  0, 0,   NULL, NULL, 1, 'Small gift', 'Gift on purchase of Rs 499 or more', true),
  ('Tier 2', 999,  1, 250, 3000, 30,   0, NULL,         'Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash.', true),
  ('Tier 3', 1499, 1, 350, 3000, 30,   1, 'Small gift', 'Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash. + Small gift', true),
  ('Tier 4', 1999, 1, 500, 3000, 30,   0, NULL,         'Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash.', true);

-- 3. Replace finalize_bill to enforce new voucher terms & IST expiry
CREATE OR REPLACE FUNCTION finalize_bill(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p_client_request_id TEXT;
  p_phone TEXT;
  p_name TEXT;
  p_instagram TEXT;
  p_consent BOOLEAN;
  p_payment_mode TEXT;
  p_discount_amount INTEGER;
  p_applied_voucher_code TEXT;
  p_gift_handed_over BOOLEAN;
  p_items JSONB;

  v_customer_id UUID;
  v_invoice_id UUID;
  v_invoice_num TEXT;
  v_item JSONB;
  v_prod_id UUID;
  v_qty INTEGER;
  v_prod RECORD;
  v_subtotal INTEGER := 0;
  v_grand_total INTEGER := 0;
  v_eligible_amount INTEGER := 0;
  v_voucher_discount INTEGER := 0;
  v_applied_voucher_id UUID;
  v_applied_vouch RECORD;
  v_min_purchase INTEGER;
  v_deficit INTEGER;

  v_tier RECORD;
  v_vouchers_created JSONB := '[]'::jsonb;
  v_gift_created JSONB := NULL;
  v_code TEXT;
  v_v_idx INTEGER;
  v_caller_role TEXT := 'staff';
  v_existing_inv RECORD;
  v_vouch_expiry TIMESTAMPTZ;
BEGIN
  p_client_request_id := payload->>'client_request_id';
  IF p_client_request_id IS NULL OR trim(p_client_request_id) = '' THEN
    RAISE EXCEPTION 'client_request_id is required';
  END IF;

  -- 1. Idempotency Check: if already exists, return existing record directly
  SELECT id, invoice_number INTO v_existing_inv
  FROM invoices
  WHERE client_request_id = p_client_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'invoice_id', v_existing_inv.id,
      'invoice_number', v_existing_inv.invoice_number
    );
  END IF;

  -- Verify caller role
  SELECT role INTO v_caller_role FROM profiles WHERE user_id = auth.uid();
  IF v_caller_role IS NULL THEN
    v_caller_role := 'staff';
  END IF;

  p_phone := trim(payload->>'customer_phone');
  p_name := nullif(trim(payload->>'customer_name'), '');
  p_instagram := nullif(regexp_replace(trim(payload->>'instagram_handle'), '^@', ''), '');
  p_consent := coalesce((payload->>'marketing_consent')::boolean, false);
  p_payment_mode := coalesce(payload->>'payment_mode', 'UPI');
  p_discount_amount := coalesce((payload->>'discount_amount')::integer, 0);
  p_applied_voucher_code := nullif(trim(payload->>'applied_voucher_code'), '');
  p_gift_handed_over := coalesce((payload->>'gift_handed_over')::boolean, true);
  p_items := payload->'items';

  IF p_discount_amount > 0 AND v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Discounts are only allowed for owner role';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart cannot be empty';
  END IF;

  -- Upsert Customer
  INSERT INTO customers (phone_e164, name, instagram_handle, marketing_consent, consent_at)
  VALUES (
    p_phone, 
    p_name, 
    p_instagram, 
    p_consent, 
    CASE WHEN p_consent THEN now() ELSE NULL END
  )
  ON CONFLICT (phone_e164) DO UPDATE
  SET 
    name = coalesce(EXCLUDED.name, customers.name),
    instagram_handle = coalesce(EXCLUDED.instagram_handle, customers.instagram_handle),
    marketing_consent = EXCLUDED.marketing_consent,
    consent_at = CASE WHEN EXCLUDED.marketing_consent THEN now() ELSE customers.consent_at END,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  -- Allocate sequential invoice number (TR-0001)
  v_invoice_num := 'TR-' || lpad(nextval('invoice_number_seq')::text, 4, '0');

  -- Create Invoice skeleton
  INSERT INTO invoices (
    invoice_number,
    client_request_id,
    customer_id,
    subtotal,
    discount_total,
    voucher_total,
    grand_total,
    payment_mode,
    created_by
  ) VALUES (
    v_invoice_num,
    p_client_request_id,
    v_customer_id,
    0,
    p_discount_amount,
    0,
    0,
    p_payment_mode,
    auth.uid()
  ) RETURNING id INTO v_invoice_id;

  -- Lock and process products in ordered fashion
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero';
    END IF;

    -- Lock product FOR UPDATE
    SELECT * INTO v_prod FROM products WHERE id = v_prod_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_prod_id;
    END IF;

    IF v_prod.quantity_on_hand < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (Item #%). Requested %, available %', 
        v_prod.name, v_prod.item_number, v_qty, v_prod.quantity_on_hand;
    END IF;

    -- Decrement stock
    UPDATE products
    SET quantity_on_hand = quantity_on_hand - v_qty, updated_at = now()
    WHERE id = v_prod_id;

    -- Audit trail
    INSERT INTO stock_movements (product_id, delta, reason, invoice_id, user_id, note)
    VALUES (v_prod_id, -v_qty, 'SALE', v_invoice_id, auth.uid(), 'Invoice ' || v_invoice_num);

    -- Insert snapshot line
    INSERT INTO invoice_items (
      invoice_id,
      product_id,
      item_number_snapshot,
      description_snapshot,
      quantity,
      unit_price_snapshot,
      line_total
    ) VALUES (
      v_invoice_id,
      v_prod_id,
      v_prod.item_number,
      v_prod.name,
      v_qty,
      v_prod.price,
      v_prod.price * v_qty
    );

    v_subtotal := v_subtotal + (v_prod.price * v_qty);
  END LOOP;

  -- Validate and Lock Applied Voucher if any (Single voucher only)
  IF p_applied_voucher_code IS NOT NULL THEN
    SELECT * INTO v_applied_vouch
    FROM vouchers
    WHERE code = upper(trim(p_applied_voucher_code))
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Voucher code % not found', p_applied_voucher_code;
    END IF;

    IF v_applied_vouch.status = 'CANCELLED' THEN
      RAISE EXCEPTION 'This voucher is cancelled because the source bill was cancelled.';
    END IF;

    IF v_applied_vouch.status = 'REDEEMED' THEN
      RAISE EXCEPTION 'This voucher was already used on %.', to_char(v_applied_vouch.redeemed_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY');
    END IF;

    IF v_applied_vouch.status = 'EXPIRED' OR (v_applied_vouch.expires_at IS NOT NULL AND now() > v_applied_vouch.expires_at) THEN
      RAISE EXCEPTION 'This voucher expired on %.', to_char(v_applied_vouch.expires_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY');
    END IF;

    -- Section D: Check minimum purchase on merchandise total after discount and BEFORE voucher
    v_min_purchase := coalesce(v_applied_vouch.min_purchase, 3000);
    IF (v_subtotal - p_discount_amount) < v_min_purchase THEN
      v_deficit := v_min_purchase - (v_subtotal - p_discount_amount);
      RAISE EXCEPTION 'This voucher needs a bill of Rs % or more. Add Rs % more.', v_min_purchase, v_deficit;
    END IF;

    v_applied_voucher_id := v_applied_vouch.id;
    v_voucher_discount := v_applied_vouch.face_value;
  END IF;

  -- Recompute totals strictly on server
  v_grand_total := v_subtotal - p_discount_amount - v_voucher_discount;
  IF v_grand_total < 0 THEN
    v_grand_total := 0;
  END IF;

  -- Section D: Eligible amount A for NEW offers on that same bill: total after discount and after voucher
  v_eligible_amount := v_grand_total;

  -- Mark applied voucher REDEEMED
  IF v_applied_voucher_id IS NOT NULL THEN
    UPDATE vouchers
    SET 
      status = 'REDEEMED',
      redeemed_invoice_id = v_invoice_id,
      redeemed_at = now(),
      redeemed_by = auth.uid(),
      updated_at = now()
    WHERE id = v_applied_voucher_id;
  END IF;

  -- Select highest met active tier (threshold <= eligible amount)
  SELECT * INTO v_tier
  FROM offer_tiers
  WHERE is_active = true AND threshold <= v_eligible_amount
  ORDER BY threshold DESC
  LIMIT 1;

  -- Update invoice with final figures and tier
  UPDATE invoices
  SET 
    subtotal = v_subtotal,
    voucher_total = v_voucher_discount,
    grand_total = v_grand_total,
    offer_tier_id = v_tier.id,
    updated_at = now()
  WHERE id = v_invoice_id;

  -- Issue Rewards (Vouchers & Gifts per new terms)
  IF v_tier.id IS NOT NULL THEN
    -- Issue Voucher (at most 1 voucher per tier)
    IF v_tier.voucher_count > 0 AND v_tier.voucher_value > 0 THEN
      LOOP
        v_code := generate_voucher_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM vouchers WHERE code = v_code);
      END LOOP;

      -- Section C: expires_at = end of day (23:59:59 IST) of (issue date in IST + 30 calendar days)
      v_vouch_expiry := ((now() AT TIME ZONE 'Asia/Kolkata')::date + (coalesce(v_tier.valid_days, 30) || ' days')::interval + time '23:59:59') AT TIME ZONE 'Asia/Kolkata';

      INSERT INTO vouchers (
        code,
        source_invoice_id,
        customer_id,
        face_value,
        min_purchase,
        status,
        expires_at
      ) VALUES (
        v_code,
        v_invoice_id,
        v_customer_id,
        v_tier.voucher_value,
        coalesce(v_tier.min_purchase, 3000),
        'ISSUED',
        v_vouch_expiry
      );

      v_vouchers_created := v_vouchers_created || jsonb_build_object(
        'code', v_code,
        'face_value', v_tier.voucher_value,
        'min_purchase', coalesce(v_tier.min_purchase, 3000),
        'expires_at', v_vouch_expiry,
        'terms', 'Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash.'
      );
    END IF;

    -- Issue Gift (e.g. Small gift)
    IF v_tier.gift_count > 0 THEN
      INSERT INTO gifts (
        source_invoice_id,
        customer_id,
        description,
        status,
        collected_at,
        collected_by
      ) VALUES (
        v_invoice_id,
        v_customer_id,
        coalesce(v_tier.gift_description, 'Small gift'),
        CASE WHEN p_gift_handed_over THEN 'COLLECTED' ELSE 'PENDING_COLLECTION' END,
        CASE WHEN p_gift_handed_over THEN now() ELSE NULL END,
        CASE WHEN p_gift_handed_over THEN auth.uid() ELSE NULL END
      );

      v_gift_created := jsonb_build_object(
        'description', coalesce(v_tier.gift_description, 'Small gift'),
        'status', CASE WHEN p_gift_handed_over THEN 'COLLECTED' ELSE 'PENDING_COLLECTION' END,
        'claimed', p_gift_handed_over
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_num,
    'customer_id', v_customer_id,
    'subtotal', v_subtotal,
    'discount_total', p_discount_amount,
    'voucher_total', v_voucher_discount,
    'grand_total', v_grand_total,
    'eligible_amount', v_eligible_amount,
    'tier_name', coalesce(v_tier.name, 'None'),
    'vouchers', v_vouchers_created,
    'gift', v_gift_created
  );
END;
$$;

-- 4. Replace check_voucher function with live IST expiry evaluation
CREATE OR REPLACE FUNCTION check_voucher(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vouch RECORD;
  v_status TEXT;
  v_is_expired BOOLEAN;
BEGIN
  SELECT * INTO v_vouch
  FROM vouchers
  WHERE code = upper(trim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'code', upper(trim(p_code)),
      'status', 'NOT_FOUND',
      'message', 'Voucher not found'
    );
  END IF;

  v_is_expired := (v_vouch.expires_at IS NOT NULL AND now() > v_vouch.expires_at);

  IF v_vouch.status = 'CANCELLED' THEN
    v_status := 'CANCELLED';
  ELSIF v_vouch.status = 'REDEEMED' THEN
    v_status := 'REDEEMED';
  ELSIF v_vouch.status = 'EXPIRED' OR v_is_expired THEN
    v_status := 'EXPIRED';
  ELSE
    v_status := 'ISSUED';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_vouch.id,
    'code', v_vouch.code,
    'face_value', v_vouch.face_value,
    'min_purchase', coalesce(v_vouch.min_purchase, 3000),
    'status', v_status,
    'is_valid', (v_status = 'ISSUED'),
    'expires_at', v_vouch.expires_at,
    'redeemed_at', v_vouch.redeemed_at,
    'expires_at_formatted', to_char(v_vouch.expires_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY'),
    'redeemed_at_formatted', to_char(v_vouch.redeemed_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY')
  );
END;
$$;
