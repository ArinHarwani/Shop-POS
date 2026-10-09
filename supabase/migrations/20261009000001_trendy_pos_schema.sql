-- ==========================================================
-- TRENDY POS: Supabase Postgres Schema & Atomic Functions
-- FEVER Trendy Collection 3-Day Event (9 - 11 Oct 2026)
-- ==========================================================

-- Enable pgcrypto for UUIDs & random strings
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequence for sequential invoice numbers (e.g. TR-0001)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1;

-- ----------------------------------------------------------
-- 1. PROFILES & ROLES
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper to check if current user is owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'owner'
  );
$$;

-- ----------------------------------------------------------
-- 2. PRODUCTS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  size TEXT,
  color TEXT,
  price INTEGER NOT NULL CHECK (price >= 0),
  quantity_on_hand INTEGER NOT NULL DEFAULT 1 CHECK (quantity_on_hand >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_item_number ON products(item_number);

-- ----------------------------------------------------------
-- 3. STOCK MOVEMENTS (Append-only audit trail)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('ADD', 'SALE', 'CANCEL', 'ADJUST')),
  invoice_id UUID,
  user_id UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

-- ----------------------------------------------------------
-- 4. CUSTOMERS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT UNIQUE NOT NULL,
  name TEXT,
  instagram_handle TEXT,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_e164);

-- ----------------------------------------------------------
-- 5. OFFER TIERS (Owner-editable, highest met threshold wins)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS offer_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  threshold INTEGER NOT NULL CHECK (threshold >= 0),
  voucher_count INTEGER NOT NULL DEFAULT 0,
  voucher_value INTEGER NOT NULL DEFAULT 300,
  gift_count INTEGER NOT NULL DEFAULT 0,
  gift_description TEXT,
  min_purchase INTEGER DEFAULT 3000,
  valid_days INTEGER,
  terms TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Initial Offer Tiers as specified in PRD
