// ─────────────────────────────────────────────────────────────────────────────
// api/client.js — Central HTTP client
//
// THE ONLY FILE IN THE ENTIRE PROJECT THAT CALLS fetch().
// Every API call goes through here. This means:
//   • Auth headers are built once, here, for every request
//   • Workspace headers are attached once, here
//   • Error parsing is consistent everywhere
//   • Logging/interceptors go here, once
//   • Changing auth scheme = edit this file only
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, API_BASE, CENTRAL_URL } from '../config';
import { STORAGE_KEYS } from '../types/index';

// ── In-memory token cache 
// Avoids an AsyncStorage read on every request
let _cachedToken = null;

export const setCachedToken = (token) => { _cachedToken = token; };
export const clearTokenCache = () => { _cachedToken = null; };

// ── 401 Interceptor — auto-refresh + request queue ──────────────────────────
// Mirrors the web app's Axios response interceptor.
// When an authenticated request returns 401:
//   1. First 401 triggers a token refresh
//   2. Concurrent 401s queue up and wait for the refresh to finish
//   3. On success, all queued requests retry with the new token
//   4. On failure, session is cleared and app returns to login
let _isRefreshing = false;
let _refreshQueue = [];      // { resolve, reject }[]
let _onTokenExpired = () => { };

/** Register a callback fired when refresh fails — AuthContext uses this to clear session */
export const setOnTokenExpired = (callback) => { _onTokenExpired = callback; };

const _processQueue = (error, success) => {
  _refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(success);
  });
  _refreshQueue = [];
};

