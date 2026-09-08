import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatPrice';

const idOf = (item) => item.product?._id || item.product?.id;

export default function CartPage() {
  const { items, totalCount, rawSubtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  if (!items.length) return <main className="container page cart-empty-page"><div className="empty-cart-card"><h1>Giỏ hàng đang trống</h1><p>Chọn nội thất phù hợp cho không gian của bạn.</p><Link className="button" to="/products">Xem sản phẩm</Link></div></main>;
  return <main className="container page cart-page"><div className="split-heading"><div><p className="eyebrow">GIỎ HÀNG</p><h1>Đơn hàng của bạn</h1><p>{totalCount} sản phẩm đã chọn</p></div><button className="text-button danger" type="button" onClick={clearCart}>Xóa tất cả</button></div><div className="cart-layout"><section className="cart-items-column">{items.map((item) => { const id = idOf(item); return <article className="cart-item-row" key={id}><div className="item-details">{item.image ? <img src={item.image} alt="" className="item-thumbnail" /> : <div className="item-thumbnail-placeholder">⌂</div>}<div><Link className="item-title" to={`/products/${id}`}>{item.name}</Link><p className="muted">{formatPrice(item.price)}</p></div></div><label className="sr-only" htmlFor={`qty-${id}`}>Số lượng</label><input id={`qty-${id}`} className="cart-quantity" type="number" min="1" max={item.product.stock ?? item.product.countInStock ?? 99} value={item.quantity} onChange={(event) => updateQuantity(id, event.target.value)} /><strong>{formatPrice(item.price * item.quantity)}</strong><button className="text-button danger" type="button" onClick={() => removeFromCart(id)}>Xóa</button></article>; })}</section><aside className="order-summary"><h2>Tóm tắt</h2><p><span>Tạm tính</span><strong>{formatPrice(rawSubtotal)}</strong></p><p className="muted">Giá và tồn kho được kiểm tra lại khi đặt hàng.</p><Link className="button button-full" to="/checkout">Thanh toán COD</Link></aside></div></main>;
}
