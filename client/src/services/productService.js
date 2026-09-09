import apiClient from './apiClient';

const productService = {
  async getAll(params = {}) {
    const response = await apiClient.get('/products', { params });
    return response.data.data;
  },
  async getPage(params = {}) {
    const response = await apiClient.get('/products', { params });
    return {
      products: Array.isArray(response.data.data) ? response.data.data : [],
      pagination: response.data.pagination || null,
      categories: Array.isArray(response.data.categories) ? response.data.categories : [],
    };
  },
  async getById(id) {
    const response = await apiClient.get(`/products/${id}`);
    return response.data.data;
  },
  async create(data) {
    const response = await apiClient.post('/products', data);
    return response.data.data;
  },
  async update(id, data) {
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data.data;
  },
  async addImage(id, dataUrl) {
    const response = await apiClient.post(`/products/${id}/images`, { dataUrl });
    return response.data.data;
  },
  async remove(id) {
    const response = await apiClient.delete('/products/' + id);
    return response.data.data;
  },
  async permanentRemove(id) {
    const response = await apiClient.delete(`/products/${id}/permanent`);
    return response.data.data;
  },
  async syncJson() {
    const response = await apiClient.post('/products/sync-json');
    return response.data;
  },
};

export default productService;
