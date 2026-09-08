import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';

const STATES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  const load = () => { setLoading(true); setError(''); orderService.getAllOrders().then((data) => setOrders(Array.isArray(data) ? data : [])).catch((err) => setError(err.response?.data?.message || 'Không thể tải đơn hàng.')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const update = async (id, orderStatus) => { setBusy(id); try { const saved = await orderService.updateOrderStatus(id, orderStatus); setOrders((current) => current.map((order) => order._id === id ? saved : order)); } catch (err) { setError(err.response?.data?.message || 'Không thể cập nhật đơn hàng.'); } finally { setBusy(''); } };
  return <main className="container page"><div className="split-heading"><div><p className="eyebrow">QUẢN TRỊ</p><h1>Đơn hàng</h1><p>Trạng thái được cập nhật trực tiếp trên hệ thống.</p></div><Link className="button button-secondary" to="/admin">Sản phẩm, user & phản hồi</Link></div>{loading ? <div className="empty-state">Đang tải đơn hàng…</div> : error ? <div className="empty-state"><p>{error}</p><button className="button" type="button" onClick={load}>Thử lại</button></div> : !orders.length ? <div className="empty-state">Chưa có đơn hàng.</div> : <div className="admin-table-container"><table className="admin-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Tổng</th><th>Trạng thái</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td>{String(order._id).slice(-8).toUpperCase()}</td><td>{order.shippingAddress?.fullName}<br/><small>{order.shippingAddress?.phone}</small></td><td>{(order.orderItems || []).map((item) => `${item.name} × ${item.qty ?? item.quantity}`).join(', ')}</td><td>{formatPrice(order.totalAmount)}</td><td><select value={order.orderStatus || 'Pending'} disabled={busy === order._id} onChange={(event) => update(order._id, event.target.value)}>{STATES.map((state) => <option key={state}>{state}</option>)}</select></td></tr>)}</tbody></table></div>}</main>;
}
