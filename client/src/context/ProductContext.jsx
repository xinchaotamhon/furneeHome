import { createContext, useContext, useState } from 'react';
import productService from '../services/productService';

const ProductContext = createContext(null);

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const apiData = await productService.getAll();
      const loadedProducts = Array.isArray(apiData) ? apiData : [];
      setProducts(loadedProducts);
      return loadedProducts;
    } catch {
      setProducts([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const value = {
    products,
    loading,
    refreshProducts: fetchProducts,
    async addProduct(data) {
      const product = await productService.create(data);
      await fetchProducts();
      return product;
    },
    async updateProduct(id, data) {
      const product = await productService.update(id, data);
      await fetchProducts();
      return product;
    },
    async removeProduct(id) {
      await productService.remove(id);
      await fetchProducts();
    },
    async addProductImage(id, dataUrl) {
      const product = await productService.addImage(id, dataUrl);
      await fetchProducts();
      return product;
    },
  };

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export const useProducts = () => useContext(ProductContext);
