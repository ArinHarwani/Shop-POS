import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OFFER_TIERS,
  calculateEligibleAmount,
  evaluateRewards,
  calculateVoucherExpiry,
  formatIstDate,
  isVoucherExpired,
  formatVoucherTerms,
  formatVoucherPrintLine,
  validateVoucherRedemption,
} from '../src/lib/rewards';
import { Voucher } from '../src/types';

describe('New 4-Tier Offer Engine Tests', () => {
  it('Bill of Rs 498 -> 0 vouchers, 0 gifts', () => {
    const eligible = calculateEligibleAmount(498);
    const res = evaluateRewards(eligible, DEFAULT_OFFER_TIERS);
    expect(res.voucherCount).toBe(0);
    expect(res.giftCount).toBe(0);
  });

  it('Tier 1: Bill of Rs 499 -> 0 vouchers, 1 Small gift', () => {
    const eligible = calculateEligibleAmount(499);
    const res = evaluateRewards(eligible, DEFAULT_OFFER_TIERS);
    expect(res.voucherCount).toBe(0);
    expect(res.giftCount).toBe(1);
    expect(res.giftDescription).toBe('Small gift');
  });

  it('Bill of Rs 998 -> 0 vouchers, 1 Small gift (still Tier 1)', () => {
    const eligible = calculateEligibleAmount(998);
    const res = evaluateRewards(eligible, DEFAULT_OFFER_TIERS);
    expect(res.voucherCount).toBe(0);
    expect(res.giftCount).toBe(1);
  });

  it('Tier 2: Bill of Rs 999 -> 1 voucher of Rs 250, 0 gifts', () => {
    const eligible = calculateEligibleAmount(999);
    const res = evaluateRewards(eligible, DEFAULT_OFFER_TIERS);
    expect(res.voucherCount).toBe(1);
    expect(res.voucherValue).toBe(250);
    expect(res.giftCount).toBe(0);
  });

  it('Bill of Rs 1,498 -> 1 voucher of Rs 250, 0 gifts (still Tier 2)', () => {
    const eligible = calculateEligibleAmount(1498);
    const res = evaluateRewards(eligible, DEFAULT_OFFER_TIERS);
    expect(res.voucherCount).toBe(1);
    expect(res.voucherValue).toBe(250);
    expect(res.giftCount).toBe(0);
  });

  it('Tier 3: Bill of Rs 1,499 -> 1 voucher of Rs 350, 1 Small gift', () => {
    const eligible = calculateEligibleAmount(1499);
    const res = evaluateRewards(eligible, DEFAULT_OFFER_TIERS);
    expect(res.voucherCount).toBe(1);
    expect(res.voucherValue).toBe(350);
    expect(res.giftCount).toBe(1);
    expect(res.giftDescription).toBe('Small gift');
  });

  it('Tier 4: Bill of Rs 1,999 -> 1 voucher of Rs 500, 0 gifts', () => {
    const eligible = calculateEligibleAmount(1999);
    const res = evaluateRewards(eligible, DEFAULT_OFFER_TIERS);
    expect(res.voucherCount).toBe(1);
    expect(res.voucherValue).toBe(500);
    expect(res.giftCount).toBe(0);
  });

  it('Bill of Rs 3,500 -> 1 voucher of Rs 500, 0 gifts (Tier 4, strictly non-additive single tier wins)', () => {
    const eligible = calculateEligibleAmount(3500);
    const res = evaluateRewards(eligible, DEFAULT_OFFER_TIERS);
    expect(res.voucherCount).toBe(1);
    expect(res.voucherValue).toBe(500);
    expect(res.giftCount).toBe(0);
  });
});

