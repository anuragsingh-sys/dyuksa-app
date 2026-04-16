import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    ]);
    setToken(authToken);
    setUser(userData);
  };

  const clearSession = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
      SecureStore.deleteItemAsync(AUTH_USER_KEY),
      SecureStore.deleteItemAsync(AUTH_REFRESH_KEY),
      SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY),
    ]).catch(() => {});
    setToken(null);
    setUser(null);
  };

  // ── Token refresh ─────────────────────────────────────────────────────
  const attemptRefresh = useCallback(async () => {
    try {
      const refreshTok = await SecureStore.getItemAsync(AUTH_REFRESH_KEY);
      if (!refreshTok) return false;

      const res = await fetch('http://192.168.1.164:8000/api/v1/auth/token/refresh/', {
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
    if (!cleanUsername) return { success: false, errors: ['Username is required.'] };
    if (!password)      return { success: false, errors: ['Password is required.'] };
    try {
      const res  = await fetch('http://192.168.1.164:8000/api/v1/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail || data.message || data.non_field_errors?.[0] || 'Login failed.';
        return { success: false, errors: [msg] };
      }
      const mockUser = {
        id:        data.user_id || cleanUsername,
        name:      cleanUsername.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        username:  cleanUsername,
        email:     data.email || '',
        role:      data.role  || 'Member',
        avatar:    cleanUsername[0].toUpperCase(),
        createdAt: new Date().toISOString(),
      };
      await persistSession(data.access, mockUser, data.refresh, 3600);
      return { success: true, errors: [] };
    } catch {
      return { success: false, errors: ['Network error. Make sure you are on the same WiFi.'] };
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
    const sanitized = {};
    for (const [k, v] of Object.entries(updates)) {
      sanitized[k] = typeof v === 'string' ? sanitize(v) : v;
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
