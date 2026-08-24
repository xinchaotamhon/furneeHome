import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import productService from '../services/productService';

const STORAGE_KEY = 'furneehome-products';
const ProductContext = createContext(null);

function readCachedProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : [];
  } catch {
    return [];
  }
}

export function ProductProvider({ children }) {
  const [products, setProducts] = useState(readCachedProducts);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    let loadedProducts = [];

    try {
      const apiData = await productService.getAll();
      if (Array.isArray(apiData) && apiData.length > 0) loadedProducts = apiData;
    } catch {
      // Vẫn dùng được trang sản phẩm nếu backend tạm thời chưa bật.
    }

    if (!loadedProducts.length) {
      try {
        const response = await fetch('/data_import/data_import.json?t=' + Date.now());
        if (response.ok) {
          const jsonData = await response.json();
          if (Array.isArray(jsonData)) loadedProducts = jsonData;
        }
      } catch {
        // Giữ lại dữ liệu cache hiện tại nếu file dự phòng không đọc được.
      }
    }

    if (loadedProducts.length > 0) {
      setProducts(loadedProducts);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedProducts));
      } catch {
        // Không chặn giao diện nếu localStorage đầy.
      }
    }
    setLoading(false);
    return loadedProducts;
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const value = useMemo(() => ({
    products,
    loading,
    refreshProducts: fetchProducts,
    async addProduct(product) {
      const createdProduct = await productService.create(product);
      await fetchProducts();
      return createdProduct;
    },
    async updateProduct(product) {
      const updatedProduct = await productService.update(product._id, product);
      await fetchProducts();
      return updatedProduct;
    },
    async removeProduct(id) {
      await productService.remove(id);
      await fetchProducts();
    },
    resetProducts: fetchProducts,
  }), [products, loading]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export const useProducts = () => useContext(ProductContext);
