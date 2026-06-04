import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setCachedToken, clearTokenCache } from '../services/ApiService';
import WebSocketService from '../services/WebSocketService';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
const AUTH_TOKEN_KEY     = 'DYUKSA_AUTH_TOKEN';
const AUTH_REFRESH_KEY   = 'DYUKSA_REFRESH_TOKEN';
const AUTH_USER_KEY      = 'DYUKSA_AUTH_USER';
const TOKEN_EXPIRY_KEY   = 'DYUKSA_TOKEN_EXPIRY';

// ── Secure store shim — replace with expo-secure-store once installed ──────
// Run: npx expo install expo-secure-store
// Then replace this block with: import * as SecureStore from 'expo-secure-store';
const SecureStore = {
  getItemAsync:    (key)        => AsyncStorage.getItem(key),
  setItemAsync:    (key, value) => AsyncStorage.setItem(key, value),
  deleteItemAsync: (key)        => AsyncStorage.removeItem(key),
};

// ── Input sanitization ─────────────────────────────────────────────────────
export const sanitize = (str) =>
  String(str ?? '')
    .trim()
    .replace(/[<>]/g, '')           // strip angle brackets
    .replace(/javascript:/gi, '')   // strip JS protocol
    .replace(/on\w+=/gi, '')        // strip event handlers
    .slice(0, 500);                 // hard length cap

