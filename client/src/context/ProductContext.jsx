import { createContext, useContext, useMemo, useState } from 'react';
import sampleProducts from '../data/sampleProducts';

const STORAGE_KEY = 'furneehome-demo-products';
const ProductContext = createContext(null);

function readProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : sampleProducts;
  } catch {
    return sampleProducts;
  }
}

export function ProductProvider({ children }) {
  const [products, setProducts] = useState(readProducts);

  const save = (nextProducts) => {
    setProducts(nextProducts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProducts));
  };

  const value = useMemo(() => ({
    products,
    addProduct(product) {
      save([...products, { ...product, _id: `local-${Date.now()}` }]);
    },
    updateProduct(product) {
      save(products.map((item) => item._id === product._id ? product : item));
    },
    removeProduct(id) {
      save(products.filter((item) => item._id !== id));
    },
    resetProducts() {
      save(sampleProducts);
    },
  }), [products]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export const useProducts = () => useContext(ProductContext);
