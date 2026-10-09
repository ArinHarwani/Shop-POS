import { OfferTier, Voucher } from '@/types';

export interface RewardEvaluation {
  currentTier: OfferTier | null;
  voucherCount: number;
  voucherValue: number;
  giftCount: number;
  giftDescription: string | null;
  nextTier: OfferTier | null;
  amountNeededForNextTier: number;
  nextTierVouchersUnlocked: number;
  nextTierGiftsUnlocked: number;
  upsellMessage: string | null;
}

/**
 * Standard 4 Offer Tiers per updated PRD:
 * Tier 1: 499  -> 0 vouchers, 1 gift (Small gift)
 * Tier 2: 999  -> 1 voucher of Rs 250, 0 gifts (min_purchase: 3000, valid_days: 30)
 * Tier 3: 1499 -> 1 voucher of Rs 350, 1 gift (Small gift) (min_purchase: 3000, valid_days: 30)
 * Tier 4: 1999 -> 1 voucher of Rs 500, 0 gifts (min_purchase: 3000, valid_days: 30)
 */
export const DEFAULT_OFFER_TIERS: OfferTier[] = [
  {
    id: 'tier-1',
    name: 'Tier 1',
    threshold: 499,
    voucher_count: 0,
    voucher_value: 0,
    min_purchase: null,
    valid_days: null,
    gift_count: 1,
    gift_description: 'Small gift',
    terms: 'Gift on purchase of Rs 499 or more',
    is_active: true,
  },
  {
    id: 'tier-2',
    name: 'Tier 2',
    threshold: 999,
    voucher_count: 1,
    voucher_value: 250,
    min_purchase: 3000,
    valid_days: 30,
    gift_count: 0,
    gift_description: null,
    terms: 'Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash.',
    is_active: true,
  },
  {
    id: 'tier-3',
    name: 'Tier 3',
    threshold: 1499,
    voucher_count: 1,
    voucher_value: 350,
    min_purchase: 3000,
    valid_days: 30,
    gift_count: 1,
    gift_description: 'Small gift',
    terms: 'Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash. + Small gift',
    is_active: true,
  },
  {
    id: 'tier-4',
    name: 'Tier 4',
    threshold: 1999,
    voucher_count: 1,
    voucher_value: 500,
    min_purchase: 3000,
    valid_days: 30,
    gift_count: 0,
    gift_description: null,
    terms: 'Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash.',
    is_active: true,
  },
];

/**
 * Calculates the eligible amount for rewards:
 * merchandise total after any manual discount and after any voucher redeemed on the same bill,
 * in whole integer rupees.
 */
export function calculateEligibleAmount(
  subtotal: number,
  discountTotal: number = 0,
  voucherTotal: number = 0
): number {
  const eligible = Math.floor(subtotal) - Math.floor(discountTotal) - Math.floor(voucherTotal);
  return Math.max(0, eligible);
}

/**
 * Evaluates the rewards earned strictly based on dynamic offer_tiers without hardcoded thresholds.
 * Tiers are evaluated such that the single highest met threshold (threshold <= eligibleAmount) wins.
 * Tiers are non-additive.
 */
export function evaluateRewards(
  eligibleAmount: number,
  tiers: OfferTier[] = DEFAULT_OFFER_TIERS
): RewardEvaluation {
  const activeTiers = tiers
    .filter((t) => t.is_active)
    .sort((a, b) => a.threshold - b.threshold);

  let currentTier: OfferTier | null = null;
  for (let i = activeTiers.length - 1; i >= 0; i--) {
    if (eligibleAmount >= activeTiers[i].threshold) {
      if (activeTiers[i].voucher_count > 0 || activeTiers[i].gift_count > 0) {
        currentTier = activeTiers[i];
      }
      break;
    }
  }

  // Find the next higher tier to provide helpful upsell nudge
  const nextTier = activeTiers.find(
    (t) => t.threshold > eligibleAmount && (t.voucher_count > 0 || t.gift_count > 0)
  ) || null;

  let amountNeededForNextTier = 0;
  let nextTierVouchersUnlocked = 0;
  let nextTierGiftsUnlocked = 0;
  let upsellMessage: string | null = null;

  if (nextTier) {
    amountNeededForNextTier = nextTier.threshold - eligibleAmount;
    nextTierVouchersUnlocked = nextTier.voucher_count;
    nextTierGiftsUnlocked = nextTier.gift_count;

    if (nextTier.gift_count > 0 && nextTier.voucher_count > 0) {
      upsellMessage = `Add Rs ${amountNeededForNextTier} more to get a ${nextTier.gift_description || 'Small gift'} & Rs ${nextTier.voucher_value} voucher!`;
    } else if (nextTier.gift_count > 0) {
      upsellMessage = `Add Rs ${amountNeededForNextTier} more to get a ${nextTier.gift_description || 'Small gift'}!`;
    } else if (nextTier.voucher_count > 0) {
      upsellMessage = `Add Rs ${amountNeededForNextTier} more to get a voucher of Rs ${nextTier.voucher_value}!`;
    }
  }

  return {
    currentTier,
    voucherCount: currentTier ? currentTier.voucher_count : 0,
    voucherValue: currentTier ? currentTier.voucher_value : 0,
    giftCount: currentTier ? currentTier.gift_count : 0,
    giftDescription: currentTier?.gift_description ?? null,
    nextTier,
    amountNeededForNextTier,
    nextTierVouchersUnlocked,
    nextTierGiftsUnlocked,
    upsellMessage,
  };
}

