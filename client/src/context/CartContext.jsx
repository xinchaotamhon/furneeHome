import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearStoredCart, cartService, getStoredCart, saveStoredCart } from '../services/cartService';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const MAX_SELECTED_COUNT = 100;
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

const normalizeSelection = (cartItems) => {
  let selectedCount = 0;
  return cartItems.map((item) => {
    if (item.selected === false || selectedCount + item.quantity > MAX_SELECTED_COUNT) {
      return { ...item, selected: false };
    }
    selectedCount += item.quantity;
    return item;
  });
};

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id || null;
  const prevUserIdRef = useRef(userId);
  const skipSaveRef = useRef(false);

  // Khởi tạo giỏ hàng từ localStorage theo userId hiện tại
  const [items, setItems] = useState(() => normalizeSelection(getStoredCart(userId)));

  // Khi user thay đổi (đăng nhập / đăng xuất / đổi tài khoản)
  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (prevUserId === userId) return; // không có gì thay đổi
    skipSaveRef.current = true;

    if (!userId) {
      // Đăng xuất → xóa sạch giỏ hàng hiển thị (không xóa storage của user cũ)
      setItems([]);
      return;
    }

    // Đăng nhập / đổi tài khoản → tải giỏ hàng local của tài khoản mới
    setItems(normalizeSelection(getStoredCart(userId)));
  }, [userId]);

  // Lưu vào localStorage mỗi khi items thay đổi (theo key của user hiện tại)
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
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
        const cart = await cartService.sync(local.map((item) => ({
          productId: productId(item.product),
          quantity: item.quantity,
        })));
        if (active) setItems(normalizeSelection(fromRemote(cart)));
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
      maxSelectedCount: MAX_SELECTED_COUNT,
      toggleItemSelection(id) {
        setItems((current) => {
          const target = current.find((item) => productId(item.product) === String(id));
          if (!target) return current;
          if (target.selected === false) {
            const currentSelectedCount = current.reduce(
              (sum, item) => sum + (item.selected !== false ? item.quantity : 0),
              0,
            );
            if (currentSelectedCount + target.quantity > MAX_SELECTED_COUNT) return current;
          }
          return current.map((item) => (
            productId(item.product) === String(id)
              ? { ...item, selected: item.selected === false }
              : item
          ));
        });
      },
      toggleSelectAll() {
        setItems((current) => {
          const nextState = !current.every((item) => item.selected !== false);
          if (!nextState) return current.map((item) => ({ ...item, selected: false }));

          let selectedCount = 0;
          return current.map((item) => {
            if (selectedCount + item.quantity > MAX_SELECTED_COUNT) {
              return { ...item, selected: false };
            }
            selectedCount += item.quantity;
            return { ...item, selected: true };
          });
        });
      },
      addToCart(product, quantity = 1) {
        const id = productId(product);
        const stock = stockOf(product);
        if (!id || stock < 1) return { ok: false, message: 'Sản phẩm hiện đã hết hàng.' };
        const qty = Math.min(stock, Math.max(1, Number(quantity) || 1));
        setItems((current) => {
          const existing = current.find((item) => productId(item.product) === id);
          const selectedCount = current.reduce(
            (sum, item) => sum + (item.selected !== false ? item.quantity : 0),
            0,
          );
          if (!existing) {
            return [
              ...current,
              {
                product,
                quantity: qty,
                price: Number(product.price) || 0,
                name: product.name,
                image: product.image || product.transparentImage || product.sourceImages?.[0] || '',
                selected: selectedCount + qty <= MAX_SELECTED_COUNT,
              },
            ];
          }
          const nextQuantity = Math.min(stock, existing.quantity + qty);
          const otherSelectedCount = selectedCount - (
            existing.selected !== false ? existing.quantity : 0
          );
          return current.map((item) => productId(item.product) === id
            ? {
              ...item,
              product,
              quantity: nextQuantity,
              price: Number(product.price) || 0,
              selected: otherSelectedCount + nextQuantity <= MAX_SELECTED_COUNT,
            }
            : item);
        });
        sync(() => cartService.add(id, qty));
        return { ok: true };
      },
      updateQuantity(id, quantity) {
        const qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) return;
        setItems((current) => current.map((item) => {
          if (productId(item.product) !== String(id)) return item;
          const nextQuantity = Math.min(stockOf(item.product), qty);
          if (item.selected === false) return { ...item, quantity: nextQuantity };
          const otherSelectedCount = current.reduce(
            (sum, currentItem) => sum + (
              currentItem !== item && currentItem.selected !== false ? currentItem.quantity : 0
            ),
            0,
          );
          if (otherSelectedCount + nextQuantity > MAX_SELECTED_COUNT) return item;
          return { ...item, quantity: nextQuantity };
        }));
        sync(() => cartService.update(id, qty));
      },
      removeFromCart(id) {
        setItems((current) => current.filter((item) => productId(item.product) !== String(id)));
        sync(() => cartService.remove(id));
      },
      clearPurchasedItems(purchasedIds = []) {
        const idSet = new Set(purchasedIds.map(String));
        setItems((current) => current.filter((item) => !idSet.has(productId(item.product))));
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
