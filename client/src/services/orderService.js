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
  async getOrderById(id) {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data.data;
  },
  async getAllOrders(params = {}) {
    const response = await apiClient.get('/admin/orders', { params });
    return response.data.data;
  },
  async updateOrderStatus(id, status) {
    const response = await apiClient.put(`/admin/orders/${id}/status`, { status });
    return response.data.data;
  },
};

export default orderService;
