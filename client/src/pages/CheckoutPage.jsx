import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';
import {
  fetchProvinces,
  fetchDistricts,
  fetchWards,
  calculateShippingFee,
  FALLBACK_PROVINCES,
} from '../services/locationService';
import { validateVietnamPhone, validateSpecificAddress } from '../utils/validation';
import QrPaymentCard from '../components/payment/QrPaymentCard';

export default function CheckoutPage() {
  const {
    items: allCartItems,
    selectedItems,
    selectedSubtotal,
    selectedCount,
    clearPurchasedItems,
  } = useCart();

  // Chỉ thanh toán các sản phẩm được tích chọn (hoặc tất cả nếu chưa chọn lọc)
  const items = selectedItems.length > 0 ? selectedItems : allCartItems;
  const rawSubtotal = selectedItems.length > 0 ? selectedSubtotal : allCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCount = selectedItems.length > 0 ? selectedCount : allCartItems.reduce((sum, item) => sum + item.quantity, 0);
  const { user, openLogin } = useAuth();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Phương thức thanh toán (COD hoặc Chuyển khoản QR)
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');

  // Thông tin người nhận
  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [specificAddress, setSpecificAddress] = useState('');
  const [note, setNote] = useState('');

  // Tỉnh / Quận / Phường
  const [provinces, setProvinces] = useState(FALLBACK_PROVINCES);
  const [selectedProvince, setSelectedProvince] = useState(79); // Mặc định 79: TP. Hồ Chí Minh
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [wards, setWards] = useState([]);
  const [selectedWard, setSelectedWard] = useState('');
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // Tải danh sách tỉnh thành online
  useEffect(() => {
    fetchProvinces().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setProvinces(data);
      }
    });
  }, []);

  // Tải quận/huyện khi đổi tỉnh
  useEffect(() => {
    if (!selectedProvince) {
      setDistricts([]);
      setSelectedDistrict('');
      setWards([]);
      setSelectedWard('');
      return;
    }
    setLoadingDistricts(true);
    fetchDistricts(selectedProvince)
      .then((data) => {
        setDistricts(data);
        setSelectedDistrict('');
        setWards([]);
        setSelectedWard('');
      })
      .finally(() => setLoadingDistricts(false));
  }, [selectedProvince]);

  // Tải phường/xã khi đổi quận/huyện
  useEffect(() => {
    if (!selectedDistrict) {
      setWards([]);
      setSelectedWard('');
      return;
    }
    setLoadingWards(true);
    fetchWards(selectedDistrict)
      .then((data) => {
        setWards(data);
        setSelectedWard('');
      })
      .finally(() => setLoadingWards(false));
  }, [selectedDistrict]);

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

  // Tính tiền phí ship theo quy tắc
  const shippingInfo = calculateShippingFee(selectedProvince);
  const shippingFee = shippingInfo.fee;
  const totalAmount = rawSubtotal + shippingFee;

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!fullName.trim()) return setError('Vui lòng nhập họ và tên người nhận.');

    // Kiểm tra số điện thoại vùng Việt Nam
    const phoneCheck = validateVietnamPhone(phone);
    if (!phoneCheck.isValid) {
      return setError(phoneCheck.message);
    }

    const provinceObj = provinces.find((p) => Number(p.code) === Number(selectedProvince));
    const districtObj = districts.find((d) => Number(d.code) === Number(selectedDistrict));
    const wardObj = wards.find((w) => Number(w.code) === Number(selectedWard));

    if (!provinceObj) return setError('Vui lòng chọn Tỉnh / Thành phố nhận hàng.');

    const addressCheck = validateSpecificAddress(specificAddress);
    if (!addressCheck.isValid) {
      return setError(addressCheck.message);
    }

    // Ghép địa chỉ đầy đủ
    const addressParts = [
      addressCheck.address,
      wardObj ? wardObj.name : '',
      districtObj ? districtObj.name : '',
      provinceObj ? provinceObj.name : '',
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
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: fullAddress,
          provinceCode: selectedProvince,
          note: note.trim(),
        },
        paymentMethod,
      });
      const purchasedIds = items.map((item) => item.product._id || item.product.id);
      clearPurchasedItems(purchasedIds);
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

          {/* Form thông tin giao nhận */}
          <div className="checkout-section-card">
            <h2>1. Thông tin người nhận</h2>
            <label>
              Họ và tên người nhận *
              <input
                value={fullName}
                placeholder="Ví dụ: Nguyễn Văn A"
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>
            <label>
              Số điện thoại người nhận *
              <input
                inputMode="tel"
                value={phone}
                placeholder="Ví dụ: 0912345678"
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="checkout-section-card">
            <h2>2. Địa chỉ giao hàng</h2>
            <p className="location-group-title">Khu vực hành chính</p>
            <div className="location-select-row">
              <label className="location-field-label">
                Tỉnh / Thành phố *
                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(Number(e.target.value))}
                  required
                >
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="location-field-label">
                Quận / Huyện
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  disabled={loadingDistricts || districts.length === 0}
                >
                  <option value="">{loadingDistricts ? 'Đang tải...' : '-- Chọn Quận/Huyện --'}</option>
                  {districts.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="location-field-label">
                Phường / Xã
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  disabled={loadingWards || wards.length === 0}
                >
                  <option value="">{loadingWards ? 'Đang tải...' : '-- Chọn Phường/Xã --'}</option>
                  {wards.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Số nhà, tên đường cụ thể *
              <input
                value={specificAddress}
                placeholder="Ví dụ: 71/5 Huỳnh Tấn Phát, Ấp 31"
                onChange={(event) => setSpecificAddress(event.target.value)}
                required
              />
            </label>

            <label>
              Ghi chú cho đơn hàng (tùy chọn)
              <textarea
                rows="2"
                value={note}
                placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>

          {/* Phương thức thanh toán */}
          <div className="checkout-section-card">
            <h2>3. Phương thức thanh toán</h2>
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
    </main>
  );
}
