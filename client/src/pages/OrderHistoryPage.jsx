import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';
import QrPaymentModal from '../components/payment/QrPaymentModal';

const statusLabel = {
  Pending: 'Chờ xác nhận',
  Processing: 'Đang xử lý',
  Shipped: 'Đang giao',
  Delivered: 'Đã giao',
  Cancelled: 'Đã hủy',
};

const paymentStatusLabel = {
  Pending: 'Chưa thanh toán',
  Paid: 'Đã thanh toán',
};

function canCancel(order) {
  return ['Pending', 'Processing'].includes(order.orderStatus);
}
function canReviewOrder(order) {
  return order.orderStatus === 'Delivered';
}

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const { user, openLogin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [activeQrOrder, setActiveQrOrder] = useState(null);

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
            const canShowQr = isBank && !isPaid && order.orderStatus !== 'Cancelled';
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
                    <span className={`status-pill ${isPaid ? 'payment-paid' : 'payment-pending'}`}>
                      {isPaid ? '✓ Đã thanh toán' : isBank ? 'Chờ chuyển khoản' : 'Chưa thu tiền (COD)'}
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
        />
      )}
    </main>
  );
}
