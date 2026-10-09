import { OfferTier } from '@/types';

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
  tiers: OfferTier[]
): RewardEvaluation {
  const activeTiers = tiers
    .filter((t) => t.is_active)
    .sort((a, b) => a.threshold - b.threshold);

  let currentTier: OfferTier | null = null;
  for (let i = activeTiers.length - 1; i >= 0; i--) {
    if (eligibleAmount >= activeTiers[i].threshold) {
      // Only treat as a reward tier if it actually grants vouchers or gifts
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

    const currentGifts = currentTier?.gift_count || 0;
    const currentVouchers = currentTier?.voucher_count || 0;

    if (nextTierGiftsUnlocked > currentGifts && nextTierVouchersUnlocked > currentVouchers) {
      upsellMessage = `Add Rs ${amountNeededForNextTier} more to unlock a surprise gift & extra voucher!`;
    } else if (nextTierGiftsUnlocked > currentGifts) {
      upsellMessage = `Add Rs ${amountNeededForNextTier} more to unlock an exclusive gift!`;
    } else if (nextTierVouchersUnlocked > currentVouchers) {
      upsellMessage = `Add Rs ${amountNeededForNextTier} more to unlock another Rs ${nextTier.voucher_value} voucher!`;
    } else {
      upsellMessage = `Add Rs ${amountNeededForNextTier} more to reach ${nextTier.name}!`;
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
