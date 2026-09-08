import { useEffect, useMemo, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductContext';
import feedbackService from '../services/feedbackService';
import userService from '../services/userService';
import { formatPrice } from '../utils/formatPrice';

const emptyForm = {
  name: '', categoryName: 'Nội thất', price: '', stock: '20', description: '',
  width: '', depth: '', height: '', usageType: 'standard',
  placementSurface: 'floor', aiDescription: '',
};

function categoryName(product) {
  if (typeof product.category === 'object') return product.category?.name || product.categoryName || 'Nội thất';
  return product.category || product.categoryName || 'Nội thất';
}

function formFromProduct(product) {
  const size = product.dimensionsCm || product.dimensions || {};
  return {
    name: product.name || '', categoryName: categoryName(product), price: product.price ?? '',
    stock: product.stock ?? 0,
    description: product.description || '', width: size.width || size.widthCm || '',
    depth: size.depth || size.depthCm || '', height: size.height || size.heightCm || '',
    usageType: product.usageType || 'standard', placementSurface: product.placementSurface || 'floor',
    aiDescription: product.aiDescription || '',
  };
}

function productFromForm(form) {
  return {
    name: form.name.trim(), categoryName: form.categoryName.trim(), price: Number(form.price) || 0,
    stock: Math.max(0, Math.round(Number(form.stock) || 0)),
    description: form.description.trim(), usageType: form.usageType,
    placementSurface: form.placementSurface, aiDescription: form.aiDescription.trim(),
    dimensionsCm: {
      width: Number(form.width) || undefined,
      depth: Number(form.depth) || undefined,
      height: Number(form.height) || undefined,
    },
    isActive: true,
  };
}

function messageFrom(error) {
  return error.response?.data?.message || error.message || 'Không thể xử lý yêu cầu.';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không thể đọc ảnh.'));
    reader.readAsDataURL(file);
  });
}

function imageElement(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('File ảnh không hợp lệ.'));
    image.src = source;
  });
}

async function optimizeImage(file) {
  const source = await fileToDataUrl(file);
  if (file.size <= 700 * 1024) return source;
  const image = await imageElement(source);
  const ratio = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * ratio);
  canvas.height = Math.round(image.naturalHeight * ratio);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.82);
}

