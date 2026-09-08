import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';

const statusLabel = {
  Pending: 'Chờ xác nhận',
  Processing: 'Đang xử lý',
  Shipped: 'Đang giao',
  Delivered: 'Đã giao',
  Cancelled: 'Đã hủy',
};

function canCancel(order) {
  return ['Pending', 'Processing'].includes(order.orderStatus);
}

export default function OrderHistoryPage() {
  const { user, openLogin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');

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
          {orders.map((order) => (
            <article className="order-card" key={order._id}>
              <header>
                <strong>{order.orderNumber || `#${String(order._id).slice(-8).toUpperCase()}`}</strong>
                <span className="status-pill">{statusLabel[order.orderStatus] || order.orderStatus}</span>
              </header>

              {(order.orderItems || []).map((item, index) => {
                const quantity = item.qty ?? item.quantity;
                return (
                  <p key={`${order._id}-${index}`}>
                    <span>{item.name} × {quantity}</span>
                    <strong>{formatPrice(item.price * quantity)}</strong>
                  </p>
                );
              })}

              {Number(order.shippingFee) > 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                  <span>Phí vận chuyển</span>
                  <span>{formatPrice(order.shippingFee)}</span>
                </p>
              )}

              <footer>
                <span>{new Date(order.createdAt).toLocaleDateString('vi-VN')} · COD</span>
                <strong>{formatPrice(order.totalAmount)}</strong>
              </footer>

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
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
