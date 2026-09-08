import apiClient from './apiClient';

const reviewService = {
  async getReviews(productId) {
    const response = await apiClient.get(`/products/${productId}/reviews`);
    return response.data.data;
  },
  async addReview(productId, data) {
    const response = await apiClient.post(`/products/${productId}/reviews`, data);
    return response.data.data;
  },
};

export default reviewService;
