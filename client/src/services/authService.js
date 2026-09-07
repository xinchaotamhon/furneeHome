import apiClient from './apiClient';

const authService = {
  async login(credentials) {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data.data;
  },
  async requestRegistration(email) {
    const response = await apiClient.post('/auth/register/request', { email });
    return response.data.data;
  },
  async verifyRegistration(email, code) {
    const response = await apiClient.post('/auth/register/verify', { email, code });
    return response.data.data;
  },
  async completeRegistration(profile) {
    const response = await apiClient.post('/auth/register/complete', profile);
    return response.data.data;
  },
};

export default authService;
