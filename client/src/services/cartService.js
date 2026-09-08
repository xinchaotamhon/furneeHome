import apiClient from './apiClient';

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

function unwrap(response) { return response.data?.data ?? response.data; }

export const cartService = {
  async get() { return unwrap(await apiClient.get('/cart')); },
  async add(productId, quantity) { return unwrap(await apiClient.post('/cart/add', { productId, quantity })); },
  async update(productId, quantity) { return unwrap(await apiClient.put('/cart/update', { productId, quantity })); },
  async remove(productId) { return unwrap(await apiClient.delete(`/cart/item/${productId}`)); },
  async clear() { return unwrap(await apiClient.delete('/cart/clear')); },
};
