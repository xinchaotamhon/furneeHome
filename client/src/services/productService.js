import apiClient from './apiClient';

const productService = {
  async getAll(params = {}) {
    const response = await apiClient.get('/products', { params });
    return response.data.data;
  },
  async create(product) {
    const response = await apiClient.post('/products', product);
    return response.data.data;
  },
  async update(id, product) {
    const response = await apiClient.put('/products/' + id, product);
    return response.data.data;
  },
  async remove(id) {
    const response = await apiClient.delete('/products/' + id);
    return response.data.data;
  },
};

export default productService;
