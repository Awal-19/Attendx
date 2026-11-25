import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ACCESS: 'attendx_access_token',
  REFRESH: 'attendx_refresh_token',
  USER: 'attendx_user_profile',
  PUSH_TOKEN: 'attendx_expo_push_token',
};

const memoryFallback = {};

async function setSecureItem(key, value) {
  if (Platform.OS === 'web') {
    memoryFallback[key] = value;
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getSecureItem(key) {
  if (Platform.OS === 'web') {
    return memoryFallback[key] || null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteSecureItem(key) {
  if (Platform.OS === 'web') {
    delete memoryFallback[key];
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveAuthSession({ access, refresh, user }) {
  if (access) await setSecureItem(KEYS.ACCESS, access);
  if (refresh) await setSecureItem(KEYS.REFRESH, refresh);
  if (user) await setSecureItem(KEYS.USER, JSON.stringify(user));
}

export async function getAccessToken() {
  return getSecureItem(KEYS.ACCESS);
}

export async function getRefreshToken() {
  return getSecureItem(KEYS.REFRESH);
}

export async function getSavedUser() {
  const raw = await getSecureItem(KEYS.USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function savePushToken(token) {
  if (token) await setSecureItem(KEYS.PUSH_TOKEN, token);
}

export async function getSavedPushToken() {
  return getSecureItem(KEYS.PUSH_TOKEN);
}

export async function clearAuthSession() {
  await Promise.all([
    deleteSecureItem(KEYS.ACCESS),
    deleteSecureItem(KEYS.REFRESH),
    deleteSecureItem(KEYS.USER),
    deleteSecureItem(KEYS.PUSH_TOKEN),
  ]);
}

// Non-sensitive read-only UI cache (never used for tokens or biometrics)
export async function setCachedData(cacheKey, data) {
  try {
    await AsyncStorage.setItem(
      `attendx_cache_${cacheKey}`,
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {
    // Ignore cache write errors
  }
}

export async function getCachedData(cacheKey) {
  try {
    const raw = await AsyncStorage.getItem(`attendx_cache_${cacheKey}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

