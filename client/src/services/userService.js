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
  async listAdmin(scope = '', search = '') {
    const data = dataOf(await apiClient.get('/admin/users', { params: { scope, search } }));
    return Array.isArray(data) ? data : (data?.users || []);
  },
  async updateAdmin(id, changes) {
    return dataOf(await apiClient.patch(`/admin/users/${encodeURIComponent(id)}`, changes));
  },
  async changePassword(passwords) {
    return dataOf(await apiClient.post('/users/me/password', passwords));
  },
};

export default userService;
