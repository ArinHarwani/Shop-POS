import { describe, it, expect, beforeEach } from 'vitest';
import { DataService } from '../src/lib/data-service';
import { setActiveRole } from '../src/lib/storage';

// Setup basic localStorage mock for Node test environment
const mockStorage: Record<string, string> = {};
if (typeof window === 'undefined') {
  (global as any).window = {};
  (global as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = val;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    },
  };
}

describe('Finalize Bill & Vouchers Integration Tests', () => {
  beforeEach(async () => {
    (global as any).localStorage.clear();
    setActiveRole('owner');
    // Initialize products
    await DataService.getProducts();
  });

  it('Finalizes bill successfully, decrements stock, issues vouchers and sequential TR-0001 invoice', async () => {
    const products = await DataService.getProducts();
    const item1 = products[0]; // e.g. 450 rs, qty 12
    const initialQty = item1.quantity_on_hand;

    // Buy 3 items = 1350 rs -> Qualifies for Tier 2 (999 threshold: 1 voucher of Rs 250, 0 gifts)
    const result = await DataService.finalizeBill({
      client_request_id: 'req-test-1',
      customer_phone: '+919876543210',
      customer_name: 'Priya Sharma',
      marketing_consent: true,
      payment_mode: 'UPI',
      discount_amount: 0,
      gift_handed_over: true,
      items: [
        { product_id: item1.id, quantity: 3 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.invoice_number).toBe('TR-0001');
    expect(result.subtotal).toBe(1350);
    expect(result.grand_total).toBe(1350);
    expect(result.vouchers.length).toBe(1);
    expect(result.vouchers[0].face_value).toBe(250);
    expect(result.gift).toBeNull();

    // Verify stock was decremented
    const updatedProducts = await DataService.getProducts();
    const updatedItem1 = updatedProducts.find((p) => p.id === item1.id);
    expect(updatedItem1?.quantity_on_hand).toBe(initialQty - 3);
  });

  it('Enforces idempotency: identical client_request_id returns original bill without issuing duplicate vouchers or decrementing stock twice', async () => {
    const products = await DataService.getProducts();
    const item = products[0];
    const initialQty = item.quantity_on_hand;

    const payload = {
      client_request_id: 'idempotent-key-100',
      customer_phone: '+919876543210',
      customer_name: 'Ananya Verma',
      marketing_consent: false,
      payment_mode: 'Cash' as const,
      discount_amount: 0,
      gift_handed_over: true,
      items: [{ product_id: item.id, quantity: 1 }],
    };

    // First submit
    const res1 = await DataService.finalizeBill(payload);
    expect(res1.is_duplicate).toBeFalsy();

    // Check stock decremented by 1
    const stockAfter1 = (await DataService.getProducts()).find((p) => p.id === item.id)?.quantity_on_hand;
    expect(stockAfter1).toBe(initialQty - 1);

    // Second submit (Double tap / retry)
    const res2 = await DataService.finalizeBill(payload);
    expect(res2.is_duplicate).toBe(true);
    expect(res2.invoice_number).toBe(res1.invoice_number);

    // Stock should NOT decrement again
    const stockAfter2 = (await DataService.getProducts()).find((p) => p.id === item.id)?.quantity_on_hand;
    expect(stockAfter2).toBe(stockAfter1);
  });

  it('Rejects finalize if requested quantity exceeds stock on hand', async () => {
    const products = await DataService.getProducts();
    const item = products[0];

    await expect(
      DataService.finalizeBill({
        client_request_id: 'out-of-stock-attempt',
        customer_phone: '+919876543210',
        marketing_consent: false,
        payment_mode: 'Cash',
        discount_amount: 0,
        gift_handed_over: false,
        items: [{ product_id: item.id, quantity: item.quantity_on_hand + 5 }],
      })
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('Voucher can be redeemed once, and second attempt is refused with a clear message', async () => {
    // 1. Bill to earn a voucher (Rs 1350 = Tier 2: 1 voucher of Rs 250)
    const products = await DataService.getProducts();
    const item = products[0]; // 450 rs * 3 = 1350
    const bill = await DataService.finalizeBill({
      client_request_id: 'req-voucher-gen',
      customer_phone: '+919876543210',
      marketing_consent: false,
      payment_mode: 'UPI',
      discount_amount: 0,
      gift_handed_over: true,
      items: [{ product_id: item.id, quantity: 3 }],
    });

    const code = bill.vouchers[0].code;
    expect(code).toBeDefined();

    // Lookup voucher
    const lookup = await DataService.lookupVoucher(code);
    expect(lookup).toBeDefined();
    expect(lookup?.voucher.status).toBe('ISSUED');

    // Redeem first time
    const redeemed = await DataService.redeemVoucher(code);
    expect(redeemed.status).toBe('REDEEMED');

    // Attempt second redemption
    await expect(DataService.redeemVoucher(code)).rejects.toThrow(/already used/);
  });

  it('Owner cancel restores stock and cancels unredeemed vouchers', async () => {
    const products = await DataService.getProducts();
    const item = products[0];
    const initialQty = item.quantity_on_hand;

    const bill = await DataService.finalizeBill({
      client_request_id: 'req-to-cancel',
      customer_phone: '+919999999999',
      marketing_consent: false,
      payment_mode: 'Card',
      discount_amount: 0,
      gift_handed_over: false,
      items: [{ product_id: item.id, quantity: 3 }],
    });

    expect((await DataService.getProducts()).find((p) => p.id === item.id)?.quantity_on_hand).toBe(initialQty - 3);

    // Cancel bill as owner
    await DataService.cancelInvoice(bill.invoice_id, 'Customer requested return');

    // Verify stock restored
    expect((await DataService.getProducts()).find((p) => p.id === item.id)?.quantity_on_hand).toBe(initialQty);

    // Verify voucher is cancelled
    const lookup = await DataService.lookupVoucher(bill.vouchers[0].code);
    expect(lookup?.voucher.status).toBe('CANCELLED');

    // Attempt to redeem cancelled voucher should fail
    await expect(DataService.redeemVoucher(bill.vouchers[0].code)).rejects.toThrow(/cancelled/);
  });
});
