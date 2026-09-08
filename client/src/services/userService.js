import apiClient from './apiClient';

function dataOf(response) {
  return response.data?.data ?? response.data;
}

const userService = {
  async getMe() {
    return dataOf(await apiClient.get('/users/me'));
  },
  async updateMe(profile) {
    return dataOf(await apiClient.patch('/users/me', profile));
  },
  async listAdmin() {
    const data = dataOf(await apiClient.get('/admin/users'));
    return Array.isArray(data) ? data : (data?.users || []);
  },
  async updateAdmin(id, changes) {
    return dataOf(await apiClient.patch(`/admin/users/${encodeURIComponent(id)}`, changes));
  },
};

export default userService;
