const CART_KEY = 'furneehome_cart';

export function getStoredCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {}
}

export function clearStoredCart() {
  try {
    localStorage.removeItem(CART_KEY);
  } catch {}
}
