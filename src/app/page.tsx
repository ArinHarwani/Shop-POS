'use client';

import React, { useState, useRef, useEffect } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { Product } from '@/types';
import { DataService } from '@/lib/data-service';
import {
  DEFAULT_OFFER_TIERS,
  calculateEligibleAmount,
  evaluateRewards,
  calculateVoucherExpiry,
  formatIstDate,
  formatVoucherPrintLine,
  generateClientVoucherCode,
} from '@/lib/rewards';
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
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [soldItems, setSoldItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [itemInput, setItemInput] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);

  // Attached voucher & manual discount
  const [attachedVoucher, setAttachedVoucher] = useState<{
    code: string;
    face_value: number;
    expires_at?: string;
    min_purchase?: number;
  } | null>(null);
  const [manualDiscount, setManualDiscount] = useState<number>(0);

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
    subtotal: number;
    discountAmount: number;
    voucherDeduction: number;
    paymentMode: string;
    vouchers: { code: string; face_value: number; expires_at: string }[];
    gift: string | null;
    giftClaimed: boolean;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // Load saved cart and attached voucher from localStorage on mount (never lose work)
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
            is_active: item.product.is_active ?? true,
          },
          quantity: item.quantity,
        }))
      );
    } else {
      setCart([]);
    }

    try {
      const savedVoucher = localStorage.getItem('attached_voucher');
      if (savedVoucher) {
        setAttachedVoucher(JSON.parse(savedVoucher));
      }
    } catch {
      // ignore JSON parse error
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
  const merchandiseTotal = Math.max(0, subtotal - manualDiscount);

  // Attached voucher qualification
  const minPurchase = attachedVoucher?.min_purchase ?? 3000;
  const isVoucherUnderMin = attachedVoucher ? merchandiseTotal < minPurchase : false;
  const voucherShortfall = attachedVoucher && isVoucherUnderMin ? minPurchase - merchandiseTotal : 0;
  const voucherDiscount = attachedVoucher && !isVoucherUnderMin ? attachedVoucher.face_value : 0;
  const payableTotal = Math.max(0, merchandiseTotal - voucherDiscount);

  // The eligible amount A for NEW offers on that same bill:
  // merchandise total after discount and after voucher is subtracted
  const eligibleAmount = calculateEligibleAmount(subtotal, manualDiscount, voucherDiscount);
  const rewardEval = evaluateRewards(eligibleAmount, DEFAULT_OFFER_TIERS);

  // Add Item to Bill
  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setItemError(null);
    const query = itemInput.trim().toLowerCase();
    if (!query) return;

    const found = await DataService.getProductByItemNumber(query);
    if (!found) {
      setItemError(`Garment #${itemInput.trim()} not found in inventory.`);
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

  const handleRemoveAttachedVoucher = () => {
    setAttachedVoucher(null);
    try {
      localStorage.removeItem('attached_voucher');
    } catch {}
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
    if (isVoucherUnderMin) {
      setItemError(`Add Rs ${voucherShortfall.toLocaleString('en-IN')} more to use this voucher.`);
      return;
    }
    setStep('payment');
  };

  // Step 2 -> Confirmation
  const handleValidateBeforeConfirm = () => {
    if (isVoucherUnderMin) {
      setPhoneError(`Add Rs ${voucherShortfall.toLocaleString('en-IN')} more to use this voucher.`);
      return;
    }
    setPhoneError(null);
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setPhoneError(STRINGS.phoneErrorReq);
      return;
    }
    setShowConfirm(true);
  };

  // Execute Sale Completion
  const handleCompleteSale = async () => {
    setShowConfirm(false);
    const cleanPhone = phone.startsWith('+91') ? phone : (phone.length === 10 ? `+91${phone}` : phone);

    try {
      const result = await DataService.finalizeBill({
        client_request_id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        customer_phone: cleanPhone,
        customer_name: customerName.trim() || undefined,
        instagram_handle: instagramId.trim() || undefined,
        marketing_consent: marketingConsent,
        payment_mode: paymentMode,
        discount_amount: manualDiscount,
        applied_voucher_code: attachedVoucher?.code,
        gift_handed_over: giftHandedOver,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });

      setSoldItems([...cart]);
      setCompletedSale({
        billNumber: result.invoice_number,
        total: result.grand_total,
        subtotal: result.subtotal,
        discountAmount: result.discount_total,
        voucherDeduction: result.voucher_total,
        paymentMode,
        vouchers: result.vouchers.map((v) => ({
          code: v.code,
          face_value: v.face_value,
          expires_at: calculateVoucherExpiry(new Date(), 30).toISOString(),
        })),
        gift: result.gift ? result.gift.description : null,
        giftClaimed: result.gift ? result.gift.claimed : false,
      });

      if (attachedVoucher) {
        try {
          localStorage.removeItem('attached_voucher');
        } catch {}
        setAttachedVoucher(null);
      }

      clearSavedCart();
      setCart([]);
      setStep('done');
    } catch (err: any) {
      alert(`Could not complete sale: ${err.message || 'Unknown error'}`);
    }
  };

  const handleStartNewSale = () => {
    setCart([]);
    setSoldItems([]);
    setPhone('');
    setCustomerName('');
    setInstagramId('');
    setMarketingConsent(false);
    setManualDiscount(0);
    setAttachedVoucher(null);
    try {
      localStorage.removeItem('attached_voucher');
    } catch {}
    setCompletedSale(null);
    setStep('cart');
    setTimeout(() => {
      itemInputRef.current?.focus();
    }, 100);
  };

  // Helper text for reward line
  let rewardLineText = '';
  if (rewardEval.currentTier) {
    if (rewardEval.voucherCount > 0 && rewardEval.giftCount > 0) {
      rewardLineText = `Rs ${rewardEval.currentTier.threshold.toLocaleString('en-IN')} reached: Rs ${rewardEval.voucherValue} voucher + ${rewardEval.giftDescription || 'Small gift'} earned`;
    } else if (rewardEval.voucherCount > 0) {
      rewardLineText = `Rs ${rewardEval.currentTier.threshold.toLocaleString('en-IN')} reached: Rs ${rewardEval.voucherValue} voucher earned`;
    } else if (rewardEval.giftCount > 0) {
      rewardLineText = `Rs ${rewardEval.currentTier.threshold.toLocaleString('en-IN')} reached: ${rewardEval.giftDescription || 'Small gift'} earned`;
    }
  }

  if (rewardEval.amountNeededForNextTier > 0 && rewardEval.nextTier) {
    const nextRewardDesc =
      rewardEval.nextTier.voucher_count > 0 && rewardEval.nextTier.gift_count > 0
        ? `Rs ${rewardEval.nextTier.voucher_value} voucher + Small gift`
        : rewardEval.nextTier.voucher_count > 0
        ? `voucher of Rs ${rewardEval.nextTier.voucher_value}`
        : `${rewardEval.nextTier.gift_description || 'Small gift'}`;

    if (rewardLineText) {
      rewardLineText += ` • Add ${formatRupees(rewardEval.amountNeededForNextTier)} more to get ${nextRewardDesc}`;
    } else {
      rewardLineText = `Add ${formatRupees(rewardEval.amountNeededForNextTier)} more to get ${nextRewardDesc}`;
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

              {/* Attached Voucher Bar / Warning */}
              {attachedVoucher && (
                <div className={`p-3 rounded-[8px] border text-[15px] flex items-center justify-between ${
                  isVoucherUnderMin
                    ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A] font-semibold'
                    : 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC] font-medium'
                }`}>
                  <div className="flex flex-col">
                    {isVoucherUnderMin ? (
                      <span>Add Rs {voucherShortfall.toLocaleString('en-IN')} more to use this voucher</span>
                    ) : (
                      <span>Voucher {attachedVoucher.code} applied (-Rs {voucherDiscount})</span>
                    )}
                    <span className="text-[12px] opacity-80 font-normal">
                      Min bill: Rs 3,000 in-store purchase
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveAttachedVoucher}
                    className="text-[13px] underline ml-2 shrink-0 font-medium hover:opacity-75"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Thin Reward Line in light grey panel (#F6F6F4) */}
              {cart.length > 0 && rewardLineText && (
                <div className="bg-[#F6F6F4] p-3 rounded-[8px] border border-[#E6E6E6] text-[15px] text-[#1A1A1A] leading-snug break-words">
                  <span className="font-medium">{rewardLineText}</span>
                </div>
              )}
            </div>

            {/* Sticky Bottom Area: Total + Full Width "Next" */}
            <TotalBar
              total={payableTotal}
              actionText={STRINGS.nextBtn}
              onAction={handleNextToPayment}
              disabled={cart.length === 0 || isVoucherUnderMin}
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

              {/* Attached Voucher notice on Payment screen as well */}
              {attachedVoucher && (
                <div className={`p-3 rounded-[8px] border text-[15px] flex items-center justify-between ${
                  isVoucherUnderMin
                    ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A] font-semibold'
                    : 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC] font-medium'
                }`}>
                  <div className="flex flex-col">
                    {isVoucherUnderMin ? (
                      <span>Add Rs {voucherShortfall.toLocaleString('en-IN')} more to use this voucher</span>
                    ) : (
                      <span>Voucher {attachedVoucher.code} applied (-Rs {voucherDiscount})</span>
                    )}
                    <span className="text-[12px] opacity-80 font-normal">
                      Min bill: Rs 3,000 in-store purchase
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveAttachedVoucher}
                    className="text-[13px] underline ml-2 shrink-0 font-medium hover:opacity-75"
                  >
                    Remove
                  </button>
                </div>
              )}

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
              total={payableTotal}
              actionText={STRINGS.completeSaleBtn}
              onAction={handleValidateBeforeConfirm}
              disabled={isVoucherUnderMin}
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
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-[#E6E6E6]">
                    <span className="text-[#6B6B6B] text-[14px] font-medium">{STRINGS.vouchersEarnedLabel}:</span>
                    {completedSale.vouchers.map((v) => (
                      <div key={v.code} className="text-[13px] font-semibold text-[#15803D] bg-[#DCFCE7] p-2.5 rounded-[6px] border border-[#86EFAC] break-words">
                        {formatVoucherPrintLine({
                          code: v.code,
                          face_value: v.face_value,
                          expires_at: v.expires_at,
                          min_purchase: 3000,
                        })}
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
                      items: soldItems.map((c) => ({
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
                        expires_at: v.expires_at,
                        min_purchase: 3000,
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
                      items: soldItems.map((c) => ({
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
                      vouchers: completedSale.vouchers.map((v) => ({
                        id: v.code,
                        code: v.code,
                        source_invoice_id: '',
                        customer_id: '',
                        face_value: v.face_value,
                        expires_at: v.expires_at,
                        min_purchase: 3000,
                        status: 'ISSUED',
                      })),
                    });
                    if (completedSale.vouchers.length > 0) {
                      downloadVoucherPng({
                        id: 'v',
                        code: completedSale.vouchers[0].code,
                        source_invoice_id: '',
                        customer_id: '',
                        face_value: completedSale.vouchers[0].face_value,
                        expires_at: completedSale.vouchers[0].expires_at,
                        min_purchase: 3000,
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
                      items: soldItems.map((c) => ({
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
