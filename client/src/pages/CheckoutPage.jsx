import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import orderService from '../services/orderService';
import {
  calculateShippingFee,
  FALLBACK_PROVINCES,
  fetchDistricts,
  fetchProvinces,
  fetchWards,
} from '../services/locationService';
import { formatPrice } from '../utils/formatPrice';

export default function CheckoutPage() {
  const { user, openLogin } = useAuth();
  const { items, totalCount, rawSubtotal, clearCart } = useCart();

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

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
          <Link className="button" to="/products">Quay về cửa hàng</Link>
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
    if (!phone.trim()) return setError('Vui lòng nhập số điện thoại người nhận.');

    const provinceObj = provinces.find((p) => Number(p.code) === Number(selectedProvince));
    const districtObj = districts.find((d) => Number(d.code) === Number(selectedDistrict));
    const wardObj = wards.find((w) => Number(w.code) === Number(selectedWard));

    if (!provinceObj) return setError('Vui lòng chọn Tỉnh/Thành phố.');
    if (!districtObj) return setError('Vui lòng chọn Quận/Huyện.');
    if (!wardObj) return setError('Vui lòng chọn Phường/Xã.');
    if (!specificAddress.trim()) {
      return setError('Vui lòng điền địa chỉ cụ thể (số nhà, tên đường).');
    }

    const fullAddress = `${specificAddress.trim()}, ${wardObj.name}, ${districtObj.name}, ${provinceObj.name}`;

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
          note: note.trim(),
        },
        shippingFee,
        paymentMethod: 'COD',
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
    return (
      <main className="container page order-success-page">
        <div className="success-card">
          <h1>Đặt hàng thành công!</h1>
          <p>
            Mã đơn hàng: <strong>{result.orderNumber || result._id}</strong>.
            Chúng tôi sẽ liên hệ để xác nhận trước khi giao.
          </p>
          <div style={{ margin: '18px 0', textAlign: 'left', background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <p style={{ margin: '4px 0' }}><strong>Người nhận:</strong> {result.shippingAddress?.fullName} ({result.shippingAddress?.phone})</p>
            <p style={{ margin: '4px 0' }}><strong>Địa chỉ:</strong> {result.shippingAddress?.address}</p>
            <p style={{ margin: '4px 0' }}><strong>Tiền hàng:</strong> {formatPrice(result.subtotal || rawSubtotal)}</p>
            <p style={{ margin: '4px 0' }}><strong>Phí vận chuyển:</strong> {formatPrice(result.shippingFee ?? shippingFee)}</p>
            <p style={{ margin: '4px 0', fontSize: '1.15rem', color: 'var(--color-primary)' }}>
              <strong>Tổng thanh toán:</strong> {formatPrice(result.totalAmount || totalAmount)}
            </p>
            <p style={{ margin: '4px 0', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
              Phương thức: <strong>Tiền mặt khi nhận hàng (COD)</strong>
            </p>
          </div>
          <Link className="button" to="/orders">Xem lịch sử đơn hàng</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container page checkout-page">
      <div className="page-heading">
        <p className="eyebrow">THANH TOÁN</p>
        <h1>Thanh toán khi nhận hàng (COD)</h1>
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
                    const id = item.product?._id || item.product?.id;
                    const imgUrl = item.image || item.product?.image || item.product?.transparentImage || '';
                    return (
                      <tr key={id}>
                        <td>
                          <div className="checkout-prod-info">
                            {imgUrl ? (
                              <img src={imgUrl} alt={item.name} className="checkout-prod-thumb" />
                            ) : (
                              <div className="checkout-prod-thumb-placeholder">⌂</div>
                            )}
                            <div>
                              <div className="checkout-prod-name">{item.name}</div>
                              {item.product?.category && (
                                <small style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                                  {typeof item.product.category === 'object' ? item.product.category.name : item.product.category}
                                </small>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {formatPrice(item.price)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong>{item.quantity}</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                          {formatPrice(item.price * item.quantity)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form thông tin giao hàng & chọn địa giới hành chính */}
          <div className="checkout-section-card">
            <h2>Thông tin giao hàng</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <label>
                Họ và tên
                <input
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>

              <label>
                Số điện thoại
                <input
                  required
                  inputMode="tel"
                  placeholder="Ví dụ: 0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>

            {/* Chọn Tỉnh/Thành phố, Quận/Huyện, Phường/Xã */}
            <div style={{ marginBottom: '14px' }}>
              <p className="location-group-title">Tỉnh/Thành Phố, Quận/Huyện, Phường/Xã</p>
              <div className="location-select-row">
                <label className="location-field-label">
                  <span>Tỉnh / Thành phố *</span>
                  <select
                    required
                    value={selectedProvince}
                    onChange={(e) => setSelectedProvince(Number(e.target.value))}
                  >
                    <option value="">-- Chọn Tỉnh/Thành phố --</option>
                    {provinces.map((prov) => (
                      <option key={prov.code} value={prov.code}>
                        {prov.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="location-field-label">
                  <span>Quận / Huyện *</span>
                  <select
                    required
                    disabled={!selectedProvince || loadingDistricts}
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(Number(e.target.value))}
                  >
                    <option value="">
                      {loadingDistricts ? 'Đang tải…' : '-- Chọn Quận/Huyện --'}
                    </option>
                    {districts.map((dist) => (
                      <option key={dist.code} value={dist.code}>
                        {dist.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="location-field-label">
                  <span>Phường / Xã *</span>
                  <select
                    required
                    disabled={!selectedDistrict || loadingWards}
                    value={selectedWard}
                    onChange={(e) => setSelectedWard(Number(e.target.value))}
                  >
                    <option value="">
                      {loadingWards ? 'Đang tải…' : '-- Chọn Phường/Xã --'}
                    </option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Huy hiệu hiển thị cước phí vận chuyển tính toán */}
              <div className="shipping-fee-pill">
                <span>🚚 Phí vận chuyển:</span>
                <strong>{formatPrice(shippingFee)}</strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>({shippingInfo.label})</span>
              </div>
            </div>

            {/* Địa chỉ cụ thể */}
            <label style={{ marginTop: '10px' }}>
              Địa chỉ cụ thể
              <textarea
                required
                rows="2"
                placeholder="Ví dụ: 203/19/2F, Đường Huỳnh Văn Nghệ"
                value={specificAddress}
                onChange={(e) => setSpecificAddress(e.target.value)}
              />
            </label>

            {/* Ghi chú */}
            <label style={{ marginTop: '10px' }}>
              Ghi chú đơn hàng (tùy chọn)
              <textarea
                rows="2"
                placeholder="Giao giờ hành chính, gọi trước khi đến..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Cột Tóm tắt thanh toán */}
        <aside className="checkout-summary-column">
          <div className="checkout-summary-card">
            <h2>Tóm tắt thanh toán</h2>

            <div className="summary-row">
              <span>Tiền hàng ({totalCount} món):</span>
              <strong>{formatPrice(rawSubtotal)}</strong>
            </div>

            <div className="summary-row">
              <span>Phí vận chuyển:</span>
              <strong style={{ color: 'var(--color-primary)' }}>{formatPrice(shippingFee)}</strong>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '-8px' }}>
              {selectedProvince === 79
                ? '• Nội thành TP.HCM: 30.000₫'
                : selectedProvince >= 48
                ? '• Đà Nẵng đến TP.HCM: 40.000₫'
                : '• Hà Nội & miền Bắc: 60.000₫'}
            </div>

            <div className="summary-total-divider" />

            <div className="total-row summary-row">
              <span>Tổng thanh toán:</span>
              <strong className="total-amount">{formatPrice(totalAmount)}</strong>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: '4px 0 0' }}>
              Phương thức: <strong>Tiền mặt khi nhận hàng (COD)</strong>. Kiểm tra hàng trước khi thanh toán.
            </p>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button
              className="button button-full button-accent"
              style={{ fontSize: '1rem', padding: '12px' }}
              disabled={saving}
              type="submit"
            >
              {saving ? 'Đang gửi đơn hàng…' : 'Đặt hàng COD ngay'}
            </button>
          </div>
        </aside>
      </form>
    </main>
  );
}
