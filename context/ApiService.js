import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.164:8000/api/v1';
const AUTH_TOKEN_KEY = 'DYUKSA_AUTH_TOKEN';

export const getAccessToken = async () => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

const authHeaders = async () => {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
  return data;
};

// ── Users ────────────────────────────────────────────────────────────────────
export const getUsers = async () => {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/tasksite/all-users/`, {
    method: 'GET',
    headers,
  });
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
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/tasksite/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch tasks');
  // API returns { count, next, previous, results: [...] }
  return data.results || (Array.isArray(data) ? data : []);
};

export const createTask = async (formData) => {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/tasksite/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
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