const _attemptTokenRefresh = async () => {
  // If a refresh is already in progress, queue up and wait
  if (_isRefreshing) {
    return new Promise((resolve, reject) => {
      _refreshQueue.push({ resolve, reject });
    });
  }

  _isRefreshing = true;
  try {
    const refreshTok = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshTok) throw new Error('No refresh token');

    // Direct fetch — must NOT go through _withAuthRetry to avoid infinite loop
    const res = await fetch(`${BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshTok }),
    });
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);

    const data = await res.json();
    if (!data.access) throw new Error('No access token in refresh response');

    // Update all token stores
    _cachedToken = data.access;
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.access);
    if (data.refresh) {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh);
    }

    _processQueue(null, true);
    return true;
  } catch (err) {
    _processQueue(err, false);
    // Clear token cache so no more requests go out with the dead token
    _cachedToken = null;
    _onTokenExpired();
    return false;
  } finally {
    _isRefreshing = false;
  }
};

/**
 * Wraps an authenticated fetch call with 401 retry.
 * @param {Function} requestFn - async () => fetch Response (will be called again on retry)
 */
const _withAuthRetry = async (requestFn) => {
  let res = await requestFn();

  if (res.status === 401) {
    const refreshed = await _attemptTokenRefresh();
    if (refreshed) {
      res = await requestFn();
    }
  }

  return handleResponse(res);
};

// ── Token accessors
export const getAccessToken = async () => {
  if (_cachedToken) return _cachedToken;
  try {
    const t = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (t) _cachedToken = t;
    return t;
  } catch { return null; }
};

export const getWorkspaceId = async () => {
  try { return await AsyncStorage.getItem(STORAGE_KEYS.WORKSPACE_ID); }
  catch { return null; }
};

export const setWorkspaceId = async (id) => {
  try {
    if (id == null) await AsyncStorage.removeItem(STORAGE_KEYS.WORKSPACE_ID);
    else await AsyncStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, String(id));
  } catch { }
};

// ── Build auth headers 
const buildHeaders = async (options = {}) => {
  const {
    includeWorkspace = true,
    isMultipart = false,
    extraHeaders = {},
  } = options;

  const token = await getAccessToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    ...extraHeaders,
  };

  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }

  if (includeWorkspace) {
    const wsId = await getWorkspaceId();
    if (wsId) headers['X-Workspace-ID'] = wsId;
  }

  return headers;
};

// ── Response handler 
const handleResponse = async (res) => {
  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    let errorData = null;
    if (isJson) {
      try {
        errorData = await res.json();
        detail = errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch { }
    }
    const error = new Error(detail);
    error.status = res.status;
    error.data = errorData;
    throw error;
  }

  if (!isJson) return null;
  return res.json();
};

// ── Core request methods

/**
 * GET request
 * @param {string} path - Endpoint path (will be prefixed with BASE_URL)
 * @param {object} options - { includeWorkspace, extraHeaders, fullUrl }
 */
export const get = async (path, options = {}) => {
  const url = options.fullUrl || `${BASE_URL}${path}`;
  return _withAuthRetry(async () => {
    const headers = await buildHeaders({ includeWorkspace: options.includeWorkspace ?? true, extraHeaders: options.extraHeaders });
    return fetch(url, { method: 'GET', headers });
  });
};

/**
 * POST request
 * @param {string} path - Endpoint path
 * @param {object|FormData} body - Request body
 * @param {object} options - { includeWorkspace, isMultipart, extraHeaders, fullUrl }
 */
export const post = async (path, body = {}, options = {}) => {
  const url = options.fullUrl || `${BASE_URL}${path}`;
  const isMultipart = options.isMultipart ?? (body instanceof FormData);
  return _withAuthRetry(async () => {
    const headers = await buildHeaders({
      includeWorkspace: options.includeWorkspace ?? true,
      isMultipart,
      extraHeaders: options.extraHeaders,
    });
    return fetch(url, {
      method: 'POST',
      headers,
      body: isMultipart ? body : JSON.stringify(body),
    });
  });
};

/**
 * PATCH request
 * @param {string} path - Endpoint path
 * @param {object|FormData} body - Partial update body
 * @param {object} options - { includeWorkspace, isMultipart, extraHeaders }
 */
export const patch = async (path, body = {}, options = {}) => {
  const url = options.fullUrl || `${BASE_URL}${path}`;
  const isMultipart = options.isMultipart ?? (body instanceof FormData);
  return _withAuthRetry(async () => {
    const headers = await buildHeaders({
      includeWorkspace: options.includeWorkspace ?? true,
      isMultipart,
      extraHeaders: options.extraHeaders,
    });
    return fetch(url, {
      method: 'PATCH',
      headers,
      body: isMultipart ? body : JSON.stringify(body),
    });
  });
};

/**
 * PUT request
 */
export const put = async (path, body = {}, options = {}) => {
  const url = options.fullUrl || `${BASE_URL}${path}`;
  return _withAuthRetry(async () => {
    const headers = await buildHeaders({ includeWorkspace: options.includeWorkspace ?? true, extraHeaders: options.extraHeaders });
    return fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
  });
};

/**
 * DELETE request
 */
export const del = async (path, options = {}) => {
  const url = options.fullUrl || `${BASE_URL}${path}`;
  return _withAuthRetry(async () => {
    const headers = await buildHeaders({ includeWorkspace: options.includeWorkspace ?? true, extraHeaders: options.extraHeaders });
    return fetch(url, { method: 'DELETE', headers });
  });
};

/**
 * POST without auth — for login, refresh, forgot-password
 */
export const postPublic = async (path, body = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * POST without auth to CENTRAL server — for login, signup, forgot-password
 * These endpoints live on the Central identity server, NOT the PM server.
 */
export const postPublicCentral = async (path, body = {}) => {
  const res = await fetch(`${CENTRAL_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * POST with auth to CENTRAL server — for reset-password (logged-in), add-platform
 */
export const postCentral = async (path, body = {}, options = {}) => {
  return _withAuthRetry(async () => {
    const headers = await buildHeaders({ includeWorkspace: false, extraHeaders: options.extraHeaders });
    return fetch(`${CENTRAL_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  });
};

/**
 * POST to S3 presigned URL — no auth headers
 */
export const postToS3 = async (url, formData) => {
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
  return res;
};

// ── Raw fetch with full URL
/**
 * GET using a full URL (e.g. next page URL from paginated response)
 */
export const getFullUrl = async (url, options = {}) => {
  return _withAuthRetry(async () => {
    const headers = await buildHeaders({ includeWorkspace: options.includeWorkspace ?? true });
    return fetch(url, { method: 'GET', headers });
  });
};

export default { get, post, patch, put, del, postPublic, postPublicCentral, postCentral, postToS3, getFullUrl, getAccessToken, getWorkspaceId, setWorkspaceId, setCachedToken, clearTokenCache, setOnTokenExpired, buildHeaders };
