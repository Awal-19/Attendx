import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, {
  clearScopedAuth,
  getPortalScope,
  getScopedItem,
  setScopedAuth,
} from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = getScopedItem('attendx_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const scope = getPortalScope();
    try {
      const res = await api.get('/auth/profile/');
      setUser(res.data);
      localStorage.setItem(`attendx_user_${scope}`, JSON.stringify(res.data));
      return res.data;
    } catch {
      clearScopedAuth(scope);
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
    const scope = roleKey || getPortalScope();
    const endpoint = roleKey ? `/auth/${roleKey}/login/` : '/auth/login/';
    const res = await api.post(endpoint, { identifier, password });
    const { user: userData, tokens } = res.data;
    setScopedAuth(scope, userData, tokens);
    setUser(userData);
    return userData;
  };

  const register = async (payload) => {
    const scope = payload?.role === 'LECTURER' ? 'lecturer' : 'student';
    const res = await api.post('/auth/register/', payload);
    if (res.data?.requires_otp) {
      return res.data;
    }
    const { user: userData, tokens } = res.data;
    setScopedAuth(scope, userData, tokens);
    setUser(userData);
    return userData;
  };

  const verifyRegistrationOtp = async (index_number, code) => {
    const res = await api.post('/auth/register/verify-otp/', { index_number, code });
    const { user: userData, tokens } = res.data;
    setScopedAuth('student', userData, tokens);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    const scope = getPortalScope();
    const refresh = getScopedItem('attendx_refresh_token', scope);
    const role = user?.role;
    const redirectPath =
      role === 'LECTURER' ? '/lecturer' : role === 'ADMIN' || role === 'DEPT_ADMIN' ? '/admin' : '/login';
    try {
      await api.post('/auth/logout/', refresh ? { refresh } : {});
    } catch {
      // Ignore logout network error
    } finally {
      clearScopedAuth(scope);
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
