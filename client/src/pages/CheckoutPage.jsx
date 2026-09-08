import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';
import QrPaymentCard from '../components/payment/QrPaymentCard';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, openLogin } = useAuth();
  const { items, totalCount, rawSubtotal, clearCart } = useCart();
  const [form, setForm] = useState({
    fullName: user?.name || '',
    phone: '',
    address: '',
    note: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!items.length && !result) {
    return (
      <main className="container page cart-empty-page">
        <div className="empty-cart-card">
          <h1>Chưa có sản phẩm để thanh toán</h1>
          <Link className="button" to="/products">
            Quay về cửa hàng
          </Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container page access-denied">
        <h1>Đăng nhập để thanh toán</h1>
        <p>Đăng nhập giúp bạn theo dõi đơn hàng sau khi đặt.</p>
        <button className="button" type="button" onClick={() => openLogin('login')}>
          Đăng nhập
        </button>
      </main>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.fullName.trim() || !form.phone.trim() || !form.address.trim()) {
      return setError('Vui lòng điền tên, số điện thoại và địa chỉ nhận hàng.');
    }

    setSaving(true);
    try {
      const order = await orderService.createOrder({
        items: items.map((item) => ({
          productId: item.product._id || item.product.id,
          quantity: item.quantity,
        })),
        shippingAddress: form,
        paymentMethod,
      });
      clearCart();
      setResult(order);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể tạo đơn hàng. Hãy thử lại.');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const isBankTransfer = result.paymentMethod === 'BANK_TRANSFER';

    return (
      <main className="container page order-success-page">
        <div className="success-card qr-success-card">
          <div className="success-status-icon">✓</div>
          <h1>Đặt hàng thành công!</h1>
          <p className="order-code-banner">
            Mã đơn hàng: <strong>{result.orderNumber || result._id}</strong>
          </p>

          {isBankTransfer ? (
            <div className="success-payment-wrapper">
              <QrPaymentCard
                order={result}
                onComplete={() => navigate('/orders')}
              />
            </div>
          ) : (
            <div className="cod-success-info">
              <p>
                Phương thức: <strong>Thanh toán tiền mặt khi nhận hàng (COD)</strong>.
              </p>
              <p>Chúng tôi sẽ liên hệ số điện thoại {result.shippingAddress?.phone} để xác nhận trước khi giao hàng.</p>
              <div className="cod-success-actions">
                <Link className="button" to="/orders">
                  Xem đơn hàng
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="container page checkout-page">
      <div className="page-heading">
        <p className="eyebrow">THANH TOÁN</p>
        <h1>Thông tin đơn hàng</h1>
      </div>

      <form className="checkout-layout" onSubmit={submit}>
        <section className="checkout-form-column">
          {/* Shipping Details */}
          <div className="checkout-section-card">
            <h2>1. Thông tin giao hàng</h2>
            <label>
              Họ và tên *
              <input
                value={form.fullName}
                placeholder="Nguyễn Văn A"
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                required
              />
            </label>
            <label>
              Số điện thoại *
              <input
                inputMode="tel"
                value={form.phone}
                placeholder="0912 345 678"
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                required
              />
            </label>
            <label>
              Địa chỉ nhận hàng *
              <textarea
                rows="3"
                value={form.address}
                placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                required
              />
            </label>
            <label>
              Ghi chú đơn hàng (tùy chọn)
              <textarea
                rows="2"
                value={form.note}
                placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                onChange={(event) => setForm({ ...form, note: event.target.value })}
              />
            </label>
          </div>

          {/* Payment Method Selector */}
          <div className="checkout-section-card">
            <h2>2. Phương thức thanh toán</h2>
            <div className="payment-options-grid">
              <label className={`payment-method-card ${paymentMethod === 'BANK_TRANSFER' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="BANK_TRANSFER"
                  checked={paymentMethod === 'BANK_TRANSFER'}
                  onChange={() => setPaymentMethod('BANK_TRANSFER')}
                />
                <div className="payment-card-content">
                  <div className="payment-card-icon">📱</div>
                  <div className="payment-card-text">
                    <strong>Chuyển khoản QR (VietQR / VNPAY)</strong>
                    <span>Quét mã QR tiện lợi qua VNPAY hoặc bất kỳ App ngân hàng nào (VCB, MB, Techcombank...)</span>
                    <div className="payment-tag-list">
                      <span className="mini-tag">VNPAY</span>
                      <span className="mini-tag">Vietcombank</span>
                      <span className="mini-tag">MoMo</span>
                      <span className="mini-tag">+40 Ngân hàng</span>
                    </div>
                  </div>
                </div>
              </label>

              <label className={`payment-method-card ${paymentMethod === 'COD' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')}
                />
                <div className="payment-card-content">
                  <div className="payment-card-icon">💵</div>
                  <div className="payment-card-text">
                    <strong>Thanh toán khi nhận hàng (COD)</strong>
                    <span>Thanh toán tiền mặt cho nhân viên giao hàng khi nhận sản phẩm</span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* Order Summary Aside */}
        <aside className="checkout-summary-column">
          <div className="checkout-summary-card">
            <h2>Đơn hàng ({totalCount})</h2>
            <div className="checkout-items-list">
              {items.map((item) => (
                <p className="line" key={item.product._id || item.product.id}>
                  <span>{item.name} × {item.quantity}</span>
                  <strong>{formatPrice(item.price * item.quantity)}</strong>
                </p>
              ))}
            </div>

            <p className="line-total">
              <span>Tổng thanh toán</span>
              <strong>{formatPrice(rawSubtotal)}</strong>
            </p>

            {error && <p className="form-error">{error}</p>}

            <button className="button button-full" disabled={saving} type="submit">
              {saving ? 'Đang tạo đơn hàng…' : paymentMethod === 'BANK_TRANSFER' ? 'Tiếp tục thanh toán QR' : 'Đặt hàng COD'}
            </button>

            <p className="checkout-guarantee">
              🔒 Đảm bảo thông tin giao hàng và giao dịch được bảo mật tuyệt đối.
            </p>
          </div>
        </aside>
      </form>
    </main>
  );
}
