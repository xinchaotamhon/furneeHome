import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearStoredCart, getStoredCart, saveStoredCart } from '../services/cartService';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => getStoredCart());
  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);

  useEffect(() => {
    saveStoredCart(items);
  }, [items]);

  function addToCart(product, quantity = 1) {
    if (!product || !product._id) return;
    const qty = Math.max(1, Number(quantity) || 1);
    setItems((current) => {
      const index = current.findIndex((item) => item.product._id === product._id);
      if (index >= 0) {
        const next = [...current];
        const updatedQty = next[index].quantity + qty;
        next[index] = { ...next[index], quantity: updatedQty };
        return next;
      }
      return [...current, {
        product,
        quantity: qty,
        price: product.price || 0,
        name: product.name,
        image: product.image || (product.sourceImages && product.sourceImages[0]) || '',
      }];
    });
  }

  function updateQuantity(productId, quantity) {
    const qty = Number(quantity);
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.product._id === productId ? { ...item, quantity: qty } : item
      )
    );
  }

  function removeFromCart(productId) {
    setItems((current) => current.filter((item) => item.product._id !== productId));
  }

  function clearCart() {
    setItems([]);
    setCouponCode('');
    setDiscountPercent(0);
    clearStoredCart();
  }

  function applyCoupon(code) {
    const trimmed = String(code || '').trim().toUpperCase();
    if (trimmed === 'FURNEE10') {
      setCouponCode(trimmed);
      setDiscountPercent(10);
      return { success: true, message: 'Áp dụng mã giảm 10% thành công.' };
    }
    if (trimmed === 'VIP20') {
      setCouponCode(trimmed);
      setDiscountPercent(20);
      return { success: true, message: 'Áp dụng mã VIP giảm 20% thành công.' };
    }
    return { success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' };
  }

  function removeCoupon() {
    setCouponCode('');
    setDiscountPercent(0);
  }

  const totalCount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [items]);

  const rawSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    return Math.round((rawSubtotal * discountPercent) / 100);
  }, [rawSubtotal, discountPercent]);

  const totalPrice = useMemo(() => {
    return Math.max(0, rawSubtotal - discountAmount);
  }, [rawSubtotal, discountAmount]);

  const value = {
    items,
    totalCount,
    rawSubtotal,
    discountPercent,
    discountAmount,
    totalPrice,
    couponCode,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
