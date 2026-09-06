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

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Không thể lưu dữ liệu.';
}

export function isLocalBrowserHost(hostname = '') {
  const host = String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export default function AdminPage() {
  const {
    products, importShopeeProduct, removeProduct, refreshProducts, addProductImage, downloadProductJson,
  } = useProducts();
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingProductId, setUploadingProductId] = useState('');
  const isLocalBrowser = typeof window !== 'undefined'
    && isLocalBrowserHost(window.location.hostname);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!sourceUrl.trim()) {
      setError('Hãy dán URL Shopee.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await importShopeeProduct(sourceUrl.trim());
      const product = result?.product || result;
      const needsImage = product?.importStatus === 'needs-image-processing'
        && !product?.sourceImages?.length;
      setSourceUrl('');
      setNotice(result?.alreadyExists
        ? 'Sản phẩm đã có.'
        : needsImage ? 'Đã thêm sản phẩm. Hãy thêm ảnh.' : `Đã thêm: ${product?.name || 'sản phẩm'}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
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

      <div className={`admin-layout${isLocalBrowser ? '' : ' single'}`}>
        {isLocalBrowser && (
          <form className="admin-form panel-card admin-enter" onSubmit={submit}>
            <div className="section-title">
              <div><span className="step-label">SẢN PHẨM</span><h2>Thêm sản phẩm</h2></div>
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

            <button className="button" type="submit" disabled={isSaving}>
              {isSaving ? 'Đang thêm…' : 'Thêm sản phẩm'}
            </button>
            {error && <p className="form-error" role="alert" aria-live="polite">{error}</p>}
            {notice && <p className="form-success" role="status" aria-live="polite">{notice}</p>}
          </form>
        )}

        <section className="admin-products panel-card admin-enter">
          <div className="section-title">
            <div><span className="step-label">{products.length} SẢN PHẨM</span><h2>Danh sách sản phẩm</h2></div>
            <div className="row-actions">
              <button className="text-button" type="button" onClick={refreshProducts} disabled={isSaving}>Tải lại</button>
              <button className="text-button" type="button" onClick={() => downloadProductJson().catch((downloadError) => setError(getErrorMessage(downloadError)))} disabled={isSaving}>Tải JSON</button>
            </div>
          </div>

          <div className="admin-product-list">
            {products.map((product) => (
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
                  <span>{getCategoryName(product)} · {(
                    product.importStatus === 'needs-image-processing' && !product.sourceImages?.length
                      ? 'Chưa có giá'
                      : formatPrice(product.price)
                  )}</span>
                </div>
                <div className="row-actions">
                  <label className="text-button">{uploadingProductId === product._id ? 'Đang lưu…' : 'Thêm ảnh'}
                    <input hidden type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploadingProductId)} onChange={(event) => uploadImage(product, event.target.files?.[0])} />
                  </label>
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
