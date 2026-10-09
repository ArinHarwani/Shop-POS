'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  Ticket,
  Gift,
  ArrowRight,
  RotateCcw,
  Percent,
  CheckCircle,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Product, CartItem, OfferTier, Customer, FinalizeResult } from '@/types';
import { DataService } from '@/lib/data-service';
import { getSavedCart, saveCart, clearSavedCart, getActiveRole } from '@/lib/storage';
import { calculateEligibleAmount, evaluateRewards } from '@/lib/rewards';
import { normalizePhoneE164 } from '@/lib/whatsapp';
import { ShareModal } from '@/components/ShareModal';

export default function BillingPage() {
  // Products & Tiers
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<OfferTier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Cart & Persistence
  const [cart, setCart] = useState<CartItem[]>([]);
  const [role, setRole] = useState<'owner' | 'staff'>('owner');
  const [isOnline, setIsOnline] = useState(true);

  // Customer Input
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Discount (Owner only)
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('');

  // Voucher Deduction
  const [appliedVoucherCode, setAppliedVoucherCode] = useState('');
  const [appliedVoucherValue, setAppliedVoucherValue] = useState(0);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  // Payment & Finalize
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Other'>('UPI');
  const [giftHandedOver, setGiftHandedOver] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Post-finalize Modal
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  useEffect(() => {
    async function loadInitial() {
      const prods = await DataService.getProducts();
      const trs = await DataService.getOfferTiers();
      setProducts(prods);
      setTiers(trs);
      setCart(getSavedCart());
      setRole(getActiveRole());
    }
    loadInitial();

    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-focus search input for rapid entry
    searchInputRef.current?.focus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save Cart on change
  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  // Handle Search Input Change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setErrorMessage(null);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    const clean = val.trim().toLowerCase();
    const exact = products.filter((p) => p.item_number.toLowerCase() === clean);
    const partial = products.filter(
      (p) =>
        p.item_number.toLowerCase() !== clean &&
        (p.item_number.toLowerCase().includes(clean) ||
          p.name.toLowerCase().includes(clean) ||
          p.category.toLowerCase().includes(clean))
    );
    setSearchResults([...exact, ...partial].slice(0, 5));
  };

  // Add Item to Cart (Exact match or selected item)
  const addItemToCart = (product: Product) => {
    setErrorMessage(null);
    if (product.quantity_on_hand <= 0) {
      setErrorMessage(`Item #${product.item_number} (${product.name}) is OUT OF STOCK.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity_on_hand) {
          setErrorMessage(`Cannot add more. Available stock for #${product.item_number} is ${product.quantity_on_hand}.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  // Handle Enter key on search input for rapid laptop barcode entry
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const clean = searchQuery.trim().toLowerCase();
      if (!clean) return;

      // Exact match first
      const exact = products.find((p) => p.item_number.toLowerCase() === clean);
      if (exact) {
        addItemToCart(exact);
      } else if (searchResults.length > 0) {
        addItemToCart(searchResults[0]);
      } else {
        setErrorMessage(`No product found matching "${searchQuery}".`);
      }
    }
  };

  // Cart quantity controls
  const updateQuantity = (productId: string, delta: number) => {
    setErrorMessage(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.product.quantity_on_hand) {
              setErrorMessage(`Only ${item.product.quantity_on_hand} in stock for #${item.product.item_number}.`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    clearSavedCart();
    setDiscountValue(0);
    setAppliedVoucherCode('');
    setAppliedVoucherValue(0);
    setErrorMessage(null);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  let calculatedDiscount = 0;
  if (discountValue > 0) {
    if (discountType === 'percent') {
      calculatedDiscount = Math.floor((subtotal * Math.min(100, discountValue)) / 100);
    } else {
      calculatedDiscount = Math.min(subtotal, Math.floor(discountValue));
    }
  }

  const grandTotal = Math.max(0, subtotal - calculatedDiscount - appliedVoucherValue);
  const eligibleAmount = calculateEligibleAmount(subtotal, calculatedDiscount, appliedVoucherValue);
  const rewardEval = evaluateRewards(eligibleAmount, tiers);

  // Apply voucher by code
  const handleApplyVoucher = async () => {
    setVoucherError(null);
    if (!appliedVoucherCode.trim()) return;

    try {
      const code = appliedVoucherCode.trim().toUpperCase();
      const lookup = await DataService.lookupVoucher(code);
      if (!lookup) {
        setVoucherError(`Voucher "${code}" not found.`);
        return;
      }
      if (lookup.voucher.status !== 'ISSUED') {
        setVoucherError(`Voucher status is ${lookup.voucher.status}.`);
        return;
      }
      if (lookup.voucher.min_purchase && subtotal < lookup.voucher.min_purchase) {
        setVoucherError(`Requires minimum purchase of Rs ${lookup.voucher.min_purchase}. Current subtotal is Rs ${subtotal}.`);
        return;
      }
      setAppliedVoucherValue(lookup.voucher.face_value);
      setAppliedVoucherCode(code);
    } catch (err: any) {
      setVoucherError(err.message || 'Failed to validate voucher.');
    }
  };

  const removeAppliedVoucher = () => {
    setAppliedVoucherCode('');
    setAppliedVoucherValue(0);
    setVoucherError(null);
  };

  // Finalize Bill
  const handleFinalize = async () => {
    setErrorMessage(null);

    if (cart.length === 0) {
      setErrorMessage('Cart is empty. Add at least one garment.');
      return;
    }

    if (!isOnline) {
      setErrorMessage('Cannot finalize bill while offline. Please connect to Wi-Fi or mobile hotspot.');
      return;
    }

    const normalizedPhone = normalizePhoneE164(customerPhone);
    if (!normalizedPhone) {
      setErrorMessage('Please enter a valid 10-digit WhatsApp number (or international with +).');
      return;
    }

    setIsSubmitting(true);
    try {
      // Unique client request ID for idempotency (BIL-6)
      const clientRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const result = await DataService.finalizeBill({
        client_request_id: clientRequestId,
        customer_phone: normalizedPhone,
        customer_name: customerName.trim(),
        instagram_handle: instagramHandle.trim(),
        marketing_consent: marketingConsent,
        payment_mode: paymentMode,
        discount_amount: calculatedDiscount,
        applied_voucher_code: appliedVoucherValue > 0 ? appliedVoucherCode : undefined,
        gift_handed_over: giftHandedOver,
        items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
        })),
      });

      // Refresh product list in background
      const updatedProds = await DataService.getProducts();
      setProducts(updatedProds);

      // Open Success & WhatsApp modal
      setFinalizeResult(result);
      clearCart();
    } catch (err: any) {
      setErrorMessage(err.message || 'Finalization failed. Please check stock and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startNewBill = () => {
    setFinalizeResult(null);
    clearCart();
    setCustomerPhone('');
    setCustomerName('');
    setInstagramHandle('');
    setMarketingConsent(false);
    searchInputRef.current?.focus();
  };

  const activeCustomer: Customer = {
    id: finalizeResult?.customer_id || '',
    phone_e164: normalizePhoneE164(customerPhone) || customerPhone,
    name: customerName,
    instagram_handle: instagramHandle,
    marketing_consent: marketingConsent,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 w-full flex-1 flex flex-col">
      {/* Page Title */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Billing Counter</span>
            <span className="text-xs font-normal text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              FEVER Trendy
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Type item number, add to cart, auto-compute rewards & WhatsApp invoice
          </p>
        </div>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Cart</span>
          </button>
        )}
      </div>

      {/* Main Grid: Left Cart / Entry (60%), Right Rewards & Customer (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1">
        {/* Left Column: Rapid Search & Cart Items */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Rapid Add Search Bar (BIL-1) */}
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                inputMode="numeric"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Enter Item Number (e.g. 847291) or Name..."
                className="w-full pl-11 pr-24 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-base font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all touch-target"
              />
              <div className="absolute right-3 flex items-center gap-1 text-[11px] text-slate-400 font-mono bg-slate-800 px-2 py-1 rounded border border-slate-700">
                <span>Enter ↵</span>
              </div>
            </div>

            {/* Live Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#131a29] border border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden divide-y divide-slate-800">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addItemToCart(product)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-800/80 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-rose-400 font-bold text-sm">
                          #{product.item_number}
                        </span>
                        <span className="text-white text-sm font-semibold">{product.name}</span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{product.category}</span>
                        <span>•</span>
                        <span>Size: {product.size}</span>
                        <span>•</span>
                        <span>Color: {product.color}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-base">Rs {product.price}</div>
                      <div
                        className={`text-xs font-medium ${
                          product.quantity_on_hand > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {product.quantity_on_hand > 0
                          ? `${product.quantity_on_hand} in stock`
                          : 'Out of stock'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cart List */}
          <div className="flex-1 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Garments ({cart.reduce((sum, it) => sum + it.quantity, 0)} items)</span>
              <span>Rate / Total</span>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Search className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                <p className="text-sm font-medium text-slate-300">Cart is empty</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Scan a tag or enter the item number above to begin billing.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 overflow-y-auto max-h-[380px] pr-1">
                {cart.map(({ product, quantity }) => (
                  <div key={product.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-800 text-rose-300 border border-slate-700">
                          #{product.item_number}
                        </span>
                        <span className="text-white text-sm font-medium leading-tight">
                          {product.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {product.category} • {product.size} • Rs {product.price} each
                      </p>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-mono font-bold text-white">
                          {quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          disabled={quantity >= product.quantity_on_hand}
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-20 text-right font-mono font-bold text-white text-sm">
                        Rs {product.price * quantity}
                      </div>

                      <button
                        onClick={() => removeItem(product.id)}
                        className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Customer Details, Rewards, Discounts & Finalize */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Customer Input Card (CUS-1 & CUS-2) */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Customer Details</span>
              <span className="text-[10px] text-rose-400 font-normal">(WhatsApp Required)</span>
            </h3>

            {/* WhatsApp Phone */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                WhatsApp Phone Number *
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="10-digit number (e.g. 9876543210)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Optional Name & Instagram */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">
                  Instagram ID (Optional)
                </label>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value.replace(/^@/, ''))}
                  placeholder="handle (without @)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Marketing Consent Checkbox (CUS-2: Separate unticked checkbox) */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
              <span className="text-[11px] text-slate-400 leading-tight">
                Customer consented to receive WhatsApp updates and new collection drops from FEVER.
              </span>
            </label>
          </div>

          {/* Dynamic Rewards Preview Banner (RWD-1 & Upsell Nudge) */}
          <div className="bg-gradient-to-br from-[#1b172a] via-[#161d31] to-[#0c1220] border border-rose-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Rewards Engine</span>
              </span>
              <span className="text-xs font-mono text-slate-300 font-semibold">
                Tier: {rewardEval.currentTier ? rewardEval.currentTier.name : 'Standard'}
              </span>
            </div>

            {/* Earned Rewards Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/40 border border-rose-500/20 p-2.5 rounded-xl flex items-center gap-2">
                <Ticket className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-white">
                    {rewardEval.voucherCount}x Rs 300 Vouchers
                  </div>
                  <div className="text-[10px] text-slate-400">Valid on future store visit</div>
                </div>
              </div>

              <div className="bg-black/40 border border-amber-500/20 p-2.5 rounded-xl flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-white">
                    {rewardEval.giftCount > 0 ? 'Surprise Gift' : 'No Gift'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {rewardEval.giftCount > 0 ? 'Collect at counter' : 'Higher tier needed'}
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Upsell Nudge */}
            {rewardEval.upsellMessage && (
              <div className="bg-rose-950/40 border border-rose-500/40 px-3 py-2 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="font-medium">{rewardEval.upsellMessage}</span>
              </div>
            )}
          </div>

          {/* Vouchers & Discounts Accordion / Inputs */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
            {/* Voucher Redemption Input */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                Redeem Voucher Code
              </label>
              {appliedVoucherValue > 0 ? (
                <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/40 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs font-bold">
                    <CheckCircle className="w-4 h-4" />
                    <span>{appliedVoucherCode} (-Rs {appliedVoucherValue})</span>
                  </div>
                  <button
                    onClick={removeAppliedVoucher}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={appliedVoucherCode}
                    onChange={(e) => setAppliedVoucherCode(e.target.value.toUpperCase())}
                    placeholder="TRD-XXXX-XXXX"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <button
                    onClick={handleApplyVoucher}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
              {voucherError && (
                <p className="text-[11px] text-rose-400 mt-1">{voucherError}</p>
              )}
            </div>

            {/* Owner Discount Section (BIL-4) */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <span>Owner Discount</span>
                  {role !== 'owner' && <Lock className="w-3 h-3 text-amber-400" />}
                </span>
                {role !== 'owner' && (
                  <span className="text-[10px] text-amber-400">Owner Role Required</span>
                )}
              </div>

              {role === 'owner' ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex bg-slate-950 border border-slate-700 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setDiscountType('flat')}
                        className={`px-3 py-1.5 text-xs font-bold ${
                          discountType === 'flat' ? 'bg-rose-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        Rs
                      </button>
                      <button
                        onClick={() => setDiscountType('percent')}
                        className={`px-3 py-1.5 text-xs font-bold ${
                          discountType === 'percent' ? 'bg-rose-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        %
                      </button>
                    </div>
                    <input
                      type="number"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder={discountType === 'flat' ? 'Amount (Rs)' : 'Percent (%)'}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                  {discountValue > 0 && (
                    <input
                      type="text"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Discount reason (required for audit)"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  Switch to Owner role to apply discounts.
                </p>
              )}
            </div>

            {/* Payment Mode Selector (BIL-5) */}
            <div className="pt-2 border-t border-slate-800">
              <label className="text-[11px] text-slate-400 font-medium block mb-1.5">
                Payment Mode
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['UPI', 'Cash', 'Card', 'Other'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      paymentMode === mode
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/60'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Gift Handed Over Checkbox (appears only if gift earned) */}
            {rewardEval.giftCount > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-950/20 border border-amber-500/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giftHandedOver}
                    onChange={(e) => setGiftHandedOver(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-500 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs text-amber-200 font-medium">
                    Gift handed over to customer right now
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Bill Summary & Finalize Button */}
          <div className="bg-[#111726] border border-slate-700/80 rounded-2xl p-5 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono text-white">Rs {subtotal}</span>
              </div>
              {calculatedDiscount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Discount:</span>
                  <span className="font-mono">-Rs {calculatedDiscount}</span>
                </div>
              )}
              {appliedVoucherValue > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Voucher Applied:</span>
                  <span className="font-mono">-Rs {appliedVoucherValue}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                <span>Grand Total:</span>
                <span className="font-mono text-rose-400 text-lg">Rs {grandTotal}</span>
              </div>
            </div>

            {/* Finalize Button (BIL-6) */}
            <button
              onClick={handleFinalize}
              disabled={isSubmitting || cart.length === 0 || !isOnline}
              className="w-full h-14 py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-rose-950/80 transition-all touch-target"
            >
              <span>{isSubmitting ? 'Finalizing Bill...' : `Finalize & Bill Rs ${grandTotal}`}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {!isOnline && (
              <p className="text-[11px] text-amber-400 text-center font-medium">
                Offline: Finalize is disabled until network reconnects.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Post Finalize WhatsApp Share Modal */}
      {finalizeResult && (
        <ShareModal
          finalizeResult={finalizeResult}
          items={cart.map((c) => ({
            product_id: c.product.id,
            item_number_snapshot: c.product.item_number,
            description_snapshot: c.product.name,
            quantity: c.quantity,
            unit_price_snapshot: c.product.price,
            line_total: c.product.price * c.quantity,
          }))}
          customer={activeCustomer}
          onClose={() => setFinalizeResult(null)}
          onNewBill={startNewBill}
        />
      )}
    </div>
  );
}
