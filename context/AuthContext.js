import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, workspaceApi, setCachedToken, clearTokenCache, setWorkspaceId, setOnTokenExpired } from '../api';
import { clearAllCaches } from '../hooks/useAppCache';
import { resetPrefetch } from '../hooks/usePrefetch';
import { invalidateTasksCache } from '../hooks/useTasksCache';
import { normalizeUser, hasPMAccess, STORAGE_KEYS } from '../types/index';
import WebSocketService from '../services/WebSocketService';

const AUTH_TOKEN_KEY = STORAGE_KEYS.AUTH_TOKEN;
const AUTH_REFRESH_KEY = STORAGE_KEYS.REFRESH_TOKEN;
const AUTH_USER_KEY = STORAGE_KEYS.AUTH_USER;
const TOKEN_EXPIRY_KEY = STORAGE_KEYS.TOKEN_EXPIRY;

// ── Secure store shim — replace with expo-secure-store once installed ──────
const SecureStore = {
  getItemAsync: (key) => AsyncStorage.getItem(key),
  setItemAsync: (key, value) => AsyncStorage.setItem(key, value),
  deleteItemAsync: (key) => AsyncStorage.removeItem(key),
};

// ── Input sanitization
export const sanitize = (str) =>
  String(str ?? '')
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .slice(0, 500);

