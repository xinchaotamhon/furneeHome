import apiClient from './apiClient';

const orderService = {
  async createOrder(data) {
    const response = await apiClient.post('/orders', data);
    return response.data.data;
  },
  async getMyOrders() {
    const response = await apiClient.get('/orders/my-orders');
    return response.data.data;
  },
  async getAllOrders(params = {}) {
    const response = await apiClient.get('/orders', { params });
    return response.data.data;
  },
  async updateOrderStatus(id, updateData) {
    const payload = typeof updateData === 'object' && updateData !== null ? updateData : { orderStatus: updateData };
    const response = await apiClient.put(`/orders/${id}/status`, payload);
    return response.data.data;
  },
  async cancelOrder(id) {
    const response = await apiClient.patch(`/orders/${id}/cancel`);
    return response.data.data;
  },
  async updateRefundInfo(id, data) {
    const response = await apiClient.put(`/orders/${id}/refund-info`, data);
    return response.data.data;
  },
};

export default orderService;
