import apiClient from './apiClient';

const authService = {
  async login(credentials) {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data.data;
  },
  async register(profile) {
    const response = await apiClient.post('/auth/register', profile);
    return response.data.data;
  },
  async requestPasswordReset(email) {
    const response = await apiClient.post('/auth/forgot-password/request', { email });
    return response.data.data;
  },
  async resetPassword(data) {
    const response = await apiClient.post('/auth/forgot-password/reset', data);
    return response.data.data;
  },
};

export default authService;
