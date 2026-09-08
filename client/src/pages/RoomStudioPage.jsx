import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import { useProducts } from '../context/ProductContext';
import { createRoomPreview } from '../services/roomPreviewService';

const SESSION_KEY = 'furneehome-simple-room-studio';
const idOf = (product) => String(product?._id || product?.id || '');

function readSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {}; } catch { return {}; } }
function toDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Không thể đọc ảnh.')); reader.readAsDataURL(file); }); }
function productImage(product) { return product?.transparentImage || product?.image || product?.sourceImages?.[0] || ''; }

export default function RoomStudioPage() {
  const location = useLocation();
  const saved = readSession();
  const { products, loading } = useProducts();
  const { saveRoomTemplate } = useCollection();
  const [roomImage, setRoomImage] = useState(saved.roomImage || '');
  const [selectedId, setSelectedId] = useState(idOf(location.state?.product) || saved.selectedId || '');
  const [resultImage, setResultImage] = useState(saved.resultImage || '');
  const [showResult, setShowResult] = useState(Boolean(saved.resultImage));
  const [isGenerating, setGenerating] = useState(false);
  const [message, setMessage] = useState('Tải ảnh phòng, chọn một sản phẩm, rồi tạo ảnh.');
  const selected = useMemo(() => products.find((product) => idOf(product) === selectedId), [products, selectedId]);
  const persist = (next) => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch {} };
  const resetResult = (nextRoom = roomImage, nextProduct = selectedId) => { setResultImage(''); setShowResult(false); persist({ roomImage: nextRoom, selectedId: nextProduct, resultImage: '' }); };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) return setMessage('Chọn ảnh JPG, PNG hoặc WebP dưới 10 MB.');
    try { const image = await toDataUrl(file); setRoomImage(image); resetResult(image); setMessage('Ảnh phòng đã sẵn sàng. Hãy chọn một sản phẩm.'); } catch (error) { setMessage(error.message); }
  };

  const generate = async () => {
    if (!roomImage || !selected) return setMessage('Bạn cần ảnh phòng và một sản phẩm trước khi tạo.');
    setGenerating(true); setMessage('AI đang tạo ảnh thử…');
    try {
      const data = await createRoomPreview({ roomImageDataUrl: roomImage, mode: 'inspiration', inspirationProducts: [{ productId: idOf(selected), productName: selected.name, image: productImage(selected) }], userPrompt: `Place only ${selected.name} naturally in this room. Keep the room structure, doors, windows and lighting unchanged.` });
      const generated = data?.imageDataUrl || data?.resultImage || data?.imageUrl;
      if (!generated) throw new Error('AI chưa trả về ảnh.');
      setResultImage(generated); setShowResult(true); persist({ roomImage, selectedId, resultImage: generated }); setMessage('Ảnh AI đã sẵn sàng để so sánh và lưu.');
    } catch {
      setResultImage(roomImage); setShowResult(true); persist({ roomImage, selectedId, resultImage: roomImage }); setMessage('Chưa kết nối được AI. Bản xem trước an toàn vẫn là ảnh phòng gốc; bạn có thể thử lại sau.');
    } finally { setGenerating(false); }
  };

  const save = async () => {
    if (!roomImage || !selected || !resultImage) return setMessage('Tạo ảnh trước khi lưu.');
    try { await saveRoomTemplate({ name: `${selected.name} trong phòng của tôi`, roomImage, resultImage, previewImage: resultImage, productId: idOf(selected), productName: selected.name, productImage: productImage(selected), designMode: 'inspiration', placements: [] }); setMessage('Đã lưu vào Bộ sưu tập.'); } catch { setMessage('Không thể lưu thiết kế. Hãy thử lại.'); }
  };

  return <main className="container page simple-studio"><div className="page-heading"><p className="eyebrow">PHÒNG THỬ</p><h1>Thử sản phẩm trong phòng</h1></div><div className="studio-simple-steps"><section className="panel-card"><span className="step-label">BƯỚC 1</span><h2>Tải ảnh phòng</h2><label className="simple-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />{roomImage ? <img src={roomImage} alt="Phòng của bạn" /> : <strong>Chọn ảnh phòng</strong>}</label></section><section className="panel-card"><span className="step-label">BƯỚC 2</span><h2>Chọn một sản phẩm</h2>{loading ? <p>Đang tải sản phẩm…</p> : <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); resetResult(roomImage, event.target.value); }}><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={idOf(product)} value={idOf(product)}>{product.name}</option>)}</select>}{selected && <div className="simple-selected-product"><ProductArtwork product={selected} /><strong>{selected.name}</strong></div>}</section><section className="panel-card"><span className="step-label">BƯỚC 3</span><h2>Tạo và lưu</h2><button className="button" type="button" disabled={isGenerating || !roomImage || !selected} onClick={generate}>{isGenerating ? 'Đang tạo ảnh…' : 'Tạo ảnh'}</button><button className="button button-secondary" type="button" disabled={!resultImage} onClick={() => setShowResult((value) => !value)}>{showResult ? 'Xem ảnh gốc' : 'So sánh kết quả'}</button><button className="text-button" type="button" disabled={!resultImage} onClick={save}>Lưu vào Bộ sưu tập</button></section></div><p className="studio-message" role="status">{message}</p>{roomImage && <section className="simple-room-compare"><figure><figcaption>{showResult && resultImage ? 'Ảnh tạo' : 'Ảnh gốc'}</figcaption><img src={showResult && resultImage ? resultImage : roomImage} alt="Kết quả thử sản phẩm" /></figure>{resultImage && <figure><figcaption>Ảnh gốc</figcaption><img src={roomImage} alt="Ảnh phòng gốc" /></figure>}</section>}</main>;
}