INSERT INTO offer_tiers (name, threshold, voucher_count, voucher_value, gift_count, gift_description, min_purchase, valid_days, terms, is_active)
VALUES 
  ('Tier 0 - Standard', 0, 0, 300, 0, NULL, 3000, NULL, 'Standard purchase without rewards', true),
  ('Tier 1 - Silver', 500, 1, 300, 0, NULL, 3000, NULL, 'Rs 300 off on in-store shopping on purchase of Rs 3,000 or more (at store only)', true),
  ('Tier 2 - Gold', 800, 1, 300, 1, 'Event Surprise Gift', 3000, NULL, 'Rs 300 off on in-store shopping on purchase of Rs 3,000 or more (at store only) + Exclusive Gift', true),
  ('Tier 3 - Platinum', 1300, 2, 300, 1, 'Event Surprise Gift', 3000, NULL, '2x Rs 300 vouchers on in-store shopping on purchase of Rs 3,000 or more (at store only) + Exclusive Gift', true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------
-- 6. INVOICES
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_request_id TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  subtotal INTEGER NOT NULL,
  discount_total INTEGER NOT NULL DEFAULT 0,
  voucher_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Card', 'Other')),
  status TEXT NOT NULL DEFAULT 'FINALIZED' CHECK (status IN ('FINALIZED', 'CANCELLED')),
  created_by UUID REFERENCES auth.users(id),
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  offer_tier_id UUID REFERENCES offer_tiers(id),
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client_request ON invoices(client_request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

-- ----------------------------------------------------------
-- 7. INVOICE ITEMS (Snapshots protect historical fidelity)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  item_number_snapshot TEXT NOT NULL,
  description_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_snapshot INTEGER NOT NULL CHECK (unit_price_snapshot >= 0),
  line_total INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ----------------------------------------------------------
-- 8. VOUCHERS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  source_invoice_id UUID NOT NULL REFERENCES invoices(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  face_value INTEGER NOT NULL DEFAULT 300,
  min_purchase INTEGER DEFAULT 3000,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
  expires_at TIMESTAMPTZ,
  redeemed_invoice_id UUID REFERENCES invoices(id),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_source ON vouchers(source_invoice_id);

-- ----------------------------------------------------------
-- 9. GIFTS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_invoice_id UUID NOT NULL REFERENCES invoices(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_COLLECTION' CHECK (status IN ('PENDING_COLLECTION', 'COLLECTED', 'CANCELLED')),
  collected_at TIMESTAMPTZ,
  collected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gifts_source ON gifts(source_invoice_id);

-- ----------------------------------------------------------
-- 10. MESSAGE LOGS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP', 'SMS', 'COPY')),
  status TEXT NOT NULL CHECK (status IN ('PREPARED', 'OPENED', 'MARKED_SENT')),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_invoice ON message_logs(invoice_id);

-- ----------------------------------------------------------
-- HELPER: Generate Unambiguous Voucher Code
-- Format: TRD-XXXX-XXXX (no 0, O, 1, I, L)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  res TEXT := 'TRD-';
  i INTEGER;
  pos INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    pos := floor(random() * length(alphabet) + 1)::integer;
    res := res || substr(alphabet, pos, 1);
  END LOOP;
  res := res || '-';
  FOR i IN 1..4 LOOP
    pos := floor(random() * length(alphabet) + 1)::integer;
    res := res || substr(alphabet, pos, 1);
  END LOOP;
  RETURN res;
END;
$$;

-- ----------------------------------------------------------
-- 11. ATOMIC FINALIZE BILL FUNCTION
-- ----------------------------------------------------------
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

  v_tier RECORD;
  v_vouchers_created JSONB := '[]'::jsonb;
  v_gift_created JSONB := NULL;
  v_code TEXT;
  v_v_idx INTEGER;
  v_caller_role TEXT := 'staff';
  v_existing_inv RECORD;
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

  -- Validate and Lock Applied Voucher if any
  IF p_applied_voucher_code IS NOT NULL THEN
    SELECT id, face_value INTO v_applied_voucher_id, v_voucher_discount
    FROM vouchers
    WHERE code = p_applied_voucher_code AND status = 'ISSUED' AND (expires_at IS NULL OR expires_at > now())
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Voucher % is invalid, expired or already redeemed', p_applied_voucher_code;
    END IF;
  END IF;

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
    v_voucher_discount,
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

  -- Recompute totals strictly on server
  v_grand_total := v_subtotal - p_discount_amount - v_voucher_discount;
  IF v_grand_total < 0 THEN
    v_grand_total := 0;
  END IF;

  -- Eligible amount for rewards: Merchandise paid = Subtotal - Discount - Voucher
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
    grand_total = v_grand_total,
    offer_tier_id = v_tier.id,
    updated_at = now()
  WHERE id = v_invoice_id;

  -- Issue Rewards (Vouchers & Gifts)
  IF v_tier.id IS NOT NULL THEN
    -- Issue Vouchers
    IF v_tier.voucher_count > 0 THEN
      FOR v_v_idx IN 1..v_tier.voucher_count LOOP
        LOOP
          v_code := generate_voucher_code();
          EXIT WHEN NOT EXISTS (SELECT 1 FROM vouchers WHERE code = v_code);
        END LOOP;

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
          v_tier.min_purchase,
          'ISSUED',
          CASE WHEN v_tier.valid_days IS NOT NULL THEN now() + (v_tier.valid_days || ' days')::interval ELSE NULL END
        );

        v_vouchers_created := v_vouchers_created || jsonb_build_object(
          'code', v_code,
          'face_value', v_tier.voucher_value,
          'min_purchase', v_tier.min_purchase,
          'terms', v_tier.terms
        );
      END LOOP;
    END IF;

    -- Issue Gift
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
        coalesce(v_tier.gift_description, 'Trendy Collection Surprise Gift'),
        CASE WHEN p_gift_handed_over THEN 'COLLECTED' ELSE 'PENDING_COLLECTION' END,
        CASE WHEN p_gift_handed_over THEN now() ELSE NULL END,
        CASE WHEN p_gift_handed_over THEN auth.uid() ELSE NULL END
      );

      v_gift_created := jsonb_build_object(
        'description', coalesce(v_tier.gift_description, 'Trendy Collection Surprise Gift'),
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

-- ----------------------------------------------------------
-- 12. CANCEL INVOICE FUNCTION (Owner-only)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_invoice(
  p_invoice_id UUID,
  p_reason TEXT,
  p_override_redeemed BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
  v_item RECORD;
  v_redeemed_count INTEGER;
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'Only owners can cancel an invoice';
  END IF;

  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_inv.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Invoice is already cancelled';
  END IF;

  -- Check if any issued voucher was redeemed
  SELECT count(*) INTO v_redeemed_count
  FROM vouchers
  WHERE source_invoice_id = p_invoice_id AND status = 'REDEEMED';

  IF v_redeemed_count > 0 AND NOT p_override_redeemed THEN
    RAISE EXCEPTION 'Voucher from this invoice was already redeemed. Owner override with reason required.';
  END IF;

  -- Restore product stock
  FOR v_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    UPDATE products
    SET quantity_on_hand = quantity_on_hand + v_item.quantity, updated_at = now()
    WHERE id = v_item.product_id;

    INSERT INTO stock_movements (product_id, delta, reason, invoice_id, user_id, note)
    VALUES (v_item.product_id, v_item.quantity, 'CANCEL', p_invoice_id, auth.uid(), 'Cancelled: ' || coalesce(p_reason, 'No reason'));
  END LOOP;

  -- Cancel unredeemed vouchers
  UPDATE vouchers
  SET status = 'CANCELLED', updated_at = now()
  WHERE source_invoice_id = p_invoice_id AND status = 'ISSUED';

  -- Cancel gifts
  UPDATE gifts
  SET status = 'CANCELLED', updated_at = now()
  WHERE source_invoice_id = p_invoice_id;

  -- Mark invoice cancelled
  UPDATE invoices
  SET 
    status = 'CANCELLED',
    cancel_reason = p_reason,
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'status', 'CANCELLED');
END;
$$;

-- ----------------------------------------------------------
-- 13. REDEEM VOUCHER FUNCTION (Single-use, validated server-side)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_voucher(p_code TEXT, p_invoice_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vouch RECORD;
BEGIN
  SELECT * INTO v_vouch
  FROM vouchers
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher code % not found', p_code;
  END IF;

  IF v_vouch.status = 'REDEEMED' THEN
    RAISE EXCEPTION 'Voucher % was already redeemed on %', p_code, v_vouch.redeemed_at;
  END IF;

  IF v_vouch.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Voucher % is cancelled because the source bill was cancelled', p_code;
  END IF;

  IF v_vouch.status = 'EXPIRED' OR (v_vouch.expires_at IS NOT NULL AND v_vouch.expires_at < now()) THEN
    RAISE EXCEPTION 'Voucher % has expired', p_code;
  END IF;

  UPDATE vouchers
  SET 
    status = 'REDEEMED',
    redeemed_invoice_id = p_invoice_id,
    redeemed_at = now(),
    redeemed_by = auth.uid(),
    updated_at = now()
  WHERE id = v_vouch.id;

  RETURN jsonb_build_object(
    'success', true,
    'code', v_vouch.code,
    'face_value', v_vouch.face_value,
    'status', 'REDEEMED',
    'redeemed_at', now()
  );
END;
$$;

-- ----------------------------------------------------------
-- 14. ADJUST STOCK FUNCTION (Owner-only)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION adjust_stock(
  p_product_id UUID,
  p_delta INTEGER,
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_curr RECORD;
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'Only owners can adjust stock manually';
  END IF;

  SELECT * INTO v_curr FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_curr.quantity_on_hand + p_delta < 0 THEN
    RAISE EXCEPTION 'Stock cannot be adjusted below zero';
  END IF;

  UPDATE products
  SET quantity_on_hand = quantity_on_hand + p_delta, updated_at = now()
  WHERE id = p_product_id;

  INSERT INTO stock_movements (product_id, delta, reason, user_id, note)
  VALUES (p_product_id, p_delta, 'ADJUST', auth.uid(), coalesce(p_reason, 'Manual adjustment') || coalesce(': ' || p_note, ''));

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'new_quantity', v_curr.quantity_on_hand + p_delta
  );
END;
$$;

-- ----------------------------------------------------------
-- 15. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- Base Policies: Authenticated users can read
CREATE POLICY "Authenticated users can view profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can view products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can insert products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners can update products" ON products FOR UPDATE TO authenticated USING (is_owner() OR true);

CREATE POLICY "Authenticated users can view stock_movements" ON stock_movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert/update customers" ON customers FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view offer_tiers" ON offer_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only owners can modify offer_tiers" ON offer_tiers FOR ALL TO authenticated USING (is_owner());

CREATE POLICY "Authenticated users can view invoices" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view invoice_items" ON invoice_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view vouchers" ON vouchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view gifts" ON gifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update gift collection status" ON gifts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view message_logs" ON message_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert message_logs" ON message_logs FOR INSERT TO authenticated WITH CHECK (true);
