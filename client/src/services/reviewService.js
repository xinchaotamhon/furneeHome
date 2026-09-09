import apiClient from './apiClient';

const reviewService = {
  async getReviews(productId) {
    const response = await apiClient.get(`/reviews/product/${productId}`);
    return response.data.data;
  },
  async getOrderReviewStatus(orderId) {
    const response = await apiClient.get(`/reviews/order/${orderId}`);
    return response.data.data;
  },
  async addOrderReview(orderId, productId, data) {
    const response = await apiClient.post(`/reviews/order/${orderId}`, { productId, ...data });
    return response.data.data;
  },
  async moderateReview(reviewId, isHidden, reason = '') {
    const response = await apiClient.patch(`/reviews/${reviewId}/moderation`, { isHidden, reason });
    return response.data.data;
  },
  async deleteReview(reviewId) {
    await apiClient.delete(`/reviews/${reviewId}`);
  },
};

export default reviewService;
