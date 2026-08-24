import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'furneehome-collection';
const CollectionContext = createContext(null);

function readCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];

    return saved.map((item) => {
      if (item.type !== 'room-template' || item.resultImage || !item.photo) return item;
      const { photo, ...rest } = item;
      return { ...rest, resultImage: photo };
    });
  } catch {
    return [];
  }
}

function safeSaveCollection(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('LocalStorage quota exceeded, attempting storage optimization:', err);
    try {
      // Nếu bộ nhớ đầy do ảnh AI quá lớn, chỉ giữ 2 mục gần nhất
      const trimmed = items.slice(-2);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      try {
        // Nếu vẫn đầy, lưu danh sách không kèm chuỗi ảnh lớn
        const lightweight = items.slice(-3).map((item) => {
          if (item.type === 'room-template' && item.resultImage && item.resultImage.length > 5000) {
            return { ...item, resultImage: '' };
          }
          return item;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
      } catch {
        // Bỏ qua nếu hoàn toàn không còn dung lượng, không làm sập ứng dụng
      }
    }
  }
}

export function CollectionProvider({ children }) {
  const [items, setItems] = useState(readCollection);

  useEffect(() => {
    safeSaveCollection(items);
  }, [items]);

  const value = useMemo(() => ({
    items,
    itemCount: items.length,
    isProductSaved(id) {
      return items.some((item) => item.type === 'product' && item.product._id === id);
    },
    toggleProduct(product) {
      setItems((current) => {
        const exists = current.some((item) => item.type === 'product' && item.product._id === product._id);
        return exists
          ? current.filter((item) => !(item.type === 'product' && item.product._id === product._id))
          : [...current, { id: 'product-' + product._id, type: 'product', product, savedAt: new Date().toISOString() }];
      });
    },
    saveRoomTemplate(template) {
      setItems((current) => [...current, {
        ...template,
        id: 'room-' + Date.now(),
        type: 'room-template',
        savedAt: new Date().toISOString(),
      }]);
    },
    removeItem(id) {
      setItems((current) => current.filter((item) => item.id !== id));
    },
  }), [items]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export const useCollection = () => useContext(CollectionContext);
