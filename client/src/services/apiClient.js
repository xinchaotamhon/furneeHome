import axios from 'axios';

const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && (error.response?.data?.message === 'Invalid session' || error.response?.data?.message === 'Invalid account')) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('furneehome-user');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
