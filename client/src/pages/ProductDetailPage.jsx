import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductContext';
import { formatPrice } from '../utils/formatPrice';

export default function ProductDetailPage() {
  const { id } = useParams(); const { products, loading } = useProducts(); const { addToCart } = useCart(); const [quantity, setQuantity] = useState(1); const [notice, setNotice] = useState('');
  const product = products.find((item) => String(item._id || item.id) === id || item.slug === id);
  if (loading) return <main className="container page"><div className="empty-state">Đang tải sản phẩm…</div></main>;
  if (!product) return <main className="container page"><div className="empty-state"><h1>Không tìm thấy sản phẩm</h1><Link className="button" to="/products">Về danh sách sản phẩm</Link></div></main>;
  const stock = Math.max(0, Number(product.stock ?? product.countInStock ?? 99));
  const category = typeof product.category === 'object' ? product.category?.name : (product.category || product.categoryName || 'Nội thất');
  const add = () => { const outcome = addToCart(product, quantity); setNotice(outcome?.ok === false ? outcome.message : 'Đã thêm vào giỏ hàng.'); };
  return <main className="container page detail-page"><Link className="back-link" to="/products">← Sản phẩm</Link><section className="detail-grid"><div className="main-image-wrap"><ProductArtwork product={product} /></div><div className="detail-info"><span className="category-tag">{category}</span><h1>{product.name}</h1><p className="current-price">{formatPrice(product.price)}</p><p>{product.description || 'Sản phẩm nội thất thiết kế gọn gàng, phù hợp cho không gian sống hiện đại.'}</p><p className={stock ? 'stock-badge in-stock' : 'stock-badge'}>{stock ? `Còn ${stock} sản phẩm` : 'Tạm hết hàng'}</p>{stock > 0 && <div className="detail-action-box"><label>Số lượng<input type="number" min="1" max={stock} value={quantity} onChange={(event) => setQuantity(Math.min(stock, Math.max(1, Number(event.target.value) || 1)))} /></label><button className="button" type="button" onClick={add}>Thêm vào giỏ</button></div>}{notice && <p className="form-success" role="status">{notice}</p>}<Link className="text-button" to="/room-studio" state={{ product }}>Thử sản phẩm trong phòng →</Link></div></section></main>;
}
