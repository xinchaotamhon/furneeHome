import apiClient from './apiClient';

const productService = {
  async getAll(params = {}) {
    const response = await apiClient.get('/products', { params });
    return response.data.data;
  },
  async importShopee(sourceUrl) {
    const response = await apiClient.post('/products/import-shopee', { sourceUrl });
    return response.data.data;
  },
  async addImage(id, dataUrl) {
    const response = await apiClient.post(`/products/${id}/images`, { dataUrl });
    return response.data.data;
  },
  async downloadJson() {
    const response = await apiClient.get('/products/export-json', { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'furneehome-products.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  async remove(id) {
    const response = await apiClient.delete('/products/' + id);
    return response.data.data;
  },
};

export default productService;
