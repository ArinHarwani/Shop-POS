/**
 * DEVELOPMENT-ONLY FIXTURES
 * Excluded from production builds.
 * Used strictly for rapid clickable UI review without live database dependencies.
 */

export interface FixtureProduct {
  id: string;
  item_number: string;
  name: string;
  category: string;
  size: string;
  color: string;
  price: number;
  quantity_on_hand: number;
}

export interface FixtureBillItem {
  product: FixtureProduct;
  quantity: number;
}

export interface FixtureBill {
  id: string;
  bill_number: string;
  time: string;
  items_count: number;
  total: number;
  payment_mode: 'Cash' | 'UPI' | 'Card' | 'Other';
  customer_phone: string;
  customer_name?: string;
  vouchers_earned: string[];
  gift_earned?: string;
  gift_claimed: boolean;
}

export interface FixtureVoucher {
  code: string;
  status: 'VALID' | 'USED' | 'EXPIRED' | 'NOT_FOUND';
  face_value: number;
  used_at?: string;
  min_purchase?: number;
}

export const FIXTURE_PRODUCTS: FixtureProduct[] = [
  { id: 'fx-1', item_number: '847291', name: 'Floral Satin Crop Top', category: 'Tops', size: 'M', color: 'Rose Pink', price: 450, quantity_on_hand: 8 },
  { id: 'fx-2', item_number: '847305', name: 'Embroidered Velvet Bustier', category: 'Tops', size: 'S', color: 'Burgundy', price: 400, quantity_on_hand: 2 }, // low stock
  { id: 'fx-3', item_number: '912004', name: 'High-Rise Flared Denim', category: 'Jeans', size: '28', color: 'Indigo', price: 500, quantity_on_hand: 0 }, // out of stock
  { id: 'fx-4', item_number: '004812', name: 'Boho Chiffon Maxi Dress', category: 'Dresses', size: 'L', color: 'Ivory Cream', price: 1200, quantity_on_hand: 5 },
  { id: 'fx-5', item_number: '772109', name: 'Ruched Metallic Midi Skirt', category: 'Skirts', size: 'M', color: 'Silver Chrome', price: 650, quantity_on_hand: 6 },
  { id: 'fx-6', item_number: '550192', name: 'Ribbed Halter Knit Top', category: 'Tops', size: 'Free Size', color: 'Black Onyx', price: 350, quantity_on_hand: 1 }, // low stock
  { id: 'fx-7', item_number: '661840', name: 'Structured Oversized Blazer', category: 'Outerwear', size: 'XL', color: 'Camel', price: 1500, quantity_on_hand: 4 },
];

export const FIXTURE_VOUCHERS: Record<string, FixtureVoucher> = {
  'TRD-K7M2-9QXA': { code: 'TRD-K7M2-9QXA', status: 'VALID', face_value: 300, min_purchase: 3000 },
  'TRD-H4P8-2WZC': { code: 'TRD-H4P8-2WZC', status: 'USED', face_value: 300, used_at: '09 Oct 2026, 11:20 AM' },
  'TRD-EXPD-9999': { code: 'TRD-EXPD-9999', status: 'EXPIRED', face_value: 300 },
};

export const FIXTURE_TODAY_BILLS: FixtureBill[] = [
  {
    id: 'b-01',
    bill_number: 'TR-0123',
    time: '11:42 AM',
    items_count: 3,
    total: 1350,
    payment_mode: 'UPI',
    customer_phone: '+919876543210',
    customer_name: 'Priya Sharma',
    vouchers_earned: ['TRD-K7M2-9QXA', 'TRD-W2M9-4VKA'],
    gift_earned: 'Trendy Collection Gift',
    gift_claimed: true,
  },
  {
    id: 'b-02',
    bill_number: 'TR-0122',
    time: '11:15 AM',
    items_count: 2,
    total: 850,
    payment_mode: 'Cash',
    customer_phone: '+919822334455',
    customer_name: 'Ananya Verma',
    vouchers_earned: ['TRD-P8R2-7XLA'],
    gift_earned: 'Trendy Collection Gift',
    gift_claimed: false, // Gift waiting!
  },
  {
    id: 'b-03',
    bill_number: 'TR-0121',
    time: '10:30 AM',
    items_count: 1,
    total: 450,
    payment_mode: 'Card',
    customer_phone: '+919711223344',
    customer_name: 'Sneha Patel',
    vouchers_earned: [],
    gift_claimed: false,
  },
];

export const FIXTURE_TODAY_STATS = {
  salesToday: 2650,
  billsCount: 3,
  itemsSold: 6,
  giftsWaiting: 1,
};
