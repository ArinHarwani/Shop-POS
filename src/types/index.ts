export type UserRole = 'owner' | 'staff';

export interface UserProfile {
  user_id: string;
  role: UserRole;
  display_name: string;
}

export interface Product {
  id: string;
  item_number: string;
  name: string;
  category: string;
  size: string;
  color: string;
  price: number;
  quantity_on_hand: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  delta: number;
  reason: 'ADD' | 'SALE' | 'CANCEL' | 'ADJUST';
  invoice_id?: string | null;
  user_id?: string | null;
  note?: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  phone_e164: string;
  name?: string | null;
  instagram_handle?: string | null;
  marketing_consent: boolean;
  consent_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OfferTier {
  id: string;
  name: string;
  threshold: number;
  voucher_count: number;
  voucher_value: number;
  gift_count: number;
  gift_description?: string | null;
  min_purchase?: number | null;
  valid_days?: number | null;
  terms?: string | null;
  is_active: boolean;
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_id: string;
  item_number_snapshot: string;
  description_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_request_id: string;
  customer_id: string;
  subtotal: number;
  discount_total: number;
  voucher_total: number;
  grand_total: number;
  payment_mode: 'Cash' | 'UPI' | 'Card' | 'Other';
  status: 'FINALIZED' | 'CANCELLED';
  created_by?: string | null;
  finalized_at: string;
  offer_tier_id?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  items?: InvoiceItem[];
  customer?: Customer;
}

export interface Voucher {
  id: string;
  code: string;
  source_invoice_id: string;
  customer_id: string;
  face_value: number;
  min_purchase?: number | null;
  status: 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
  expires_at?: string | null;
  redeemed_invoice_id?: string | null;
  redeemed_at?: string | null;
  redeemed_by?: string | null;
  created_at?: string;
}

export interface Gift {
  id: string;
  source_invoice_id: string;
  customer_id: string;
  description: string;
  status: 'PENDING_COLLECTION' | 'COLLECTED' | 'CANCELLED';
  collected_at?: string | null;
  collected_by?: string | null;
  created_at?: string;
}

export interface MessageLog {
  id: string;
  invoice_id: string;
  channel: 'WHATSAPP' | 'SMS' | 'COPY';
  status: 'PREPARED' | 'OPENED' | 'MARKED_SENT';
  user_id?: string | null;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface FinalizePayload {
  client_request_id: string;
  customer_phone: string;
  customer_name?: string;
  instagram_handle?: string;
  marketing_consent: boolean;
  payment_mode: 'Cash' | 'UPI' | 'Card' | 'Other';
  discount_amount: number;
  applied_voucher_code?: string;
  gift_handed_over: boolean;
  items: {
    product_id: string;
    quantity: number;
  }[];
}

export interface FinalizeResult {
  success: boolean;
  is_duplicate?: boolean;
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  subtotal: number;
  discount_total: number;
  voucher_total: number;
  grand_total: number;
  eligible_amount: number;
  tier_name?: string;
  vouchers: {
    code: string;
    face_value: number;
    min_purchase?: number | null;
    terms?: string | null;
  }[];
  gift?: {
    description: string;
    status: 'COLLECTED' | 'PENDING_COLLECTION';
    claimed: boolean;
  } | null;
}
