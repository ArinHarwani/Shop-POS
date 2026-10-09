import { supabase, isSupabaseConfigured } from './supabase';
import {
  Product,
  OfferTier,
  Invoice,
  InvoiceItem,
  Voucher,
  Gift,
  Customer,
  StockMovement,
  FinalizePayload,
  FinalizeResult,
  UserRole,
} from '@/types';
import {
  calculateEligibleAmount,
  evaluateRewards,
  generateClientVoucherCode,
  calculateVoucherExpiry,
  validateVoucherRedemption,
  isVoucherExpired,
  formatIstDate,
  DEFAULT_OFFER_TIERS,
} from './rewards';
import { getActiveRole } from './storage';

// Local storage keys for standalone / offline operations
const STORAGE_KEYS = {
  PRODUCTS: 'trendy_db_products',
  OFFER_TIERS: 'trendy_db_offer_tiers',
  INVOICES: 'trendy_db_invoices',
  INVOICE_ITEMS: 'trendy_db_invoice_items',
  CUSTOMERS: 'trendy_db_customers',
  VOUCHERS: 'trendy_db_vouchers',
  GIFTS: 'trendy_db_gifts',
  STOCK_MOVEMENTS: 'trendy_db_stock_movements',
  MESSAGE_LOGS: 'trendy_db_message_logs',
  INVOICE_SEQ: 'trendy_db_invoice_seq',
};

// Compliant UUID generator for PostgreSQL UUID columns and local state
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getLocalData<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('Local database write error', err);
  }
}

export class DataService {
  // ----------------------------------------------------
  // PRODUCTS & INVENTORY
  // ----------------------------------------------------
  static async getProducts(): Promise<Product[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('item_number', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Supabase getProducts failed, using local fallback:', err);
      }
    }

