import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';

export default function CheckoutPage() {
  const { user, openLogin } = useAuth();
  const { items, totalCount, rawSubtotal, clearCart } = useCart();
  const [form, setForm] = useState({ fullName: user?.name || '', phone: '', address: '', note: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!items.length && !result) return <main className="container page cart-empty-page"><div className="empty-cart-card"><h1>Chưa có sản phẩm để thanh toán</h1><Link className="button" to="/products">Quay về cửa hàng</Link></div></main>;
  if (!user) return <main className="container page access-denied"><h1>Đăng nhập để thanh toán</h1><p>Đăng nhập giúp bạn theo dõi đơn hàng sau khi đặt.</p><button className="button" type="button" onClick={() => openLogin('login')}>Đăng nhập</button></main>;
  const submit = async (event) => { event.preventDefault(); setError(''); if (!form.fullName.trim() || !form.phone.trim() || !form.address.trim()) return setError('Vui lòng điền tên, số điện thoại và địa chỉ nhận hàng.'); setSaving(true); try { const order = await orderService.createOrder({ items: items.map((item) => ({ productId: item.product._id || item.product.id, quantity: item.quantity })), shippingAddress: form, paymentMethod: 'COD' }); clearCart(); setResult(order); } catch (err) { setError(err.response?.data?.message || err.message || 'Không thể tạo đơn hàng. Hãy thử lại.'); } finally { setSaving(false); } };
  if (result) return <main className="container page order-success-page"><div className="success-card"><h1>Đặt hàng thành công</h1><p>Mã đơn: <strong>{result.orderNumber || result._id}</strong>. Chúng tôi sẽ liên hệ xác nhận trước khi giao.</p><p>Thanh toán: <strong>tiền mặt khi nhận hàng (COD)</strong>.</p><Link className="button" to="/orders">Xem đơn hàng</Link></div></main>;
  return <main className="container page checkout-page"><div className="page-heading"><p className="eyebrow">THANH TOÁN</p><h1>Thanh toán khi nhận hàng</h1></div><form className="checkout-layout" onSubmit={submit}><section className="checkout-form-column"><div className="checkout-section-card"><h2>Thông tin giao hàng</h2><label>Họ và tên<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>Số điện thoại<input inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Địa chỉ nhận hàng<textarea rows="3" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><label>Ghi chú (tùy chọn)<textarea rows="2" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div></section><aside className="checkout-summary-column"><div className="checkout-summary-card"><h2>Đơn hàng ({totalCount})</h2>{items.map((item) => <p className="line" key={item.product._id || item.product.id}><span>{item.name} × {item.quantity}</span><strong>{formatPrice(item.price * item.quantity)}</strong></p>)}<p className="line-total"><span>Tổng cộng</span><strong>{formatPrice(rawSubtotal)}</strong></p>{error && <p className="form-error">{error}</p>}<button className="button button-full" disabled={saving} type="submit">{saving ? 'Đang đặt hàng…' : 'Đặt hàng COD'}</button></div></aside></form></main>;
}
