import apiClient from './apiClient';

const productService = {
  async getAll(params = {}) {
    const response = await apiClient.get('/products', { params });
    return response.data.data;
  },
};

export default productService;
