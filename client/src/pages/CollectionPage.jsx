import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import roomDesignService from '../services/roomDesignService';
import { formatPrice } from '../utils/formatPrice';

const HANDOFF_KEY = 'furneehome-room-design-to-open';

function dimensionsText(product = {}) {
  if (typeof product.dimensions === 'string') return product.dimensions;
  const dimensions = product.dimensionsCm || product.dimensions || {};
  const values = [dimensions.width || dimensions.widthCm, dimensions.depth || dimensions.depthCm, dimensions.height || dimensions.heightCm]
    .filter(Boolean);
  return values.length ? `${values.join(' × ')} cm` : '';
}

function restorePlacement(placement = {}) {
  const product = placement.product || {};
  const facts = placement.productFacts || {};

  return {
    ...placement,
    productFacts: facts,
    product: {
      _id: product._id || placement.productId,
      id: product.id || placement.productId,
      name: product.name || placement.productName || 'Sản phẩm nội thất',
      image: product.image || placement.image || '',
      transparentImage: product.transparentImage || placement.transparentImage || '',
      ...product,
      ...facts,
    },
  };
}

function saveRoomForStudio(design) {
  const target = design.target || { x: 0.5, y: 0.72 };
  const placements = design.placements || design.sceneItems || design.items || [];

  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
    selectedId: design.productId || design.product?._id || '',
    roomImage: design.roomImage || '',
    roomFileName: design.roomFileName || '',
    resultImage: design.resultImage || '',
    resultInfo: {
      model: design.model || '',
      elapsedMs: design.elapsedMs,
    },
    target: {
      x: Number(target.x) <= 1 ? Number(target.x) * 100 : Number(target.x),
      y: Number(target.y) <= 1 ? Number(target.y) * 100 : Number(target.y),
    },
    hasTarget: true,
    sceneItems: placements.map(restorePlacement),
    roomRequest: design.userPrompt || '',
    designBrief: design.designBrief || {},
    imageSize: design.imageSize,
    elapsedMs: design.elapsedMs,
  }));
}

function RoomDesignPreview({ design }) {
  const [hasError, setHasError] = useState(false);
  const image = design.previewImage || design.resultImage || design.roomImage;

  if (!image || hasError) {
    return <span className="room-template-fallback">Chưa có ảnh xem trước</span>;
  }

  return (
    <img
      src={image}
      alt={design.name || 'Mẫu phòng đã lưu'}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}
export default function CollectionPage() {
  const {
    items,
    removeItem,
    isLoadingDesigns,
    syncMessage,
    syncError,
  } = useCollection();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [openingId, setOpeningId] = useState('');

  const products = items.filter((item) => item.type === 'product');
  const designs = items.filter((item) => item.type === 'room-template');

  const openDesign = async (design) => {
    setMessage('');
    setOpeningId(design.id);

    try {
      const fullDesign = design._id
        ? await roomDesignService.getMine(design._id)
        : design;
      saveRoomForStudio(fullDesign);
      navigate('/room-studio');
    } catch {
      setMessage('Không mở được mẫu phòng. Hãy thử lại.');
    } finally {
      setOpeningId('');
    }
  };

  return (
    <main className="container page collection-page">
      <div className="page-heading split-heading">
        <div>
          <h1>Bộ sưu tập</h1>
          <p>Sản phẩm yêu thích và mẫu phòng bạn đã lưu.</p>
        </div>
        <Link className="button" to="/room-studio">Mở Phòng thử</Link>
      </div>

      {message && <p className="studio-message" role="status">{message}</p>}
      {isLoadingDesigns && <p className="muted">Đang tải mẫu phòng…</p>}
      {syncMessage && <p className="studio-message" role="status">{syncMessage}</p>}
      {syncError && <p className="error-message" role="alert">{syncError}</p>}

      <section>
        <div className="section-heading">
          <div><h2>Sản phẩm đã lưu ({products.length})</h2></div>
        </div>

        {products.length ? (
          <div className="collection-grid">
            {products.map((item) => (
              <article className="saved-card" key={item.id}>
                <div className="saved-visual">
                  <ProductArtwork product={item.product} />
                </div>
                <div className="saved-card-body">
                  <h2>{item.product.name}</h2>
                  {dimensionsText(item.product) && <p>{dimensionsText(item.product)}</p>}
                  <strong>{formatPrice(item.product.price)}</strong>
                </div>
                <div className="saved-actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() => navigate('/room-studio', { state: { product: item.product } })}
                  >
                    Thử trong phòng
                  </button>
                  <button className="text-button danger" type="button" onClick={() => removeItem(item.id)}>
                    Bỏ lưu
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Chưa có sản phẩm. <Link to="/products">Xem sản phẩm</Link></p>
        )}
      </section>

      <section>
        <div className="section-heading">
          <div><h2>Mẫu phòng đã lưu ({designs.length})</h2></div>
        </div>

        {designs.length ? (
          <div className="collection-grid">
            {designs.map((design) => (
              <article className="saved-card room-saved-card" key={design.id}>
                <div className="room-template-icon">
                  <RoomDesignPreview design={design} />
                </div>
                <div className="saved-card-body">
                  <h2>{design.name || 'Mẫu phòng'}</h2>
                  <p>{design.productName || 'Thiết kế nội thất đã lưu'}</p>
                </div>
                <div className="saved-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={openingId === design.id}
                    onClick={() => openDesign(design)}
                  >
                    {openingId === design.id ? 'Đang mở…' : 'Mở lại'}
                  </button>
                  <button className="text-button danger" type="button" onClick={() => removeItem(design.id)}>
                    Xóa mẫu
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Chưa có mẫu phòng. <Link to="/room-studio">Tạo mẫu đầu tiên</Link></p>
        )}
      </section>
    </main>
  );
}
