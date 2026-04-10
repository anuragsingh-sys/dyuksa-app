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

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

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
  const validateEmail = (email) => {
    const e = sanitize(email);
    if (!e) return ['Email is required.'];
    if (!EMAIL_RE.test(e)) return ['Enter a valid email address.'];
    return [];
  };

  const validatePassword = (password) => {
    const errors = [];
    if (!password)                errors.push('Password is required.');
    else {
      if (password.length < 8)   errors.push('At least 8 characters.');
      if (!/[A-Z]/.test(password)) errors.push('At least 1 uppercase letter.');
      if (!/\d/.test(password))  errors.push('At least 1 number.');
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
                                  errors.push('At least 1 special character.');
    }
    return errors;
  };

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

      // ── BACKEND INTEGRATION POINT ──────────────────────────────────
      // const res = await fetch('https://api.dyuksa.com/auth/refresh', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ refreshToken: refreshTok }),
      // });
      // if (!res.ok) return false;
      // const { token, refreshToken, expiresIn, user } = await res.json();
      // await persistSession(token, user, refreshToken, expiresIn);
      // return true;
      // ─────────────────────────────────────────────────────────────

      // MOCK: simulate successful refresh
      const storedUser = await SecureStore.getItemAsync(AUTH_USER_KEY);
      if (!storedUser) return false;
      const mockNewToken = `refreshed_token_${Date.now()}`;
      await persistSession(mockNewToken, JSON.parse(storedUser), refreshTok, 3600);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshToken = attemptRefresh;

  // ── Login ─────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const cleanEmail = sanitize(email);
    const emailErrors = validateEmail(cleanEmail);
    const passErrors  = validatePassword(password);
    const errors = [...emailErrors, ...passErrors];
    if (errors.length) return { success: false, errors };

    try {
      // ── BACKEND INTEGRATION POINT ──────────────────────────────────
      // const res = await fetch('https://api.dyuksa.com/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email: cleanEmail, password }),
      // });
      // const data = await res.json();
      // if (!res.ok) return { success: false, errors: [data.message || 'Login failed.'] };
      // await persistSession(data.token, data.user, data.refreshToken, data.expiresIn);
      // ─────────────────────────────────────────────────────────────

      await new Promise(r => setTimeout(r, 800));
      const mockToken   = `mock_token_${Date.now()}`;
      const mockRefresh = `mock_refresh_${Date.now()}`;
      const mockUser    = {
        id: 'user_001',
        name: cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        email: cleanEmail.toLowerCase(),
        role: 'Manager',
        avatar: cleanEmail[0].toUpperCase(),
        createdAt: new Date().toISOString(),
      };
      await persistSession(mockToken, mockUser, mockRefresh, 3600);
      return { success: true, errors: [] };
    } catch {
      return { success: false, errors: ['Login failed. Please try again.'] };
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
