import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'furneehome-collection';
const CollectionContext = createContext(null);

function readCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function CollectionProvider({ children }) {
  const [items, setItems] = useState(readCollection);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
          : [...current, { id: `product-${product._id}`, type: 'product', product, savedAt: new Date().toISOString() }];
      });
    },
    saveRoomTemplate(template) {
      setItems((current) => [...current, {
        ...template,
        id: `room-${Date.now()}`,
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
