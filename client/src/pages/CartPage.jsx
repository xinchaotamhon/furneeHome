import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatPrice';

export default function CartPage() {
  const navigate = useNavigate();
  const {
    items,
    totalCount,
    rawSubtotal,
    discountAmount,
    totalPrice,
    couponCode,
    discountPercent,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [inputCoupon, setInputCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState({ text: '', isError: false });

  function handleApplyCoupon(e) {
    e.preventDefault();
    if (!inputCoupon.trim()) return;
    const res = applyCoupon(inputCoupon);
    setCouponMsg({ text: res.message, isError: !res.success });
    if (res.success) setInputCoupon('');
  }

  if (items.length === 0) {
    return (
      <div className="container page cart-empty-page">
        <div className="empty-cart-card">
          <div className="empty-cart-icon">&#128722;</div>
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p>Hãy khám phá các sản phẩm nội thất cao cấp của FurneeHome và lấp đầy không gian sống mơ ước của bạn.</p>
          <Link to="/products" className="button">
            Khám phá sản phẩm ngay
          </Link>
        </div>
      </div>
    );
  }

  const shippingFee = rawSubtotal >= 2000000 ? 0 : 50000;
  const finalTotal = totalPrice + shippingFee;

  return (
    <div className="container page cart-page">
      <h1 className="page-heading">Giỏ hàng của bạn ({totalCount} sản phẩm)</h1>

      <div className="cart-layout">
        <div className="cart-items-column">
          <div className="cart-table-header">
            <span className="col-prod">Sản phẩm</span>
            <span className="col-price">Đơn giá</span>
            <span className="col-qty">Số lượng</span>
            <span className="col-total">Thành tiền</span>
            <span className="col-action"></span>
          </div>

          <div className="cart-items-list">
            {items.map((item) => {
              const itemTotal = (item.price || 0) * (item.quantity || 1);
              return (
                <div key={item.product._id} className="cart-item-row">
                  <div className="item-details">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="item-thumbnail" />
                    ) : (
                      <div className="item-thumbnail-placeholder">&#129681;</div>
                    )}
                    <div className="item-meta">
                      <Link to={`/products/${item.product._id}`} className="item-title">
                        {item.name}
                      </Link>
                      <span className="item-cat">
                        {item.product.categoryName || item.product.category?.name || 'Nội thất'}
                      </span>
                    </div>
                  </div>

                  <div className="item-price">{formatPrice(item.price)}</div>

                  <div className="item-quantity">
                    <div className="qty-control small">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product._id, item.quantity - 1)}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        min="1"
                        onChange={(e) =>
                          updateQuantity(item.product._id, Math.max(1, Number(e.target.value) || 1))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product._id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="item-subtotal">{formatPrice(itemTotal)}</div>

                  <div className="item-actions">
                    <button
                      type="button"
                      className="btn-remove"
                      title="Xóa sản phẩm"
                      onClick={() => removeFromCart(item.product._id)}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-bottom-actions">
            <Link to="/products" className="button button-outline">
              &larr; Tiếp tục mua sắm
            </Link>
            <button type="button" className="button button-text" onClick={clearCart}>
              Xóa toàn bộ giỏ hàng
            </button>
          </div>
        </div>

        <div className="cart-summary-column">
          <div className="cart-summary-card">
            <h3>Tóm tắt đơn hàng</h3>

            <div className="summary-row">
              <span>Tạm tính ({totalCount} món):</span>
              <strong>{formatPrice(rawSubtotal)}</strong>
            </div>

            {discountPercent > 0 && (
              <div className="summary-row discount-row">
                <span>Giảm giá ({couponCode} - {discountPercent}%):</span>
                <strong>-{formatPrice(discountAmount)}</strong>
              </div>
            )}

            <div className="summary-row">
              <span>Phí vận chuyển:</span>
              <strong>{shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}</strong>
            </div>

            {rawSubtotal < 2000000 && (
              <p className="shipping-hint">
                Mua thêm {formatPrice(2000000 - rawSubtotal)} để được miễn phí giao hàng toàn quốc!
              </p>
            )}

            <div className="coupon-box">
              <form onSubmit={handleApplyCoupon} className="coupon-form">
                <input
                  type="text"
                  placeholder="Mã giảm (FURNEE10, VIP20)"
                  value={inputCoupon}
                  onChange={(e) => setInputCoupon(e.target.value)}
                />
                <button type="submit" className="button button-small">
                  Áp dụng
                </button>
              </form>
              {couponMsg.text && (
                <p className={`coupon-msg ${couponMsg.isError ? 'err' : 'ok'}`}>
                  {couponMsg.text}
                </p>
              )}
              {couponCode && (
                <div className="active-coupon-tag">
                  <span>Mã đang dùng: <strong>{couponCode}</strong></span>
                  <button type="button" onClick={removeCoupon}>Bỏ dùng</button>
                </div>
              )}
            </div>

            <div className="summary-total-divider"></div>

            <div className="summary-row total-row">
              <span>Tổng cộng:</span>
              <span className="total-amount">{formatPrice(finalTotal)}</span>
            </div>

            <button
              type="button"
              className="button button-accent button-full"
              onClick={() => navigate('/checkout')}
            >
              Tiến hành thanh toán &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
