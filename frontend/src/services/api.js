import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const getPortalScope = (pathname = window.location.pathname) => {
  const p = (pathname || '').toLowerCase();
  if (p.startsWith('/lecturer') || p.startsWith('/register/lecturer') || p.startsWith('/login/lecturer')) {
    return 'lecturer';
  }
  if (p.startsWith('/admin') || p.startsWith('/login/admin')) {
    return 'admin';
  }
  return 'student';
};

export const getScopedItem = (baseKey, scope = getPortalScope()) =>
  localStorage.getItem(`${baseKey}_${scope}`);

export const setScopedAuth = (scope, userData, tokens) => {
  if (tokens?.access) localStorage.setItem(`attendx_access_token_${scope}`, tokens.access);
  if (tokens?.refresh) localStorage.setItem(`attendx_refresh_token_${scope}`, tokens.refresh);
  if (userData) localStorage.setItem(`attendx_user_${scope}`, JSON.stringify(userData));
};

export const clearScopedAuth = (scope = getPortalScope()) => {
  localStorage.removeItem(`attendx_access_token_${scope}`);
  localStorage.removeItem(`attendx_refresh_token_${scope}`);
  localStorage.removeItem(`attendx_user_${scope}`);
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getScopedItem('attendx_access_token');
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
    const scope = getPortalScope();
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/login/') &&
      !originalRequest.url.includes('/auth/token/refresh/')
    ) {
      originalRequest._retry = true;
      const refreshToken = getScopedItem('attendx_refresh_token', scope);
      try {
        const res = await axios.post(
          `${API_BASE_URL}/auth/token/refresh/`,
          refreshToken ? { refresh: refreshToken, portal: scope } : { portal: scope },
          { withCredentials: true }
        );
        const newAccess = res.data.access;
        localStorage.setItem(`attendx_access_token_${scope}`, newAccess);
        if (res.data.refresh) {
          localStorage.setItem(`attendx_refresh_token_${scope}`, res.data.refresh);
        }
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearScopedAuth(scope);
        const path = window.location.pathname || '';
        const isQrPath = path.startsWith('/a/') || path.startsWith('/scan');
        if (!isQrPath && !path.startsWith('/login')) {
          window.location.href =
            scope === 'lecturer' ? '/lecturer' : scope === 'admin' ? '/admin' : '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const getWebSocketUrl = (sessionId) => {
  const token = getScopedItem('attendx_access_token') || '';
  const wsBase =
    import.meta.env.VITE_WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return `${wsBase}/ws/attendance/session/${sessionId}/?token=${encodeURIComponent(token)}`;
};

export const getNotificationWebSocketUrl = () => {
  const token = getScopedItem('attendx_access_token') || '';
  const wsBase =
    import.meta.env.VITE_WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return `${wsBase}/ws/notifications/?token=${encodeURIComponent(token)}`;
};

export default api;
