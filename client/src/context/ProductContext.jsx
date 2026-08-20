import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import productService from '../services/productService';

const STORAGE_KEY = 'furneehome-products';
const ProductContext = createContext(null);

export function ProductProvider({ children }) {
  const [products, setProducts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) && saved.length ? saved : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // 1. Thử lấy từ Backend API MongoDB
      const apiData = await productService.getAll();
      if (Array.isArray(apiData) && apiData.length) {
        setProducts(apiData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(apiData));
        setLoading(false);
        return;
      }
    } catch {
      // 2. Nếu API lỗi/chưa bật server, đọc từ file JSON đã cào (data_import.json)
      try {
        const response = await fetch('/data_import/data_import.json');
        if (response.ok) {
          const jsonData = await response.json();
          if (Array.isArray(jsonData) && jsonData.length) {
            setProducts(jsonData);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(jsonData));
          }
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const save = (nextProducts) => {
    setProducts(nextProducts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProducts));
  };

  const value = useMemo(() => ({
    products,
    loading,
    refreshProducts: fetchProducts,
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
      fetchProducts();
    },
  }), [products, loading]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export const useProducts = () => useContext(ProductContext);
