import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';
import {
  calculateShippingFee,
  FALLBACK_PROVINCES,
} from '../services/locationService';
import { validateVietnamPhone, validateSpecificAddress } from '../utils/validation';
import QrPaymentCard from '../components/payment/QrPaymentCard';
import VoucherModal from '../components/checkout/VoucherModal';

function hasCompleteDeliveryProfile(user) {
  return Boolean(
    user?.name?.trim()
    && user?.phone
    && user?.address?.trim()
    && user?.provinceCode
    && user?.districtCode
    && user?.wardCode,
  );
}

function provinceName(code) {
  return FALLBACK_PROVINCES.find((province) => Number(province.code) === Number(code))?.name || 'Việt Nam';
}

export default function CheckoutPage() {
  const {
    items: allCartItems,
    selectedItems,
    selectedSubtotal,
    selectedCount,
    clearPurchasedItems,
  } = useCart();
  const location = useLocation();
  const buyNowItem = location.state?.buyNowItem;

  // Chỉ thanh toán các sản phẩm được tích chọn (hoặc tất cả nếu chưa chọn lọc)
  const items = buyNowItem ? [buyNowItem] : (selectedItems.length > 0 ? selectedItems : allCartItems);
  const rawSubtotal = buyNowItem
    ? buyNowItem.price * buyNowItem.quantity
    : (selectedItems.length > 0 ? selectedSubtotal : allCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const totalCount = buyNowItem
    ? buyNowItem.quantity
    : (selectedItems.length > 0 ? selectedCount : allCartItems.reduce((sum, item) => sum + item.quantity, 0));
  const { user, openLogin } = useAuth();
  const navigate = useNavigate();
  const profileComplete = hasCompleteDeliveryProfile(user);
  const openProfile = () => navigate('/profile', {
    state: {
      returnToCheckout: true,
      checkoutState: location.state,
    },
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Phương thức thanh toán (COD hoặc Chuyển khoản QR)
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [isVoucherOpen, setVoucherOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState(null);

  if (!items.length && !result) {
    return (
      <main className="container page cart-empty-page">
        <div className="empty-cart-card">
          <h1>Chưa có sản phẩm để thanh toán</h1>
          <p>Hãy chọn sản phẩm bạn yêu thích để bắt đầu mua sắm.</p>
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
        <p>Đăng nhập giúp bạn theo dõi đơn hàng và tình trạng giao nhận sau khi đặt.</p>
        <button className="button" type="button" onClick={() => openLogin('login')}>
          Đăng nhập
        </button>
      </main>
    );
  }

  if (!profileComplete) {
    return (
      <main className="container page checkout-page">
        <div className="profile-required-backdrop" role="dialog" aria-modal="true" aria-labelledby="profile-required-title">
          <div className="profile-required-dialog">
            <div className="profile-required-icon" aria-hidden="true">⌖</div>
            <p className="eyebrow">THÔNG TIN GIAO HÀNG</p>
            <h1 id="profile-required-title">Cập nhật thông tin trước khi mua</h1>
            <p>Vui lòng điền họ tên, số điện thoại và địa chỉ nhận hàng trong hồ sơ. Sau khi lưu, bạn sẽ được quay lại trang thanh toán này.</p>
            <button className="button button-full" type="button" onClick={openProfile}>
              Đi đến trang hồ sơ
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Tính tiền phí ship theo quy tắc
  const shippingInfo = calculateShippingFee(user.provinceCode);
  const shippingDiscount = appliedVoucher ? Math.min(appliedVoucher.discount, shippingInfo.fee) : 0;
  const shippingFee = shippingInfo.fee - shippingDiscount;
  const totalAmount = rawSubtotal + shippingFee;

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!user.name.trim()) return setError('Vui lòng cập nhật họ và tên trong hồ sơ.');

    // Kiểm tra số điện thoại vùng Việt Nam
    const phoneCheck = validateVietnamPhone(user.phone);
    if (!phoneCheck.isValid) {
      return setError(phoneCheck.message);
    }

    const addressCheck = validateSpecificAddress(user.address);
    if (!addressCheck.isValid) {
      return setError(addressCheck.message);
    }

    // Ghép địa chỉ đầy đủ
    const addressParts = [
      addressCheck.address,
      user.wardName,
      user.districtName,
      provinceName(user.provinceCode),
    ].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    setSaving(true);
    try {
      const order = await orderService.createOrder({
        items: items.map((item) => ({
          productId: item.product._id || item.product.id,
          quantity: item.quantity,
        })),
        shippingAddress: {
          fullName: user.name.trim(),
          phone: user.phone.trim(),
          address: fullAddress,
          provinceCode: user.provinceCode,
          note: user.deliveryNote.trim(),
        },
        voucherCode: appliedVoucher?.code || '',
        paymentMethod,
      });
      const purchasedIds = items.map((item) => item.product._id || item.product.id);
      if (!buyNowItem) clearPurchasedItems(purchasedIds);
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

          <div style={{ margin: '18px 0', textAlign: 'left', background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <p style={{ margin: '4px 0' }}>
              <strong>Người nhận:</strong> {result.shippingAddress?.fullName} ({result.shippingAddress?.phone})
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Địa chỉ:</strong> {result.shippingAddress?.address}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Tổng thanh toán:</strong> {formatPrice(result.totalAmount)}
              {Number(result.shippingFee) > 0 && ` (Đã gồm phí ship ${formatPrice(result.shippingFee)})`}
            </p>
          </div>

          {isBankTransfer ? (
            <div className="success-payment-wrapper">
              <QrPaymentCard order={result} onComplete={() => navigate('/orders')} />
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
        <h1>Thông tin đơn hàng & Giao hàng</h1>
      </div>

      <form className="checkout-layout" onSubmit={submit}>
        <section className="checkout-form-column">
          {/* Bảng danh sách sản phẩm theo mẫu TMĐT */}
          <div className="checkout-table-card">
            <h2>Sản phẩm đã chọn ({totalCount})</h2>
            <div className="checkout-table-wrap">
              <table className="checkout-table">
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Sản phẩm</th>
                    <th style={{ width: '20%', textAlign: 'right' }}>Đơn giá</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Số lượng</th>
                    <th style={{ width: '20%', textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const prodId = item.product._id || item.product.id;
                    const prodImage = item.product.image || (item.product.images && item.product.images[0]);
                    return (
                      <tr key={prodId}>
                        <td>
                          <div className="checkout-prod-info">
                            {prodImage ? (
                              <img src={prodImage} alt={item.name} className="checkout-prod-thumb" />
                            ) : (
                              <div className="checkout-prod-thumb-placeholder">🛋️</div>
                            )}
                            <span className="checkout-prod-name">{item.name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatPrice(item.price)}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatPrice(item.price * item.quantity)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Địa chỉ mặc định lấy từ hồ sơ */}
          <div className="checkout-section-card delivery-address-card">
            <div className="delivery-address-heading">
              <h2>⌖ Địa chỉ nhận hàng</h2>
              <button className="delivery-address-change" type="button" onClick={openProfile}>Thay đổi</button>
            </div>
            <div className="delivery-address-content">
              <strong>{user.name} (+84) {user.phone}</strong>
              <span>{[user.address, user.wardName, user.districtName, provinceName(user.provinceCode)].filter(Boolean).join(', ')}</span>
              <em>Mặc định</em>
            </div>
          </div>

          {/* Phương thức thanh toán */}
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

        {/* Cột tóm tắt thanh toán */}
        <aside className="checkout-summary-column">
          <div className="checkout-summary-card">
            <h2>Tóm tắt thanh toán</h2>
            <div className="checkout-items-list">
              <p className="line">
                <span>Tiền hàng ({totalCount} món)</span>
                <strong>{formatPrice(rawSubtotal)}</strong>
              </p>
              <p className="line">
                <span>Phí vận chuyển ({shippingInfo.label})</span>
                <strong>{shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}</strong>
              </p>
              <button className="checkout-voucher-button" type="button" onClick={() => setVoucherOpen(true)}>
                {appliedVoucher ? `Đã áp dụng ${appliedVoucher.code}` : 'Chọn voucher vận chuyển'}
              </button>
              {appliedVoucher && (
                <p className="checkout-voucher-discount">
                  Đã giảm {formatPrice(shippingDiscount)} phí vận chuyển
                </p>
              )}
            </div>

            <p className="line-total">
              <span>Tổng thanh toán</span>
              <strong>{formatPrice(totalAmount)}</strong>
            </p>

            {error && <p className="form-error">{error}</p>}

            <button className="button button-full" disabled={saving} type="submit">
              {saving
                ? 'Đang tạo đơn hàng…'
                : paymentMethod === 'BANK_TRANSFER'
                ? 'Tiếp tục thanh toán QR'
                : 'Đặt hàng COD'}
            </button>

            <p className="checkout-guarantee">
              🔒 Đảm bảo thông tin giao hàng và giao dịch được bảo mật tuyệt đối.
            </p>
          </div>
        </aside>
      </form>
      {isVoucherOpen && (
        <VoucherModal
          onClose={() => setVoucherOpen(false)}
          onApply={setAppliedVoucher}
          subtotal={rawSubtotal}
          region={shippingInfo.region}
          appliedVoucherId={appliedVoucher?.id}
          baseShippingFee={shippingInfo.fee}
        />
      )}
    </main>
  );
}
