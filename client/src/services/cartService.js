import apiClient from './apiClient';

const CART_KEY_PREFIX = 'furneehome_cart';

function cartKey(userId) {
  return userId ? `${CART_KEY_PREFIX}_${userId}` : `${CART_KEY_PREFIX}_guest`;
}

export function getStoredCart(userId) {
  try {
    const raw = localStorage.getItem(cartKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredCart(items, userId) {
  try {
    localStorage.setItem(cartKey(userId), JSON.stringify(items));
  } catch {}
}

export function clearStoredCart(userId) {
  try {
    localStorage.removeItem(cartKey(userId));
  } catch {}
}

function unwrap(response) { return response.data?.data ?? response.data; }

export const cartService = {
  async get() { return unwrap(await apiClient.get('/cart')); },
  async sync(items) { return unwrap(await apiClient.post('/cart/sync', { items })); },
  async add(productId, quantity) { return unwrap(await apiClient.post('/cart/add', { productId, quantity })); },
  async update(productId, quantity) { return unwrap(await apiClient.put('/cart/update', { productId, quantity })); },
  async remove(productId) { return unwrap(await apiClient.delete(`/cart/item/${productId}`)); },
  async clear() { return unwrap(await apiClient.delete('/cart/clear')); },
};
