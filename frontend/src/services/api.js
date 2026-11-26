import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('attendx_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/login/') &&
      !originalRequest.url.includes('/auth/token/refresh/')
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('attendx_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });
          const newAccess = res.data.access;
          localStorage.setItem('attendx_access_token', newAccess);
          if (res.data.refresh) {
            localStorage.setItem('attendx_refresh_token', res.data.refresh);
          }
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('attendx_access_token');
          localStorage.removeItem('attendx_refresh_token');
          localStorage.removeItem('attendx_user');
          const p = window.location.pathname.toLowerCase();
          window.location.href = p.startsWith('/lecturer')
            ? '/lecturer'
            : p.startsWith('/admin')
              ? '/admin'
              : '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const getWebSocketUrl = (sessionId) => {
  const token = localStorage.getItem('attendx_access_token') || '';
  const wsBase =
    import.meta.env.VITE_WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000`;
  return `${wsBase}/ws/attendance/session/${sessionId}/?token=${encodeURIComponent(token)}`;
};

export const getNotificationWebSocketUrl = () => {
  const token = localStorage.getItem('attendx_access_token') || '';
  const wsBase =
    import.meta.env.VITE_WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000`;
  return `${wsBase}/ws/notifications/?token=${encodeURIComponent(token)}`;
};

export default api;

