import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import roomDesignService from '../services/roomDesignService';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'furneehome-collection';
const CollectionContext = createContext(null);

function productId(product) {
  return product?._id || product?.id || '';
}

function normalizeDesign(design) {
  const id = design._id || design.id || `room-${Date.now()}`;
  return {
    ...design,
    id,
    type: 'room-template',
    resultImage: design.resultImage || design.photo || '',
    productName: design.productName || 'Sản phẩm đã chọn',
    target: design.target || { x: 0.5, y: 0.76 },
    placements: design.placements || design.sceneItems || [],
    savedAt: design.savedAt || design.createdAt || new Date().toISOString(),
  };
}

function readLocalCollection() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(items)) return [];
    return items.map((item) => item.type === 'room-template' ? normalizeDesign(item) : item);
  } catch {
    return [];
  }
}

function keepUrl(value) {
  return typeof value === 'string' && !value.startsWith('data:') ? value : '';
}

function localCopy(item) {
  if (item.type === 'product') {
    return {
      ...item,
      product: {
        ...item.product,
        image: keepUrl(item.product?.image),
        transparentImage: keepUrl(item.product?.transparentImage),
      },
    };
  }

  return {
    id: item.id,
    type: 'room-template',
    name: item.name,
    productId: item.productId,
    productName: item.productName,
    productImage: keepUrl(item.productImage),
    previewImage: item.previewImage?.length <= 500_000 ? item.previewImage : '',
    roomImage: item.previewImage?.length <= 500_000 ? item.previewImage : '',
    resultImage: item.previewImage?.length <= 500_000 ? item.previewImage : '',
    target: item.target,
    scale: item.scale,
    flip: item.flip,
    placements: (item.placements || []).slice(0, 1).map((placement) => ({
      productId: placement.productId || productId(placement.product),
      productName: placement.productName || placement.product?.name || item.productName || '',
      image: keepUrl(placement.image || placement.product?.image),
      transparentImage: keepUrl(placement.transparentImage || placement.product?.transparentImage),
      target: placement.target,
      scale: placement.scale,
      isFlipped: Boolean(placement.isFlipped ?? placement.flip),
    })),
    userPrompt: item.userPrompt,
    designBrief: item.designBrief,
    savedAt: item.savedAt,
  };
}

function saveLocalCollection(items) {
  const localItems = items.filter((item) => !item._id).map(localCopy);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localItems));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localItems.slice(-10)));
  }
}

export function CollectionProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState(readLocalCollection);
  const [isLoadingDesigns, setLoadingDesigns] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  useEffect(() => saveLocalCollection(items), [items]);

  useEffect(() => {
    let active = true;
    setSyncMessage('');
    setSyncError('');

    if (!user) {
      setItems((current) => current.filter((item) => !item._id));
      setLoadingDesigns(false);
      return undefined;
    }

    setLoadingDesigns(true);
    roomDesignService.listMine()
      .then((designs) => {
        if (!active) return;
        const remoteDesigns = designs.map(normalizeDesign);
        setItems((current) => [
          ...current.filter((item) => item.type === 'product' || (item.type === 'room-template' && !item._id)),
          ...remoteDesigns,
        ]);
      })
      .catch(() => {
        if (active) setSyncError('Không tải được mẫu phòng từ tài khoản.');
      })
      .finally(() => {
        if (active) setLoadingDesigns(false);
      });

    return () => { active = false; };
  }, [user]);

  const value = useMemo(() => ({
    items,
    itemCount: items.length,
    isLoadingDesigns,
    syncMessage,
    syncError,

    isProductSaved(id) {
      return items.some((item) => item.type === 'product' && productId(item.product) === id);
    },

    toggleProduct(product) {
      const id = productId(product);
      setItems((current) => current.some((item) => item.type === 'product' && productId(item.product) === id)
        ? current.filter((item) => !(item.type === 'product' && productId(item.product) === id))
        : [...current, { id: `product-${id}`, type: 'product', product, savedAt: new Date().toISOString() }]);
    },

    async saveRoomTemplate(template) {
      const localDesign = normalizeDesign({
        ...template,
        id: `room-local-${Date.now()}`,
        savedAt: new Date().toISOString(),
      });
      setItems((current) => [...current, localDesign]);
      if (!user) return localDesign;

      try {
        const saved = normalizeDesign(await roomDesignService.create(template));
        setItems((current) => current.map((item) => item.id === localDesign.id ? saved : item));
        setSyncMessage('Đã lưu mẫu phòng vào tài khoản.');
        return saved;
      } catch {
        setSyncError('Mẫu chỉ được lưu trên thiết bị này.');
        return localDesign;
      }
    },

    async removeItem(id) {
      const item = items.find((candidate) => candidate.id === id);
      setItems((current) => current.filter((candidate) => candidate.id !== id));
      if (!item?._id) return;
      try {
        await roomDesignService.remove(item._id);
      } catch (error) {
        setItems((current) => [...current, item]);
        setSyncError('Không xóa được mẫu phòng.');
        throw error;
      }
    },
  }), [items, user, isLoadingDesigns, syncMessage, syncError]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export const useCollection = () => useContext(CollectionContext);