    let local = getLocalData<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    // Purge legacy dev fixture items if present
    if (local.some((p) => p.id?.startsWith('p-') || p.id?.startsWith('fx-'))) {
      local = local.filter((p) => !p.id?.startsWith('p-') && !p.id?.startsWith('fx-'));
      setLocalData(STORAGE_KEYS.PRODUCTS, local);
    }
    return local;
  }

  static async getProductByItemNumber(itemNumber: string): Promise<Product | null> {
    const products = await this.getProducts();
    const query = itemNumber.trim().toLowerCase();
    return products.find((p) => p.item_number.toLowerCase() === query) || null;
  }

  static async searchProducts(query: string): Promise<Product[]> {
    const products = await this.getProducts();
    const clean = query.trim().toLowerCase();
    if (!clean) return products;

    // Exact match first, partial match second (BIL-1)
    const exact = products.filter((p) => p.item_number.toLowerCase() === clean);
    const partial = products.filter(
      (p) =>
        p.item_number.toLowerCase() !== clean &&
        (p.item_number.toLowerCase().includes(clean) ||
          p.name.toLowerCase().includes(clean) ||
          (p.category && p.category.toLowerCase().includes(clean)))
    );
    return [...exact, ...partial];
  }

  static async addOrUpdateProduct(product: Partial<Product> & { item_number: string; name: string; price: number }): Promise<Product> {
    const products = await this.getProducts();
    const existingIndex = products.findIndex((p) => p.item_number.trim() === product.item_number.trim());

    let savedProduct: Product;
    if (existingIndex >= 0) {
      savedProduct = {
        ...products[existingIndex],
        ...product,
        updated_at: new Date().toISOString(),
      };
      products[existingIndex] = savedProduct;
    } else {
      savedProduct = {
        id: generateUuid(),
        item_number: product.item_number.trim(),
        name: product.name.trim(),
        category: product.category || 'General',
        size: product.size || 'Free Size',
        color: product.color || 'Standard',
        price: Math.max(0, Math.floor(product.price)),
        quantity_on_hand: Math.max(0, product.quantity_on_hand ?? 1),
        is_active: product.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      products.push(savedProduct);
    }

    setLocalData(STORAGE_KEYS.PRODUCTS, products);

    // Audit trail stock movement
    const movements = getLocalData<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    movements.push({
      id: generateUuid(),
      product_id: savedProduct.id,
      delta: savedProduct.quantity_on_hand,
      reason: 'ADD',
      created_at: new Date().toISOString(),
      note: `Added/updated item #${savedProduct.item_number}`,
    });
    setLocalData(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').upsert(savedProduct, { onConflict: 'item_number' });
      } catch (err) {
        console.warn('Supabase upsert failed, stored locally:', err);
      }
    }

    return savedProduct;
  }

  static async bulkAddProducts(newProducts: Product[]): Promise<{ added: number; updated: number }> {
    const products = await this.getProducts();
    let added = 0;
    let updated = 0;

    for (const p of newProducts) {
      const idx = products.findIndex((exist) => exist.item_number.trim() === p.item_number.trim());
      if (idx >= 0) {
        products[idx] = {
          ...products[idx],
          ...p,
          quantity_on_hand: products[idx].quantity_on_hand + (p.quantity_on_hand || 1),
          updated_at: new Date().toISOString(),
        };
        updated++;
      } else {
        const item: Product = {
          ...p,
          id: p.id || generateUuid(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        products.push(item);
        added++;
      }
    }

    setLocalData(STORAGE_KEYS.PRODUCTS, products);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').upsert(products, { onConflict: 'item_number' });
      } catch (err) {
        console.warn('Supabase bulk upsert failed, stored locally:', err);
      }
    }

    return { added, updated };
  }

  static async adjustStock(productId: string, delta: number, reason: string, note?: string): Promise<Product> {
    const role = getActiveRole();
    if (role !== 'owner') {
      throw new Error('Only the owner role is permitted to manually adjust stock');
    }

    const products = await this.getProducts();
    const prod = products.find((p) => p.id === productId);
    if (!prod) throw new Error('Product not found');

    const newQty = prod.quantity_on_hand + delta;
    if (newQty < 0) {
      throw new Error(`Stock cannot drop below 0. Current: ${prod.quantity_on_hand}, Requested delta: ${delta}`);
    }

    prod.quantity_on_hand = newQty;
    prod.updated_at = new Date().toISOString();
    setLocalData(STORAGE_KEYS.PRODUCTS, products);

    const movements = getLocalData<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    movements.push({
      id: generateUuid(),
      product_id: productId,
      delta,
      reason: 'ADJUST',
      note: `${reason}: ${note || ''}`,
      created_at: new Date().toISOString(),
    });
    setLocalData(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('adjust_stock', {
          p_product_id: productId,
          p_delta: delta,
          p_reason: reason,
          p_note: note,
        });
      } catch (err) {
        console.warn('Supabase adjust_stock RPC failed, recorded locally:', err);
      }
    }

    return prod;
  }

  // ----------------------------------------------------
  // OFFER TIERS
  // ----------------------------------------------------
  static async getOfferTiers(): Promise<OfferTier[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('offer_tiers').select('*').order('threshold', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Supabase getOfferTiers failed, using local/defaults:', err);
      }
    }
    let local = getLocalData<OfferTier[]>(STORAGE_KEYS.OFFER_TIERS, []);
    if (local.length === 0) {
      local = DEFAULT_OFFER_TIERS;
      setLocalData(STORAGE_KEYS.OFFER_TIERS, local);
    }
    return local;
  }

  static async saveOfferTier(tier: OfferTier): Promise<OfferTier> {
    const role = getActiveRole();
    if (role !== 'owner') {
      throw new Error('Only owners can modify reward offer tiers');
    }

    const tiers = await this.getOfferTiers();
    const idx = tiers.findIndex((t) => t.id === tier.id);
    if (idx >= 0) {
      tiers[idx] = tier;
    } else {
      tiers.push(tier);
    }
    setLocalData(STORAGE_KEYS.OFFER_TIERS, tiers);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('offer_tiers').upsert(tier);
      } catch (err) {
        console.warn('Supabase saveOfferTier failed, saved locally:', err);
      }
    }
    return tier;
  }

  // ----------------------------------------------------
  // ATOMIC FINALIZE BILL (BIL-6)
  // ----------------------------------------------------
  static async finalizeBill(payload: FinalizePayload): Promise<FinalizeResult> {
    // 1. Idempotency Check (BIL-6)
    const invoices = getLocalData<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    const existing = invoices.find((inv) => inv.client_request_id === payload.client_request_id);
    if (existing) {
      const vouchers = getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []).filter(
        (v) => v.source_invoice_id === existing.id
      );
      const gift = getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []).find(
        (g) => g.source_invoice_id === existing.id
      );
      return {
        success: true,
        is_duplicate: true,
        invoice_id: existing.id,
        invoice_number: existing.invoice_number,
        customer_id: existing.customer_id,
        subtotal: existing.subtotal,
        discount_total: existing.discount_total,
        voucher_total: existing.voucher_total,
        grand_total: existing.grand_total,
        eligible_amount: existing.grand_total,
        vouchers: vouchers.map((v) => ({ code: v.code, face_value: v.face_value, min_purchase: v.min_purchase })),
        gift: gift ? { description: gift.description, status: gift.status as any, claimed: gift.status === 'COLLECTED' } : null,
      };
    }

    const role = getActiveRole();
    if (payload.discount_amount > 0 && role !== 'owner') {
      throw new Error('Discounts are only allowed for owner role');
    }

    const products = await this.getProducts();

    // 2. Ensure each product exists in catalogue and check stock
    for (const item of payload.items) {
      let prod = products.find((p) => p.id === item.product_id);
      if (!prod) {
        prod = {
          id: item.product_id,
          item_number: (item as any).item_number || String(Math.floor(100000 + Math.random() * 900000)),
          name: (item as any).name || 'Garment',
          category: 'General',
          size: 'Free Size',
          color: 'Standard',
          price: (item as any).unit_price || 0,
          quantity_on_hand: 99999,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        products.push(prod);
      }
      if (prod.quantity_on_hand < item.quantity) {
        throw new Error(`Insufficient stock for ${prod.name} (Item #${prod.item_number}). Available: ${prod.quantity_on_hand}, Requested: ${item.quantity}`);
      }
    }

    // 3. Calculate Subtotal, Snapshots, and Decrement Stock
    let subtotal = 0;
    const invoiceItems: InvoiceItem[] = [];
    const stockMovements = getLocalData<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);

    // Next sequence number
    let seq = getLocalData<number>(STORAGE_KEYS.INVOICE_SEQ, 0) + 1;
    setLocalData(STORAGE_KEYS.INVOICE_SEQ, seq);
    const invoiceNumber = `TR-${String(seq).padStart(4, '0')}`;
    const invoiceId = generateUuid();

    for (const item of payload.items) {
      const prod = products.find((p) => p.id === item.product_id)!;
      prod.quantity_on_hand -= item.quantity;
      prod.updated_at = new Date().toISOString();

      const lineTotal = prod.price * item.quantity;
      subtotal += lineTotal;

      invoiceItems.push({
        id: generateUuid(),
        invoice_id: invoiceId,
        product_id: prod.id,
        item_number_snapshot: prod.item_number,
        description_snapshot: prod.name,
        quantity: item.quantity,
        unit_price_snapshot: prod.price,
        line_total: lineTotal,
      });

      stockMovements.push({
        id: generateUuid(),
        product_id: prod.id,
        delta: -item.quantity,
        reason: 'SALE',
        invoice_id: invoiceId,
        created_at: new Date().toISOString(),
        note: `Invoice ${invoiceNumber}`,
      });
    }
    setLocalData(STORAGE_KEYS.PRODUCTS, products);
    setLocalData(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);

    // 4. Validate and apply voucher if provided (Section D: min purchase checked on merchandise total after discount and before voucher)
    let appliedVoucher: Voucher | null = null;
    let voucherDiscount = 0;
    const allVouchers = getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
    const discountAmount = Math.max(0, Math.floor(payload.discount_amount || 0));

    if (payload.applied_voucher_code) {
      const codeUpper = payload.applied_voucher_code.trim().toUpperCase();
      appliedVoucher = allVouchers.find((v) => v.code === codeUpper) || null;
      if (!appliedVoucher) {
        throw new Error(`Voucher code "${payload.applied_voucher_code}" not found`);
      }
      const valRes = validateVoucherRedemption(appliedVoucher, subtotal - discountAmount);
      if (!valRes.valid) {
        throw new Error(valRes.error);
      }
      voucherDiscount = appliedVoucher.face_value;
    }

    // 5. Server-side totals recomputation
    const grandTotal = Math.max(0, subtotal - discountAmount - voucherDiscount);

    // 6. Eligible Amount for Rewards
    const eligibleAmount = calculateEligibleAmount(subtotal, discountAmount, voucherDiscount);

    // 7. Upsert Customer
    const customers = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    let customer = customers.find((c) => c.phone_e164 === payload.customer_phone);
    if (!customer) {
      customer = {
        id: generateUuid(),
        phone_e164: payload.customer_phone,
        name: payload.customer_name || null,
        instagram_handle: payload.instagram_handle?.replace(/^@/, '') || null,
        marketing_consent: payload.marketing_consent,
        consent_at: payload.marketing_consent ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      };
      customers.push(customer);
    } else {
      if (payload.customer_name) customer.name = payload.customer_name;
      if (payload.instagram_handle) customer.instagram_handle = payload.instagram_handle.replace(/^@/, '');
      customer.marketing_consent = payload.marketing_consent;
      if (payload.marketing_consent && !customer.consent_at) {
        customer.consent_at = new Date().toISOString();
      }
      customer.updated_at = new Date().toISOString();
    }
    setLocalData(STORAGE_KEYS.CUSTOMERS, customers);

    // 8. Redeem applied voucher if present
    if (appliedVoucher) {
      appliedVoucher.status = 'REDEEMED';
      appliedVoucher.redeemed_invoice_id = invoiceId;
      appliedVoucher.redeemed_at = new Date().toISOString();
      setLocalData(STORAGE_KEYS.VOUCHERS, allVouchers);
    }

    // 9. Evaluate & Issue Rewards
    const tiers = await this.getOfferTiers();
    const rewardEval = evaluateRewards(eligibleAmount, tiers);

    const createdVouchers: Voucher[] = [];
    if (rewardEval.voucherCount > 0) {
      for (let i = 0; i < rewardEval.voucherCount; i++) {
        let code = '';
        do {
          code = generateClientVoucherCode();
        } while (allVouchers.some((v) => v.code === code));

        const newVoucher: Voucher = {
          id: generateUuid(),
          code,
          source_invoice_id: invoiceId,
          customer_id: customer.id,
          face_value: rewardEval.voucherValue,
          min_purchase: 3000,
          status: 'ISSUED',
          expires_at: calculateVoucherExpiry(new Date(), rewardEval.currentTier?.valid_days ?? 30).toISOString(),
          created_at: new Date().toISOString(),
        };
        allVouchers.push(newVoucher);
        createdVouchers.push(newVoucher);
      }
      setLocalData(STORAGE_KEYS.VOUCHERS, allVouchers);
    }

    let createdGift: Gift | null = null;
    if (rewardEval.giftCount > 0) {
      const gifts = getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []);
      createdGift = {
        id: generateUuid(),
        source_invoice_id: invoiceId,
        customer_id: customer.id,
        description: rewardEval.giftDescription || 'Small gift',
        status: payload.gift_handed_over ? 'COLLECTED' : 'PENDING_COLLECTION',
        collected_at: payload.gift_handed_over ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      };
      gifts.push(createdGift);
      setLocalData(STORAGE_KEYS.GIFTS, gifts);
    }

    // 10. Save Invoice and Items locally
    const invoice: Invoice = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      client_request_id: payload.client_request_id,
      customer_id: customer.id,
      subtotal,
      discount_total: discountAmount,
      voucher_total: voucherDiscount,
      grand_total: grandTotal,
      payment_mode: payload.payment_mode,
      status: 'FINALIZED',
      finalized_at: new Date().toISOString(),
      offer_tier_id: rewardEval.currentTier?.id || null,
      items: invoiceItems,
      customer,
    };
    invoices.push(invoice);
    setLocalData(STORAGE_KEYS.INVOICES, invoices);

    const allInvoiceItems = getLocalData<InvoiceItem[]>(STORAGE_KEYS.INVOICE_ITEMS, []);
    allInvoiceItems.push(...invoiceItems);
    setLocalData(STORAGE_KEYS.INVOICE_ITEMS, allInvoiceItems);

    // Background asynchronous sync to Supabase when online
    if (isSupabaseConfigured && supabase) {
      this.syncBillToSupabase(customer, invoice, invoiceItems, createdVouchers, createdGift).catch((err) => {
        console.warn('Background Supabase bill sync warning:', err);
      });
    }

    return {
      success: true,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      customer_id: customer.id,
      subtotal,
      discount_total: discountAmount,
      voucher_total: voucherDiscount,
      grand_total: grandTotal,
      eligible_amount: eligibleAmount,
      tier_name: rewardEval.currentTier?.name,
      vouchers: createdVouchers.map((v) => ({
        code: v.code,
        face_value: v.face_value,
        min_purchase: v.min_purchase,
        terms: rewardEval.currentTier?.terms,
      })),
      gift: createdGift
        ? {
            description: createdGift.description,
            status: createdGift.status as any,
            claimed: createdGift.status === 'COLLECTED',
          }
        : null,
    };
  }

  // Background Cloud Sync Helper (Tolerates offline/slow connections)
  private static async syncBillToSupabase(
    customer: Customer,
    invoice: Invoice,
    items: InvoiceItem[],
    vouchers: Voucher[],
    gift: Gift | null
  ): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('customers').upsert({
        id: customer.id,
        phone_e164: customer.phone_e164,
        name: customer.name,
        instagram_handle: customer.instagram_handle,
        marketing_consent: customer.marketing_consent,
        consent_at: customer.consent_at,
        created_at: customer.created_at,
        updated_at: customer.updated_at || new Date().toISOString(),
      });

      await supabase.from('invoices').insert({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_request_id: invoice.client_request_id,
        customer_id: customer.id,
        subtotal: invoice.subtotal,
        discount_total: invoice.discount_total,
        voucher_total: invoice.voucher_total,
        grand_total: invoice.grand_total,
        payment_mode: invoice.payment_mode,
        status: invoice.status,
        finalized_at: invoice.finalized_at,
        offer_tier_id: invoice.offer_tier_id,
      });

      if (items.length > 0) {
        await supabase.from('invoice_items').insert(
          items.map((it) => ({
            id: it.id,
            invoice_id: it.invoice_id,
            product_id: it.product_id,
            item_number_snapshot: it.item_number_snapshot,
            description_snapshot: it.description_snapshot,
            quantity: it.quantity,
            unit_price_snapshot: it.unit_price_snapshot,
            line_total: it.line_total,
          }))
        );
      }

      if (vouchers.length > 0) {
        await supabase.from('vouchers').insert(
          vouchers.map((v) => ({
            id: v.id,
            code: v.code,
            source_invoice_id: v.source_invoice_id,
            customer_id: v.customer_id,
            face_value: v.face_value,
            min_purchase: v.min_purchase,
            status: v.status,
            expires_at: v.expires_at,
            created_at: v.created_at,
          }))
        );
      }

      if (gift) {
        await supabase.from('gifts').insert({
          id: gift.id,
          source_invoice_id: gift.source_invoice_id,
          customer_id: gift.customer_id,
          description: gift.description,
          status: gift.status,
          collected_at: gift.collected_at,
          created_at: gift.created_at,
        });
      }
    } catch (err) {
      console.warn('Supabase sync bill failed:', err);
    }
  }

  // ----------------------------------------------------
  // CANCEL INVOICE (BIL-8)
  // ----------------------------------------------------
  static async cancelInvoice(invoiceId: string, reason: string, overrideRedeemed: boolean = false): Promise<void> {
    const role = getActiveRole();
    if (role !== 'owner') {
      throw new Error('Only the owner role is permitted to cancel an invoice');
    }

    const invoices = getLocalData<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status === 'CANCELLED') throw new Error('Invoice is already cancelled');

    const vouchers = getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
    const redeemedVouchers = vouchers.filter(
      (v) => v.source_invoice_id === invoiceId && v.status === 'REDEEMED'
    );

    if (redeemedVouchers.length > 0 && !overrideRedeemed) {
      throw new Error('Vouchers from this invoice have already been redeemed. Owner override with reason required.');
    }

    // Restore stock
    const products = await this.getProducts();
    const allLines = getLocalData<InvoiceItem[]>(STORAGE_KEYS.INVOICE_ITEMS, []);
    const lines = allLines.filter((l) => l.invoice_id === invoiceId);
    const stockMovements = getLocalData<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);

    for (const line of lines) {
      const prod = products.find((p) => p.id === line.product_id);
      if (prod) {
        prod.quantity_on_hand += line.quantity;
        prod.updated_at = new Date().toISOString();
        stockMovements.push({
          id: generateUuid(),
          product_id: prod.id,
          delta: line.quantity,
          reason: 'CANCEL',
          invoice_id: invoiceId,
          created_at: new Date().toISOString(),
          note: `Cancelled Bill ${inv.invoice_number}: ${reason}`,
        });
      }
    }
    setLocalData(STORAGE_KEYS.PRODUCTS, products);
    setLocalData(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);

    // Cancel unredeemed vouchers
    vouchers.forEach((v) => {
      if (v.source_invoice_id === invoiceId && v.status === 'ISSUED') {
        v.status = 'CANCELLED';
      }
    });
    setLocalData(STORAGE_KEYS.VOUCHERS, vouchers);

    // Cancel gifts
    const gifts = getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []);
    gifts.forEach((g) => {
      if (g.source_invoice_id === invoiceId) {
        g.status = 'CANCELLED';
      }
    });
    setLocalData(STORAGE_KEYS.GIFTS, gifts);

    // Mark invoice cancelled
    inv.status = 'CANCELLED';
    inv.cancel_reason = reason;
    inv.cancelled_at = new Date().toISOString();
    setLocalData(STORAGE_KEYS.INVOICES, invoices);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('cancel_invoice', {
          p_invoice_id: invoiceId,
          p_reason: reason,
          p_override_redeemed: overrideRedeemed,
        });
      } catch (err) {
        console.warn('Supabase cancel_invoice RPC failed, recorded locally:', err);
      }
    }
  }

  // ----------------------------------------------------
  // VOUCHERS (LOOKUP & REDEEM)
  // ----------------------------------------------------
  static async lookupVoucher(code: string): Promise<{ voucher: Voucher; invoice?: Invoice; customer?: Customer } | null> {
    const cleanCode = code.trim().toUpperCase();
    const vouchers = getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
    let voucher = vouchers.find((v) => v.code === cleanCode);

    if (!voucher && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('vouchers')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();
        if (!error && data) {
          voucher = data as Voucher;
        }
      } catch (err) {
        console.warn('Supabase lookupVoucher failed, checking local only:', err);
      }
    }

    if (!voucher) return null;

    const invoices = getLocalData<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    const invoice = invoices.find((i) => i.id === voucher?.source_invoice_id);

    const customers = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    const customer = customers.find((c) => c.id === voucher?.customer_id);

    return { voucher, invoice, customer };
  }

  static async redeemVoucher(code: string, invoiceId?: string): Promise<Voucher> {
    const cleanCode = code.trim().toUpperCase();
    const vouchers = getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
    const voucher = vouchers.find((v) => v.code === cleanCode);

    if (!voucher) throw new Error(`Voucher code "${cleanCode}" not found`);
    if (voucher.status === 'REDEEMED') {
      throw new Error(`This voucher was already used on ${formatIstDate(voucher.redeemed_at)}.`);
    }
    if (voucher.status === 'CANCELLED') {
      throw new Error('This voucher is cancelled because the source bill was cancelled.');
    }
    if (voucher.status === 'EXPIRED' || (voucher.expires_at && isVoucherExpired(voucher.expires_at))) {
      throw new Error(`This voucher expired on ${formatIstDate(voucher.expires_at)}.`);
    }

    voucher.status = 'REDEEMED';
    voucher.redeemed_invoice_id = invoiceId || null;
    voucher.redeemed_at = new Date().toISOString();
    setLocalData(STORAGE_KEYS.VOUCHERS, vouchers);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('redeem_voucher', {
          p_code: cleanCode,
          p_invoice_id: invoiceId || null,
        });
      } catch (err) {
        console.warn('Supabase redeem_voucher RPC failed, redeemed locally:', err);
      }
    }

    return voucher;
  }

  // ----------------------------------------------------
  // GIFTS TRACKING & COLLECTION
  // ----------------------------------------------------
  static async getGifts(): Promise<Gift[]> {
    return getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []);
  }

  static async markGiftCollected(giftId: string): Promise<Gift> {
    const gifts = getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []);
    const gift = gifts.find((g) => g.id === giftId);
    if (!gift) throw new Error('Gift record not found');

    gift.status = 'COLLECTED';
    gift.collected_at = new Date().toISOString();
    setLocalData(STORAGE_KEYS.GIFTS, gifts);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('gifts').update({
          status: 'COLLECTED',
          collected_at: new Date().toISOString(),
        }).eq('id', giftId);
      } catch (err) {
        console.warn('Supabase markGiftCollected failed, marked locally:', err);
      }
    }
    return gift;
  }

  // ----------------------------------------------------
  // INVOICES & REPORTS
  // ----------------------------------------------------
  static async getInvoices(filters?: {
    date?: string;
    invoiceNumber?: string;
    customerPhone?: string;
    paymentMode?: string;
  }): Promise<Invoice[]> {
    let invoices = getLocalData<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    const customers = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    const allLines = getLocalData<InvoiceItem[]>(STORAGE_KEYS.INVOICE_ITEMS, []);

    // Enrich with customer & items
    invoices = invoices.map((inv) => ({
      ...inv,
      customer: customers.find((c) => c.id === inv.customer_id),
      items: allLines.filter((l) => l.invoice_id === inv.id),
    }));

    if (filters) {
      if (filters.invoiceNumber) {
        const q = filters.invoiceNumber.trim().toLowerCase();
        invoices = invoices.filter((i) => i.invoice_number.toLowerCase().includes(q));
      }
      if (filters.customerPhone) {
        const q = filters.customerPhone.trim();
        invoices = invoices.filter((i) => i.customer?.phone_e164.includes(q));
      }
      if (filters.paymentMode && filters.paymentMode !== 'ALL') {
        invoices = invoices.filter((i) => i.payment_mode === filters.paymentMode);
      }
      if (filters.date) {
        invoices = invoices.filter((i) => i.finalized_at.startsWith(filters.date!));
      }
    }

    return invoices.sort((a, b) => new Date(b.finalized_at).getTime() - new Date(a.finalized_at).getTime());
  }

  static async getInvoiceDetails(invoiceId: string): Promise<{
    invoice: Invoice;
    items: InvoiceItem[];
    customer?: Customer;
    vouchers: Voucher[];
    gift?: Gift | null;
  } | null> {
    const invoices = getLocalData<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return null;

    const allLines = getLocalData<InvoiceItem[]>(STORAGE_KEYS.INVOICE_ITEMS, []);
    const items = allLines.filter((l) => l.invoice_id === invoiceId);

    const customers = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    const customer = customers.find((c) => c.id === invoice.customer_id);

    const vouchers = getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []).filter(
      (v) => v.source_invoice_id === invoiceId
    );

    const gift = getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []).find(
      (g) => g.source_invoice_id === invoiceId
    );

    return { invoice, items, customer, vouchers, gift };
  }

  static async getCustomers(searchQuery?: string): Promise<Customer[]> {
    const customers = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    if (!searchQuery) return customers;
    const q = searchQuery.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.phone_e164.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.instagram_handle && c.instagram_handle.toLowerCase().includes(q))
    );
  }

  static async getCustomerProfile(customerId: string): Promise<{
    customer: Customer;
    invoices: Invoice[];
    vouchers: Voucher[];
    gifts: Gift[];
    totalSpend: number;
  } | null> {
    const customers = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return null;

    const invoices = (await this.getInvoices()).filter((i) => i.customer_id === customerId);
    const vouchers = getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []).filter((v) => v.customer_id === customerId);
    const gifts = getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []).filter((g) => g.customer_id === customerId);
    const totalSpend = invoices.reduce((sum, i) => sum + (i.status === 'FINALIZED' ? i.grand_total : 0), 0);

    return { customer, invoices, vouchers, gifts, totalSpend };
  }

  // ----------------------------------------------------
  // DASHBOARD STATS (RPT-1)
  // ----------------------------------------------------
  static async getDashboardStats(): Promise<{
    todaySales: number;
    invoiceCount: number;
    itemsSold: number;
    averageBill: number;
    paymentSplit: { Cash: number; UPI: number; Card: number; Other: number };
    vouchersIssued: number;
    giftsPending: number;
    pendingGiftsList: Gift[];
  }> {
    const today = new Date().toISOString().slice(0, 10);
    const invoices = (await this.getInvoices()).filter(
      (i) => i.status === 'FINALIZED' && i.finalized_at.startsWith(today)
    );

    const todaySales = invoices.reduce((sum, i) => sum + i.grand_total, 0);
    const invoiceCount = invoices.length;
    const averageBill = invoiceCount > 0 ? Math.round(todaySales / invoiceCount) : 0;

    let itemsSold = 0;
    invoices.forEach((inv) => {
      inv.items?.forEach((item) => {
        itemsSold += item.quantity;
      });
    });

    const paymentSplit = { Cash: 0, UPI: 0, Card: 0, Other: 0 };
    invoices.forEach((inv) => {
      if (paymentSplit[inv.payment_mode] !== undefined) {
        paymentSplit[inv.payment_mode] += inv.grand_total;
      }
    });

    const allVouchers = getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
    const todayVouchers = allVouchers.filter((v) => v.created_at?.startsWith(today));

    const allGifts = getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []);
    const pendingGifts = allGifts.filter((g) => g.status === 'PENDING_COLLECTION');

    return {
      todaySales,
      invoiceCount,
      itemsSold,
      averageBill,
      paymentSplit,
      vouchersIssued: todayVouchers.length,
      giftsPending: pendingGifts.length,
      pendingGiftsList: pendingGifts,
    };
  }

  // ----------------------------------------------------
  // AUDIT & MESSAGE LOGS (SHR-4)
  // ----------------------------------------------------
  static async logMessage(invoiceId: string, channel: 'WHATSAPP' | 'SMS' | 'COPY', status: 'PREPARED' | 'OPENED' | 'MARKED_SENT'): Promise<void> {
    const logs = getLocalData<any[]>(STORAGE_KEYS.MESSAGE_LOGS, []);
    logs.push({
      id: generateUuid(),
      invoice_id: invoiceId,
      channel,
      status,
      created_at: new Date().toISOString(),
    });
    setLocalData(STORAGE_KEYS.MESSAGE_LOGS, logs);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('message_logs').insert({
          invoice_id: invoiceId,
          channel,
          status,
        });
      } catch (err) {
        console.warn('Supabase logMessage failed, recorded locally:', err);
      }
    }
  }

  // ----------------------------------------------------
  // EXPORT ALL DATA FOR CSV BACKUP (RPT-3)
  // ----------------------------------------------------
  static async getAllDataForExport() {
    return {
      products: await this.getProducts(),
      invoices: getLocalData<Invoice[]>(STORAGE_KEYS.INVOICES, []),
      invoiceItems: getLocalData<InvoiceItem[]>(STORAGE_KEYS.INVOICE_ITEMS, []),
      customers: getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []),
      vouchers: getLocalData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []),
      gifts: getLocalData<Gift[]>(STORAGE_KEYS.GIFTS, []),
      stockMovements: getLocalData<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []),
    };
  }

  // ----------------------------------------------------
  // RESET ALL DATA TO FRESH STATE
  // ----------------------------------------------------
  static async resetAllData(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
      localStorage.removeItem(STORAGE_KEYS.INVOICES);
      localStorage.removeItem(STORAGE_KEYS.INVOICE_ITEMS);
      localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
      localStorage.removeItem(STORAGE_KEYS.VOUCHERS);
      localStorage.removeItem(STORAGE_KEYS.GIFTS);
      localStorage.removeItem(STORAGE_KEYS.STOCK_MOVEMENTS);
      localStorage.removeItem(STORAGE_KEYS.MESSAGE_LOGS);
      localStorage.removeItem('attached_voucher');
      localStorage.removeItem('trendy_saved_cart');
      localStorage.removeItem('trendy_cart_items');
    }
  }
}

