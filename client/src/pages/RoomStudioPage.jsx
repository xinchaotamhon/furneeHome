import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useProducts } from '../context/ProductContext';
import { createRoomPreview } from '../services/roomPreviewService';

export const ROOM_STUDIO_SESSION_KEY = 'furneehome-simple-room-studio';
const MAX_PRODUCTS = 3;

const idOf = (product) => String(product?._id || product?.id || '');
const productImage = (product) => product?.transparentImage || product?.image || product?.sourceImages?.[0] || '';

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(ROOM_STUDIO_SESSION_KEY)) || {}; } catch { return {}; }
}

function writeSession(value) {
  try { sessionStorage.setItem(ROOM_STUDIO_SESSION_KEY, JSON.stringify(value)); } catch { /* Ảnh lớn không được chặn thao tác */ }
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể đọc ảnh.'));
    reader.readAsDataURL(file);
  });
}

async function imageUrlToDataUrl(source) {
  if (typeof source !== 'string' || !source) throw new Error('Sản phẩm chưa có ảnh tham chiếu.');
  if (source.startsWith('data:')) return source;
  const response = await fetch(new URL(source, window.location.origin).href);
  if (!response.ok) throw new Error('Không thể tải ảnh sản phẩm để gửi lên máy chủ.');
  return toDataUrl(await response.blob());
}

