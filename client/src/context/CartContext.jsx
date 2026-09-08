import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearStoredCart, cartService, getStoredCart, saveStoredCart } from '../services/cartService';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const productId = (product) => String(product?._id || product?.id || '');
const stockOf = (product) => {
  const value = Number(product?.stock ?? product?.countInStock ?? 99);
  return Number.isFinite(value) ? Math.max(0, value) : 99;
};
const fromRemote = (cart) => (cart?.items || []).map((item) => ({
  product: item.product,
  quantity: Number(item.quantity) || 1,
  price: Number(item.price ?? item.product?.price) || 0,
  name: item.product?.name || item.name || 'Sản phẩm',
  image: item.product?.image || item.product?.transparentImage || item.image || '',
  selected: item.selected !== false,
})).filter((item) => productId(item.product));

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id || null;
  const prevUserIdRef = useRef(userId);

  // Khởi tạo giỏ hàng từ localStorage theo userId hiện tại
  const [items, setItems] = useState(() => getStoredCart(userId));

  // Khi user thay đổi (đăng nhập / đăng xuất / đổi tài khoản)
  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (prevUserId === userId) return; // không có gì thay đổi

    if (!userId) {
      // Đăng xuất → xóa sạch giỏ hàng hiển thị (không xóa storage của user cũ)
      setItems([]);
      return;
    }

    // Đăng nhập / đổi tài khoản → tải giỏ hàng local của tài khoản mới
    setItems(getStoredCart(userId));
  }, [userId]);

  // Lưu vào localStorage mỗi khi items thay đổi (theo key của user hiện tại)
  useEffect(() => {
    if (userId !== null || items.length > 0) {
      saveStoredCart(items, userId);
    }
  }, [items, userId]);

  // Đồng bộ với server khi đăng nhập
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    (async () => {
      try {
        const local = getStoredCart(userId);
        const remote = fromRemote(await cartService.get());
        const remoteIds = new Set(remote.map((item) => productId(item.product)));
        for (const item of local) {
          const id = productId(item.product);
          if (remoteIds.has(id)) await cartService.update(id, item.quantity);
          else await cartService.add(id, item.quantity);
        }
        if (active) setItems(fromRemote(await cartService.get()));
      } catch {
        // Guest storage remains available if the signed-in cart cannot be reached.
      }
    })();
    return () => { active = false; };
  }, [userId]);

  const value = useMemo(() => {
    const sync = (action) => { if (userId) action().catch(() => {}); };
    const selectedItems = items.filter((item) => item.selected !== false);
    const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const isAllSelected = items.length > 0 && items.every((item) => item.selected !== false);

    return {
      items,
      totalCount: items.reduce((sum, item) => sum + item.quantity, 0),
      rawSubtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      selectedItems,
      selectedCount,
      selectedSubtotal,
      isAllSelected,
      toggleItemSelection(id) {
        setItems((current) => current.map((item) => (
          productId(item.product) === String(id)
            ? { ...item, selected: item.selected === false }
            : item
        )));
      },
      toggleSelectAll() {
        setItems((current) => {
          const nextState = !current.every((item) => item.selected !== false);
          return current.map((item) => ({ ...item, selected: nextState }));
        });
      },
      addToCart(product, quantity = 1) {
        const id = productId(product);
        const stock = stockOf(product);
        if (!id || stock < 1) return { ok: false, message: 'Sản phẩm hiện đã hết hàng.' };
        const qty = Math.min(stock, Math.max(1, Number(quantity) || 1));
        setItems((current) => {
          const existing = current.find((item) => productId(item.product) === id);
          if (!existing) {
            return [
              ...current,
              {
                product,
                quantity: qty,
                price: Number(product.price) || 0,
                name: product.name,
                image: product.image || product.transparentImage || product.sourceImages?.[0] || '',
                selected: true,
              },
            ];
          }
          return current.map((item) => productId(item.product) === id
            ? { ...item, product, quantity: Math.min(stock, item.quantity + qty), price: Number(product.price) || 0, selected: true }
            : item);
        });
        sync(() => cartService.add(id, qty));
        return { ok: true };
      },
      updateQuantity(id, quantity) {
        const qty = Number(quantity);
        if (qty <= 0) {
          setItems((current) => current.filter((item) => productId(item.product) !== String(id)));
          sync(() => cartService.remove(id));
          return;
        }
        setItems((current) => current.map((item) => productId(item.product) === String(id) ? { ...item, quantity: Math.min(stockOf(item.product), qty) } : item));
        sync(() => cartService.update(id, qty));
      },
      removeFromCart(id) {
        setItems((current) => current.filter((item) => productId(item.product) !== String(id)));
        sync(() => cartService.remove(id));
      },
      clearPurchasedItems(purchasedIds = []) {
        const idSet = new Set(purchasedIds.map(String));
        setItems((current) => current.filter((item) => !idSet.has(productId(item.product))));
        if (userId) {
          for (const id of purchasedIds) {
            cartService.remove(id).catch(() => {});
          }
        }
      },
      clearCart() {
        setItems([]); clearStoredCart(userId); sync(() => cartService.clear());
      },
    };
  }, [items, userId]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
