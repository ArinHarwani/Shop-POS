/**
 * Central user-facing strings for TRENDY POS.
 * Kept in one file for easy translation (e.g. Hindi).
 * Uses plain, natural shopkeeper vocabulary.
 */
export const STRINGS = {
  // App Header & Branding
  brandName: 'FEVER - Trendy Collection',
  tagline: 'Event Bill Pad',

  // Status
  online: 'Online',
  offline: 'No internet - cannot complete sales',

  // Navigation Tabs
  navSell: 'Sell',
  navItems: 'Items',
  navVouchers: 'Vouchers',
  navToday: 'Today',
  navMore: 'More',
  navHistory: 'Bill History',
  navSignIn: 'Sign In',

  // Sell Screen
  itemNumberPlaceholder: 'Item number',
  addItemBtn: 'Add',
  clearBillBtn: 'Clear bill',
  clearBillConfirmTitle: 'Clear current bill?',
  clearBillConfirmText: 'All garments added to this bill will be removed.',
  clearBillYes: 'Yes, clear bill',
  clearBillNo: 'Keep bill',
  emptyBillPrompt: 'Enter article name and amount above, then tap Add.',
  removeBtn: 'Remove',
  totalLabel: 'Total',
  nextBtn: 'Next',

  // Customer & Payment Screen
  customerPaymentTitle: 'Customer and payment',
  phoneLabel: 'WhatsApp number',
  phonePlaceholder: '10-digit mobile number',
  phoneErrorReq: 'Phone number needs 10 digits.',
  nameLabel: 'Customer name (optional)',
  namePlaceholder: 'Name',
  instagramLabel: 'Instagram ID (optional)',
  instagramPlaceholder: 'Handle without @',
  marketingConsentLabel: 'OK to send offers later',
  paymentLabel: 'Payment method',
  giftHandedOverLabel: 'Gift handed over to customer',
  completeSaleBtn: 'Complete sale',
  backBtn: 'Go back',

  // Confirmation
  confirmSaleTitle: 'Confirm sale',
  confirmSaleYes: 'Yes, complete sale',
  confirmSaleBack: 'Go back',

  // Done Screen
  doneTitle: 'Sale completed',
  billNumberLabel: 'Bill number',
  grandTotalLabel: 'Total paid',
  vouchersEarnedLabel: 'Reward vouchers',
  giftEarnedLabel: 'Gift earned',
  giftClaimed: 'Gift handed over',
  giftPending: 'Gift to be collected',
  sendWhatsAppBtn: 'Send on WhatsApp',
  shareFilesBtn: 'Share PDF / images',
  copyMessageBtn: 'Copy message',
  sendSmsBtn: 'Send SMS',
  newSaleBtn: 'New sale',

  // Items Screen
  searchItemsPlaceholder: 'Search item number or name',
  lowStockLabel: 'Only {count} left',
  outOfStockLabel: 'Sold out',
  inStockLabel: '{count} in stock',
  addNewItemBtn: 'Add item',
  importSpreadsheetLink: 'Import from spreadsheet',
  scanNumberCameraBtn: 'Scan number',
  saveItemBtn: 'Save',
  itemNumberLabel: 'Item number',
  priceLabel: 'Price (Rs)',
  itemNameLabel: 'Item name / description',
  sizeLabel: 'Size',
  colorLabel: 'Colour',
  quantityLabel: 'Quantity',

  // Vouchers Screen
  voucherCodePlaceholder: 'Enter voucher code (e.g. TRD-XXXX-XXXX)',
  checkVoucherBtn: 'Check',
  useOnBillBtn: 'Use on this bill',
  voucherValid: 'Valid: Rs {amount} off',
  voucherUsed: 'Already used on {date}',
  voucherExpired: 'Expired',
  voucherNotFound: 'Voucher not found',

  // Today Screen
  salesTodayTitle: 'Sales today',
  billsCountTitle: 'Bills',
  itemsSoldCountTitle: 'Items sold',
  giftsWaitingTitle: 'Gifts waiting',
  todaysBillsHeading: "Today's bills",
  noBillsToday: 'No bills created yet today.',

  // Common Errors
  itemSoldOutError: 'This item is sold out.',
  itemNotFoundError: 'Item not found in inventory.',

  // Instagram Promo
  instagramPromoText: 'Check out more from our exclusive collection: https://www.instagram.com/fever.profilefashion?utm_source=ig_web_button_share_sheet&xtok=ZDNlZDc0MzIxNw==',
};

/**
 * Format rupee amount as "Rs 1,350" with proper thousands separator
 */
export function formatRupees(amount: number): string {
  const formatted = Math.floor(amount).toLocaleString('en-IN');
  return `Rs ${formatted}`;
}
