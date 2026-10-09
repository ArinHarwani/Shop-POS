import { describe, it, expect } from 'vitest';
import { normalizePhoneE164, buildWhatsAppMessage, getWhatsAppUrl } from '../src/lib/whatsapp';
import { Invoice, InvoiceItem, Voucher, Gift } from '../src/types';

describe('WhatsApp Formatting & Normalization Tests', () => {
  it('Normalizes 10-digit Indian numbers with +91 prefix', () => {
    expect(normalizePhoneE164('9876543210')).toBe('+919876543210');
    expect(normalizePhoneE164(' 9876543210 ')).toBe('+919876543210');
    expect(normalizePhoneE164('98765-43210')).toBe('+919876543210');
  });

  it('Normalizes 11-digit number starting with 0 to +91', () => {
    expect(normalizePhoneE164('09876543210')).toBe('+919876543210');
  });

  it('Preserves international number with +', () => {
    expect(normalizePhoneE164('+14155552671')).toBe('+14155552671');
    expect(normalizePhoneE164('+919876543210')).toBe('+919876543210');
  });

  it('Rejects invalid phone numbers', () => {
    expect(normalizePhoneE164('12345')).toBeNull();
    expect(normalizePhoneE164('abcdefghij')).toBeNull();
    expect(normalizePhoneE164('')).toBeNull();
  });

  it('Generates correct WhatsApp URLs ensuring country code +91 is always present', () => {
    const msg = 'Test message';
    const encoded = encodeURIComponent(msg);

    // 10-digit raw number typed by cashier
    expect(getWhatsAppUrl('9876543210', msg)).toBe(`https://wa.me/919876543210?text=${encoded}`);

    // With leading 0 (local trunk dial)
    expect(getWhatsAppUrl('09876543210', msg)).toBe(`https://wa.me/919876543210?text=${encoded}`);

    // With +91
    expect(getWhatsAppUrl('+919876543210', msg)).toBe(`https://wa.me/919876543210?text=${encoded}`);

    // With spaces
    expect(getWhatsAppUrl('98765 43210', msg)).toBe(`https://wa.me/919876543210?text=${encoded}`);

    // With already included 91 prefix without plus
    expect(getWhatsAppUrl('919876543210', msg)).toBe(`https://wa.me/919876543210?text=${encoded}`);

    // International number
    expect(getWhatsAppUrl('+14155552671', msg)).toBe(`https://wa.me/14155552671?text=${encoded}`);

    // Empty or falsy falls back to open chat selector
    expect(getWhatsAppUrl('', msg)).toBe(`https://wa.me/?text=${encoded}`);
  });

  it('Formats items with quantity > 1 according to PRD format', () => {
    const mockInvoice: Invoice = {
      id: 'inv-1',
      invoice_number: 'TR-0123',
      client_request_id: 'req-1',
      customer_id: 'c-1',
      subtotal: 900,
      discount_total: 0,
      voucher_total: 0,
      grand_total: 900,
      payment_mode: 'UPI',
      status: 'FINALIZED',
      finalized_at: '2026-10-12T10:00:00Z',
    };

    const mockItems: InvoiceItem[] = [
      {
        product_id: 'p-1',
        item_number_snapshot: '847291',
        description_snapshot: 'Top',
        quantity: 2,
        unit_price_snapshot: 450,
        line_total: 900,
      },
    ];

    const message = buildWhatsAppMessage({
      invoice: mockInvoice,
      items: mockItems,
    });

    expect(message).toContain('Top (Item 847291) - x2 @ Rs 450 each = Rs 900');
    expect(message).toContain('Total: Rs 900 (UPI)');
  });

  it('Distinguishes claimed vs to be collected gifts', () => {
    const mockInvoice: Invoice = {
      id: 'inv-2',
      invoice_number: 'TR-0124',
      client_request_id: 'req-2',
      customer_id: 'c-1',
      subtotal: 800,
      discount_total: 0,
      voucher_total: 0,
      grand_total: 800,
      payment_mode: 'UPI',
      status: 'FINALIZED',
      finalized_at: '2026-10-12T10:00:00Z',
    };

    const mockGift: Gift = {
      id: 'g-1',
      source_invoice_id: 'inv-2',
      customer_id: 'c-1',
      description: 'Coffee Mug',
      status: 'COLLECTED',
      created_at: '2026-10-12T10:00:00Z',
    };

    const msgClaimed = buildWhatsAppMessage({
      invoice: mockInvoice,
      items: [],
      gift: mockGift,
      giftClaimed: true,
    });
    expect(msgClaimed).toContain('- Gift: Coffee Mug (claimed)');

    const msgPending = buildWhatsAppMessage({
      invoice: mockInvoice,
      items: [],
      gift: mockGift,
      giftClaimed: false,
    });
    expect(msgPending).toContain('- Gift: Coffee Mug (to be collected)');
  });
});
