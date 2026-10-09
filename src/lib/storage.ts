import { CartItem, Product, UserRole } from '@/types';

const CART_KEY = 'trendy_pos_cart';
const CATALOGUE_KEY = 'trendy_pos_cached_catalogue';
const CATALOGUE_TIMESTAMP_KEY = 'trendy_pos_catalogue_updated_at';
const USER_ROLE_KEY = 'trendy_pos_user_role';

/**
 * Cart Persistence across refresh and tab close (BIL-2)
 */
export function getSavedCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load cart from storage', err);
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save cart to storage', err);
  }
}

export function clearSavedCart(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CART_KEY);
  } catch (err) {
    console.error('Failed to clear cart from storage', err);
  }
}

/**
 * Product Catalogue Cache (IndexedDB / LocalStorage)
 */
export function getCachedCatalogue(): { products: Product[]; updatedAt: number | null } {
  if (typeof window === 'undefined') return { products: [], updatedAt: null };
  try {
    const raw = localStorage.getItem(CATALOGUE_KEY);
    const ts = localStorage.getItem(CATALOGUE_TIMESTAMP_KEY);
    return {
      products: raw ? JSON.parse(raw) : [],
      updatedAt: ts ? parseInt(ts, 10) : null,
    };
  } catch (err) {
    console.error('Failed to load cached catalogue', err);
    return { products: [], updatedAt: null };
  }
}

export function setCachedCatalogue(products: Product[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CATALOGUE_KEY, JSON.stringify(products));
    localStorage.setItem(CATALOGUE_TIMESTAMP_KEY, Date.now().toString());
  } catch (err) {
    console.error('Failed to cache catalogue', err);
  }
}

/**
 * User Role Session
 */
export function getActiveRole(): UserRole {
  if (typeof window === 'undefined') return 'owner';
  try {
    const saved = localStorage.getItem(USER_ROLE_KEY);
    return saved === 'staff' ? 'staff' : 'owner';
  } catch {
    return 'owner';
  }
}

export function setActiveRole(role: UserRole): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_ROLE_KEY, role);
  } catch (err) {
    console.error('Failed to save role', err);
  }
}
