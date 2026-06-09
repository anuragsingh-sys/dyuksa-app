import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config';

const AUTH_TOKEN_KEY   = 'DYUKSA_AUTH_TOKEN';
const WORKSPACE_ID_KEY = 'DYUKSA_WORKSPACE_ID';

// ── In-memory token cache — avoids AsyncStorage reads on every request ────────
let _cachedToken = null;

export const setCachedToken = (token) => { _cachedToken = token; };
export const clearTokenCache = () => { _cachedToken = null; };

// ── Auth token ────────────────────────────────────────────────────────────────
export const getAccessToken = async () => {
  if (_cachedToken) return _cachedToken;
  try {
    const t = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (t) _cachedToken = t;
    return t;
  } catch { return null; }
};

// ── Workspace ID (persisted) ───────────────────────────────────────────────────
export const getWorkspaceId = async () => {
  try { return await AsyncStorage.getItem(WORKSPACE_ID_KEY); }
  catch { return null; }
};

export const setWorkspaceId = async (id) => {
  try {
    if (id == null) await AsyncStorage.removeItem(WORKSPACE_ID_KEY);
    else            await AsyncStorage.setItem(WORKSPACE_ID_KEY, String(id));
  } catch {}
};

// ── Shared headers ──────────────────────────────────────────────────────────────
const authHeaders = async (includeWorkspace = true) => {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  if (includeWorkspace) {
    const wsId = await getWorkspaceId();
    if (wsId) headers['X-Workspace-ID'] = wsId;
  }
  return headers;
};

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
  return data;
};

// ── Workspaces ────────────────────────────────────────────────────────────────
export const getWorkspaces = async () => {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/organizations/workspaces/`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch workspaces');
  return Array.isArray(data) ? data : (data.results || data.workspaces || []);
};

export const switchWorkspace = async (workspaceId) => {
  const token = await getAccessToken();
  // Persist immediately — this is the source of truth for X-Workspace-ID
  await setWorkspaceId(workspaceId);
  try {
    const res = await fetch(`${BASE_URL}/organizations/workspaces/${workspaceId}/switch/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': String(workspaceId),
      },
    });
    if (res.ok) return await res.json().catch(() => ({ workspace_id: workspaceId }));
  } catch {}
  // Even if the switch endpoint fails/doesn't exist, the ID is saved
  return { workspace_id: workspaceId };
};

// ── Users ────────────────────────────────────────────────────────────────────
export const getUsers = async () => {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/tasksite/all-users/`, { method: 'GET', headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch users');
  return data.users || data.results || (Array.isArray(data) ? data : []);
};

// ── Projects ─────────────────────────────────────────────────────────────────
export const getProjects = async () => {
  const res = await fetch(`${BASE_URL}/projects/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch projects');
  return Array.isArray(data) ? data : (data.projects || data.results || []);
};

export const createProject = async (body) => {
  const res = await fetch(`${BASE_URL}/projects/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const getTasks = async () => {
  const res = await fetch(`${BASE_URL}/tasksite/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch tasks');
  return data.results || (Array.isArray(data) ? data : []);
};

export const createTask = async (formData) => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const headers = { 'Authorization': `Bearer ${token}` };
  if (wsId) headers['X-Workspace-ID'] = wsId;
  const res = await fetch(`${BASE_URL}/tasksite/`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return handleResponse(res);
};

// ── AI Text Enhancer ──────────────────────────────────────────────────────────
export const refineTextAI = async (text, type) => {
  const res = await fetch(`${BASE_URL}/task-ai/refine-text/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ text, type }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'AI request failed');
  return data.refined_text || data.data || data.enhanced_text || '';
};
