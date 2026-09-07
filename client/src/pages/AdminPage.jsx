import { useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useProducts } from '../context/ProductContext';
import { formatPrice } from '../utils/formatPrice';

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không thể đọc file ảnh.')); };
    image.src = url;
  });
}

function detectImageMimeType(file) {
  const rawType = String(file?.type || '').toLowerCase();
  if (rawType === 'image/png') return 'image/png';
  if (rawType === 'image/jpeg' || rawType === 'image/jpg') return 'image/jpeg';
  if (rawType === 'image/webp') return 'image/webp';
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function canvasBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể nén ảnh.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function optimizeProductImage(file) {
  const mimeType = detectImageMimeType(file);
  const image = await readImageFile(file);
  let scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const qualities = mimeType === 'image/png' ? [undefined] : [0.86, 0.72, 0.58];
    for (const quality of qualities) {
      const blob = await canvasBlob(canvas, mimeType, quality);
      if (blob && blob.size <= 500 * 1024) return blobToDataUrl(blob);
    }
    scale *= 0.78;
  }
  throw new Error('Ảnh vẫn quá lớn sau khi tối ưu.');
}

function getCategoryName(product) {
  if (typeof product.category === 'object') return product.category?.name || product.categoryName || '';
  return product.categoryName || product.category || '';
}

const emptyProductForm = {
  name: '',
  categoryName: 'Nội thất',
  price: '',
  description: '',
  widthCm: '',
  depthCm: '',
  heightCm: '',
  usageType: 'unknown',
  placementSurface: 'unknown',
  aiDescription: '',
};
const ADMIN_PAGE_SIZE = 12;

function productToForm(product) {
  const dimensions = product.dimensionsCm || {};
  return {
    name: product.name || '',
    categoryName: getCategoryName(product) || 'Nội thất',
    price: Number.isFinite(Number(product.price)) ? String(product.price) : '',
    description: product.description || '',
    widthCm: dimensions.width || product.dimensions?.widthCm || '',
    depthCm: dimensions.depth || product.dimensions?.depthCm || '',
    heightCm: dimensions.height || product.dimensions?.heightCm || '',
    usageType: product.usageType || 'unknown',
    placementSurface: product.placementSurface || 'unknown',
    aiDescription: product.aiDescription || '',
  };
}

function formToProduct(form) {
  const width = Number(form.widthCm) || undefined;
  const depth = Number(form.depthCm) || undefined;
  const height = Number(form.heightCm) || undefined;
  return {
    name: form.name.trim(),
    categoryName: form.categoryName.trim(),
    price: Number(form.price) || 0,
    description: form.description.trim(),
    dimensionsCm: { width, depth, height },
    dimensions: { widthCm: width, depthCm: depth, heightCm: height },
    usageType: form.usageType,
    placementSurface: form.placementSurface,
    aiDescription: form.aiDescription.trim(),
    isActive: true,
  };
}

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Không thể lưu dữ liệu.';
}

