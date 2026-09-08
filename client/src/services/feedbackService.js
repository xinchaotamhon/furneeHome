import apiClient from './apiClient';

function dataOf(response) {
  return response.data?.data ?? response.data;
}

const feedbackService = {
  async create(feedback) {
    return dataOf(await apiClient.post('/feedback', feedback));
  },
  async listAdmin() {
    const data = dataOf(await apiClient.get('/admin/feedback'));
    return Array.isArray(data) ? data : (data?.feedback || []);
  },
  async updateAdmin(id, changes) {
    return dataOf(await apiClient.patch(`/admin/feedback/${encodeURIComponent(id)}`, changes));
  },
};

export default feedbackService;
