import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';

const idOf = (item) => item.product?._id || item.product?.id;

export default function CartPage() {
  const [draftQuantities, setDraftQuantities] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const { user, openLogin } = useAuth();
  const {
    items,
    totalCount,
    selectedItems,
    selectedCount,
    selectedSubtotal,
    isAllSelected,
    maxSelectedCount,
    toggleItemSelection,
    toggleSelectAll,
    updateQuantity,
    removeFromCart,
    clearPurchasedItems,
    clearCart,
  } = useCart();

  if (!items.length) {
    return (
      <main className="container page cart-empty-page">
        <div className="empty-cart-card">
          <h1>Giỏ hàng đang trống</h1>
          <p>Chọn nội thất phù hợp cho không gian của bạn.</p>
          <Link className="button" to="/products">
            Xem sản phẩm
          </Link>
        </div>
      </main>
    );
  }

  const removeSelected = () => {
    if (!selectedItems.length) return;
    if (window.confirm(`Bạn có chắc muốn xóa ${selectedItems.length} sản phẩm đã chọn?`)) {
      clearPurchasedItems(selectedItems.map(idOf));
    }
  };

  const continueToCheckout = () => {
    navigate('/checkout');
  };

  const handleQuantityChange = (id, value) => {
    setDraftQuantities((current) => ({ ...current, [id]: value }));
    if (value !== '') updateQuantity(id, value);
  };

  const finishQuantityEdit = (id) => {
    setDraftQuantities((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(items.length / 7));
  const page = Math.min(currentPage, totalPages);
  const visibleItems = items.slice((page - 1) * 7, page * 7);

  return (
    <main className="container page cart-page">
      <div className="split-heading">
        <div>
          <p className="eyebrow">GIỎ HÀNG</p>
          <h1>Đơn hàng của bạn</h1>
          <p>
            Đã chọn <strong>{selectedCount}</strong> / {totalCount} món (tối đa {maxSelectedCount} món)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {selectedItems.length > 0 && selectedItems.length < items.length && (
            <button className="text-button danger" type="button" onClick={removeSelected}>
              Xóa mục đã chọn
            </button>
          )}
          <button className="text-button danger" type="button" onClick={clearCart}>
            Xóa tất cả
          </button>
        </div>
      </div>

      <div className="cart-layout">
        <section className="cart-items-column">
          {/* Thanh chọn tất cả */}
          <div className="cart-select-all-bar">
            <label className="cart-checkbox-label select-all-label">
              <input
                type="checkbox"
                className="cart-checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
              />
              <span>
                Chọn tất cả ({items.length} loại sản phẩm, {totalCount} món)
              </span>
            </label>
          </div>

          {visibleItems.map((item) => {
            const id = idOf(item);
            const isChecked = item.selected !== false;
            const selectionBlocked = !isChecked && selectedCount + item.quantity > maxSelectedCount;

            return (
              <article className={`cart-item-row ${isChecked ? 'is-selected' : ''}`} key={id}>
                <div className="cart-item-select">
                  <input
                    type="checkbox"
                    className="cart-checkbox"
                    checked={isChecked}
                    disabled={selectionBlocked}
                    onChange={() => toggleItemSelection(id)}
                    title={selectionBlocked ? `Chỉ có thể chọn tối đa ${maxSelectedCount} món` : undefined}
                    aria-label={`Chọn sản phẩm ${item.name}`}
                  />
                </div>

                <div className="item-details">
                  {item.image ? (
                    <img src={item.image} alt="" className="item-thumbnail" />
                  ) : (
                    <div className="item-thumbnail-placeholder">⌂</div>
                  )}
                  <div>

                  {selectedCount >= maxSelectedCount && (
                    <p className="form-error" style={{ margin: '12px 0 0' }}>
                      Bạn đã chọn tối đa {maxSelectedCount} món.
                    </p>
                  )}
                    <Link className="item-title" to={`/products/${id}`}>
                      {item.name}
                    </Link>
                    <p className="muted">{formatPrice(item.price)}</p>
                  </div>
                </div>

                <label className="sr-only" htmlFor={`qty-${id}`}>
                  Số lượng
                </label>
                <input
                  id={`qty-${id}`}
                  className="cart-quantity"
                  type="number"
                  min="1"
                  max={item.product?.stock ?? item.product?.countInStock ?? 99}
                  value={draftQuantities[id] ?? item.quantity}
                  onChange={(event) => handleQuantityChange(id, event.target.value)}
                  onBlur={() => finishQuantityEdit(id)}
                />

                <strong>{formatPrice(item.price * item.quantity)}</strong>

                <button
                  className="text-button danger"
                  type="button"
                  onClick={() => removeFromCart(id)}
                >
                  Xóa
                </button>
              </article>
            );
          })}
          {totalPages > 1 && (
            <nav className="simple-pagination cart-pagination" aria-label="Chuyển trang giỏ hàng">
              <button type="button" disabled={page === 1} onClick={() => setCurrentPage(page - 1)}>
                ← Trước
              </button>
              <span>Trang {page} / {totalPages}</span>
              <button type="button" disabled={page === totalPages} onClick={() => setCurrentPage(page + 1)}>
                Sau →
              </button>
            </nav>
          )}
        </section>

        <aside className="order-summary">
          <h2>Tóm tắt đơn hàng</h2>
          <div className="summary-lines">
            <p>
              <span>Sản phẩm đã chọn</span>
              <strong>{selectedCount} món</strong>
            </p>
            <p>
              <span>Tạm tính</span>
              <strong className="summary-total-price">{formatPrice(selectedSubtotal)}</strong>
            </p>
          </div>

          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Phí vận chuyển sẽ được tính tại bước thanh toán theo khu vực giao hàng.
          </p>

          {selectedCount > 0 ? (
            user ? (
              <button className="button button-full" type="button" onClick={continueToCheckout}>
                Mua hàng ({selectedCount})
              </button>
            ) : (
              <button className="button button-full" type="button" onClick={() => openLogin('login')}>
                Đăng nhập để mua hàng
              </button>
            )
          ) : (
            <button
              className="button button-full button-disabled"
              disabled
              title="Vui lòng tích chọn ít nhất 1 sản phẩm để thanh toán"
            >
              Mua hàng (0)
            </button>
          )}

          {selectedCount === 0 && (
            <p className="form-error" style={{ fontSize: '0.82rem', textAlign: 'center', marginTop: '8px' }}>
              * Hãy tích chọn sản phẩm bạn muốn thanh toán
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
