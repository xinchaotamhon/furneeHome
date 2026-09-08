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
  async forgotPassword(email) {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },
  async resetPassword({ token, password }) {
    const response = await apiClient.post('/auth/reset-password', { token, password });
    return response.data;
  },
};

export default authService;