export function isLocalBrowserHost(hostname = '') {
  const host = String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export default function AdminPage() {
  const {
    products, importShopeeProduct, addProduct, updateProduct, removeProduct,
    refreshProducts, addProductImage, downloadProductJson,
  } = useProducts();
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [editingId, setEditingId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importError, setImportError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingProductId, setUploadingProductId] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const isLocalBrowser = typeof window !== 'undefined'
    && isLocalBrowserHost(window.location.hostname);
  const normalizedQuery = query.trim().toLocaleLowerCase('vi');
  const filteredProducts = products.filter((product) => !normalizedQuery || [
    product.name,
    getCategoryName(product),
    product.shopeeItemId,
  ].some((value) => String(value || '').toLocaleLowerCase('vi').includes(normalizedQuery)));
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = filteredProducts.slice((currentPage - 1) * ADMIN_PAGE_SIZE, currentPage * ADMIN_PAGE_SIZE);
  const missingImageCount = products.filter((product) => product.imageReady === false || (!product.image && !product.transparentImage)).length;

  const updateForm = (field, value) => {
    setProductForm((current) => ({ ...current, [field]: value }));
  };

  const resetProductForm = () => {
    setProductForm(emptyProductForm);
    setEditingId('');
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!productForm.name.trim() || !productForm.categoryName.trim()) {
      setError('Nhập tên và danh mục sản phẩm.');
      return;
    }
    if (Number(productForm.price) < 0) {
      setError('Giá sản phẩm không hợp lệ.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = formToProduct(productForm);
      if (editingId) {
        await updateProduct(editingId, payload);
        setNotice('Đã cập nhật sản phẩm.');
      } else {
        await addProduct(payload);
        setNotice('Đã thêm sản phẩm.');
      }
      resetProductForm();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const editProduct = (product) => {
    setProductForm(productToForm(product));
    setEditingId(product._id);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitShopee = async (event) => {
    event.preventDefault();
    setImportError('');
    setImportNotice('');
    if (!sourceUrl.trim()) {
      setImportError('Hãy dán URL Shopee.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await importShopeeProduct(sourceUrl.trim());
      const product = result?.product || result;
      const needsImage = product?.importStatus === 'needs-image-processing'
        && !product?.sourceImages?.length;
      setSourceUrl('');
      setImportNotice(result?.alreadyExists
        ? 'Sản phẩm đã có.'
        : needsImage ? 'Đã thêm sản phẩm. Hãy thêm ảnh.' : `Đã thêm: ${product?.name || 'sản phẩm'}`);
    } catch (submitError) {
      setImportError(getErrorMessage(submitError));
    } finally {
      setIsSaving(false);
    }
  };

  const uploadImage = async (product, file) => {
    if (!file) return;
    setError('');
    setNotice('');
    const validExtensions = /\.(png|jpe?g|webp)$/i;
    const isValidType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || validExtensions.test(file.name || '');
    if (!isValidType || file.size > 12 * 1024 * 1024) {
      setError('Chỉ nhận PNG, JPEG hoặc WebP không quá 12 MB.');
      return;
    }
    setUploadingProductId(product._id);
    try {
      await addProductImage(product._id, await optimizeProductImage(file));
      setNotice(`Đã thêm ảnh: ${product.name}`);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setUploadingProductId('');
    }
  };

  const remove = async (product) => {
    if (!window.confirm(`Xóa ${product.name}?`)) return;
    setError('');
    setNotice('');
    setIsSaving(true);
    try {
      await removeProduct(product._id);
      setNotice('Đã xóa sản phẩm.');
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="container page admin-page">
      <div className="page-heading admin-enter">
        <p className="eyebrow">QUẢN TRỊ</p>
        <h1>Quản trị sản phẩm</h1>
      </div>

      <div className="admin-layout">
        <div className="admin-sidebar">
          <form className="admin-form panel-card admin-enter" onSubmit={saveProduct}>
            <div className="section-title">
              <div><span className="step-label">SẢN PHẨM</span><h2>{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div>
            </div>

            <label>Tên
              <input value={productForm.name} onChange={(event) => updateForm('name', event.target.value)} required />
            </label>
            <label>Danh mục
              <input value={productForm.categoryName} onChange={(event) => updateForm('categoryName', event.target.value)} required />
            </label>
            <label>Giá
              <input type="number" min="0" value={productForm.price} onChange={(event) => updateForm('price', event.target.value)} />
            </label>
            <label>Mô tả
              <textarea rows="3" value={productForm.description} onChange={(event) => updateForm('description', event.target.value)} />
            </label>

            <details className="admin-product-details">
              <summary>Thông tin tạo ảnh</summary>
              <div className="admin-detail-fields">
                <label>Cách sử dụng
                  <select value={productForm.usageType} onChange={(event) => updateForm('usageType', event.target.value)}>
                    <option value="unknown">Chưa xác định</option>
                    <option value="standard">Thông thường</option>
                    <option value="floor-seating">Ngồi bệt</option>
                  </select>
                </label>
                <label>Đặt ở đâu
                  <select value={productForm.placementSurface} onChange={(event) => updateForm('placementSurface', event.target.value)}>
                    <option value="unknown">Chưa xác định</option>
                    <option value="floor">Trên sàn</option>
                    <option value="wall">Trên tường</option>
                    <option value="tabletop">Trên mặt bàn</option>
                  </select>
                </label>
                <div className="admin-dimensions">
                  <label>Rộng (cm)<input type="number" min="1" value={productForm.widthCm} onChange={(event) => updateForm('widthCm', event.target.value)} /></label>
                  <label>Sâu (cm)<input type="number" min="1" value={productForm.depthCm} onChange={(event) => updateForm('depthCm', event.target.value)} /></label>
                  <label>Cao (cm)<input type="number" min="1" value={productForm.heightCm} onChange={(event) => updateForm('heightCm', event.target.value)} /></label>
                </div>
                <label>Mô tả hình dạng
                  <textarea rows="3" maxLength="300" value={productForm.aiDescription} onChange={(event) => updateForm('aiDescription', event.target.value)} />
                </label>
              </div>
            </details>

            <div className="admin-form-actions">
              <button className="button" type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu…' : 'Lưu sản phẩm'}</button>
              {editingId && <button className="text-button" type="button" onClick={resetProductForm}>Hủy</button>}
            </div>
            {error && <p className="form-error" role="alert" aria-live="polite">{error}</p>}
            {notice && <p className="form-success" role="status" aria-live="polite">{notice}</p>}
          </form>

          {isLocalBrowser && (
            <form className="admin-form panel-card admin-enter" onSubmit={submitShopee}>
              <div className="section-title">
                <div><span className="step-label">LOCALHOST</span><h2>Nhập từ Shopee</h2></div>
              </div>
              <label>URL Shopee
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://shopee.vn/..."
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  autoComplete="url"
                  required
                />
              </label>
              <button className="button" type="submit" disabled={isSaving}>{isSaving ? 'Đang thêm…' : 'Thêm từ URL'}</button>
              {importError && <p className="form-error" role="alert" aria-live="polite">{importError}</p>}
              {importNotice && <p className="form-success" role="status" aria-live="polite">{importNotice}</p>}
            </form>
          )}
        </div>

        <section className="admin-products panel-card admin-enter">
          <div className="section-title">
            <div><span className="step-label">{products.length} SẢN PHẨM · {missingImageCount} CẦN ẢNH</span><h2>Danh sách sản phẩm</h2></div>
            <div className="row-actions">
              <button className="text-button" type="button" onClick={refreshProducts} disabled={isSaving}>Tải lại</button>
              <button className="text-button" type="button" onClick={() => downloadProductJson().catch((downloadError) => setError(getErrorMessage(downloadError)))} disabled={isSaving}>Tải JSON</button>
            </div>
          </div>

          <input
            className="admin-search"
            type="search"
            value={query}
            placeholder="Tìm tên, danh mục hoặc Item ID"
            aria-label="Tìm sản phẩm quản trị"
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          />

          <div className="admin-product-list">
            {visibleProducts.map((product) => (
              <article key={product._id}>
                <a
                  className="admin-thumb"
                  href={product.sourceUrl || product.shopeeSearchUrl || `https://shopee.vn/search?keyword=${encodeURIComponent(product.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Mở trên Shopee"
                >
                  <ProductArtwork product={product} />
                </a>
                <div>
                  <a
                    className="admin-product-link"
                    href={product.sourceUrl || product.shopeeSearchUrl || `https://shopee.vn/search?keyword=${encodeURIComponent(product.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Mở trên Shopee"
                  >
                    <strong>{product.name}</strong>
                  </a>
                  <span>{getCategoryName(product)} · {formatPrice(product.price)}</span>
                  {(product.imageReady === false || (!product.image && !product.transparentImage)) && <small>Chưa có ảnh</small>}
                </div>
                <div className="row-actions">
                  <button className="text-button" type="button" onClick={() => editProduct(product)} disabled={isSaving}>Sửa</button>
                  <label className="text-button">{uploadingProductId === product._id ? 'Đang lưu…' : 'Thêm ảnh'}
                    <input hidden type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploadingProductId)} onChange={(event) => uploadImage(product, event.target.files?.[0])} />
                  </label>
                  <button className="danger" type="button" onClick={() => remove(product)} disabled={isSaving}>Xóa</button>
                </div>
              </article>
            ))}
          </div>
          {!visibleProducts.length && <p className="muted">Không tìm thấy sản phẩm.</p>}
          {totalPages > 1 && <div className="admin-pagination">
            <button className="text-button" type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>←</button>
            <span>{currentPage} / {totalPages}</span>
            <button className="text-button" type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>→</button>
          </div>}
        </section>
      </div>
    </main>
  );
}
