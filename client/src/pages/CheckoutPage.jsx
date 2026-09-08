import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    items,
    totalCount,
    rawSubtotal,
    discountAmount,
    discountPercent,
    couponCode,
    totalPrice,
    clearCart,
  } = useCart();

  const [shippingInfo, setShippingInfo] = useState({
    fullName: user?.name || '',
    phone: '',
    email: user?.email || '',
    address: '',
    city: 'TP. Hồ Chí Minh',
    note: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdOrder, setCreatedOrder] = useState(null);

  const shippingFee = rawSubtotal >= 2000000 ? 0 : 50000;
  const finalTotal = totalPrice + shippingFee;

  const mockOrderCode = useMemo(() => {
    return 'FH' + Math.floor(100000 + Math.random() * 900000);
  }, []);

  const vietQrUrl = useMemo(() => {
    const bankId = 'MB';
    const accountNo = '0987654321';
    const accountName = 'CONG TY NOI THAT FURNEEHOME';
    const desc = encodeURIComponent(`THANHTOAN ${mockOrderCode}`);
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${finalTotal}&addInfo=${desc}&accountName=${encodeURIComponent(accountName)}`;
  }, [finalTotal, mockOrderCode]);

  function handleChange(field, value) {
    setShippingInfo((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!shippingInfo.fullName.trim()) {
      setError('Vui lòng nhập họ và tên người nhận.');
      return;
    }
    if (!shippingInfo.phone.trim()) {
      setError('Vui lòng nhập số điện thoại nhận hàng.');
      return;
    }
    if (!shippingInfo.address.trim()) {
      setError('Vui lòng nhập địa chỉ giao hàng chi tiết.');
      return;
    }

    setSubmitting(true);
    const orderPayload = {
      orderCode: mockOrderCode,
      user: user?._id || null,
      orderItems: items.map((i) => ({
        product: i.product._id,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        image: i.image,
      })),
      shippingAddress: shippingInfo,
      paymentMethod,
      itemsPrice: rawSubtotal,
      shippingPrice: shippingFee,
      discountPrice: discountAmount,
      totalPrice: finalTotal,
      isPaid: paymentMethod === 'VIETQR',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      let saved = null;
      try {
        saved = await orderService.createOrder(orderPayload);
      } catch {
        saved = { ...orderPayload, _id: 'ord-' + Date.now() };
      }

      try {
        const localOrders = JSON.parse(localStorage.getItem('furneehome_orders') || '[]');
        localOrders.unshift(saved);
        localStorage.setItem('furneehome_orders', JSON.stringify(localOrders));
      } catch {}

      clearCart();
      setCreatedOrder(saved);
    } catch (err) {
      setError(err.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  if (createdOrder) {
    return (
      <div className="container page order-success-page">
        <div className="success-card">
          <div className="success-check">&#10004;</div>
          <h1>Đặt hàng thành công!</h1>
          <p className="order-lead">
            Cảm ơn bạn đã tin tưởng FurneeHome. Mã đơn hàng của bạn là{' '}
            <strong className="order-highlight">{createdOrder.orderCode || mockOrderCode}</strong>.
          </p>

          <div className="success-details-box">
            <div className="box-col">
              <h3>Thông tin người nhận</h3>
              <p><strong>Họ tên:</strong> {createdOrder.shippingAddress?.fullName}</p>
              <p><strong>Số điện thoại:</strong> {createdOrder.shippingAddress?.phone}</p>
              <p><strong>Địa chỉ:</strong> {createdOrder.shippingAddress?.address}, {createdOrder.shippingAddress?.city}</p>
              <p><strong>Hình thức:</strong> {createdOrder.paymentMethod === 'VIETQR' ? 'Chuyển khoản VietQR' : 'Thanh toán tiền mặt (COD)'}</p>
            </div>
            <div className="box-col">
              <h3>Chi tiết thanh toán</h3>
              <p><strong>Số lượng món:</strong> {totalCount || createdOrder.orderItems?.length} sản phẩm</p>
              <p><strong>Tổng thanh toán:</strong> <span className="price-big">{formatPrice(createdOrder.totalPrice)}</span></p>
              <p><strong>Trạng thái:</strong> <span className="badge-pending">Chờ xử lý & đóng gói</span></p>
            </div>
          </div>

          {createdOrder.paymentMethod === 'VIETQR' && (
            <div className="vietqr-box">
              <h3>Mã quét thanh toán VietQR chuyển khoản nhanh 24/7</h3>
              <p>Quét mã QR dưới đây bằng bất kỳ ứng dụng Ngân hàng nào để hoàn tất:</p>
              <img src={vietQrUrl} alt="VietQR" className="vietqr-image" />
              <div className="bank-info-table">
                <p>Ngân hàng: <strong>MBBank (Ngân hàng Quân Đội)</strong></p>
                <p>Chủ tài khoản: <strong>CONG TY NOI THAT FURNEEHOME</strong></p>
                <p>Số tài khoản: <strong>0987654321</strong></p>
                <p>Nội dung chuyển khoản: <strong>THANHTOAN {createdOrder.orderCode || mockOrderCode}</strong></p>
              </div>
            </div>
          )}

          <div className="success-actions">
            <Link to="/orders" className="button button-accent">
              Xem lịch sử đơn hàng
            </Link>
            <Link to="/products" className="button button-outline">
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container page cart-empty-page">
        <div className="empty-cart-card">
          <h2>Bạn chưa có sản phẩm nào trong giỏ hàng</h2>
          <p>Vui lòng chọn sản phẩm vào giỏ trước khi tiến hành thanh toán.</p>
          <Link to="/products" className="button">
            Xem danh sách sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page checkout-page">
      <h1 className="page-heading">Thanh toán & Đặt hàng</h1>

      <form onSubmit={handleSubmit} className="checkout-layout">
        <div className="checkout-form-column">
          <div className="checkout-section-card">
            <h2>1. Thông tin giao hàng</h2>

            <div className="form-group">
              <label>Họ và tên người nhận *</label>
              <input
                type="text"
                required
                placeholder="Nguyễn Văn A"
                value={shippingInfo.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  placeholder="0912345678"
                  value={shippingInfo.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Email thông báo</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={shippingInfo.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Địa chỉ nhận hàng chi tiết *</label>
              <input
                type="text"
                required
                placeholder="Số nhà, tên đường, phường/xã..."
                value={shippingInfo.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Tỉnh / Thành phố *</label>
              <select
                value={shippingInfo.city}
                onChange={(e) => handleChange('city', e.target.value)}
              >
                <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                <option value="Hà Nội">Hà Nội</option>
                <option value="Đà Nẵng">Đà Nẵng</option>
                <option value="Hải Phòng">Hải Phòng</option>
                <option value="Cần Thơ">Cần Thơ</option>
                <option value="Bình Dương">Bình Dương</option>
                <option value="Đồng Nai">Đồng Nai</option>
                <option value="Khác">Tỉnh thành khác</option>
              </select>
            </div>

            <div className="form-group">
              <label>Ghi chú đơn hàng (tùy chọn)</label>
              <textarea
                rows={2}
                placeholder="Ví dụ: Giao giờ hành chính, gọi điện trước 15 phút..."
                value={shippingInfo.note}
                onChange={(e) => handleChange('note', e.target.value)}
              />
            </div>
          </div>

          <div className="checkout-section-card">
            <h2>2. Phương thức thanh toán</h2>

            <div className="payment-options">
              <label className={`payment-option-card ${paymentMethod === 'COD' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={paymentMethod === 'COD'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <div className="payment-option-info">
                  <strong>Thanh toán tiền mặt khi nhận hàng (COD)</strong>
                  <p>Nhận hàng kiểm tra xong mới thanh toán cho nhân viên giao hàng.</p>
                </div>
              </label>

              <label className={`payment-option-card ${paymentMethod === 'VIETQR' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="VIETQR"
                  checked={paymentMethod === 'VIETQR'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <div className="payment-option-info">
                  <strong>Chuyển khoản VietQR siêu tốc (Miễn phí giao dịch)</strong>
                  <p>Hệ thống tự động hiển thị mã QR chuẩn ngân hàng, quét mã thanh toán 30 giây.</p>
                </div>
              </label>
            </div>

            {paymentMethod === 'VIETQR' && (
              <div className="qr-preview-card">
                <h4>Xem trước mã thanh toán VietQR:</h4>
                <div className="qr-flex">
                  <img src={vietQrUrl} alt="VietQR" className="qr-thumb" />
                  <div className="qr-instructions">
                    <p>Mã đơn hàng: <strong>{mockOrderCode}</strong></p>
                    <p>Số tiền: <strong>{formatPrice(finalTotal)}</strong></p>
                    <p>Ngân hàng: <strong>MBBank - 0987654321</strong></p>
                    <p className="qr-note">Sau khi nhấn "Xác nhận đặt hàng", mã QR kích thước lớn và hướng dẫn chi tiết sẽ được hiển thị.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="checkout-summary-column">
          <div className="checkout-summary-card">
            <h3>Đơn hàng của bạn ({totalCount} món)</h3>

            <div className="order-items-mini">
              {items.map((item) => (
                <div key={item.product._id} className="item-mini-row">
                  <div className="item-mini-img">
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
                    ) : (
                      <span>&#129681;</span>
                    )}
                  </div>
                  <div className="item-mini-info">
                    <p className="title">{item.name}</p>
                    <p className="sub">
                      SL: {item.quantity} &times; {formatPrice(item.price)}
                    </p>
                  </div>
                  <div className="item-mini-price">
                    {formatPrice((item.price || 0) * (item.quantity || 1))}
                  </div>
                </div>
              ))}
            </div>

            <div className="summary-details">
              <div className="line">
                <span>Tạm tính:</span>
                <span>{formatPrice(rawSubtotal)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="line discount">
                  <span>Giảm giá ({couponCode}):</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="line">
                <span>Phí vận chuyển:</span>
                <span>{shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}</span>
              </div>
              <div className="line-total">
                <span>Tổng cộng:</span>
                <span className="total-val">{formatPrice(finalTotal)}</span>
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button
              type="submit"
              className="button button-accent button-full submit-order-btn"
              disabled={submitting}
            >
              {submitting ? 'Đang tạo đơn hàng...' : 'Xác nhận đặt hàng'}
            </button>

            <p className="terms-agree">
              Bằng việc đặt hàng, bạn đồng ý với Điều khoản dịch vụ và Chính sách giao hàng của FurneeHome.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