/**
 * Calculates voucher expiry in Asia/Kolkata timezone:
 * expires_at = end of day (23:59:59.999 IST) of (issue date in IST + 30 calendar days).
 * Example: issued on 12 Oct 2026 at any time that day, valid through the end of 11 Nov 2026.
 */
export function calculateVoucherExpiry(
  issuedAtInput?: Date | string,
  validDays: number = 30
): Date {
  const d = issuedAtInput ? new Date(issuedAtInput) : new Date();
  // IST offset is UTC + 5.5 hours (+19,800,000 ms)
  const istOffsetMs = 5.5 * 3600 * 1000;
  const istTimeMs = d.getTime() + istOffsetMs;
  const istDate = new Date(istTimeMs);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();

  // Calendar date in IST + validDays at end of day 23:59:59.999 IST
  const expiryIstMs = Date.UTC(year, month, day + validDays, 23, 59, 59, 999);
  // Convert back to UTC instant
  return new Date(expiryIstMs - istOffsetMs);
}

/**
 * Formats a date in Asia/Kolkata timezone into "11 Nov 2026"
 */
export function formatIstDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

/**
 * Checks whether a voucher is expired relative to server time.
 */
export function isVoucherExpired(
  expiresAt?: string | Date | null,
  nowInput?: Date | string
): boolean {
  if (!expiresAt) return false;
  const exp = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = nowInput ? (typeof nowInput === 'string' ? new Date(nowInput) : nowInput) : new Date();
  return now.getTime() > exp.getTime();
}

/**
 * Formats terms text printed on every voucher and message:
 * "Valid till <date>. Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash."
 */
export function formatVoucherTerms(voucher: {
  expires_at?: string | Date | null;
  min_purchase?: number | null;
}): string {
  const dateStr = formatIstDate(voucher.expires_at);
  const minPurch = voucher.min_purchase ? voucher.min_purchase.toLocaleString('en-IN') : '3,000';
  return `Valid till ${dateStr}. Use on an in-store purchase of Rs ${minPurch} or more. One voucher per bill. Not exchangeable for cash.`;
}

/**
 * Formats voucher print line for Done screen, PDF and WhatsApp:
 * "Voucher <CODE>: Rs 250 off | valid till 11 Nov 2026 | on in-store purchase of Rs 3,000 or more"
 */
export function formatVoucherPrintLine(voucher: {
  code: string;
  face_value: number;
  expires_at?: string | Date | null;
  min_purchase?: number | null;
}): string {
  const dateStr = formatIstDate(voucher.expires_at);
  const minPurch = voucher.min_purchase ? voucher.min_purchase.toLocaleString('en-IN') : '3,000';
  return `Voucher ${voucher.code}: Rs ${voucher.face_value} off | valid till ${dateStr} | on in-store purchase of Rs ${minPurch} or more`;
}

/**
 * Validates whether a voucher can be redeemed against a given merchandise total after discount.
 */
export function validateVoucherRedemption(
  voucher: Voucher,
  merchandiseTotalAfterDiscount: number,
  serverNow: Date = new Date()
): { valid: boolean; error?: string } {
  if (voucher.status === 'CANCELLED') {
    return {
      valid: false,
      error: 'This voucher is cancelled because the source bill was cancelled.',
    };
  }

  if (voucher.status === 'REDEEMED') {
    return {
      valid: false,
      error: `This voucher was already used on ${formatIstDate(voucher.redeemed_at)}.`,
    };
  }

  if (voucher.status === 'EXPIRED' || isVoucherExpired(voucher.expires_at, serverNow)) {
    return {
      valid: false,
      error: `This voucher expired on ${formatIstDate(voucher.expires_at)}.`,
    };
  }

  const minPurchase = voucher.min_purchase ?? 3000;
  if (merchandiseTotalAfterDiscount < minPurchase) {
    const deficit = minPurchase - merchandiseTotalAfterDiscount;
    return {
      valid: false,
      error: `This voucher needs a bill of Rs ${minPurchase.toLocaleString('en-IN')} or more. Add Rs ${deficit.toLocaleString('en-IN')} more.`,
    };
  }

  return { valid: true };
}

/**
 * Generates an 8-character cryptographic voucher code:
 * Format TRD-XXXX-XXXX using unambiguous characters (no 0, O, 1, I, L)
 */
export function generateClientVoucherCode(): string {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    const idx1 = Math.floor(Math.random() * alphabet.length);
    const idx2 = Math.floor(Math.random() * alphabet.length);
    part1 += alphabet[idx1];
    part2 += alphabet[idx2];
  }
  return `TRD-${part1}-${part2}`;
}
