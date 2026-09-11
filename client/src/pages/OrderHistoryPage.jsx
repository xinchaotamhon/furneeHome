import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';
import QrPaymentModal from '../components/payment/QrPaymentModal';

// Tên hiển thị tiếng Việt của các trạng thái đơn hàng
const statusLabel = {
  Pending: 'Chờ xác nhận',
  Processing: 'Đang xử lý',
  Shipped: 'Đang giao',
  Delivered: 'Đã giao',
  Returned: 'Hoàn hàng',
  Cancelled: 'Đã hủy',
};

// Đơn chỉ được hủy khi ở trạng thái Chờ xác nhận hoặc Đang xử lý
function canCancel(order) {
  return ['Pending', 'Processing'].includes(order.orderStatus);
}

// Chỉ đơn đã giao thành công mới được viết đánh giá
function canReviewOrder(order) {
  return order.orderStatus === 'Delivered';
}

// Modal để khách hàng nhập thông tin tài khoản ngân hàng nhận tiền hoàn
// Tránh việc gửi ảnh mã QR lạ có thể chứa mã độc / gian lận
function RefundAccountModal({ order, onClose, onSaved }) {
  const [bankName, setBankName] = useState(order.refundInfo?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(order.refundInfo?.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(
    order.refundInfo?.accountHolder || order.shippingAddress?.fullName?.toUpperCase() || ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!bankName.trim()) return setError('Vui lòng chọn hoặc nhập tên ngân hàng.');
    if (!accountNumber.trim()) return setError('Vui lòng nhập số tài khoản ngân hàng.');
    if (!accountHolder.trim()) return setError('Vui lòng nhập tên chủ tài khoản.');

    setSaving(true);
    setError('');
    try {
      const updated = await orderService.updateRefundInfo(order._id, {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim().toUpperCase(),
      });
      onSaved(updated);
      onClose();
    } catch (saveError) {
      setError(saveError.response?.data?.message || saveError.message || 'Không thể lưu thông tin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px' }}
      >
        <header className="modal-header">
          <h2 id="refund-modal-title">Thông tin nhận tiền hoàn</h2>
          <button className="btn-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        </header>

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.84rem', color: '#1e40af', lineHeight: 1.5 }}>
            🛡️ <strong>Chính sách an toàn:</strong> Nhằm phòng ngừa mã QR độc hại, FurneeHome không quét ảnh QR do khách hàng gửi. Quý khách vui lòng cung cấp số tài khoản bên dưới để FurneeHome chuyển khoản hoàn tiền trực tiếp an toàn.
          </div>

          {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.9rem', fontWeight: 500 }}>
            Ngân hàng thụ hưởng:
            <input
              list="vietnam-banks"
              placeholder="VD: Vietcombank, MB Bank, Techcombank..."
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
            <datalist id="vietnam-banks">
              <option value="Vietcombank (VCB)" />
              <option value="MB Bank (MB)" />
              <option value="Techcombank (TCB)" />
              <option value="VietinBank (CTG)" />
              <option value="BIDV" />
              <option value="ACB" />
              <option value="VPBank" />
              <option value="TPBank" />
              <option value="Agribank" />
              <option value="Sacombank" />
              <option value="HDBank" />
              <option value="VIB" />
            </datalist>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.9rem', fontWeight: 500 }}>
            Số tài khoản ngân hàng:
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Nhập số tài khoản (chỉ gồm số)"
              maxLength="20"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 20))}
              required
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.9rem', fontWeight: 500 }}>
            Tên chủ tài khoản (viết hoa không dấu):
            <input
              type="text"
              placeholder="VD: NGUYEN VAN A"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
              required
            />
          </label>

          <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '8px 10px', borderRadius: '4px' }}>
            Số tiền FurneeHome sẽ hoàn lại: <strong style={{ color: '#c2410c' }}>{formatPrice(order.totalAmount)}</strong>
          </div>

          <footer className="modal-footer" style={{ padding: 0, marginTop: '8px' }}>
            <button className="text-button" type="button" onClick={onClose} disabled={saving}>Hủy</button>
            <button className="button" type="submit" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Xác nhận gửi thông tin'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const { user, openLogin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [activeQrOrder, setActiveQrOrder] = useState(null);
  const [refundOrder, setRefundOrder] = useState(null);

  useEffect(() => {
    if (!user) return;
    orderService.getMyOrders()
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((loadError) => setError(loadError.response?.data?.message || 'Không thể tải đơn hàng.'))
      .finally(() => setLoading(false));
  }, [user]);

  async function cancelOrder(order) {
    if (!window.confirm('Bạn muốn hủy đơn hàng này?')) return;
    setCancellingId(order._id);
    setError('');
    try {
      const updated = await orderService.cancelOrder(order._id);
      setOrders((current) => current.map((item) => (
        item._id === order._id ? { ...item, ...updated } : item
      )));
    } catch (cancelError) {
      setError(cancelError.response?.data?.message || 'Không thể hủy đơn hàng.');
    } finally {
      setCancellingId('');
    }
  }

  function handleRefundInfoSaved(updatedOrder) {
    setOrders((current) => current.map((item) => (
      item._id === updatedOrder._id ? { ...item, ...updatedOrder } : item
    )));
  }

  if (!user) {
    return (
      <main className="container page access-denied">
        <h1>Đơn hàng của tôi</h1>
        <p>Đăng nhập để theo dõi các đơn đã đặt.</p>
        <button className="button" type="button" onClick={() => openLogin('login')}>Đăng nhập</button>
      </main>
    );
  }

  return (
    <main className="container page">
      <div className="page-heading">
        <p className="eyebrow">ĐƠN HÀNG</p>
        <h1>Lịch sử mua hàng</h1>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="empty-state">Đang tải đơn hàng…</p>}
      {!loading && !orders.length && (
        <div className="empty-state">
          <h2>Bạn chưa có đơn hàng</h2>
          <Link className="button" to="/products">Mua sắm ngay</Link>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="order-list">
          {orders.map((order) => {
            const isBank = order.paymentMethod === 'BANK_TRANSFER';
            const isPaid = order.paymentStatus === 'Paid';
            const canShowQr = isBank && !isPaid && !['Cancelled', 'Returned'].includes(order.orderStatus);
            const eligibleForReview = canReviewOrder(order);

            return (
              <article className="order-card" key={order._id}>
                <header>
                  <div className="order-header-info">
                    <strong>{order.orderNumber || `#${String(order._id).slice(-8).toUpperCase()}`}</strong>
                    <span className="order-date-text">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="order-status-group">
                    <span className={`status-pill status-${order.orderStatus.toLowerCase()}`}>
                      {statusLabel[order.orderStatus] || order.orderStatus}
                    </span>
                  </div>
                </header>

                <div className="order-items-preview">
                  {(order.orderItems || []).map((item, index) => {
                    const quantity = item.qty ?? item.quantity;
                    return (
                      <p className="line" key={`${order._id}-${index}`}>
                        <span>{item.name} × {quantity}</span>
                        <strong>{formatPrice(item.price * quantity)}</strong>
                      </p>
                    );
                  })}
                  {Number(order.shippingFee) > 0 && (
                    <p className="line order-shipping-fee-line" style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      <span>Phí vận chuyển</span>
                      <span>{formatPrice(order.shippingFee)}</span>
                    </p>
                  )}
                </div>

                {/* Thông báo chính sách đồng kiểm khi đơn đang giao */}
                {order.orderStatus === 'Shipped' && (
                  <div style={{ margin: '8px 0 12px', padding: '8px 12px', background: '#f0f7ff', border: '1px solid #cce3ff', borderRadius: '6px', fontSize: '0.84rem', color: '#0052cc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🚚</span>
                    <span><strong>Đang giao hàng:</strong> Quý khách được phép mở xem kiểm tra hàng (đồng kiểm) cùng nhân viên giao hàng khi nhận.</span>
                  </div>
                )}

                {/* Thông báo hoàn hàng hoặc hủy đơn có hoàn tiền */}
                {(order.orderStatus === 'Returned' || (order.orderStatus === 'Cancelled' && ['Refunding', 'Refunded'].includes(order.paymentStatus))) && (
                  <div style={{
                    margin: '8px 0 10px',
                    padding: '8px 12px',
                    background: order.paymentStatus === 'Refunded' ? '#f0fdf4' : '#fffaf0',
                    border: order.paymentStatus === 'Refunded' ? '1px solid #bbf7d0' : '1px solid #feebc8',
                    borderRadius: '6px',
                    fontSize: '0.84rem',
                    color: order.paymentStatus === 'Refunded' ? '#166534' : '#7b341e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>{order.paymentStatus === 'Refunded' ? '✓' : '↩️'}</span>
                    <span>
                      {order.paymentStatus === 'Refunding' && (order.orderStatus === 'Cancelled'
                        ? 'Đơn hàng đã hủy. FurneeHome đang tiến hành hoàn lại tiền cho quý khách qua tài khoản ngân hàng.'
                        : 'Đơn hàng đã được hoàn về. FurneeHome đang tiến hành hoàn lại tiền cho quý khách qua tài khoản ngân hàng.')}
                      {order.paymentStatus === 'Refunded' && 'Đã hoàn tiền thành công: FurneeHome đã chuyển khoản hoàn tiền đơn hàng này về tài khoản của quý khách.'}
                      {order.orderStatus === 'Returned' && order.paymentMethod === 'COD' && 'Đơn hàng đã hoàn về do quý khách từ chối nhận khi kiểm tra hàng (chưa thu tiền).'}
                    </span>
                  </div>
                )}

                {/* Khung cung cấp hoặc hiển thị thông tin tài khoản nhận tiền hoàn */}
                {['Returned', 'Cancelled'].includes(order.orderStatus) && order.paymentStatus === 'Refunding' && (
                  order.refundInfo?.accountNumber ? (
                    <div style={{ margin: '6px 0 12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ color: '#0f172a' }}>🏦 Tài khoản nhận tiền hoàn của bạn:</strong>
                        <button type="button" className="text-button" style={{ padding: '0 4px', fontSize: '0.8rem', color: '#0284c7' }} onClick={() => setRefundOrder(order)}>
                          Thay đổi
                        </button>
                      </div>
                      <div style={{ color: '#334155', lineHeight: 1.5 }}>
                        <div>Ngân hàng: <strong>{order.refundInfo.bankName}</strong></div>
                        <div>Số tài khoản: <strong>{order.refundInfo.accountNumber}</strong></div>
                        <div>Chủ tài khoản: <strong>{order.refundInfo.accountHolder}</strong></div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ margin: '6px 0 12px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <p style={{ margin: '0 0 8px', color: '#92400e', fontWeight: 500 }}>
                        ⚠️ Quý khách vui lòng cung cấp số tài khoản ngân hàng để FurneeHome chuyển khoản hoàn trả <strong>{formatPrice(order.totalAmount)}</strong> an toàn.
                      </p>
                      <button type="button" className="button button-small" onClick={() => setRefundOrder(order)}>
                        🏦 Nhập thông tin nhận tiền hoàn
                      </button>
                    </div>
                  )
                )}

                <footer>
                  <div className="order-footer-method">
                    <span>{isBank ? '📱 Chuyển khoản QR (VietQR)' : '💵 Tiền mặt (COD)'}</span>
                  </div>
                  <div className="order-footer-total">
                    <span>Tổng cộng:</span>
                    <strong>{formatPrice(order.totalAmount)}</strong>
                  </div>
                </footer>

                <div className="order-actions-bar">
                  {eligibleForReview && <button type="button" className="button button-small" onClick={() => navigate(`/orders/${order._id}/review`)}>★ Đánh giá đơn hàng</button>}
                  {canShowQr && (
                    <button
                      type="button"
                      className="button button-small qr-view-trigger"
                      onClick={() => setActiveQrOrder(order)}
                    >
                      📱 Xem mã QR thanh toán
                    </button>
                  )}

                  {canCancel(order) && (
                    <button
                      className="text-button danger order-cancel-button"
                      type="button"
                      disabled={cancellingId === order._id}
                      onClick={() => cancelOrder(order)}
                    >
                      {cancellingId === order._id ? 'Đang hủy…' : 'Hủy đơn'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeQrOrder && (
        <QrPaymentModal
          order={activeQrOrder}
          onClose={() => setActiveQrOrder(null)}
          onConfirmed={(updated) => {
            setOrders((prev) => prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o)));
          }}
        />
      )}

      {refundOrder && (
        <RefundAccountModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onSaved={handleRefundInfoSaved}
        />
      )}
    </main>
  );
}
