import { useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useProducts } from '../context/ProductContext';
import { formatPrice } from '../utils/formatPrice';

const emptyForm = {
  name: '',
  category: 'Bàn học',
  price: '',
  description: '',
  image: '',
  transparentImage: '',
  sourceUrl: '',
};

function getCategoryName(product) {
  if (typeof product.category === 'object') return product.category?.name || product.categoryName || '';
  return product.categoryName || product.category || '';
}

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Không thể lưu dữ liệu.';
}

export default function AdminPage() {
  const { products, addProduct, updateProduct, removeProduct, refreshProducts } = useProducts();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const categories = new Set(products.map(getCategoryName).filter(Boolean));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);

    const product = {
      name: form.name.trim(),
      category: form.category.trim(),
      price: Number(form.price),
      description: form.description.trim(),
      image: form.image.trim(),
      transparentImage: form.transparentImage.trim(),
      sourceUrl: form.sourceUrl.trim(),
    };

    try {
      if (editingId) await updateProduct({ ...product, _id: editingId });
      else await addProduct(product);
      resetForm();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSaving(false);
    }
  };

  const edit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name || '',
      category: getCategoryName(product),
      price: product.price ?? '',
      description: product.description || '',
      image: product.image || product.images?.[0] || '',
      transparentImage: product.transparentImage || '',
      sourceUrl: product.sourceUrl || product.shopeeSearchUrl || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (product) => {
    if (!window.confirm('Xóa ' + product.name + '?')) return;
    setError('');
    setIsSaving(true);
    try {
      await removeProduct(product._id);
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="container page admin-page">
      <div className="page-heading">
        <p className="eyebrow">CHỈ HIỂN THỊ VỚI ADMIN</p>
        <h1>Trang quản trị</h1>
        <p>Quản lý sản phẩm trực tiếp qua backend và MongoDB. Giá có thể để 0 nếu sản phẩm chỉ dùng theo hướng affiliate.</p>
      </div>

      <section className="admin-stats">
        <article><strong>{products.length}</strong><span>Sản phẩm đang hiển thị</span></article>
        <article><strong>{categories.size}</strong><span>Danh mục</span></article>
        <article><strong>API</strong><span>Nguồn quản lý</span></article>
      </section>

      <div className="admin-layout">
        <form className="admin-form panel-card" onSubmit={submit}>
          <div className="section-title">
            <div><span className="step-label">SẢN PHẨM</span><h2>{editingId ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div>
          </div>

          <label>Tên sản phẩm
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>

          <div className="form-two-columns">
            <label>Danh mục
              <input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </label>
            <label>Giá tham khảo (VND)
              <input type="number" min="0" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            </label>
          </div>

          <label>Mô tả
            <textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>

          <label>Ảnh sản phẩm
            <input type="text" placeholder="/images/ten-anh.png hoặc URL" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
          </label>

          <label>Ảnh tách nền (nếu có)
            <input type="text" placeholder="/images/ten-anh-transparent.png hoặc URL" value={form.transparentImage} onChange={(event) => setForm({ ...form, transparentImage: event.target.value })} />
          </label>

          <label>Link xem/mua sản phẩm
            <input type="url" placeholder="Link Shopee hoặc trang nguồn" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button className="button" type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu…' : (editingId ? 'Lưu thay đổi' : 'Thêm sản phẩm')}</button>
            {editingId && <button className="button button-secondary" type="button" onClick={resetForm} disabled={isSaving}>Hủy</button>}
          </div>
        </form>

        <section className="admin-products panel-card">
          <div className="section-title">
            <div><span className="step-label">DỮ LIỆU BACKEND</span><h2>Danh sách sản phẩm</h2></div>
            <button className="text-button" type="button" onClick={refreshProducts} disabled={isSaving}>Tải lại</button>
          </div>

          <div className="admin-product-list">
            {products.map((product) => (
              <article key={product._id}>
                <div className="admin-thumb"><ProductArtwork product={product} /></div>
                <div><strong>{product.name}</strong><span>{getCategoryName(product)} · {formatPrice(product.price)}</span></div>
                <div className="row-actions">
                  <button type="button" onClick={() => edit(product)} disabled={isSaving}>Sửa</button>
                  <button className="danger" type="button" onClick={() => remove(product)} disabled={isSaving}>Xóa</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