export const AuthContext = createContext({
  user: null, token: null, isLoading: true, isAuthenticated: false,
  login: async () => {}, signup: async () => {}, logout: async () => {},
  updateUser: async () => {}, refreshToken: async () => {},
  validateEmail: () => [], validatePassword: () => [],
});

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [token,     setToken]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restore session ────────────────────────────────────────────────────
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
          } else {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            WebSocketService.connect(); // reconnect on app boot
          }
        }
      } catch {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Auto-refresh: check token expiry every 5 minutes ──────────────────
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

  // ── Validators ────────────────────────────────────────────────────────
  const validateEmail    = () => [];
  const validatePassword = () => [];

  const validateName = (name) => {
    const n = sanitize(name);
    if (!n) return ['Name is required.'];
    if (n.length < 2) return ['Name must be at least 2 characters.'];
    return [];
  };

  // ── Persist session ───────────────────────────────────────────────────
  const persistSession = async (authToken, userData, refreshTok = null, expiresIn = 3600) => {
    const expiry = Date.now() + expiresIn * 1000;
    await Promise.all([
      SecureStore.setItemAsync(AUTH_TOKEN_KEY,   authToken),
      SecureStore.setItemAsync(AUTH_USER_KEY,    JSON.stringify(userData)),
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
    ]).catch(() => {});
    clearTokenCache();
    setToken(null);
    setUser(null);
    // Disconnect WebSocket on logout
    WebSocketService.disconnect();
  };

  // ── Token refresh ─────────────────────────────────────────────────────
  const attemptRefresh = useCallback(async () => {
    try {
      const refreshTok = await SecureStore.getItemAsync(AUTH_REFRESH_KEY);
      if (!refreshTok) return false;

      const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshTok }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const newAccess = data.access;
      if (!newAccess) return false;

      const storedUser = await SecureStore.getItemAsync(AUTH_USER_KEY);
      if (!storedUser) return false;
      await persistSession(newAccess, JSON.parse(storedUser), refreshTok, 3600);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshToken = attemptRefresh;

  // ── Login ─────────────────────────────────────────────────────────────
  const login = async (username, password) => {
    const cleanUsername = sanitize(username);
    if (!cleanUsername) return { success: false, errors: ['Username is required.'], errorField: 'username' };
    if (!password)      return { success: false, errors: ['Password is required.'], errorField: 'password' };
    try {
      const res  = await fetch(`${BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Extract backend error message
        const rawMsg = data.detail || data.message || data.non_field_errors?.[0] || '';
        const lowerMsg = rawMsg.toLowerCase();

        // Django's SimpleJWT returns "No active account found with the given credentials"
        // when EITHER username OR password is wrong — it doesn't distinguish.
        // So we classify by pattern-matching, then highlight accordingly.

        // Field-specific errors (Django may return {username: [...], password: [...]})
        if (data.username && Array.isArray(data.username)) {
          return {
            success: false,
            errors: [data.username[0]],
            errorField: 'username',
          };
        }
        if (data.password && Array.isArray(data.password)) {
          return {
            success: false,
            errors: ['Wrong password. Please try again.'],
            errorField: 'password',
          };
        }

        // Pattern-matching heuristics on message text
        if (/password|incorrect|wrong/.test(lowerMsg)) {
          return {
            success: false,
            errors: ['Wrong password. Please try again.'],
            errorField: 'password',
          };
        }
        if (/user|account|exist|not found|no match|credentials/.test(lowerMsg)) {
          // "No active account found with the given credentials" falls here —
          // could be wrong username OR wrong password; highlight both as unknown.
          return {
            success: false,
            errors: ['Wrong password or username. Please check and try again.'],
            errorField: 'both',
          };
        }

        // Unknown error — fallback
        return {
          success: false,
          errors: [rawMsg || 'Invalid username or password. Please try again.'],
          errorField: 'both',
        };
      }
      // ── Fetch real profile from /auth/me/ after login ──────────────
      let realUser = null;
      try {
        const meRes = await fetch(`${BASE_URL}/auth/me/`, {
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${data.access}`,
          },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          realUser = {
            id:        me.id || data.user_id || cleanUsername,
            name:      [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username || cleanUsername,
            username:  me.username || cleanUsername,
            email:     me.email || '',
            role:      me.role  || 'Member',
            avatar:    ([me.first_name, me.last_name].filter(Boolean).join(' ') || me.username || cleanUsername)[0]?.toUpperCase() || 'U',
            avatarUrl: me.avatar || null,   // S3 URL
            skills:    me.skills || [],
            createdAt: me.date_joined || new Date().toISOString(),
          };
        }
      } catch {}

      const mockUser = realUser || {
        id:        data.user_id || cleanUsername,
        name:      cleanUsername.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        username:  cleanUsername,
        email:     data.email || '',
        role:      data.role  || 'Member',
        avatar:    cleanUsername[0].toUpperCase(),
        avatarUrl: null,
        skills:    [],
        createdAt: new Date().toISOString(),
      };
      await persistSession(data.access, mockUser, data.refresh, 3600);
      return { success: true, errors: [] };
    } catch {
      return { success: false, errors: ['Network error. Make sure you are on the same WiFi.'], errorField: null };
    }
  };

  // ── Signup ────────────────────────────────────────────────────────────
  const signup = async (name, email, password, confirmPassword) => {
    const cleanName  = sanitize(name);
    const cleanEmail = sanitize(email);
    const nameErrors    = validateName(cleanName);
    const emailErrors   = validateEmail(cleanEmail);
    const passErrors    = validatePassword(password);
    const confirmErrors = password !== confirmPassword ? ['Passwords do not match.'] : [];
    const errors = [...nameErrors, ...emailErrors, ...passErrors, ...confirmErrors];
    if (errors.length) return { success: false, errors };

    try {
      // ── BACKEND INTEGRATION POINT ──────────────────────────────────
      // const res = await fetch('https://api.dyuksa.com/auth/signup', { ... });
      // ─────────────────────────────────────────────────────────────

      await new Promise(r => setTimeout(r, 800));
      const mockToken   = `mock_token_${Date.now()}`;
      const mockRefresh = `mock_refresh_${Date.now()}`;
      const mockUser    = {
        id:        `user_${Date.now()}`,
        name:      cleanName,
        email:     cleanEmail.toLowerCase(),
        role:      'Member',
        avatar:    cleanName[0].toUpperCase(),
        createdAt: new Date().toISOString(),
      };
      await persistSession(mockToken, mockUser, mockRefresh, 3600);
      return { success: true, errors: [] };
    } catch {
      return { success: false, errors: ['Signup failed. Please try again.'] };
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      // ── BACKEND INTEGRATION POINT ──────────────────────────────────
      // await fetch('https://api.dyuksa.com/auth/logout', {
      //   method: 'POST',
      //   headers: { Authorization: `Bearer ${token}` },
      // }).catch(() => {}); // fire and forget
      // ─────────────────────────────────────────────────────────────
    } catch {}
    await clearSession();
  };

  // ── Update profile ────────────────────────────────────────────────────
  const updateUser = async (updates) => {
    if (!user) return;
    // Fields that should NOT be sanitized (URLs, arrays, non-string values)
    const noSanitize = ['avatarUrl', 'avatar', 'skills'];
    const sanitized = {};
    for (const [k, v] of Object.entries(updates)) {
      if (noSanitize.includes(k) || typeof v !== 'string') {
        sanitized[k] = v; // keep as-is
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
      login, signup, logout, updateUser, refreshToken,
      validateEmail, validatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
