import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';

const label = (value) => ({ Pending: 'Chờ xác nhận', Processing: 'Đang xử lý', Shipped: 'Đang giao', Delivered: 'Đã giao', Cancelled: 'Đã hủy' }[value] || value || 'Đang xử lý');
export default function OrderHistoryPage() {
  const { user, openLogin } = useAuth();
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { if (!user) return; orderService.getMyOrders().then((data) => setOrders(Array.isArray(data) ? data : [])).catch((err) => setError(err.response?.data?.message || 'Không thể tải đơn hàng.')).finally(() => setLoading(false)); }, [user]);
  if (!user) return <main className="container page access-denied"><h1>Đơn hàng của tôi</h1><p>Đăng nhập để theo dõi các đơn đã đặt.</p><button className="button" type="button" onClick={() => openLogin('login')}>Đăng nhập</button></main>;
  return <main className="container page"><div className="page-heading"><p className="eyebrow">ĐƠN HÀNG</p><h1>Lịch sử mua hàng</h1></div>{loading ? <p className="empty-state">Đang tải đơn hàng…</p> : error ? <div className="empty-state"><h2>Chưa tải được đơn hàng</h2><p>{error}</p></div> : !orders.length ? <div className="empty-state"><h2>Bạn chưa có đơn hàng</h2><Link className="button" to="/products">Mua sắm ngay</Link></div> : <div className="order-list">{orders.map((order) => <article className="order-card" key={order._id}><header><strong>#{String(order._id).slice(-8).toUpperCase()}</strong><span className="status-pill">{label(order.orderStatus)}</span></header>{(order.orderItems || []).map((item, index) => <p key={`${order._id}-${index}`}><span>{item.name} × {item.qty ?? item.quantity}</span><strong>{formatPrice(item.price * (item.qty ?? item.quantity))}</strong></p>)}<footer><span>{new Date(order.createdAt).toLocaleDateString('vi-VN')} · COD</span><strong>{formatPrice(order.totalAmount)}</strong></footer></article>)}</div>}</main>;
}