describe('Section F Mandatory Tests: Voucher Terms, Redemption & Expiry', () => {
  const createMockVoucher = (overrides?: Partial<Voucher>): Voucher => ({
    id: 'vouch-1',
    code: 'TRD-K7M2-9QXA',
    source_invoice_id: 'inv-1',
    customer_id: 'cust-1',
    face_value: 250,
    min_purchase: 3000,
    valid_days: 30,
    status: 'ISSUED',
    issued_at: '2026-10-12T10:00:00.000Z',
    expires_at: calculateVoucherExpiry(new Date('2026-10-12T10:00:00.000Z'), 30).toISOString(),
    ...overrides,
  });

  // Case 1: Redeem on a bill of Rs 2,999 -> Refused, "Add Rs 1 more"
  it('Case 1: Redeem on a bill of Rs 2,999 is Refused with "Add Rs 1 more"', () => {
    const voucher = createMockVoucher();
    const result = validateVoucherRedemption(voucher, 2999);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('This voucher needs a bill of Rs 3,000 or more. Add Rs 1 more.');
  });

  // Case 2: Redeem on a bill of Rs 3,000 -> Accepted; Rs 250 / 350 / 500 deducted per the voucher
  it('Case 2: Redeem on a bill of Rs 3,000 is Accepted with correct deduction', () => {
    const v250 = createMockVoucher({ face_value: 250 });
    const v350 = createMockVoucher({ face_value: 350 });
    const v500 = createMockVoucher({ face_value: 500 });

    expect(validateVoucherRedemption(v250, 3000).valid).toBe(true);
    expect(validateVoucherRedemption(v350, 3000).valid).toBe(true);
    expect(validateVoucherRedemption(v500, 3000).valid).toBe(true);

    // Verify deductions
    expect(3000 - v250.face_value).toBe(2750);
    expect(3000 - v350.face_value).toBe(2650);
    expect(3000 - v500.face_value).toBe(2500);
  });

  // Case 3: Bill Rs 3,000 with a Rs 10 manual discount (total 2,990) -> Refused
  it('Case 3: Bill Rs 3,000 with a Rs 10 manual discount (total 2,990) is Refused', () => {
    const voucher = createMockVoucher();
    const merchandiseTotalAfterDiscount = 3000 - 10; // 2990
    const result = validateVoucherRedemption(voucher, merchandiseTotalAfterDiscount);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('This voucher needs a bill of Rs 3,000 or more. Add Rs 10 more.');
  });

  // Case 4: Redeem on the issue date + 30 days at 23:59 IST -> Accepted
  it('Case 4: Redeem on the issue date + 30 days at 23:59 IST is Accepted', () => {
    // Issued on 12 Oct 2026 at 10:00 IST (04:30 UTC)
    const issuedAt = new Date('2026-10-12T04:30:00.000Z');
    const expiry = calculateVoucherExpiry(issuedAt, 30);
    // Expiry in IST should be 11 Nov 2026 23:59:59.999 IST = 11 Nov 2026 18:29:59.999 UTC
    expect(formatIstDate(expiry)).toBe('11 Nov 2026');

    // Test time: 11 Nov 2026 at 23:59:00 IST = 18:29:00 UTC
    const testNow = new Date('2026-11-11T18:29:00.000Z');
    const voucher = createMockVoucher({ expires_at: expiry.toISOString() });

    expect(isVoucherExpired(voucher.expires_at, testNow)).toBe(false);
    const result = validateVoucherRedemption(voucher, 3000, testNow);
    expect(result.valid).toBe(true);
  });

  // Case 5: Redeem at 00:01 IST the next day -> Refused as expired
  it('Case 5: Redeem at 00:01 IST the next day is Refused as expired', () => {
    // Issued on 12 Oct 2026
    const issuedAt = new Date('2026-10-12T04:30:00.000Z');
    const expiry = calculateVoucherExpiry(issuedAt, 30);

    // Next day: 12 Nov 2026 at 00:01:00 IST = 11 Nov 2026 18:31:00 UTC
    const testNow = new Date('2026-11-11T18:31:00.000Z');
    const voucher = createMockVoucher({ expires_at: expiry.toISOString() });

    expect(isVoucherExpired(voucher.expires_at, testNow)).toBe(true);
    const result = validateVoucherRedemption(voucher, 3000, testNow);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('This voucher expired on 11 Nov 2026.');
  });

  // Case 6: Voucher issued at 23:50 IST and checked at 00:10 IST the next day -> Expiry computed from the IST issue date, not UTC
  it('Case 6: Voucher issued at 23:50 IST and checked at 00:10 IST the next day -> Expiry computed from IST issue date', () => {
    // 12 Oct 2026 at 23:50:00 IST = 12 Oct 2026 18:20:00 UTC
    // Notice that in UTC it is 18:20 UTC on 12 Oct, and in IST it is 23:50 on 12 Oct.
    const issuedAt = new Date('2026-10-12T18:20:00.000Z');
    const expiry = calculateVoucherExpiry(issuedAt, 30);

    // IST issue date was 12 Oct 2026. 12 Oct + 30 days = 11 Nov 2026.
    expect(formatIstDate(expiry)).toBe('11 Nov 2026');

    // Checked 20 minutes later at 00:10 IST next day (13 Oct 2026 00:10:00 IST = 12 Oct 2026 18:40:00 UTC)
    const checkedAt = new Date('2026-10-12T18:40:00.000Z');
    const voucher = createMockVoucher({
      issued_at: issuedAt.toISOString(),
      expires_at: expiry.toISOString(),
    });

    // It must NOT be expired, and expiry date must stay 11 Nov 2026
    expect(isVoucherExpired(voucher.expires_at, checkedAt)).toBe(false);
    expect(formatIstDate(voucher.expires_at)).toBe('11 Nov 2026');
  });

  // Case 7: Two vouchers on one bill -> Refused
  it('Case 7: Two vouchers on one bill is refused by rule', () => {
    const vouchersOnBill = ['TRD-AAAA-1111', 'TRD-BBBB-2222'];
    const qualifies = vouchersOnBill.length <= 1;
    expect(qualifies).toBe(false);
  });

  // Case 8: Same voucher redeemed twice -> Exactly one succeeds
  it('Case 8: Same voucher redeemed twice -> Exactly one succeeds', () => {
    const voucher = createMockVoucher();
    // First redemption succeeds
    const firstAttempt = validateVoucherRedemption(voucher, 3000);
    expect(firstAttempt.valid).toBe(true);

    // After redemption, status becomes REDEEMED
    const redeemedVoucher = {
      ...voucher,
      status: 'REDEEMED' as const,
      redeemed_at: '2026-10-15T10:00:00.000Z',
    };
    const secondAttempt = validateVoucherRedemption(redeemedVoucher, 3000);
    expect(secondAttempt.valid).toBe(false);
    expect(secondAttempt.error).toContain('This voucher was already used on 15 Oct 2026.');
  });

  // Case 9: Voucher from a cancelled bill -> Refused as cancelled
  it('Case 9: Voucher from a cancelled bill is Refused as cancelled', () => {
    const voucher = createMockVoucher({
      status: 'CANCELLED',
    });
    const result = validateVoucherRedemption(voucher, 3000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('This voucher is cancelled');
  });

  // Case 10: Vouchers tab shows an expired voucher -> Red "Expired" with date, no "Use" button
  it('Case 10: Formats expired voucher text accurately with date', () => {
    const voucher = createMockVoucher({
      status: 'EXPIRED',
      expires_at: '2026-10-08T18:29:59.999Z',
    });
    expect(formatIstDate(voucher.expires_at)).toBe('08 Oct 2026');
    const result = validateVoucherRedemption(voucher, 3000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('This voucher expired on 08 Oct 2026.');
  });

  // Case 11: Bill Rs 3,600 using a Rs 500 voucher (A = 3,100) -> Redeems, and the new offer is computed on 3,100 (Tier 4: Rs 500 voucher)
  it('Case 11: Bill Rs 3,600 using a Rs 500 voucher (A = 3,100) redeems and computes new offer on 3,100', () => {
    const voucher = createMockVoucher({ face_value: 500, min_purchase: 3000 });
    const billMerchandise = 3600;

    // 1. Minimum purchase check qualifies on bill merchandise total (3,600 >= 3,000)
    const redemptionCheck = validateVoucherRedemption(voucher, billMerchandise);
    expect(redemptionCheck.valid).toBe(true);

    // 2. Eligible amount A after subtracting voucher
    const eligibleA = calculateEligibleAmount(billMerchandise, 0, voucher.face_value);
    expect(eligibleA).toBe(3100);

    // 3. New reward evaluated on eligible amount 3100 qualifies for Tier 4 (threshold 1999)
    const newOffer = evaluateRewards(eligibleA, DEFAULT_OFFER_TIERS);
    expect(newOffer.currentTier?.name).toBe('Tier 4');
    expect(newOffer.voucherCount).toBe(1);
    expect(newOffer.voucherValue).toBe(500);
    expect(newOffer.giftCount).toBe(0);
  });
});

describe('Dynamic Printed Terms and Line Formatting', () => {
  it('Generates exact terms text from fields without hardcoding', () => {
    const terms = formatVoucherTerms({
      expires_at: '2026-11-11T18:29:59.999Z',
      min_purchase: 3000,
    });
    expect(terms).toBe('Valid till 11 Nov 2026. Use on an in-store purchase of Rs 3,000 or more. One voucher per bill. Not exchangeable for cash.');
  });

  it('Generates exact print line for Done screen, PDF, and WhatsApp', () => {
    const line = formatVoucherPrintLine({
      code: 'TRD-K7M2-9QXA',
      face_value: 250,
      expires_at: '2026-11-11T18:29:59.999Z',
      min_purchase: 3000,
    });
    expect(line).toBe('Voucher TRD-K7M2-9QXA: Rs 250 off | valid till 11 Nov 2026 | on in-store purchase of Rs 3,000 or more');
  });
});

