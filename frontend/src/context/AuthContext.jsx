import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('attendx_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('attendx_access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await api.get('/auth/profile/');
      setUser(res.data);
      localStorage.setItem('attendx_user', JSON.stringify(res.data));
      return res.data;
    } catch {
      localStorage.removeItem('attendx_access_token');
      localStorage.removeItem('attendx_refresh_token');
      localStorage.removeItem('attendx_user');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (identifier, password, roleKey = 'student') => {
    const endpoint = roleKey ? `/auth/${roleKey}/login/` : '/auth/login/';
    const res = await api.post(endpoint, { identifier, password });
    const { user: userData, tokens } = res.data;
    localStorage.setItem('attendx_access_token', tokens.access);
    localStorage.setItem('attendx_refresh_token', tokens.refresh);
    localStorage.setItem('attendx_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register/', payload);
    if (res.data?.requires_otp) {
      return res.data;
    }
    const { user: userData, tokens } = res.data;
    localStorage.setItem('attendx_access_token', tokens.access);
    localStorage.setItem('attendx_refresh_token', tokens.refresh);
    localStorage.setItem('attendx_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const verifyRegistrationOtp = async (index_number, code) => {
    const res = await api.post('/auth/register/verify-otp/', { index_number, code });
    const { user: userData, tokens } = res.data;
    localStorage.setItem('attendx_access_token', tokens.access);
    localStorage.setItem('attendx_refresh_token', tokens.refresh);
    localStorage.setItem('attendx_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    const refresh = localStorage.getItem('attendx_refresh_token');
    const role = user?.role;
    const redirectPath =
      role === 'LECTURER' ? '/lecturer' : role === 'ADMIN' || role === 'DEPT_ADMIN' ? '/admin' : '/login';
    try {
      await api.post('/auth/logout/', refresh ? { refresh } : {});
    } catch {
      // Ignore logout network error
    } finally {
      localStorage.removeItem('attendx_access_token');
      localStorage.removeItem('attendx_refresh_token');
      localStorage.removeItem('attendx_user');
      setUser(null);
    }
    return redirectPath;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        register,
        verifyRegistrationOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

