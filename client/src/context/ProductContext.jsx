import { createContext, useContext, useRef, useState } from 'react';
import productService from '../services/productService';

const ProductContext = createContext(null);

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const snapshotLoaded = useRef(false);

  const showJsonSnapshot = async () => {
    if (snapshotLoaded.current) return;
    snapshotLoaded.current = true;

    try {
      const response = await fetch('/data_import/data_import.json');
      const data = await response.json();
      if (Array.isArray(data)) {
        setProducts(data.filter((product) => product.isActive !== false && Number(product.price) > 0));
      }
    } catch {
      // MongoDB is still loaded below when the snapshot is unavailable.
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    await showJsonSnapshot();
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
    async deleteProduct(id) {
      await productService.permanentRemove(id);
      await fetchProducts();
    },
    async syncProductJson() {
      return productService.syncJson();
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