export default function AdminPage() {
  const { user } = useAuth();
  const {
    products, loading, addProduct, updateProduct, removeProduct,
    refreshProducts, addProductImage,
  } = useProducts();
  const [tab, setTab] = useState('products');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [isWorking, setWorking] = useState(false);
  const [uploadingId, setUploadingId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('vi');
    return products.filter((product) => product.isActive !== false && (!search
      || `${product.name} ${categoryName(product)}`.toLocaleLowerCase('vi').includes(search)));
  }, [products, query]);

  useEffect(() => {
    setNotice('');
    setError('');
    if (tab === 'users') loadUsers();
    if (tab === 'feedback') loadFeedback();
  }, [tab]);

  async function loadUsers() {
    setWorking(true);
    try {
      setUsers(await userService.listAdmin());
    } catch (loadError) {
      setError(messageFrom(loadError));
    } finally {
      setWorking(false);
    }
  }

  async function loadFeedback() {
    setWorking(true);
    try {
      setFeedback(await feedbackService.listAdmin());
    } catch (loadError) {
      setError(messageFrom(loadError));
    } finally {
      setWorking(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId('');
  }

  async function saveProduct(event) {
    event.preventDefault();
    setNotice('');
    setError('');
    if (!form.name.trim() || !form.categoryName.trim()) {
      setError('Nhập tên và danh mục sản phẩm.');
      return;
    }

    setWorking(true);
    try {
      if (editingId) {
        await updateProduct(editingId, productFromForm(form));
        setNotice('Đã cập nhật sản phẩm.');
      } else {
        await addProduct(productFromForm(form));
        setNotice('Đã thêm sản phẩm.');
      }
      resetForm();
    } catch (saveError) {
      setError(messageFrom(saveError));
    } finally {
      setWorking(false);
    }
  }

  function startEditing(product) {
    setEditingId(product._id || product.id);
    setForm(formFromProduct(product));
    setNotice('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Xóa sản phẩm “${product.name}”?`)) return;
    setWorking(true);
    setNotice('');
    setError('');
    try {
      await removeProduct(product._id || product.id);
      setNotice('Đã xóa sản phẩm.');
      if (editingId === (product._id || product.id)) resetForm();
    } catch (deleteError) {
      setError(messageFrom(deleteError));
    } finally {
      setWorking(false);
    }
  }

  async function uploadImage(product, file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setError('Chọn ảnh PNG, JPEG hoặc WebP không quá 12 MB.');
      return;
    }
    const id = product._id || product.id;
    setUploadingId(id);
    setNotice('');
    setError('');
    try {
      await addProductImage(id, await optimizeImage(file));
      setNotice(`Đã thêm ảnh cho ${product.name}.`);
    } catch (uploadError) {
      setError(messageFrom(uploadError));
    } finally {
      setUploadingId('');
    }
  }

  async function updateUser(id, changes) {
    setWorking(true);
    setNotice('');
    setError('');
    try {
      await userService.updateAdmin(id, changes);
      await loadUsers();
      setNotice('Đã cập nhật người dùng.');
    } catch (updateError) {
      setError(messageFrom(updateError));
      setWorking(false);
    }
  }

  async function updateFeedback(id, status) {
    setWorking(true);
    setNotice('');
    setError('');
    try {
      await feedbackService.updateAdmin(id, { status });
      await loadFeedback();
      setNotice('Đã cập nhật phản hồi.');
    } catch (updateError) {
      setError(messageFrom(updateError));
      setWorking(false);
    }
  }

  return (
    <main className="container page admin-page">
      <div className="page-heading">
        <h1>Quản trị</h1>
        <p>Sản phẩm, người dùng và phản hồi.</p>
      </div>

      <nav className="admin-tabs" aria-label="Nội dung quản trị">
        <button type="button" className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Sản phẩm</button>
        <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Người dùng</button>
        <button type="button" className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}>Phản hồi</button>
      </nav>

      {error && <p className="form-error admin-message" role="alert">{error}</p>}
      {notice && <p className="form-success admin-message" role="status">{notice}</p>}

      {tab === 'products' && (
        <div className="admin-layout">
          <form className="admin-form panel-card" onSubmit={saveProduct}>
            <div className="section-title"><h2>{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div>
            <label>Tên sản phẩm<input value={form.name} onChange={(event) => updateField('name', event.target.value)} required /></label>
            <label>Danh mục<input value={form.categoryName} onChange={(event) => updateField('categoryName', event.target.value)} required /></label>
            <label>Giá<input type="number" min="1" step="1" value={form.price} onChange={(event) => updateField('price', event.target.value)} required /></label>
            <label>Tồn kho<input type="number" min="0" step="1" value={form.stock} onChange={(event) => updateField('stock', event.target.value)} required /></label>
            <label>Mô tả<textarea rows="3" value={form.description} onChange={(event) => updateField('description', event.target.value)} /></label>

            <details className="admin-product-details">
              <summary>Thông tin Phòng thử</summary>
              <div className="admin-detail-fields">
                <div className="admin-dimensions">
                  <label>Rộng (cm)<input type="number" min="1" value={form.width} onChange={(event) => updateField('width', event.target.value)} /></label>
                  <label>Sâu (cm)<input type="number" min="1" value={form.depth} onChange={(event) => updateField('depth', event.target.value)} /></label>
                  <label>Cao (cm)<input type="number" min="1" value={form.height} onChange={(event) => updateField('height', event.target.value)} /></label>
                </div>
                <label>Cách sử dụng<select value={form.usageType} onChange={(event) => updateField('usageType', event.target.value)}>
                  <option value="standard">Thông thường</option><option value="floor-seating">Ngồi bệt</option><option value="unknown">Chưa xác định</option>
                </select></label>
                <label>Vị trí đặt<select value={form.placementSurface} onChange={(event) => updateField('placementSurface', event.target.value)}>
                  <option value="floor">Trên sàn</option><option value="wall">Trên tường</option><option value="tabletop">Trên mặt bàn</option><option value="unknown">Chưa xác định</option>
                </select></label>
                <label>Mô tả hình dạng<textarea rows="3" maxLength="300" value={form.aiDescription} onChange={(event) => updateField('aiDescription', event.target.value)} /></label>
              </div>
            </details>

            <div className="admin-form-actions">
              <button className="button" type="submit" disabled={isWorking}>{isWorking ? 'Đang lưu…' : (editingId ? 'Cập nhật' : 'Thêm sản phẩm')}</button>
              {editingId && <button className="text-button" type="button" onClick={resetForm}>Hủy</button>}
            </div>
          </form>

          <section className="admin-products panel-card">
            <div className="section-title">
              <h2>Danh sách sản phẩm ({visibleProducts.length})</h2>
              <button className="text-button" type="button" onClick={refreshProducts} disabled={loading || isWorking}>{loading ? 'Đang tải…' : 'Tải lại'}</button>
            </div>
            <input className="admin-search" type="search" value={query} placeholder="Tìm tên hoặc danh mục" onChange={(event) => setQuery(event.target.value)} />
            <div className="admin-product-list">
              {visibleProducts.map((product) => {
                const id = product._id || product.id;
                return <article key={id}>
                  <div className="admin-thumb"><ProductArtwork product={product} /></div>
                  <div><strong>{product.name}</strong><span>{categoryName(product)} · {formatPrice(product.price)} · Còn {product.stock ?? 0}</span></div>
                  <div className="row-actions">
                    <button className="text-button" type="button" onClick={() => startEditing(product)}>Sửa</button>
                    <label className="text-button">{uploadingId === id ? 'Đang lưu…' : 'Thêm ảnh'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadImage(product, event.target.files?.[0])} /></label>
                    <button className="danger" type="button" onClick={() => deleteProduct(product)}>Xóa</button>
                  </div>
                </article>;
              })}
            </div>
            {!visibleProducts.length && <p className="muted">Không tìm thấy sản phẩm.</p>}
          </section>
        </div>
      )}

      {tab === 'users' && (
        <section className="panel-card admin-table-card">
          <div className="section-title"><h2>Người dùng ({users.length})</h2><button className="text-button" type="button" onClick={loadUsers}>Tải lại</button></div>
          {isWorking && !users.length ? <p className="muted">Đang tải…</p> : (
            <div className="admin-user-list">
              {users.map((account) => {
                const id = account._id || account.id;
                const canChange = user.role === 'superadmin' && account.role !== 'superadmin' && id !== user.id;
                return <article key={id}>
                  <div><strong>{account.name}</strong><span>{account.email}</span></div>
                  <span className="admin-role">{account.role}</span>
                  {canChange ? <div className="row-actions">
                    <select value={account.role} onChange={(event) => updateUser(id, { role: event.target.value })} disabled={isWorking}>
                      <option value="customer">Người dùng</option><option value="admin">Quản trị</option>
                    </select>
                    <button type="button" className={account.isActive ? 'danger' : 'text-button'} onClick={() => updateUser(id, { isActive: !account.isActive })} disabled={isWorking}>
                      {account.isActive ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </div> : <span>{account.isActive ? 'Đang hoạt động' : 'Đã khóa'}</span>}
                </article>;
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'feedback' && (
        <section className="panel-card admin-table-card">
          <div className="section-title"><h2>Phản hồi ({feedback.length})</h2><button className="text-button" type="button" onClick={loadFeedback}>Tải lại</button></div>
          {isWorking && !feedback.length ? <p className="muted">Đang tải…</p> : (
            <div className="admin-feedback-list">
              {feedback.map((item) => <article key={item._id || item.id}>
                <div className="admin-feedback-head"><strong>{item.type === 'report' ? 'Báo nội dung xấu' : 'Góp ý'}</strong><span>{item.user?.email || item.email || 'Khách'}</span></div>
                <p>{item.targetName ? `${item.targetName}: ${item.content}` : item.content}</p>
                <select value={item.status} onChange={(event) => updateFeedback(item._id || item.id, event.target.value)} disabled={isWorking}>
                  <option value="new">Mới</option><option value="reviewed">Đã xem</option><option value="resolved">Đã xử lý</option>
                </select>
              </article>)}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
