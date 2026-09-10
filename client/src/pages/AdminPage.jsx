import { useEffect, useMemo, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductContext';
import feedbackService from '../services/feedbackService';
import { FALLBACK_PROVINCES } from '../services/locationService';
import orderService from '../services/orderService';
import userService from '../services/userService';
import { formatPrice } from '../utils/formatPrice';

const emptyForm = {
  name: '',
  categoryName: 'Nội thất',
  price: '',
  stock: '20',
  description: '',
};
const ORDER_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};
const ORDER_LABELS = {
  Pending: 'Chờ xử lý',
  Processing: 'Đang chuẩn bị',
  Shipped: 'Đang giao',
  Delivered: 'Đã giao',
  Cancelled: 'Đã hủy',
};

function categoryName(product) {
  if (typeof product.category === 'object') return product.category?.name || product.categoryName || 'Nội thất';
  return product.category || product.categoryName || 'Nội thất';
}

function formFromProduct(product) {
  return {
    name: product.name || '',
    categoryName: categoryName(product),
    price: product.price ?? '',
    stock: product.stock ?? 0,
    description: product.description || '',
  };
}

function productFromForm(form) {
  return {
    name: form.name.trim(),
    categoryName: form.categoryName.trim(),
    price: Number(form.price) || 0,
    stock: Math.max(0, Math.round(Number(form.stock) || 0)),
    description: form.description.trim(),
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

function profileIsComplete(account) {
  return Boolean(account.phone && account.address && account.provinceCode && account.districtCode && account.wardCode);
}

function provinceName(code) {
  return FALLBACK_PROVINCES.find((province) => Number(province.code) === Number(code))?.name || 'Chưa cập nhật';
}

function paymentLabel(order) {
  if (order.orderStatus === 'Cancelled' && order.paymentStatus !== 'Paid') return 'Đã hủy';
  return order.paymentStatus === 'Paid' ? 'Đã thanh toán' : 'Chờ thanh toán';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
}

function safeText(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function downloadInvoice(order) {
  const orderCode = order.orderNumber || String(order._id).slice(-8).toUpperCase();
  const itemRows = (order.orderItems || []).map((item) => `
    <tr>
      <td>${safeText(item.name)}</td>
      <td>${item.qty ?? item.quantity}</td>
      <td>${formatPrice(item.price)}</td>
      <td>${formatPrice(item.price * (item.qty ?? item.quantity))}</td>
    </tr>
  `).join('');

  const html = `<!doctype html>
  <html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn ${safeText(orderCode)}</title>
  <style>body{max-width:800px;margin:40px auto;font:16px Arial;color:#202820}h1{color:#17583f}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:10px;border:1px solid #ccd5ce;text-align:left}.total{text-align:right;font-size:20px}small{color:#667}</style>
  </head><body>
    <h1>FurneeHome</h1>
    <h2>Hóa đơn ${safeText(orderCode)}</h2>
    <p>Ngày tạo: ${safeText(formatDate(order.createdAt))}</p>
    <p>Khách hàng: ${safeText(order.shippingAddress?.fullName)}</p>
    <p>Số điện thoại: ${safeText(order.shippingAddress?.phone)}</p>
    <p>Địa chỉ: ${safeText(order.shippingAddress?.address)}</p>
    <table><thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${itemRows}</tbody></table>
    <p>Tiền hàng: ${formatPrice(order.subtotal)}</p>
    <p>Phí vận chuyển: ${formatPrice(order.shippingFee)}</p>
    <p class="total"><strong>Tổng cộng: ${formatPrice(order.totalAmount)}</strong></p>
    <small>Trạng thái: ${safeText(ORDER_LABELS[order.orderStatus] || order.orderStatus)} · ${safeText(paymentLabel(order))}</small>
  </body></html>`;

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `hoa-don-${orderCode}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CustomerModal({ account, onClose }) {
  if (!account) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-dialog admin-detail-modal" role="dialog" aria-modal="true" aria-labelledby="customer-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2 id="customer-title">Hồ sơ khách hàng</h2>
          <button className="btn-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        </header>
        <div className="modal-body customer-profile-grid">
          <p><span>Họ tên</span><strong>{account.name}</strong></p>
          <p><span>Tên tài khoản</span><strong>{account.username ? `@${account.username}` : 'Chưa có'}</strong></p>
          <p><span>Email</span><strong>{account.email}</strong></p>
          <p><span>Số điện thoại</span><strong>{account.phone || 'Chưa cập nhật'}</strong></p>
          <p><span>Tỉnh / Thành phố</span><strong>{provinceName(account.provinceCode)}</strong></p>
          <p><span>Quận / Huyện</span><strong>{account.districtName || 'Chưa cập nhật'}</strong></p>
          <p><span>Phường / Xã</span><strong>{account.wardName || 'Chưa cập nhật'}</strong></p>
          <p><span>Địa chỉ</span><strong>{account.address || 'Chưa cập nhật'}</strong></p>
          <p><span>Ghi chú giao hàng (tùy chọn)</span><strong>{account.deliveryNote || 'Không có'}</strong></p>
          <p><span>Ngày tạo tài khoản</span><strong>{formatDate(account.createdAt)}</strong></p>
          <p><span>Trạng thái hồ sơ</span><strong>{profileIsComplete(account) ? 'Đã đủ thông tin' : 'Chưa đủ thông tin'}</strong></p>
          <p><span>Trạng thái tài khoản</span><strong>{account.isActive ? 'Đang hoạt động' : 'Đã khóa'}</strong></p>
        </div>
        <footer className="modal-footer"><button className="text-button" type="button" onClick={onClose}>Đóng</button></footer>
      </section>
    </div>
  );
}

function InvoiceModal({ order, onClose }) {
  if (!order) return null;
  const orderCode = order.orderNumber || String(order._id).slice(-8).toUpperCase();
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-dialog admin-detail-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2 id="invoice-title">Hóa đơn {orderCode}</h2>
          <button className="btn-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">
          <div className="detail-meta-grid">
            <div><strong>Khách hàng</strong><p>{order.shippingAddress?.fullName}</p><p>{order.shippingAddress?.phone}</p></div>
            <div><strong>Ngày tạo</strong><p>{formatDate(order.createdAt)}</p><p>{ORDER_LABELS[order.orderStatus] || order.orderStatus}</p></div>
          </div>
          <p><strong>Địa chỉ:</strong> {order.shippingAddress?.address}</p>
          {order.shippingAddress?.note && <p><strong>Ghi chú:</strong> {order.shippingAddress.note}</p>}
          <div className="modal-items-table">
            {(order.orderItems || []).map((item, index) => (
              <div className="modal-item-row" key={`${item.product || item.name}-${index}`}>
                <span>{item.name} × {item.qty ?? item.quantity}</span>
                <strong>{formatPrice(item.price * (item.qty ?? item.quantity))}</strong>
              </div>
            ))}
          </div>
          <div className="modal-total-box">
            <div className="row"><span>Tiền hàng</span><strong>{formatPrice(order.subtotal)}</strong></div>
            <div className="row"><span>Phí vận chuyển</span><strong>{formatPrice(order.shippingFee)}</strong></div>
            <div className="row total"><span>Tổng cộng</span><strong>{formatPrice(order.totalAmount)}</strong></div>
          </div>
        </div>
        <footer className="modal-footer">
          <button className="text-button" type="button" onClick={onClose}>Đóng</button>
          <button className="button" type="button" onClick={() => downloadInvoice(order)}>Tải hóa đơn</button>
        </footer>
      </section>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const {
    products,
    loading,
    addProduct,
    updateProduct,
    removeProduct,
    deleteProduct,
    refreshProducts,
    addProductImage,
    syncProductJson,
  } = useProducts();
  const [tab, setTab] = useState('products');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [isNewCategory, setNewCategory] = useState(false);
  const [query, setQuery] = useState('');
  const [adminQuery, setAdminQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [isWorking, setWorking] = useState(false);
  const [uploadingId, setUploadingId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const isSuperadmin = user?.role === 'superadmin';

  const filterCategories = useMemo(() => {
    const list = products.map(categoryName).filter(Boolean);
    return ['Tất cả', ...Array.from(new Set(list))];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('vi');
    return products.filter((product) => {
      const cat = categoryName(product);
      const matchesSearch = !search || `${product.name} ${cat}`.toLocaleLowerCase('vi').includes(search);
      const matchesCategory = selectedCategory === 'Tất cả' || cat === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, query, selectedCategory]);
  const categories = useMemo(() => [...new Set([...products.map(categoryName), form.categoryName].filter(Boolean))].sort((first, second) => first.localeCompare(second, 'vi')), [products, form.categoryName]);
  const customers = users.filter((account) => account.role === 'customer');
  const adminAccounts = users.filter((account) => ['admin', 'superadmin'].includes(account.role));
  const visibleAdmins = adminAccounts.filter((account) => {
    const search = adminQuery.trim().toLocaleLowerCase('vi');
    if (!search) return true;
    return [account.name, account.username, account.email]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase('vi').includes(search));
  });

  useEffect(() => {
    setNotice('');
    setError('');
    if (tab === 'products') refreshProducts();
    if (tab === 'customers') loadUsers('customers');
    if (tab === 'admins') loadUsers('admins');
    if (tab === 'orders') loadOrders();
    if (tab === 'contact') loadFeedback();
  }, [tab]);

  async function loadUsers(scope = tab === 'admins' ? 'admins' : 'customers') {
    setWorking(true);
    try { setUsers(await userService.listAdmin(scope)); } catch (loadError) { setError(messageFrom(loadError)); } finally { setWorking(false); }
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

  async function deleteForever(product) {
    if (!window.confirm(`Xóa vĩnh viễn sản phẩm “${product.name}” khỏi MongoDB?`)) return;
    setWorking(true); setNotice(''); setError('');
    try {
      await deleteProduct(product._id || product.id);
      setNotice('Đã xóa sản phẩm khỏi MongoDB.');
      if (editingId === (product._id || product.id)) resetForm();
    } catch (deleteError) {
      setError(messageFrom(deleteError));
    } finally {
      setWorking(false);
    }
  }

  async function syncJson() {
    setWorking(true); setNotice(''); setError('');
    try {
      const result = await syncProductJson();
      setNotice(result.message || 'Đã đồng bộ JSON.');
    } catch (syncError) {
      setError(messageFrom(syncError));
    } finally {
      setWorking(false);
    }
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
    try { await feedbackService.updateAdmin(id, { status }); await loadFeedback(); setNotice('Đã cập nhật báo cáo.'); } catch (updateError) { setError(messageFrom(updateError)); setWorking(false); }
  }

  return <main className="container page admin-page">
    <div className="page-heading"><h1>Quản trị</h1></div>
    <nav className="admin-tabs" aria-label="Nội dung quản trị">
      <button type="button" className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Sản phẩm</button>
      <button type="button" className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>Khách hàng</button>
      <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Đơn hàng</button>
      <button type="button" className={tab === 'contact' ? 'active' : ''} onClick={() => setTab('contact')}>Báo nội dung</button>
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
        <div className="admin-form-actions"><button className="button" type="submit" disabled={isWorking}>{isWorking ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Thêm sản phẩm'}</button>{editingId && <button className="text-button" type="button" onClick={resetForm}>Hủy</button>}</div>
      </form>
      <section className="admin-products panel-card">
        <div className="section-title">
          <h2>Danh sách sản phẩm ({visibleProducts.length})</h2>
          <div className="row-actions">
            {['localhost', '127.0.0.1'].includes(window.location.hostname) && <button className="text-button" type="button" onClick={syncJson} disabled={isWorking}>Đồng bộ JSON</button>}
            <button className="text-button" type="button" onClick={refreshProducts} disabled={loading || isWorking}>{loading ? 'Đang tải…' : 'Tải lại'}</button>
          </div>
        </div>
        <input
          className="admin-search"
          type="search"
          value={query}
          placeholder="Tìm tên hoặc danh mục"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="category-pills" style={{ margin: '12px 0 16px', gap: '6px' }}>
          {filterCategories.map((item) => (
            <button
              className={selectedCategory === item ? 'active' : ''}
              type="button"
              key={item}
              onClick={() => setSelectedCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="admin-product-list">
          {visibleProducts.map((product) => {
            const id = product._id || product.id;
            const active = product.isActive !== false;
            return (
              <article key={id}>
                <div className="admin-thumb">
                  <ProductArtwork product={product} />
                </div>
                <div className="admin-product-name">
                  <strong>{product.name}</strong>
                  <span>{categoryName(product)} · {formatPrice(product.price)} · Còn {product.stock ?? 0} · {active ? 'Đang bán' : 'Ngừng bán'}</span>
                </div>
                <div className="row-actions">
                  <button className="admin-edit" type="button" onClick={() => startEditing(product)}>Sửa</button>
                  <label className="admin-upload">
                    {uploadingId === id ? 'Đang lưu…' : 'Thêm ảnh'}
                    <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadImage(product, event.target.files?.[0])} />
                  </label>
                  <button className={active ? 'admin-delete' : 'admin-edit'} type="button" onClick={() => changeProductStatus(product)}>
                    {active ? 'Ngừng bán' : 'Bán lại'}
                  </button>
                  <button className="admin-delete" type="button" onClick={() => deleteForever(product)}>Xóa</button>
                </div>
              </article>
            );
          })}
        </div>
        {!visibleProducts.length && <p className="muted">Không tìm thấy sản phẩm thuộc danh mục này.</p>}
      </section>
    </div>}

    {tab === 'customers' && (
      <section className="panel-card admin-table-card">
        <div className="section-title">
          <h2>Khách hàng ({customers.length})</h2>
          <button className="text-button" type="button" onClick={() => loadUsers('customers')}>Tải lại</button>
        </div>
        {isWorking && !customers.length ? <p className="muted">Đang tải…</p> : (
          <div className="admin-user-list">
            {customers.map((account) => {
              const id = account._id || account.id;
              return (
                <article key={id}>
                  <div><strong>{account.name}</strong><span>{account.email}</span></div>
                  <span className={profileIsComplete(account) ? 'profile-badge complete' : 'profile-badge'}>
                    {profileIsComplete(account) ? 'Đủ thông tin' : 'Chưa đủ'}
                  </span>
                  <div className="row-actions">
                    <button className="admin-edit" type="button" onClick={() => setSelectedCustomer(account)}>Xem hồ sơ</button>
                    <button
                      type="button"
                      className={account.isActive ? 'admin-delete' : 'admin-edit'}
                      onClick={() => updateAccount(id, { isActive: !account.isActive })}
                      disabled={isWorking}
                    >
                      {account.isActive ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    )}

    {tab === 'orders' && (
      <section className="panel-card admin-table-card">
        <div className="section-title">
          <h2>Đơn hàng ({orders.length})</h2>
          <button className="text-button" type="button" onClick={loadOrders}>Tải lại</button>
        </div>
        {isWorking && !orders.length ? <p className="muted">Đang tải…</p> : !orders.length ? <p className="muted">Chưa có đơn hàng.</p> : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Phương thức</th><th>Thanh toán</th><th>Trạng thái đơn</th><th>Hóa đơn</th></tr></thead>
              <tbody>
                {orders.map((order) => {
                  const isBank = order.paymentMethod === 'BANK_TRANSFER';
                  const paid = order.paymentStatus === 'Paid';
                  const canConfirmPayment = order.orderStatus !== 'Cancelled' && !paid && (isBank || order.orderStatus === 'Delivered');
                  const nextStates = isSuperadmin && order.orderStatus !== 'Cancelled'
                    ? ['Pending', 'Processing', 'Shipped', 'Delivered']
                    : (ORDER_TRANSITIONS[order.orderStatus] || []);

                  return (
                    <tr key={order._id}>
                      <td><strong>{order.orderNumber || String(order._id).slice(-8).toUpperCase()}</strong></td>
                      <td>{order.shippingAddress?.fullName}<br /><small>{order.shippingAddress?.phone}</small></td>
                      <td>{(order.orderItems || []).map((item) => `${item.name} × ${item.qty ?? item.quantity}`).join(', ')}</td>
                      <td><strong>{formatPrice(order.totalAmount)}</strong></td>
                      <td><span className={`payment-badge ${isBank ? 'bank' : 'cod'}`}>{isBank ? 'Chuyển khoản QR' : 'COD'}</span></td>
                      <td>
                        <span>{paymentLabel(order)}</span>
                        {canConfirmPayment && <button className="text-button admin-payment-button" type="button" disabled={isWorking} onClick={() => updateOrder(order._id, { paymentStatus: 'Paid' })}>Xác nhận thanh toán</button>}
                      </td>
                      <td>
                        {nextStates.length ? (
                          <select value={order.orderStatus} disabled={isWorking} onChange={(event) => updateOrder(order._id, { orderStatus: event.target.value })}>
                            {[...new Set([order.orderStatus, ...nextStates])].map((state) => <option key={state} value={state}>{ORDER_LABELS[state]}</option>)}
                          </select>
                        ) : <span>{ORDER_LABELS[order.orderStatus] || order.orderStatus}</span>}
                      </td>
                      <td><button className="admin-edit" type="button" onClick={() => setSelectedOrder(order)}>Xem</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )}

    {tab === 'contact' && <section className="panel-card admin-table-card"><div className="section-title"><h2>Báo nội dung ({feedback.length})</h2><button className="text-button" type="button" onClick={loadFeedback}>Tải lại</button></div>{isWorking && !feedback.length ? <p className="muted">Đang tải…</p> : !feedback.length ? <p className="muted">Chưa có báo cáo.</p> : <div className="admin-feedback-list">{feedback.map((item) => <article key={item._id || item.id}><div><strong>{item.targetName || 'Nội dung chung'}</strong><span>{item.user?.email || item.email || 'Khách'}</span><p>{item.content}</p></div><select value={item.status} onChange={(event) => updateFeedback(item._id || item.id, event.target.value)} disabled={isWorking}><option value="new">Mới</option><option value="reviewed">Đã xem</option><option value="resolved">Đã xử lý</option></select></article>)}</div>}</section>}

    {isSuperadmin && tab === 'admins' && <section className="panel-card admin-table-card"><div className="section-title"><h2>Quản trị admin ({visibleAdmins.length})</h2><button className="text-button" type="button" onClick={() => loadUsers('admins')}>Tải lại</button></div><input className="admin-search" type="search" value={adminQuery} placeholder="Tìm tên, tên đăng nhập hoặc email" onChange={(event) => setAdminQuery(event.target.value)} />{isWorking && !adminAccounts.length ? <p className="muted">Đang tải…</p> : <div className="admin-user-list">{visibleAdmins.map((account) => { const id = account._id || account.id; const orchestra = account.role === 'superadmin'; return <article key={id}><div><strong>{account.name}</strong><span>{account.username ? `@${account.username} · ` : ''}{account.email}</span></div><span className="admin-role">{orchestra ? 'Orchestra Admin' : 'Admin'}</span>{orchestra ? <span /> : <button type="button" className={account.isActive ? 'admin-delete' : 'admin-edit'} onClick={() => updateAccount(id, { isActive: !account.isActive })} disabled={isWorking}>{account.isActive ? 'Khóa' : 'Mở khóa'}</button>}</article>; })}</div>}</section>}

    <CustomerModal account={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    <InvoiceModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
  </main>;
}
