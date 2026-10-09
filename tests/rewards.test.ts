import { describe, it, expect } from 'vitest';
import { calculateEligibleAmount, evaluateRewards } from '../src/lib/rewards';
import { OfferTier } from '../src/types';

const testTiers: OfferTier[] = [
  {
    id: 't-0',
    name: 'Tier 0',
    threshold: 0,
    voucher_count: 0,
    voucher_value: 300,
    gift_count: 0,
    is_active: true,
  },
  {
    id: 't-1',
    name: 'Tier 1',
    threshold: 500,
    voucher_count: 1,
    voucher_value: 300,
    gift_count: 0,
    is_active: true,
  },
  {
    id: 't-2',
    name: 'Tier 2',
    threshold: 800,
    voucher_count: 1,
    voucher_value: 300,
    gift_count: 1,
    gift_description: 'Gift Item',
    is_active: true,
  },
  {
    id: 't-3',
    name: 'Tier 3',
    threshold: 1300,
    voucher_count: 2,
    voucher_value: 300,
    gift_count: 1,
    gift_description: 'Gift Item',
    is_active: true,
  },
];

describe('Reward Engine Acceptance Tests (PRD Edge Cases)', () => {
  it('Bill of Rs 499 -> 0 vouchers, 0 gifts', () => {
    const eligible = calculateEligibleAmount(499);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(0);
    expect(res.giftCount).toBe(0);
  });

  it('Bill of Rs 500 -> 1 voucher, 0 gifts', () => {
    const eligible = calculateEligibleAmount(500);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(1);
    expect(res.giftCount).toBe(0);
  });

  it('Bill of Rs 799 -> 1 voucher, 0 gifts', () => {
    const eligible = calculateEligibleAmount(799);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(1);
    expect(res.giftCount).toBe(0);
  });

  it('Bill of Rs 800 -> 1 voucher, 1 gift', () => {
    const eligible = calculateEligibleAmount(800);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(1);
    expect(res.giftCount).toBe(1);
  });

  it('Bill of Rs 1,299 -> 1 voucher, 1 gift', () => {
    const eligible = calculateEligibleAmount(1299);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(1);
    expect(res.giftCount).toBe(1);
  });

  it('Bill of Rs 1,300 -> 2 vouchers, 1 gift (non-additive)', () => {
    const eligible = calculateEligibleAmount(1300);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(2);
    expect(res.giftCount).toBe(1);
  });

  it('Bill of Rs 1,350 -> 2 vouchers, 1 gift', () => {
    const eligible = calculateEligibleAmount(1350);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(2);
    expect(res.giftCount).toBe(1);
  });

  it('Rs 900 with a Rs 300 voucher redeemed (eligible Rs 600) -> 1 voucher, 0 gifts', () => {
    const eligible = calculateEligibleAmount(900, 0, 300);
    expect(eligible).toBe(600);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(1);
    expect(res.giftCount).toBe(0);
  });

  it('Discount drops a Rs 520 bill to Rs 480 -> 0 vouchers', () => {
    const eligible = calculateEligibleAmount(520, 40, 0);
    expect(eligible).toBe(480);
    const res = evaluateRewards(eligible, testTiers);
    expect(res.voucherCount).toBe(0);
    expect(res.giftCount).toBe(0);
  });

  it('Upsell messages calculate the correct shortfall for next tier', () => {
    // At Rs 680, next tier is 800 (difference 120)
    const eligible = 680;
    const res = evaluateRewards(eligible, testTiers);
    expect(res.amountNeededForNextTier).toBe(120);
    expect(res.upsellMessage).toContain('120');
  });
});
