import { useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useProducts } from '../context/ProductContext';
import { formatPrice } from '../utils/formatPrice';

const emptyForm = { name: '', category: 'Bàn học', price: '', dimensions: '', shortDimensions: '', description: '', color: '#c9945d', visualType: 'desk' };

export default function AdminPage() {
  const { products, addProduct, updateProduct, removeProduct, resetProducts } = useProducts();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const categories = new Set(products.map((product) => product.category));

  const submit = (event) => {
    event.preventDefault();
    const product = { ...form, price: Number(form.price), shortDimensions: form.shortDimensions || form.dimensions };
    if (editingId) updateProduct({ ...product, _id: editingId });
    else addProduct(product);
    setForm(emptyForm);
    setEditingId(null);
  };

  const edit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      category: product.category,
      price: product.price,
      dimensions: product.dimensions,
      shortDimensions: product.shortDimensions || '',
      description: product.description || '',
      color: product.color || '#c9945d',
      visualType: product.visualType || 'desk',
      image: product.image,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="container page admin-page">
      <div className="page-heading"><p className="eyebrow">CHỈ HIỂN THỊ VỚI ADMIN</p><h1>Trang quản trị</h1><p>Quản lý dữ liệu mẫu ngay trên trình duyệt. Chưa có thao tác nào ghi vào MongoDB.</p></div>
      <section className="admin-stats"><article><strong>{products.length}</strong><span>Sản phẩm</span></article><article><strong>{categories.size}</strong><span>Danh mục</span></article><article><strong>Local</strong><span>Nguồn dữ liệu</span></article></section>
      <div className="admin-layout">
        <form className="admin-form panel-card" onSubmit={submit}>
          <div className="section-title"><div><span className="step-label">SẢN PHẨM</span><h2>{editingId ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mẫu'}</h2></div></div>
          <label>Tên sản phẩm<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <div className="form-two-columns"><label>Danh mục<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label>Giá (VND)<input type="number" min="0" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label></div>
          <label>Kích thước<input required placeholder="Rộng 60 × sâu 40 × cao 72 cm" value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} /></label>
          <label>Mô tả<textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <div className="form-two-columns"><label>Kiểu hình<select value={form.visualType} onChange={(event) => setForm({ ...form, visualType: event.target.value, image: '' })}><option value="desk">Bàn</option><option value="chair">Ghế</option><option value="lamp">Đèn</option><option value="shelf">Kệ</option><option value="cabinet">Tủ</option><option value="mirror">Gương</option><option value="rug">Thảm</option><option value="rack">Giá treo</option><option value="curtain">Rèm</option><option value="plant">Cây</option></select></label><label>Màu minh họa<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label></div>
          <div className="form-actions"><button className="button" type="submit">{editingId ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button>{editingId && <button className="button button-secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Hủy</button>}</div>
        </form>
        <section className="admin-products panel-card">
          <div className="section-title"><div><span className="step-label">DỮ LIỆU FRONTEND</span><h2>Danh sách đang hiển thị</h2></div><button className="text-button" type="button" onClick={() => { if (window.confirm('Khôi phục lại đúng 10 sản phẩm mẫu ban đầu?')) resetProducts(); }}>Khôi phục mẫu</button></div>
          <div className="admin-product-list">
            {products.map((product) => <article key={product._id}><div className="admin-thumb"><ProductArtwork product={product} /></div><div><strong>{product.name}</strong><span>{product.category} · {formatPrice(product.price)}</span></div><div className="row-actions"><button type="button" onClick={() => edit(product)}>Sửa</button><button className="danger" type="button" onClick={() => { if (window.confirm(`Xóa ${product.name}?`)) removeProduct(product._id); }}>Xóa</button></div></article>)}
          </div>
        </section>
      </div>
    </main>
  );
}
