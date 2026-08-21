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
    let loadedProducts = [];

    // 1. Thử lấy từ Backend API MongoDB (Port 5000)
    try {
      const apiData = await productService.getAll();
      if (Array.isArray(apiData) && apiData.length > 0) {
        loadedProducts = apiData;
      }
    } catch {
      // Backend chưa bật hoặc có lỗi kết nối
    }

    // 2. Nếu chưa lấy được từ API, tự động nạp từ file JSON backup (data_import.json)
    if (!loadedProducts.length) {
      try {
        const response = await fetch('/data_import/data_import.json?t=' + Date.now());
        if (response.ok) {
          const jsonData = await response.json();
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            loadedProducts = jsonData;
          }
        }
      } catch (err) {
        console.warn('Lỗi đọc data_import.json:', err);
      }
    }

    if (loadedProducts.length > 0) {
      setProducts(loadedProducts);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedProducts));
    }
    setLoading(false);
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
