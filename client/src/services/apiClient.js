import axios from 'axios';

const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const API_BASE_URL = import.meta.env.VITE_API_URL
  || (isLocalhost ? 'http://localhost:5000/api' : 'https://furneehome.onrender.com/api');

const apiClient = axios.create({ baseURL: API_BASE_URL });
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const locked = error.response?.status === 403 && error.response?.data?.code === 'ACCOUNT_LOCKED';
    const invalidSession = error.response?.status === 401 && (error.response?.data?.message === 'Invalid session' || error.response?.data?.message === 'Invalid account');
    if (locked || invalidSession) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('furneehome-user');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