export const AuthContext = createContext({
  user: null, token: null, isLoading: true, isAuthenticated: false,
  login: async () => { }, registerAndLogin: async () => { }, logout: async () => { },
  updateUser: async () => { }, refreshToken: async () => { },
  validateEmail: () => [], validatePassword: () => [],
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restore session 
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser, storedExpiry] = await Promise.all([
          SecureStore.getItemAsync(AUTH_TOKEN_KEY),
          SecureStore.getItemAsync(AUTH_USER_KEY),
          SecureStore.getItemAsync(TOKEN_EXPIRY_KEY),
        ]);

        if (storedToken && storedUser) {
          const expiry = storedExpiry ? parseInt(storedExpiry) : null;
          const isExpired = expiry && Date.now() > expiry;

          if (isExpired) {
            // Try to refresh before giving up
            const refreshed = await attemptRefresh();
            if (!refreshed) {
              await clearSession();
              return;
            }
            if (!hasPMAccess(storedToken)) {
              await clearSession();
              return;
            }
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            WebSocketService.connect();
          }
        }
      } catch {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    })();

    // Register interceptor callback — when client.js 401 refresh fails, clear session
    setOnTokenExpired(() => {
      clearSession();
    });
  }, []);

  // ── Auto-refresh: check token expiry every 5 minutes 
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      const expiry = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
      if (!expiry) return;
      const msUntilExpiry = parseInt(expiry) - Date.now();
      // Refresh if less than 10 minutes remaining
      if (msUntilExpiry < 10 * 60 * 1000) {
        await attemptRefresh();
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  // ── Validators 
  const validateEmail = () => [];
  const validatePassword = () => [];

  const validateName = (name) => {
    const n = sanitize(name);
    if (!n) return ['Name is required.'];
    if (n.length < 2) return ['Name must be at least 2 characters.'];
    return [];
  };

  // ── Persist session 
  const persistSession = async (authToken, userData, refreshTok = null, expiresIn = 3600) => {
    const expiry = Date.now() + expiresIn * 1000;
    await Promise.all([
      SecureStore.setItemAsync(AUTH_TOKEN_KEY, authToken),
      SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(userData)),
      SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, String(expiry)),
      refreshTok
        ? SecureStore.setItemAsync(AUTH_REFRESH_KEY, refreshTok)
        : Promise.resolve(),
      AsyncStorage.setItem('DYUKSA_AUTH_TOKEN', authToken),
    ]);
    setCachedToken(authToken);
    setToken(authToken);
    setUser(userData);
    // Connect WebSocket for real-time notifications
    WebSocketService.connect();
  };

  const clearSession = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
      SecureStore.deleteItemAsync(AUTH_USER_KEY),
      SecureStore.deleteItemAsync(AUTH_REFRESH_KEY),
      SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY),
      AsyncStorage.removeItem('DYUKSA_AUTH_TOKEN'),
      AsyncStorage.removeItem('DYUKSA_WORKSPACE_ID'),
      AsyncStorage.removeItem('DYUKSA_NOTIFICATIONS'),
      AsyncStorage.removeItem('DYUKSA_SETTINGS'),
      AsyncStorage.removeItem('TASKS_CACHE_V1'),
    ]).catch(() => { });
    clearTokenCache();
    invalidateTasksCache();
    clearAllCaches();
    resetPrefetch();
    setToken(null);
    setUser(null);
    // Disconnect WebSocket on logout
    WebSocketService.disconnect();
  };

  // ── Token refresh 
  const attemptRefresh = useCallback(async () => {
    try {
      const refreshTok = await SecureStore.getItemAsync(AUTH_REFRESH_KEY);
      if (!refreshTok) return false;

      const data = await authApi.refreshToken(refreshTok);
      const newAccess = data.access;
      if (!newAccess) return false;

      const storedUser = await SecureStore.getItemAsync(AUTH_USER_KEY);
      if (!storedUser) return false;
      await persistSession(newAccess, JSON.parse(storedUser), data.refresh || refreshTok, 3600);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshToken = attemptRefresh;

  // ── Login 
  const login = async (username, password) => {
    const cleanUsername = sanitize(username);
    if (!cleanUsername) return { success: false, errors: ['Username is required.'], errorField: 'username' };
    if (!password) return { success: false, errors: ['Password is required.'], errorField: 'password' };
    try {
      // ── Step 1: Login via Central (authApi routes to CENTRAL_URL) ────
      const data = await authApi.login(cleanUsername, password);

      // ── Step 1b: Platform guard — block if JWT doesn't include PM ───
      if (!hasPMAccess(data.access)) {
        return {
          success: false,
          errors: ['Your account does not have access to the Project Management platform. Please contact your administrator.'],
          errorField: null,
        };
      }

      // ── Step 2: Seed token into cache so client.js works for next calls
      setCachedToken(data.access);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.access);

      // ── Step 3: Fetch workspaces from PM, pick default 
      try {
        const workspaces = await workspaceApi.getAll();
        const defaultWs = workspaces.find(w => w.is_default) || workspaces[0];
        if (defaultWs?.id) {
          await setWorkspaceId(defaultWs.id);
        }
      } catch { }

      // ── Step 4: Fetch real profile from /auth/me/ (PM server) ───────
      let realUser = null;
      try {
        const me = await authApi.getMe();
        realUser = normalizeUser(me);
      } catch { }

      const fallbackUser = {
        id: data.user_id || cleanUsername,
        name: cleanUsername.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        username: cleanUsername,
        email: data.email || '',
        role: data.role || 'Member',
        avatar: cleanUsername[0].toUpperCase(),
        avatarUrl: null,
        skills: [],
        createdAt: new Date().toISOString(),
      };
      await persistSession(data.access, realUser || fallbackUser, data.refresh, 3600);
      return { success: true, errors: [] };
    } catch (err) {
      // ── Parse structured error from handleResponse ──────────────────
      const errData = err.data;
      if (errData) {
        const rawMsg = errData.detail || errData.message || errData.non_field_errors?.[0] || '';
        const lowerMsg = rawMsg.toLowerCase();

        if (errData.username && Array.isArray(errData.username)) {
          return { success: false, errors: [errData.username[0]], errorField: 'username' };
        }
        if (errData.password && Array.isArray(errData.password)) {
          return { success: false, errors: ['Wrong password. Please try again.'], errorField: 'password' };
        }
        if (/password|incorrect|wrong/.test(lowerMsg)) {
          return { success: false, errors: ['Wrong password. Please try again.'], errorField: 'password' };
        }
        if (/user|account|exist|not found|no match|credentials/.test(lowerMsg)) {
          return { success: false, errors: ['Wrong password or username. Please check and try again.'], errorField: 'both' };
        }
        return { success: false, errors: [rawMsg || 'Invalid username or password. Please try again.'], errorField: 'both' };
      }
      return { success: false, errors: ['Network error. Make sure you are on the same WiFi.'], errorField: null };
    }
  };

  // ── Register & Login (called by SignupScreen after authApi.register succeeds) ─
  const registerAndLogin = async (tokens, workspaceId) => {
    try {
      setCachedToken(tokens.access);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, tokens.access);
      if (workspaceId) await setWorkspaceId(workspaceId);

      let realUser = null;
      try {
        const me = await authApi.getMe();
        realUser = normalizeUser(me);
      } catch { }

      const fallbackUser = {
        id: 'new_user',
        name: 'User',
        username: '',
        email: '',
        role: 'Member',
        avatar: 'U',
        avatarUrl: null,
        skills: [],
        createdAt: new Date().toISOString(),
      };
      await persistSession(tokens.access, realUser || fallbackUser, tokens.refresh, 3600);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to complete registration.' };
    }
  };

  // ── Logout 
  const logout = async () => {
    // Call backend logout to invalidate refresh token
    try {
      const refreshTok = await SecureStore.getItemAsync(AUTH_REFRESH_KEY);
      if (refreshTok && token) {
        await authApi.logout(refreshTok).catch(() => { });
      }
    } catch { }
    await clearSession();
  };

  // ── Update profile
  const updateUser = async (updates) => {
    if (!user) return;
    const noSanitize = ['avatarUrl', 'avatar', 'skills'];
    const sanitized = {};
    for (const [k, v] of Object.entries(updates)) {
      if (noSanitize.includes(k) || typeof v !== 'string') {
        sanitized[k] = v;
      } else {
        sanitized[k] = sanitize(v);
      }
    }
    const updated = { ...user, ...sanitized };
    await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!token,
      login, registerAndLogin, logout, updateUser, refreshToken,
      validateEmail, validatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);