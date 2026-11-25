import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setSessionExpiredHandler } from '../services/api';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  getSavedUser,
  saveAuthSession,
} from '../services/storage';
import {
  registerForPushNotificationsAsync,
  unregisterPushTokenAsync,
} from '../services/pushNotifications';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  const forceExpire = useCallback(() => {
    setUser(null);
    setSessionMessage('Your session expired. Please sign in again.');
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(forceExpire);
  }, [forceExpire]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [token, savedUser] = await Promise.all([getAccessToken(), getSavedUser()]);
        if (token && savedUser) {
          setUser(savedUser);
          try {
            const res = await api.get('/auth/profile/');
            if (res.data) {
              setUser(res.data);
              await saveAuthSession({ user: res.data });
            }
          } catch {
            // Keep cached user profile if offline; 401 is handled by interceptor
          }
          registerForPushNotificationsAsync();
        }
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const signIn = async (identifier, password) => {
    setSessionMessage('');
    const res = await api.post('/auth/login/', {
      email: identifier.trim(),
      password,
    });
    const tokens = res.data?.tokens || res.data || {};
    const access = tokens.access;
    const refresh = tokens.refresh;
    const loggedUser = res.data?.user;
    await saveAuthSession({ access, refresh, user: loggedUser });
    setUser(loggedUser);
    registerForPushNotificationsAsync();
    return loggedUser;
  };

  const signOut = async () => {
    try {
      const refresh = await getRefreshToken();
      await unregisterPushTokenAsync();
      if (refresh) {
        await api.post('/auth/logout/', { refresh });
      }
    } catch {
      // Proceed with local cleanup even if offline
    } finally {
      await clearAuthSession();
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    const res = await api.get('/auth/profile/');
    if (res.data) {
      setUser(res.data);
      await saveAuthSession({ user: res.data });
    }
    return res.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionMessage,
        clearSessionMessage: () => setSessionMessage(''),
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

