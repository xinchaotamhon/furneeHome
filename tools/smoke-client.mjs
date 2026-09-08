import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const checks = [
  ['router exposes store pages', read('client/src/router.jsx'), ['/products/:id', '/cart', '/checkout', '/orders', '/profile', '/feedback', '/admin/orders']],
  ['cart has no hardcoded coupon behavior', read('client/src/context/CartContext.jsx'), ['applyCoupon', 'FURNEE10', 'VIP20'], true],
  ['checkout is COD only', read('client/src/pages/CheckoutPage.jsx'), ['paymentMethod: \'COD\'', 'Đặt hàng COD'], false],
  ['room studio is three step', read('client/src/pages/RoomStudioPage.jsx'), ['BƯỚC 1', 'BƯỚC 2', 'BƯỚC 3', 'Tạo ảnh', 'saveRoomTemplate'], false],
  ['room studio has no manual placement controls', read('client/src/pages/RoomStudioPage.jsx'), ['onPointer', 'onDrag', 'flipped', 'scale', 'corner'], true],
];

for (const [name, content, terms, forbidden] of checks) {
  for (const term of terms) {
    const found = content.includes(term);
    if ((forbidden && found) || (!forbidden && !found)) throw new Error(`${name}: ${forbidden ? 'unexpected' : 'missing'} ${term}`);
  }
}

console.log('client smoke: passed');
