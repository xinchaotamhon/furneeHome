import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import roomDesignService from '../services/roomDesignService';

const STORAGE_KEY = 'furneehome-collection';
const CollectionContext = createContext(null);

function normalizeRoomDesign(item) {
  if (!item) return null;

  const id = item.id || item._id || `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const target = item.target || item.placement || { x: 0.5, y: 0.72 };
  const placements = item.placements || item.sceneItems || item.items || [];
  const rawScaleReference = item.scaleReference;
  const scaleReference = rawScaleReference && Array.isArray(rawScaleReference.points)
    ? {
      points: rawScaleReference.points.slice(0, 2).map((point) => ({
        x: Number(point.x) > 1 ? Number(point.x) / 100 : Number(point.x ?? 0.5),
        y: Number(point.y) > 1 ? Number(point.y) / 100 : Number(point.y ?? 0.72),
      })),
      lengthCm: Number(rawScaleReference.lengthCm),
    }
    : null;

  return {
    ...item,
    id,
    type: 'room-template',
    target: {
      x: Number(target.x) > 1 ? Number(target.x) / 100 : Number(target.x ?? 0.5),
      y: Number(target.y) > 1 ? Number(target.y) / 100 : Number(target.y ?? 0.72),
    },
    placements,
    scaleReference: scaleReference?.points.length === 2 && scaleReference.lengthCm > 0 ? scaleReference : null,
    inspirationProducts: (Array.isArray(item.inspirationProducts) ? item.inspirationProducts : [])
      .slice(0, 3)
      .map(lightweightInspirationProduct)
      .filter((product) => product.productId && product.productName && product.image && product.sourceUrl),
    designMode: item.designMode === 'inspiration' ? 'inspiration' : 'placement',
    productId: item.productId || item.product?._id || item.product?.id || '',
    productName: item.productName || item.product?.name || 'Sản phẩm đã chọn',
    savedAt: item.savedAt || item.createdAt || new Date().toISOString(),
    visibility: item.visibility || 'private',
  };
}

function readCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];

    return saved
      .map((item) => {
        if (item.type !== 'room-template' || item.resultImage || !item.photo) return item;
        const { photo, ...rest } = item;
        return { ...rest, resultImage: photo };
      })
      .map((item) => (item.type === 'room-template' ? normalizeRoomDesign(item) : item));
  } catch {
    return [];
  }
}

function nonDataUrl(value) {
  return typeof value === 'string' && !value.startsWith('data:') ? value : '';
}

function lightweightProduct(product = {}) {
  return {
    ...product,
    image: nonDataUrl(product.image),
    transparentImage: nonDataUrl(product.transparentImage),
    images: Array.isArray(product.images) ? product.images.map(nonDataUrl).filter(Boolean) : [],
    sourceImages: Array.isArray(product.sourceImages) ? product.sourceImages.map(nonDataUrl).filter(Boolean) : [],
  };
}

function lightweightPlacement(placement = {}) {
  return {
    id: placement.id,
    productId: placement.productId,
    productName: placement.productName,
    productFacts: placement.productFacts || {},
    product: lightweightProduct(placement.product),
    image: nonDataUrl(placement.image),
    transparentImage: nonDataUrl(placement.transparentImage),
    target: placement.target,
    scale: placement.scale,
    rotation: placement.rotation,
    flip: placement.flip ?? placement.isFlipped,
    zIndex: placement.zIndex,
  };
}

function lightweightInspirationProduct(product = {}) {
  return {
    productId: product.productId || product._id || product.id || '',
    productName: product.productName || product.name || '',
    image: nonDataUrl(product.image),
    sourceUrl: nonDataUrl(product.sourceUrl),
  };
}

function lightweightCollectionItem(item) {
  if (item.type === 'product') {
    return { ...item, product: lightweightProduct(item.product) };
  }
  if (item.type !== 'room-template') return item;
  return {
    ...item,
    // Images are durable on MongoDB for signed-in users. Keeping data URLs in
    // localStorage quickly fills it and can make the whole site feel broken.
    roomImage: nonDataUrl(item.roomImage),
    resultImage: nonDataUrl(item.resultImage),
    productImage: nonDataUrl(item.productImage),
    placements: (item.placements || item.sceneItems || item.items || []).map(lightweightPlacement),
    inspirationProducts: (item.inspirationProducts || []).map(lightweightInspirationProduct),
    scaleReference: item.scaleReference || null,
  };
}

function safeSaveCollection(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(lightweightCollectionItem)));
  } catch (error) {
    try {
      const lightweight = items.slice(-8).map(lightweightCollectionItem);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
    } catch {
      console.warn('Không thể cập nhật bộ sưu tập trong trình duyệt:', error);
    }
  }
}

export function CollectionProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState(readCollection);
  const [isLoadingDesigns, setLoadingDesigns] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    safeSaveCollection(items);
  }, [items]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setLoadingDesigns(false);
      return undefined;
    }

    setLoadingDesigns(true);
    setSyncError('');
    roomDesignService.listMine()
      .then((data) => {
        if (!active) return;
        const remoteDesigns = (Array.isArray(data) ? data : []).map(normalizeRoomDesign).filter(Boolean);
        setItems((current) => {
          const products = current.filter((item) => item.type === 'product');
          const localDesigns = current.filter((item) => item.type === 'room-template' && !item._id);
          const remoteIds = new Set(remoteDesigns.map((item) => item._id || item.id));
          return [...products, ...remoteDesigns, ...localDesigns.filter((item) => !remoteIds.has(item.id))];
        });
        setSyncMessage(remoteDesigns.length
          ? 'Đã tải mẫu phòng của bạn.'
          : 'Chưa có mẫu phòng nào trên tài khoản.');
      })
      .catch(() => {
        if (active) {
          setSyncError('Không tải được mẫu phòng từ tài khoản. Dữ liệu đã lưu trên máy vẫn được giữ lại.');
        }
      })
      .finally(() => {
        if (active) setLoadingDesigns(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const value = useMemo(() => ({
    items,
    itemCount: items.length,
    isLoadingDesigns,
    syncMessage,
    syncError,
    isProductSaved(id) {
      return items.some((item) => item.type === 'product'
        && (item.product?._id || item.product?.id) === id);
    },
    toggleProduct(product) {
      setItems((current) => {
        const exists = current.some((item) => item.type === 'product'
          && (item.product?._id || item.product?.id) === product._id);
        return exists
          ? current.filter((item) => !(item.type === 'product'
            && (item.product?._id || item.product?.id) === product._id))
          : [...current, {
            id: `product-${product._id}`,
            type: 'product',
            product,
            savedAt: new Date().toISOString(),
          }];
      });
    },
    saveRoomTemplate(template) {
      const localItem = normalizeRoomDesign({
        ...template,
        id: `room-local-${Date.now()}`,
        savedAt: new Date().toISOString(),
        syncStatus: user ? 'syncing' : 'local',
      });
      setItems((current) => [...current, localItem]);
      if (!user) return Promise.resolve(localItem);

      setSyncError('');
      const payload = {
        name: localItem.name,
        productId: localItem.productId || undefined,
        productName: localItem.productName,
        productImage: localItem.productImage || '',
        target: localItem.target,
        scale: localItem.scale,
        rotation: localItem.rotation,
        flip: localItem.flip,
        resultImage: localItem.resultImage || '',
        resultMatchesLayout: localItem.resultMatchesLayout !== false,
        designMode: localItem.designMode,
        userPrompt: localItem.userPrompt || '',
        designBrief: localItem.designBrief || {},
        model: localItem.model || '',
        elapsedMs: localItem.elapsedMs,
        roomImage: localItem.roomImage || '',
        imageSize: localItem.imageSize,
        placements: localItem.placements || [],
        inspirationProducts: localItem.inspirationProducts || [],
        markedCorners: localItem.markedCorners || [],
        scaleReference: localItem.scaleReference || null,
        visibility: 'private',
      };

      return roomDesignService.create(payload)
        .then((created) => {
          const remote = normalizeRoomDesign(created);
          if (!remote) return localItem;
          setItems((current) => current.map((item) => (
            item.id === localItem.id ? { ...remote, syncStatus: 'synced' } : item
          )));
          setSyncMessage('Mẫu phòng đã được lưu vào tài khoản.');
          return remote;
        })
        .catch(() => {
          setItems((current) => current.map((item) => (
            item.id === localItem.id ? { ...item, syncStatus: 'local' } : item
          )));
          setSyncError('Không đồng bộ được mẫu phòng lên tài khoản. Mẫu vẫn chỉ nằm trên thiết bị này.');
          return localItem;
        });
    },
    removeItem(id) {
      const item = items.find((candidate) => candidate.id === id);
      setItems((current) => current.filter((candidate) => candidate.id !== id));
      if (!user || !item?._id) return Promise.resolve();
      return roomDesignService.remove(item._id).catch(() => {
        setSyncError('Không xóa được mẫu phòng trên tài khoản. Hãy tải lại để kiểm tra.');
      });
    },
    async updateRoomTemplate(id, changes) {
      const item = items.find((candidate) => candidate.id === id || candidate._id === id);
      setItems((current) => current.map((candidate) => (
        candidate.id === id || candidate._id === id ? { ...candidate, ...changes } : candidate
      )));
      if (!user || !item?._id) return null;

      try {
        const updated = normalizeRoomDesign(await roomDesignService.update(item._id, changes));
        if (updated) {
          setItems((current) => current.map((candidate) => (
            candidate._id === item._id ? updated : candidate
          )));
        }
        setSyncMessage(changes.visibility === 'public'
          ? 'Mẫu phòng đã được chia sẻ công khai.'
          : 'Mẫu phòng đã chuyển về riêng tư.');
        return updated;
      } catch {
        setSyncError('Không cập nhật được quyền chia sẻ của mẫu phòng.');
        return null;
      }
    },
  }), [items, user, isLoadingDesigns, syncMessage, syncError]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export const useCollection = () => useContext(CollectionContext);