function productFacts(product) {
  const facts = {
    usageType: product?.usageType,
    placementSurface: product?.placementSurface,
    dimensionsCm: product?.dimensionsCm,
    aiDescription: product?.aiDescription,
  };
  return Object.fromEntries(Object.entries(facts).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export default function RoomStudioPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const saved = readSession();
  const { products } = useProducts();
  const incomingProductId = idOf(location.state?.product);
  const incomingIds = Array.isArray(location.state?.selectedIds) ? location.state.selectedIds : [];
  const initialIds = [...new Set([
    ...(Array.isArray(saved.selectedIds) ? saved.selectedIds : (saved.selectedId ? [saved.selectedId] : [])),
    ...incomingIds,
    incomingProductId,
  ].filter(Boolean).map(String))].slice(0, MAX_PRODUCTS);

  const [roomImage, setRoomImage] = useState(saved.roomImage || '');
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [desiredPositions, setDesiredPositions] = useState(saved.desiredPositions || {});
  const [resultImage, setResultImage] = useState(saved.resultImage || '');
  const [isGenerating, setGenerating] = useState(false);
  const [message, setMessage] = useState('Chọn tối đa 3 sản phẩm để bắt đầu.');

  const selectedProducts = useMemo(() => selectedIds
    .map((id) => products.find((product) => idOf(product) === String(id)))
    .filter(Boolean), [products, selectedIds]);

  useEffect(() => {
    writeSession({ roomImage, selectedIds, selectedId: selectedIds[0] || '', desiredPositions, resultImage });
  }, [roomImage, selectedIds, desiredPositions, resultImage]);

  useEffect(() => {
    if (!incomingProductId && !incomingIds.length) return;
    const nextIds = [...new Set([...selectedIds, ...incomingIds, incomingProductId].filter(Boolean).map(String))].slice(0, MAX_PRODUCTS);
    if (nextIds.join('|') !== selectedIds.join('|')) setSelectedIds(nextIds);
  }, [incomingProductId, incomingIds.join('|')]);

  const resetResult = () => setResultImage('');

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage('Chọn ảnh JPG, PNG hoặc WebP dưới 10 MB.');
      return;
    }
    try {
      const image = await toDataUrl(file);
      setRoomImage(image);
      resetResult();
      setMessage('Ảnh phòng đã sẵn sàng. Bạn có thể ghi vị trí mong muốn hoặc để AI tự bố trí.');
    } catch (error) { setMessage(error.message); }
  };

  const removeProduct = (id) => {
    setSelectedIds((current) => current.filter((value) => value !== id));
    setDesiredPositions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    resetResult();
  };

  const updatePosition = (id, value) => {
    setDesiredPositions((current) => ({ ...current, [id]: value }));
    resetResult();
  };

  const openProductList = () => navigate('/products', { state: { fromRoomStudio: true, selectedIds } });

  const generate = async () => {
    if (!roomImage) return setMessage('Bạn cần tải ảnh phòng ở Bước 2 trước khi gửi.');
    if (!selectedProducts.length) return setMessage('Hãy chọn ít nhất một sản phẩm ở Bước 1.');
    setGenerating(true);
    setMessage('');
    try {
      const inspirationProducts = await Promise.all(selectedProducts.map(async (product) => ({
        productId: idOf(product),
        productName: product.name,
        image: await imageUrlToDataUrl(productImage(product)),
        desiredPosition: desiredPositions[idOf(product)] || '',
        ...productFacts(product),
      })));
      const data = await createRoomPreview({
        roomImageDataUrl: roomImage,
        mode: 'inspiration',
        inspirationProducts,
      });
      const generated = data?.imageDataUrl || data?.resultImage || data?.imageUrl;
      if (!generated) throw new Error('AI chưa trả về ảnh.');
      setResultImage(generated);
      setMessage('Ảnh đã tạo xong.');
    } catch (error) {
      setResultImage('');
      setMessage(error.message || 'Không thể tạo ảnh. Vui lòng thử lại.');
    } finally { setGenerating(false); }
  };

  return (
    <main className="container page simple-studio">
      <div className="page-heading"><p className="eyebrow">PHÒNG THỬ</p><h1>Thử sản phẩm trong phòng</h1><p>Chọn tối đa 3 món, tải ảnh phòng và tạo ảnh. Vị trí là tùy chọn.</p></div>
      <div className="studio-simple-steps">
        <section className="panel-card">
          <span className="step-label">BƯỚC 1</span>
          <h2>Chọn sản phẩm (tối đa 3)</h2>
          <button className="button button-outline" type="button" onClick={openProductList}>Chọn từ danh sách sản phẩm</button>
          <p className="studio-selection-count">Đã chọn {selectedProducts.length}/{MAX_PRODUCTS}</p>
          {selectedProducts.length ? <div className="studio-selected-products">{selectedProducts.map((product, index) => <div className="simple-selected-product" key={idOf(product)}><span className="studio-product-number">{index + 1}</span><ProductArtwork product={product} /><button type="button" aria-label={`Bỏ sản phẩm ${index + 1}`} title="Bỏ chọn" onClick={() => removeProduct(idOf(product))}>×</button></div>)}</div> : <p className="muted">Bạn có thể chọn 1 đến 3 sản phẩm.</p>}
        </section>
        <section className="panel-card">
          <span className="step-label">BƯỚC 2</span>
          <h2>Tải ảnh phòng</h2>
          <label className="simple-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />{roomImage ? <img src={roomImage} alt="Phòng của bạn" /> : <strong>Chọn ảnh phòng</strong>}</label>
        </section>
        <section className="panel-card studio-position-step">
          <span className="step-label">BƯỚC 3</span>
          <h2>Vị trí mong muốn (không bắt buộc)</h2>
          {selectedProducts.length ? <div className="studio-position-fields">{selectedProducts.map((product, index) => <label key={idOf(product)}>{`Vị trí sản phẩm ${index + 1}`}<input type="text" value={desiredPositions[idOf(product)] || ''} onChange={(event) => updatePosition(idOf(product), event.target.value)} placeholder="Để trống để AI tự bố trí" /></label>)}</div> : <p className="muted">Chọn sản phẩm ở Bước 1 để tiếp tục.</p>}
          <button className="button" type="button" disabled={isGenerating || !roomImage || !selectedProducts.length} onClick={generate}>{isGenerating ? 'Ảnh đang được tạo, bạn đợi xíu nghen ^_^' : 'Tạo ảnh'}</button>
        </section>
      </div>
      <p className="studio-message" role="status">{message}</p>
      {roomImage && <section className="simple-room-compare">{resultImage && <figure><figcaption>Ảnh tạo</figcaption><img src={resultImage} alt="Kết quả thử sản phẩm" /></figure>}<figure><figcaption>Ảnh gốc</figcaption><img src={roomImage} alt="Ảnh phòng gốc" /></figure></section>}
    </main>
  );
}
