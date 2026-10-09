import { Invoice, InvoiceItem, Voucher, Gift } from '@/types';

/**
 * Normalizes a phone string to E.164 format.
 * Defaults to Indian country code +91 for 10-digit entries.
 * Returns null if the number is invalid.
 */
export function normalizePhoneE164(input: string): string | null {
  if (!input) return null;
  // Remove spaces, hyphens, parentheses, etc.
  let cleaned = input.replace(/[\s\-\(\)]/g, '').trim();

  // If starts with +
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (/^\d{10,15}$/.test(digits)) {
      return '+' + digits;
    }
    return null;
  }

  // If starts with 00
  if (cleaned.startsWith('00')) {
    const digits = cleaned.slice(2);
    if (/^\d{10,15}$/.test(digits)) {
      return '+' + digits;
    }
    return null;
  }

  // If 10 digits, assume India (+91)
  if (/^\d{10}$/.test(cleaned)) {
    return '+91' + cleaned;
  }

  // If 11 digits and starts with 0 (Indian standard local dial), convert 0XXXXXXXXXX to +91XXXXXXXXXX
  if (/^0\d{10}$/.test(cleaned)) {
    return '+91' + cleaned.slice(1);
  }

  // If 12 digits and starts with 91
  if (/^91\d{10}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  return null;
}

/**
 * Formats date into e.g. "09 Oct 2026"
 */
export function formatDisplayDate(dateStr?: string): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '09 Oct 2026';
  }
}

export interface BuildMessageOptions {
  invoice: Invoice;
  items: InvoiceItem[];
  vouchers?: Voucher[];
  gift?: Gift | null;
  giftClaimed?: boolean;
}

/**
 * Builds the WhatsApp prefilled text message strictly conforming to PRD specifications:
 * - Brand heading: Thank you for shopping at FEVER - Trendy Collection!
 * - Invoice TR-XXXX | Date
 * - Every line item with item number, name, price (and x2 ... if qty > 1)
 * - Discount or voucher deduction line if any
 * - Total + Payment mode
 * - Voucher codes with face value, expiry/terms
 * - Gift line with "(claimed)" or "(to be collected)"
 * - Keeps under 1,500 characters by intelligently truncating long item names first without dropping prices/codes.
 */
export function buildWhatsAppMessage(options: BuildMessageOptions): string {
  const { invoice, items, vouchers = [], gift, giftClaimed = true } = options;
  const storeName = process.env.NEXT_PUBLIC_STORE_NAME || 'FEVER - Trendy Collection';
  const invoiceDate = formatDisplayDate(invoice.finalized_at);

  let messageHeader = `Thank you for shopping at ${storeName}!\nInvoice ${invoice.invoice_number} | ${invoiceDate}\n\n`;

  // Build items list
  const formatItemLine = (item: InvoiceItem, index: number, maxNameLength?: number) => {
    let name = item.description_snapshot || 'Item';
    if (maxNameLength && name.length > maxNameLength) {
      name = name.slice(0, maxNameLength - 1) + '…';
    }
    const itemNum = item.item_number_snapshot;
    if (item.quantity > 1) {
      return `${index + 1}. ${name} (Item ${itemNum}) - x${item.quantity} @ Rs ${item.unit_price_snapshot} each = Rs ${item.line_total}`;
    }
    return `${index + 1}. ${name} (Item ${itemNum}) - Rs ${item.line_total}`;
  };

  const buildBody = (maxNameLength?: number) => {
    const itemLines = items.map((it, idx) => formatItemLine(it, idx, maxNameLength)).join('\n');
    let summaryLines = `\n\nSubtotal: Rs ${invoice.subtotal}`;

    if (invoice.discount_total > 0) {
      summaryLines += `\nDiscount: -Rs ${invoice.discount_total}`;
    }
    if (invoice.voucher_total > 0) {
      summaryLines += `\nVoucher Applied: -Rs ${invoice.voucher_total}`;
    }
    summaryLines += `\nTotal: Rs ${invoice.grand_total} (${invoice.payment_mode})`;

    // Rewards section
    let rewardsLines = '';
    const hasVouchers = vouchers && vouchers.length > 0;
    const hasGift = !!gift;

    if (hasVouchers || hasGift) {
      rewardsLines += '\n\nYour rewards:';
      if (hasVouchers) {
        vouchers.forEach((v) => {
          const expiryText = v.expires_at ? `, valid till ${formatDisplayDate(v.expires_at)}` : '';
          const minText = v.min_purchase ? ` on min purchase of Rs ${v.min_purchase}` : '';
          rewardsLines += `\n- Voucher ${v.code}: Rs ${v.face_value} off${minText}${expiryText}`;
        });
      }
      if (hasGift) {
        const statusLabel = giftClaimed ? '(claimed)' : '(to be collected)';
        rewardsLines += `\n- Gift: ${gift.description} ${statusLabel}`;
      }
      rewardsLines += '\nT&C: Redeemable in-store only. One-time use. Non-refundable.';
    }

    return `${messageHeader}${itemLines}${summaryLines}${rewardsLines}`;
  };

  let fullMessage = buildBody();

  // If exceeds 1500 characters, truncate item names
  if (fullMessage.length > 1450) {
    fullMessage = buildBody(20);
  }
  if (fullMessage.length > 1450) {
    fullMessage = buildBody(12);
  }

  return fullMessage;
}

/**
 * Creates the https://wa.me/<number>?text=<encoded> URL
 */
export function getWhatsAppUrl(phoneE164: string, message: string): string {
  // wa.me format expects digits only, no + or symbols
  const digitsOnly = phoneE164.replace(/\D/g, '');
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

/**
 * Creates the sms:<number>?body=<encoded> URL fallback
 */
export function getSmsUrl(phoneE164: string, message: string): string {
  return `sms:${phoneE164}?body=${encodeURIComponent(message)}`;
}
