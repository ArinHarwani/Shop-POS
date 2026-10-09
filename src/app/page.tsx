'use client';

import React, { useState, useRef, useEffect } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { FIXTURE_PRODUCTS, FixtureProduct, FixtureBillItem } from '@/lib/fixtures';
import { calculateEligibleAmount, evaluateRewards } from '@/lib/rewards';
import { Button } from '@/components/ui/Button';
import { TextField, NumberField } from '@/components/ui/TextField';
import { ItemRow } from '@/components/ui/ItemRow';
import { TotalBar } from '@/components/ui/TotalBar';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { buildWhatsAppMessage, getWhatsAppUrl, getSmsUrl } from '@/lib/whatsapp';
import { downloadInvoicePdf } from '@/lib/pdf';
import { downloadVoucherPng } from '@/lib/voucher-canvas';
import { getSavedCart, saveCart, clearSavedCart } from '@/lib/storage';

export default function SellPage() {
  // Step in the billing flow: 'cart' | 'payment' | 'done'
  const [step, setStep] = useState<'cart' | 'payment' | 'done'>('cart');

  // Cart state
  const [cart, setCart] = useState<FixtureBillItem[]>([]);
  const [itemInput, setItemInput] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);

  // Customer & Payment state
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Other'>('UPI');
  const [giftHandedOver, setGiftHandedOver] = useState(true);

  // Confirmation sheet
  const [showConfirm, setShowConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Completed sale summary
  const [completedSale, setCompletedSale] = useState<{
    billNumber: string;
    total: number;
    paymentMode: string;
    vouchers: { code: string; face_value: number }[];
    gift: string | null;
    giftClaimed: boolean;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // Load saved cart from localStorage on mount (never lose work)
  useEffect(() => {
    const saved = getSavedCart();
    if (saved && saved.length > 0) {
      setCart(
        saved.map((item) => ({
          product: {
            id: item.product.id,
            item_number: item.product.item_number,
            name: item.product.name,
            category: item.product.category,
            size: item.product.size,
            color: item.product.color,
            price: item.product.price,
            quantity_on_hand: item.product.quantity_on_hand,
          },
          quantity: item.quantity,
        }))
      );
    } else {
      // Seed with 2 fixture items if empty so user immediately sees a clean bill preview
      setCart([
        { product: FIXTURE_PRODUCTS[0], quantity: 1 }, // 450
        { product: FIXTURE_PRODUCTS[1], quantity: 1 }, // 400 = 850 total
      ]);
    }

    // Auto focus item input
    setTimeout(() => {
      itemInputRef.current?.focus();
    }, 100);
  }, []);

  // Save cart changes
  useEffect(() => {
    if (cart.length > 0) {
      saveCart(
        cart.map((c) => ({
          product: {
            ...c.product,
            is_active: true,
          },
          quantity: c.quantity,
        }))
      );
    }
  }, [cart]);

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const eligibleAmount = calculateEligibleAmount(subtotal, 0, 0);

  // Dynamic reward evaluation using standard PRD tiers (500, 800, 1300)
  const defaultTiers = [
    { id: 't0', name: 'Standard', threshold: 0, voucher_count: 0, voucher_value: 300, gift_count: 0, is_active: true },
    { id: 't1', name: 'Silver', threshold: 500, voucher_count: 1, voucher_value: 300, gift_count: 0, min_purchase: 3000, is_active: true },
    { id: 't2', name: 'Gold', threshold: 800, voucher_count: 1, voucher_value: 300, gift_count: 1, gift_description: 'Trendy Collection Gift', min_purchase: 3000, is_active: true },
    { id: 't3', name: 'Platinum', threshold: 1300, voucher_count: 2, voucher_value: 300, gift_count: 1, gift_description: 'Trendy Collection Gift', min_purchase: 3000, is_active: true },
  ];
  const rewardEval = evaluateRewards(eligibleAmount, defaultTiers);

  // Add Item to Bill
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setItemError(null);
    const query = itemInput.trim().toLowerCase();
    if (!query) return;

    const found = FIXTURE_PRODUCTS.find((p) => p.item_number.toLowerCase() === query);
    if (!found) {
      setItemError(STRINGS.itemNotFoundError);
      return;
    }

    if (found.quantity_on_hand <= 0) {
      setItemError(STRINGS.itemSoldOutError);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === found.id);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product: found, quantity: 1 }];
    });

    setItemInput('');
    itemInputRef.current?.focus();
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearBill = () => {
    setCart([]);
    clearSavedCart();
    setShowClearConfirm(false);
    itemInputRef.current?.focus();
  };

  // Step 1 -> Step 2
  const handleNextToPayment = () => {
    if (cart.length === 0) {
      setItemError('Add at least one item to proceed.');
      return;
    }
    setStep('payment');
  };

  // Step 2 -> Confirmation
  const handleValidateBeforeConfirm = () => {
    setPhoneError(null);
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setPhoneError(STRINGS.phoneErrorReq);
      return;
    }
    setShowConfirm(true);
  };

  // Execute Sale Completion
  const handleCompleteSale = () => {
    setShowConfirm(false);

    // Build completed sale summary
    const newBillNumber = `TR-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const generatedVouchers: { code: string; face_value: number }[] = [];
    if (rewardEval.voucherCount > 0) {
      for (let i = 0; i < rewardEval.voucherCount; i++) {
        const randCode = 'TRD-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        generatedVouchers.push({ code: randCode, face_value: 300 });
      }
    }

    setCompletedSale({
      billNumber: newBillNumber,
      total: subtotal,
      paymentMode,
      vouchers: generatedVouchers,
      gift: rewardEval.giftCount > 0 ? (rewardEval.giftDescription || 'Trendy Collection Gift') : null,
      giftClaimed: giftHandedOver,
    });

    clearSavedCart();
    setStep('done');
  };

  const handleStartNewSale = () => {
    setCart([]);
    setPhone('');
    setCustomerName('');
    setInstagramId('');
    setMarketingConsent(false);
    setCompletedSale(null);
    setStep('cart');
    setTimeout(() => {
      itemInputRef.current?.focus();
    }, 100);
  };

  // Helper text for reward line
  let rewardLineText = '';
  if (rewardEval.voucherCount > 0 && rewardEval.giftCount > 0) {
    rewardLineText = `${rewardEval.voucherCount} vouchers + 1 gift earned`;
  } else if (rewardEval.voucherCount > 0) {
    rewardLineText = `${formatRupees(rewardEval.currentTier?.threshold || 500)} reached: ${rewardEval.voucherCount} voucher of Rs 300`;
  }

  if (rewardEval.amountNeededForNextTier > 0) {
    if (rewardLineText) {
      rewardLineText += ` • Add ${formatRupees(rewardEval.amountNeededForNextTier)} more to get a gift`;
    } else {
      rewardLineText = `Add ${formatRupees(rewardEval.amountNeededForNextTier)} more to get a voucher of Rs 300`;
    }
  }

  return (
    <div className="w-full flex-1 flex justify-center bg-white min-w-0 overflow-x-hidden">
      {/* Centred column no wider than 520px as instructed */}
      <div className="w-full max-w-[520px] flex flex-col min-h-[calc(100vh-64px)] px-3 sm:px-4 py-4 sm:py-6 min-w-0">
        {/* ========================================================= */}
        {/* VIEW 1: SELL (CART)                                       */}
        {/* ========================================================= */}
        {step === 'cart' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              {/* Header with Clear bill */}
              <div className="flex items-center justify-between pb-2 border-b border-[#E6E6E6]">
                <h1 className="text-[20px] font-bold text-[#1A1A1A]">{STRINGS.navSell}</h1>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="text-[15px] font-medium text-[#6B6B6B] hover:text-[#B91C1C]"
                  >
                    {STRINGS.clearBillBtn}
                  </button>
                )}
              </div>

              {/* Large Item Number Box + Add Button */}
              <form onSubmit={handleAddItem} className="flex gap-2 items-start w-full">
                <div className="flex-1 min-w-0">
                  <NumberField
                    ref={itemInputRef}
                    value={itemInput}
                    onChange={(e) => {
                      setItemInput(e.target.value);
                      setItemError(null);
                    }}
                    placeholder={STRINGS.itemNumberPlaceholder}
                    error={itemError}
                    autoFocus
                  />
                </div>
                <Button type="submit" variant="primary" className="shrink-0 px-5">
                  {STRINGS.addItemBtn}
                </Button>
              </form>

              {/* Bill List: One row per item */}
              <div className="flex flex-col w-full">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-[#6B6B6B] text-[17px]">
                    {STRINGS.emptyBillPrompt}
                  </div>
                ) : (
                  cart.map(({ product, quantity }) => (
                    <ItemRow
                      key={product.id}
                      itemNumber={product.item_number}
                      name={product.name}
                      price={product.price}
                      quantity={quantity}
                      onIncrement={() => handleUpdateQty(product.id, 1)}
                      onDecrement={() => handleUpdateQty(product.id, -1)}
                      onRemove={() => handleRemoveItem(product.id)}
                    />
                  ))
                )}
              </div>

              {/* Thin Reward Line in light grey panel (#F6F6F4) */}
              {cart.length > 0 && rewardLineText && (
                <div className="bg-[#F6F6F4] p-3 rounded-[8px] border border-[#E6E6E6] text-[15px] text-[#1A1A1A] leading-snug break-words">
                  <span className="font-medium">{rewardLineText}</span>
                </div>
              )}
            </div>

            {/* Sticky Bottom Area: Total Rs 1,350 + Full Width "Next" */}
            <TotalBar
              total={subtotal}
              actionText={STRINGS.nextBtn}
              onAction={handleNextToPayment}
              disabled={cart.length === 0}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: CUSTOMER AND PAYMENT                              */}
        {/* ========================================================= */}
        {step === 'payment' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#E6E6E6]">
                <h1 className="text-[20px] font-bold text-[#1A1A1A]">
                  {STRINGS.customerPaymentTitle}
                </h1>
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="text-[15px] font-medium text-[#6B6B6B] hover:text-[#1A1A1A]"
                >
                  {STRINGS.backBtn}
                </button>
              </div>

              {/* WhatsApp Number (Required) */}
              <NumberField
                label={STRINGS.phoneLabel}
                placeholder={STRINGS.phonePlaceholder}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(null);
                }}
                error={phoneError}
              />

              {/* Name (Optional) */}
              <TextField
                label={STRINGS.nameLabel}
                placeholder={STRINGS.namePlaceholder}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />

              {/* Instagram Handle (Optional) */}
              <TextField
                label={STRINGS.instagramLabel}
                placeholder={STRINGS.instagramPlaceholder}
                value={instagramId}
                onChange={(e) => setInstagramId(e.target.value.replace(/^@/, ''))}
              />

              {/* Marketing Consent (Separate unticked checkbox) */}
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="w-5 h-5 rounded-[4px] border-[#E6E6E6] text-[var(--accent)]"
                />
                <span className="text-[15px] text-[#1A1A1A]">
                  {STRINGS.marketingConsentLabel}
                </span>
              </label>

              {/* Payment Method: 4 Big Selectable Buttons */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[15px] font-medium text-[#1A1A1A]">
                  {STRINGS.paymentLabel}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'UPI', 'Card', 'Other'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`min-h-[52px] rounded-[8px] font-semibold text-[17px] border transition-colors ${
                        paymentMode === mode
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[#F6F6F4] text-[#1A1A1A] border-[#E6E6E6]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gift Handed Over Checkbox (only if gift earned, ticked by default) */}
              {rewardEval.giftCount > 0 && (
                <div className="bg-[#F6F6F4] p-3 rounded-[8px] border border-[#E6E6E6] mt-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={giftHandedOver}
                      onChange={(e) => setGiftHandedOver(e.target.checked)}
                      className="w-5 h-5 rounded-[4px] border-[#E6E6E6] text-[var(--accent)]"
                    />
                    <span className="text-[15px] font-medium text-[#1A1A1A]">
                      {STRINGS.giftHandedOverLabel}
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Bottom TotalBar: Complete Sale */}
            <TotalBar
              total={subtotal}
              actionText={STRINGS.completeSaleBtn}
              onAction={handleValidateBeforeConfirm}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: DONE SCREEN                                       */}
        {/* ========================================================= */}
        {step === 'done' && completedSale && (
          <div className="flex-1 flex flex-col justify-between py-2">
            <div className="flex flex-col gap-4">
              <h1 className="text-[22px] font-bold text-[#1A1A1A] pb-2 border-b border-[#E6E6E6]">
                {STRINGS.doneTitle}
              </h1>

              {/* Calm Summary Box */}
              <div className="bg-[#F6F6F4] p-4 rounded-[8px] border border-[#E6E6E6] flex flex-col gap-2.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B6B6B] text-[15px]">{STRINGS.billNumberLabel}</span>
                  <span className="font-bold text-[#1A1A1A] text-[18px]">
                    {completedSale.billNumber}
                  </span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B6B6B] text-[15px]">{STRINGS.grandTotalLabel}</span>
                  <span className="font-bold text-[#1A1A1A] text-[20px]">
                    {formatRupees(completedSale.total)} ({completedSale.paymentMode})
                  </span>
                </div>

                {completedSale.vouchers.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-[#E6E6E6]">
                    <span className="text-[#6B6B6B] text-[15px]">{STRINGS.vouchersEarnedLabel}:</span>
                    {completedSale.vouchers.map((v) => (
                      <div key={v.code} className="flex justify-between text-[15px] font-semibold text-[#1A1A1A]">
                        <span>{v.code}</span>
                        <span>{formatRupees(v.face_value)} off</span>
                      </div>
                    ))}
                  </div>
                )}

                {completedSale.gift && (
                  <div className="flex justify-between items-baseline pt-1 border-t border-[#E6E6E6] text-[15px]">
                    <span className="text-[#6B6B6B]">{STRINGS.giftEarnedLabel}:</span>
                    <span className="font-semibold text-[#1A1A1A]">
                      {completedSale.gift} ({completedSale.giftClaimed ? 'Claimed' : 'To collect'})
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons in exact specified order */}
              <div className="flex flex-col gap-3 pt-2">
                {/* 1. Primary Button: Send on WhatsApp */}
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    const message = buildWhatsAppMessage({
                      invoice: {
                        id: 'inv',
                        invoice_number: completedSale.billNumber,
                        client_request_id: '',
                        customer_id: '',
                        subtotal: completedSale.total,
                        discount_total: 0,
                        voucher_total: 0,
                        grand_total: completedSale.total,
                        payment_mode: completedSale.paymentMode as any,
                        status: 'FINALIZED',
                        finalized_at: new Date().toISOString(),
                      },
                      items: cart.map((c) => ({
                        product_id: c.product.id,
                        item_number_snapshot: c.product.item_number,
                        description_snapshot: c.product.name,
                        quantity: c.quantity,
                        unit_price_snapshot: c.product.price,
                        line_total: c.product.price * c.quantity,
                      })),
                      vouchers: completedSale.vouchers.map((v) => ({
                        id: v.code,
                        code: v.code,
                        source_invoice_id: '',
                        customer_id: '',
                        face_value: v.face_value,
                        status: 'ISSUED',
                      })),
                      gift: completedSale.gift ? { id: 'g', source_invoice_id: '', customer_id: '', description: completedSale.gift, status: completedSale.giftClaimed ? 'COLLECTED' : 'PENDING_COLLECTION' } : null,
                      giftClaimed: completedSale.giftClaimed,
                    });
                    const url = getWhatsAppUrl(phone || '9876543210', message);
                    window.open(url, '_blank');
                  }}
                >
                  {STRINGS.sendWhatsAppBtn}
                </Button>

                {/* 2. Secondary: Share PDF / images */}
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    downloadInvoicePdf({
                      invoice: {
                        id: 'inv',
                        invoice_number: completedSale.billNumber,
                        client_request_id: '',
                        customer_id: '',
                        subtotal: completedSale.total,
                        discount_total: 0,
                        voucher_total: 0,
                        grand_total: completedSale.total,
                        payment_mode: completedSale.paymentMode as any,
                        status: 'FINALIZED',
                        finalized_at: new Date().toISOString(),
                      },
                      items: cart.map((c) => ({
                        product_id: c.product.id,
                        item_number_snapshot: c.product.item_number,
                        description_snapshot: c.product.name,
                        quantity: c.quantity,
                        unit_price_snapshot: c.product.price,
                        line_total: c.product.price * c.quantity,
                      })),
                      customer: {
                        id: 'c',
                        phone_e164: phone,
                        name: customerName,
                        marketing_consent: marketingConsent,
                      },
                    });
                    if (completedSale.vouchers.length > 0) {
                      downloadVoucherPng({
                        id: 'v',
                        code: completedSale.vouchers[0].code,
                        source_invoice_id: '',
                        customer_id: '',
                        face_value: completedSale.vouchers[0].face_value,
                        status: 'ISSUED',
                      });
                    }
                  }}
                >
                  {STRINGS.shareFilesBtn}
                </Button>

                {/* 3. Copy message */}
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={async () => {
                    const message = buildWhatsAppMessage({
                      invoice: {
                        id: 'inv',
                        invoice_number: completedSale.billNumber,
                        client_request_id: '',
                        customer_id: '',
                        subtotal: completedSale.total,
                        discount_total: 0,
                        voucher_total: 0,
                        grand_total: completedSale.total,
                        payment_mode: completedSale.paymentMode as any,
                        status: 'FINALIZED',
                        finalized_at: new Date().toISOString(),
                      },
                      items: cart.map((c) => ({
                        product_id: c.product.id,
                        item_number_snapshot: c.product.item_number,
                        description_snapshot: c.product.name,
                        quantity: c.quantity,
                        unit_price_snapshot: c.product.price,
                        line_total: c.product.price * c.quantity,
                      })),
                    });
                    await navigator.clipboard.writeText(message);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? 'Copied!' : STRINGS.copyMessageBtn}
                </Button>

                {/* 4. Send SMS */}
                <a
                  href={getSmsUrl(phone || '9876543210', `FEVER Bill ${completedSale.billNumber}: Total ${formatRupees(completedSale.total)}`)}
                  className="min-h-[52px] px-5 py-3 rounded-[8px] font-semibold text-[17px] flex items-center justify-center gap-2 border bg-[#F6F6F4] text-[#1A1A1A] border-[#E6E6E6] hover:bg-[#EFEFEA]"
                >
                  {STRINGS.sendSmsBtn}
                </a>

                {/* 5. Finally: New Sale */}
                <div className="pt-2">
                  <Button variant="secondary" fullWidth onClick={handleStartNewSale}>
                    {STRINGS.newSaleBtn}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Sheet for Completing Sale */}
      <ConfirmSheet
        isOpen={showConfirm}
        title={STRINGS.confirmSaleTitle}
        itemsSummary={[
          { label: 'Items count', value: `${cart.reduce((s, c) => s + c.quantity, 0)} garments` },
          { label: 'Total payable', value: formatRupees(subtotal) },
          { label: 'Payment mode', value: paymentMode },
          { label: 'Customer', value: phone },
        ]}
        confirmText={STRINGS.confirmSaleYes}
        cancelText={STRINGS.confirmSaleBack}
        onConfirm={handleCompleteSale}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Clear Bill Confirmation */}
      <ConfirmSheet
        isOpen={showClearConfirm}
        title={STRINGS.clearBillConfirmTitle}
        itemsSummary={[
          { label: 'Items in bill', value: `${cart.length} line items` },
          { label: 'Current total', value: formatRupees(subtotal) },
        ]}
        confirmText={STRINGS.clearBillYes}
        cancelText={STRINGS.clearBillNo}
        isDangerous
        onConfirm={handleClearBill}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
