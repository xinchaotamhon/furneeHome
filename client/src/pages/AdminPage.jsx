import { useEffect, useMemo, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductContext';
import feedbackService from '../services/feedbackService';
import orderService from '../services/orderService';
import userService from '../services/userService';
import { formatPrice } from '../utils/formatPrice';

const emptyForm = { name: '', categoryName: 'Nội thất', price: '', stock: '20', description: '', width: '', depth: '', height: '', usageType: 'standard', placementSurface: 'floor', aiDescription: '' };
const ORDER_STATES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

function categoryName(product) {
  if (typeof product.category === 'object') return product.category?.name || product.categoryName || 'Nội thất';
  return product.category || product.categoryName || 'Nội thất';
}

function formFromProduct(product) {
  const size = product.dimensionsCm || product.dimensions || {};
  return { name: product.name || '', categoryName: categoryName(product), price: product.price ?? '', stock: product.stock ?? 0, description: product.description || '', width: size.width || size.widthCm || '', depth: size.depth || size.depthCm || '', height: size.height || size.heightCm || '', usageType: product.usageType || 'standard', placementSurface: product.placementSurface || 'floor', aiDescription: product.aiDescription || '' };
}

function productFromForm(form) {
  return { name: form.name.trim(), categoryName: form.categoryName.trim(), price: Number(form.price) || 0, stock: Math.max(0, Math.round(Number(form.stock) || 0)), description: form.description.trim(), usageType: form.usageType, placementSurface: form.placementSurface, aiDescription: form.aiDescription.trim(), dimensionsCm: { width: Number(form.width) || undefined, depth: Number(form.depth) || undefined, height: Number(form.height) || undefined } };
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

export default function AdminPage() {
  const { user } = useAuth();
  const { products, loading, addProduct, updateProduct, removeProduct, refreshProducts, addProductImage } = useProducts();
  const [tab, setTab] = useState('products');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [isNewCategory, setNewCategory] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [isWorking, setWorking] = useState(false);
  const [uploadingId, setUploadingId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const isSuperadmin = user?.role === 'superadmin';

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('vi');
    return products.filter((product) => !search || `${product.name} ${categoryName(product)}`.toLocaleLowerCase('vi').includes(search));
  }, [products, query]);
  const categories = useMemo(() => [...new Set([...products.map(categoryName), form.categoryName].filter(Boolean))].sort((first, second) => first.localeCompare(second, 'vi')), [products, form.categoryName]);
  const customers = users.filter((account) => account.role === 'customer');
  const managedAccounts = users.filter((account) => account.role !== 'superadmin');

  useEffect(() => {
    setNotice('');
    setError('');
    if (tab === 'customers' || tab === 'admins') loadUsers();
    if (tab === 'orders') loadOrders();
    if (tab === 'contact') loadFeedback();
  }, [tab]);

  async function loadUsers() {
    setWorking(true);
    try { setUsers(await userService.listAdmin()); } catch (loadError) { setError(messageFrom(loadError)); } finally { setWorking(false); }
  }

  async function loadOrders() {
    setWorking(true);
    try { const data = await orderService.getAllOrders(); setOrders(Array.isArray(data) ? data : []); } catch (loadError) { setError(messageFrom(loadError)); } finally { setWorking(false); }
  }

  async function loadFeedback() {
    setWorking(true);
    try { const data = await feedbackService.listAdmin(); setFeedback(Array.isArray(data) ? data : []); } catch (loadError) { setError(messageFrom(loadError)); } finally { setWorking(false); }
  }

  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function resetForm() { setForm(emptyForm); setEditingId(''); setNewCategory(false); }

  async function saveProduct(event) {
    event.preventDefault(); setNotice(''); setError('');
    if (!form.name.trim() || !form.categoryName.trim()) { setError('Nhập tên và danh mục sản phẩm.'); return; }
    setWorking(true);
    try {
      if (editingId) await updateProduct(editingId, productFromForm(form)); else await addProduct(productFromForm(form));
      setNotice(editingId ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.'); resetForm();
    } catch (saveError) { setError(messageFrom(saveError)); } finally { setWorking(false); }
  }

  function startEditing(product) {
    setEditingId(product._id || product.id); setForm(formFromProduct(product)); setNewCategory(false); setNotice(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function changeProductStatus(product) {
    const active = product.isActive !== false;
    if (active && !window.confirm(`Ngừng bán sản phẩm “${product.name}”?`)) return;
    setWorking(true); setNotice(''); setError('');
    try {
      if (active) await removeProduct(product._id || product.id);
      else await updateProduct(product._id || product.id, { isActive: true });
      setNotice(active ? 'Đã ngừng bán sản phẩm.' : 'Đã mở bán lại sản phẩm.');
      if (editingId === (product._id || product.id)) resetForm();
    } catch (statusError) { setError(messageFrom(statusError)); } finally { setWorking(false); }
  }

  async function uploadImage(product, file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) { setError('Chọn ảnh PNG, JPEG hoặc WebP không quá 12 MB.'); return; }
    const id = product._id || product.id;
    setUploadingId(id); setNotice(''); setError('');
    try { await addProductImage(id, await fileToDataUrl(file)); setNotice(`Đã thêm ảnh cho ${product.name}.`); } catch (uploadError) { setError(messageFrom(uploadError)); } finally { setUploadingId(''); }
  }

  async function updateAccount(id, changes) {
    setWorking(true); setNotice(''); setError('');
    try { await userService.updateAdmin(id, changes); await loadUsers(); setNotice('Đã cập nhật tài khoản.'); } catch (updateError) { setError(messageFrom(updateError)); setWorking(false); }
  }

  async function updateOrder(id, changes) {
    setWorking(true); setNotice(''); setError('');
    try {
      const saved = await orderService.updateOrderStatus(id, changes);
      setOrders((current) => current.map((order) => (order._id === id ? saved : order)));
      setNotice('Đã cập nhật đơn hàng.');
    } catch (updateError) {
      setError(messageFrom(updateError));
    } finally {
      setWorking(false);
    }
  }

  async function updateFeedback(id, status) {
    setWorking(true); setNotice(''); setError('');
    try { await feedbackService.updateAdmin(id, { status }); await loadFeedback(); setNotice('Đã cập nhật liên hệ.'); } catch (updateError) { setError(messageFrom(updateError)); setWorking(false); }
  }

  return <main className="container page admin-page">
    <div className="page-heading"><h1>Quản trị</h1></div>
    <nav className="admin-tabs" aria-label="Nội dung quản trị">
      <button type="button" className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Sản phẩm</button>
      <button type="button" className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>Khách hàng</button>
      <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Đơn hàng</button>
      <button type="button" className={tab === 'contact' ? 'active' : ''} onClick={() => setTab('contact')}>Liên hệ</button>
      {isSuperadmin && <button type="button" className={tab === 'admins' ? 'active' : ''} onClick={() => setTab('admins')}>Quản trị admin</button>}
    </nav>
    {error && <p className="form-error admin-message" role="alert">{error}</p>}
    {notice && <p className="form-success admin-message" role="status">{notice}</p>}

    {tab === 'products' && <div className="admin-layout">
      <form className="admin-form panel-card" onSubmit={saveProduct}>
        <div className="section-title"><h2>{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div>
        <label>Tên sản phẩm<input value={form.name} onChange={(event) => updateField('name', event.target.value)} required /></label>
        <label>Danh mục<select value={isNewCategory ? '__new__' : form.categoryName} onChange={(event) => { if (event.target.value === '__new__') { setNewCategory(true); updateField('categoryName', ''); } else { setNewCategory(false); updateField('categoryName', event.target.value); } }} required><option value="" disabled>Chọn danh mục</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}<option value="__new__">+ Tạo danh mục mới</option></select></label>
        {isNewCategory && <label>Danh mục mới<input value={form.categoryName} onChange={(event) => updateField('categoryName', event.target.value)} required /></label>}
        <label>Giá<input type="number" min="1" step="1" value={form.price} onChange={(event) => updateField('price', event.target.value)} required /></label>
        <label>Tồn kho<input type="number" min="0" step="1" value={form.stock} onChange={(event) => updateField('stock', event.target.value)} required /></label>
        <label>Mô tả<textarea rows="3" value={form.description} onChange={(event) => updateField('description', event.target.value)} /></label>
        <details className="admin-product-details"><summary>Thông tin Phòng thử</summary><div className="admin-detail-fields"><div className="admin-dimensions"><label>Rộng (cm)<input type="number" min="1" value={form.width} onChange={(event) => updateField('width', event.target.value)} /></label><label>Sâu (cm)<input type="number" min="1" value={form.depth} onChange={(event) => updateField('depth', event.target.value)} /></label><label>Cao (cm)<input type="number" min="1" value={form.height} onChange={(event) => updateField('height', event.target.value)} /></label></div><label>Cách sử dụng<select value={form.usageType} onChange={(event) => updateField('usageType', event.target.value)}><option value="standard">Thông thường</option><option value="floor-seating">Ngồi bệt</option><option value="unknown">Chưa xác định</option></select></label><label>Vị trí đặt<select value={form.placementSurface} onChange={(event) => updateField('placementSurface', event.target.value)}><option value="floor">Trên sàn</option><option value="wall">Trên tường</option><option value="tabletop">Trên mặt bàn</option><option value="unknown">Chưa xác định</option></select></label><label>Mô tả hình dạng<textarea rows="3" maxLength="300" value={form.aiDescription} onChange={(event) => updateField('aiDescription', event.target.value)} /></label></div></details>
        <div className="admin-form-actions"><button className="button" type="submit" disabled={isWorking}>{isWorking ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Thêm sản phẩm'}</button>{editingId && <button className="text-button" type="button" onClick={resetForm}>Hủy</button>}</div>
      </form>
      <section className="admin-products panel-card"><div className="section-title"><h2>Danh sách sản phẩm ({visibleProducts.length})</h2><button className="text-button" type="button" onClick={refreshProducts} disabled={loading || isWorking}>{loading ? 'Đang tải…' : 'Tải lại'}</button></div><input className="admin-search" type="search" value={query} placeholder="Tìm tên hoặc danh mục" onChange={(event) => setQuery(event.target.value)} /><div className="admin-product-list">{visibleProducts.map((product) => { const id = product._id || product.id; const active = product.isActive !== false; return <article key={id}><div className="admin-thumb"><ProductArtwork product={product} /></div><div className="admin-product-name"><strong>{product.name}</strong><span>{categoryName(product)} · {formatPrice(product.price)} · Còn {product.stock ?? 0} · {active ? 'Đang bán' : 'Ngừng bán'}</span></div><div className="row-actions"><button className="admin-edit" type="button" onClick={() => startEditing(product)}>Sửa</button><label className="admin-upload">{uploadingId === id ? 'Đang lưu…' : 'Thêm ảnh'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadImage(product, event.target.files?.[0])} /></label><button className={active ? 'admin-delete' : 'admin-edit'} type="button" onClick={() => changeProductStatus(product)}>{active ? 'Ngừng bán' : 'Bán lại'}</button></div></article>; })}</div>{!visibleProducts.length && <p className="muted">Không tìm thấy sản phẩm.</p>}</section>
    </div>}

    {tab === 'customers' && <section className="panel-card admin-table-card"><div className="section-title"><h2>Khách hàng ({customers.length})</h2><button className="text-button" type="button" onClick={loadUsers}>Tải lại</button></div>{isWorking && !customers.length ? <p className="muted">Đang tải…</p> : <div className="admin-user-list">{customers.map((account) => { const id = account._id || account.id; return <article key={id}><div><strong>{account.name}</strong><span>{account.username ? `@${account.username} · ` : ''}{account.email}</span></div><span className="admin-role">Khách hàng</span><button type="button" className={account.isActive ? 'admin-delete' : 'admin-edit'} onClick={() => updateAccount(id, { isActive: !account.isActive })} disabled={isWorking}>{account.isActive ? 'Khóa' : 'Mở khóa'}</button></article>; })}</div>}</section>}

    {tab === 'orders' && <section className="panel-card admin-table-card"><div className="section-title"><h2>Đơn hàng ({orders.length})</h2><button className="text-button" type="button" onClick={loadOrders}>Tải lại</button></div>{isWorking && !orders.length ? <p className="muted">Đang tải…</p> : !orders.length ? <p className="muted">Chưa có đơn hàng.</p> : <div className="admin-table-container"><table className="admin-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Phương thức</th><th>Thanh toán</th><th>Trạng thái đơn</th></tr></thead><tbody>{orders.map((order) => { const isBank = order.paymentMethod === 'BANK_TRANSFER'; return <tr key={order._id}><td><strong>{order.orderNumber || String(order._id).slice(-8).toUpperCase()}</strong></td><td>{order.shippingAddress?.fullName}<br /><small>{order.shippingAddress?.phone}</small></td><td>{(order.orderItems || []).map((item) => `${item.name} × ${item.qty ?? item.quantity}`).join(', ')}</td><td><strong>{formatPrice(order.totalAmount)}</strong></td><td><span className={`payment-badge ${isBank ? 'bank' : 'cod'}`}>{isBank ? 'Chuyển khoản QR' : 'COD'}</span></td><td><select value={order.paymentStatus || 'Pending'} disabled={isWorking} onChange={(event) => updateOrder(order._id, { paymentStatus: event.target.value })}><option value="Pending">Chờ thanh toán</option><option value="Paid">Đã thanh toán</option></select></td><td><select value={order.orderStatus || 'Pending'} disabled={isWorking} onChange={(event) => updateOrder(order._id, { orderStatus: event.target.value })}>{ORDER_STATES.map((state) => <option key={state}>{state}</option>)}</select></td></tr>; })}</tbody></table></div>}</section>}

    {tab === 'contact' && <section className="panel-card admin-table-card"><div className="section-title"><h2>Liên hệ ({feedback.length})</h2><button className="text-button" type="button" onClick={loadFeedback}>Tải lại</button></div>{isWorking && !feedback.length ? <p className="muted">Đang tải…</p> : <div className="admin-feedback-list">{feedback.map((item) => <article key={item._id || item.id}><div><strong>{item.type === 'report' ? 'Báo nội dung xấu' : 'Góp ý'}</strong><span>{item.user?.email || item.email || 'Khách'}</span><p>{item.targetName ? `${item.targetName}: ${item.content}` : item.content}</p></div><select value={item.status} onChange={(event) => updateFeedback(item._id || item.id, event.target.value)} disabled={isWorking}><option value="new">Mới</option><option value="reviewed">Đã xem</option><option value="resolved">Đã xử lý</option></select></article>)}</div>}</section>}

    {isSuperadmin && tab === 'admins' && <section className="panel-card admin-table-card"><div className="section-title"><h2>Quản trị admin</h2><button className="text-button" type="button" onClick={loadUsers}>Tải lại</button></div>{isWorking && !managedAccounts.length ? <p className="muted">Đang tải…</p> : <div className="admin-user-list">{managedAccounts.map((account) => { const id = account._id || account.id; return <article key={id}><div><strong>{account.name}</strong><span>{account.username ? `@${account.username} · ` : ''}{account.email}</span></div><select value={account.role} onChange={(event) => updateAccount(id, { role: event.target.value })} disabled={isWorking}><option value="customer">Khách hàng</option><option value="admin">Admin</option></select><button type="button" className={account.isActive ? 'admin-delete' : 'admin-edit'} onClick={() => updateAccount(id, { isActive: !account.isActive })} disabled={isWorking}>{account.isActive ? 'Khóa' : 'Mở khóa'}</button></article>; })}</div>}</section>}
  </main>;
}
