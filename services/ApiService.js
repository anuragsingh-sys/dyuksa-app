import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
// ─────────────────────────────────────────────────────────────────────────────
// BASE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
// const BASE_URL → imported from config
const AUTH_TOKEN_KEY   = 'DYUKSA_AUTH_TOKEN';
const REFRESH_KEY      = 'DYUKSA_REFRESH_TOKEN';
const WORKSPACE_ID_KEY = 'DYUKSA_WORKSPACE_ID';

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY TOKEN CACHE
// Prevents AsyncStorage reads AND redundant refresh calls on every screen switch
// ─────────────────────────────────────────────────────────────────────────────
let _cachedToken       = null;
let _cachedWorkspaceId = null;
let _refreshPromise    = null; // mutex — only one refresh at a time

export const setCachedToken       = (t)  => { _cachedToken = t; };
export const setCachedWorkspaceId = (id) => { _cachedWorkspaceId = id; };
export const clearTokenCache      = ()   => { _cachedToken = null; _cachedWorkspaceId = null; };

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN + WORKSPACE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export const getAccessToken = async () => {
  if (_cachedToken) return _cachedToken;
  try {
    const t = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (t) _cachedToken = t;
    return t;
  } catch { return null; }
};

export const getRefreshToken = async () => {
  try { return await AsyncStorage.getItem(REFRESH_KEY); }
  catch { return null; }
};

/** Get the currently active workspace ID (null if not set) */
export const getWorkspaceId = async () => {
  if (_cachedWorkspaceId) return _cachedWorkspaceId;
  try {
    const id = await AsyncStorage.getItem(WORKSPACE_ID_KEY);
    if (id) _cachedWorkspaceId = id;
    return id;
  } catch { return null; }
};

/** Persist the active workspace ID after a successful switch */
export const setWorkspaceId = async (id) => {
  _cachedWorkspaceId = id ? String(id) : null;
  try {
    if (id == null) await AsyncStorage.removeItem(WORKSPACE_ID_KEY);
    else            await AsyncStorage.setItem(WORKSPACE_ID_KEY, String(id));
  } catch {}
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** JSON headers with Bearer token + X-Workspace-ID */
const authHeaders = async () => {
  const token       = await getAccessToken();
  const workspaceId = await getWorkspaceId();
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  };
  if (workspaceId) headers['X-Workspace-ID'] = workspaceId;
  return headers;
};

/** Multipart headers with Bearer token + X-Workspace-ID (no Content-Type) */
const authHeadersMultipart = async () => {
  const token       = await getAccessToken();
  const workspaceId = await getWorkspaceId();
  const headers = { 'Authorization': `Bearer ${token}` };
  if (workspaceId) headers['X-Workspace-ID'] = workspaceId;
  return headers;
};

/**
 * fetch wrapper that:
 * 1. Uses cached token (no AsyncStorage read if already cached)
 * 2. On 401 — fires ONE token refresh (mutex prevents duplicate refreshes)
 * 3. Retries the original request once with the new token
 * 4. If refresh fails → returns the 401 response unchanged
 */
export const fetchWithAuth = async (url, options = {}) => {
  const makeHeaders = async () => {
    const token = await getAccessToken();
    const wsId  = await getWorkspaceId();
    const h = { 'Content-Type': 'application/json', ...(options.headers || {}), 'Authorization': `Bearer ${token}` };
    if (wsId) h['X-Workspace-ID'] = wsId;
    return h;
  };

  let res = await fetch(url, { ...options, headers: await makeHeaders() });

  if (res.status === 401) {
    // Only one refresh at a time — mutex
    if (!_refreshPromise) {
      _refreshPromise = (async () => {
        try {
          const refreshTok = await AsyncStorage.getItem(REFRESH_KEY);
          if (!refreshTok) return false;
          const r = await fetch(`${BASE_URL}/auth/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshTok }),
          });
          if (!r.ok) return false;
          const data = await r.json();
          const newToken = data.access;
          _cachedToken = newToken;
          await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
          return true;
        } catch { return false; }
        finally { _refreshPromise = null; }
      })();
    }
    const refreshed = await _refreshPromise;
    if (refreshed) {
      res = await fetch(url, { ...options, headers: await makeHeaders() });
    }
  }

  return res;
};

/** Parse response — throw on non-2xx */
const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || JSON.stringify(data));
  return data;
};

/** Follow DRF pagination and return all results */
const fetchAllPages = async (url) => {
  const all = [];
  let next = url;
  let safety = 20;
  while (next && safety-- > 0) {
    const res = await fetch(next, {
      headers: await authHeaders(),
    });
    const data = await handleResponse(res);
    const page = Array.isArray(data) ? data : (data.results || data.documents || []);
    all.push(...page);
    next = data.next || null;
  }
  return all;
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /organizations/workspaces/
 * Returns: Workspace[]
 */
export const getWorkspaces = async () => {
  const res = await fetch(`${BASE_URL}/organizations/workspaces/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch workspaces');
  return Array.isArray(data) ? data : (data.results || []);
};

/**
 * POST /organizations/workspaces/{id}/switch/
 * Switches the active workspace. Stores the new workspace ID so all future
 * API calls automatically send X-Workspace-ID header.
 * Returns: { workspace_id, message }
 */
export const switchWorkspace = async (workspaceId) => {
  const res = await fetch(`${BASE_URL}/organizations/workspaces/${workspaceId}/switch/`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.message || `Switch failed (${res.status})`);
  // ✅ Persist the new workspace ID — all subsequent authHeaders() calls will
  //    automatically include X-Workspace-ID: {workspaceId}
  await setWorkspaceId(data.workspace_id || workspaceId);
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/login/
 * Body: { username, password }
 * Returns: { access, refresh, user_id, email, role }
 */
export const login = async (username, password) => {
  const res = await fetch(`${BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res);
};

/**
 * POST /auth/token/refresh/
 * Body: { refresh }
 * Returns: { access }
 */
export const refreshAccessToken = async (refreshToken) => {
  const res = await fetch(`${BASE_URL}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  return handleResponse(res);
};

/**
 * POST /auth/signup/   (mock — replace when backend is ready)
 */
export const signup = async (name, email, password) => {
  const res = await fetch(`${BASE_URL}/auth/signup/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse(res);
};

/**
 * POST /auth/forgot-password/
 * Body: { email }
 */
export const forgotPassword = async (email) => {
  const res = await fetch(`${BASE_URL}/auth/forgot-password/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
};

/**
 * POST /auth/change-password/
 * Body: { current_password, new_password }
 */
export const changePassword = async (currentPassword, newPassword) => {
  const res = await fetch(`${BASE_URL}/auth/change-password/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  return handleResponse(res);
};

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /tasksite/all-users/
 * Returns: User[]
 */
export const getUsers = async () => {
  const res = await fetch(`${BASE_URL}/tasksite/all-users/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch users');
  return data.users || data.results || (Array.isArray(data) ? data : []);
};

/**
 * PATCH /auth/profile/
 * Body: { name, role, avatar }
 */
export const updateProfile = async (updates) => {
  const res = await fetch(`${BASE_URL}/auth/profile/`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
};

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /projects/
 * Returns: Project[]
 */
export const getProjects = async () => {
  const res = await fetch(`${BASE_URL}/projects/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch projects');
  return Array.isArray(data) ? data : (data.projects || data.results || []);
};

/**
 * GET /projects/:id/
 */
export const getProject = async (id) => {
  const res = await fetch(`${BASE_URL}/projects/${id}/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  return handleResponse(res);
};

/**
 * POST /projects/
 * Body: { name, description, status, ... }
 */
export const createProject = async (body) => {
  const res = await fetch(`${BASE_URL}/projects/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * PATCH /projects/:id/
 * Body: partial project fields (e.g. { is_favourite: true })
 */
export const updateProject = async (id, body) => {
  const res = await fetch(`${BASE_URL}/projects/${id}/`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * DELETE /projects/:id/
 */
export const deleteProject = async (id) => {
  const res = await fetch(`${BASE_URL}/projects/${id}/`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Delete failed (${res.status})`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /tasksite/
 * Returns: Task[] (follows pagination)
 */
export const getTasks = async () => {
  const res = await fetch(`${BASE_URL}/tasksite/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch tasks');
  return data.results || (Array.isArray(data) ? data : []);
};

/**
 * GET /tasksite/:id/
 */
export const getTask = async (id) => {
  const res = await fetch(`${BASE_URL}/tasksite/${id}/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  return handleResponse(res);
};

/**
 * POST /tasksite/
 * Body: FormData (multipart — supports file attachments)
 */
export const createTask = async (formData) => {
  const res = await fetch(`${BASE_URL}/tasksite/`, {
    method: 'POST',
    headers: await authHeadersMultipart(),
    body: formData,
  });
  return handleResponse(res);
};

/**
 * PATCH /tasksite/:id/
 * Body: partial task fields (e.g. { status }) or FormData for file updates
 */
export const updateTask = async (id, body) => {
  const isFormData = body instanceof FormData;
  const headers = isFormData
    ? await authHeadersMultipart()
    : await authHeaders();
  const res = await fetch(`${BASE_URL}/tasksite/${id}/`, {
    method: 'PATCH',
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * DELETE /tasksite/:id/
 */
export const deleteTask = async (id) => {
  const res = await fetch(`${BASE_URL}/tasksite/${id}/`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Delete failed (${res.status})`);
  }
};

// ── Task Links ────────────────────────────────────────────────────────────────

/**
 * POST /tasksite/:id/links/
 * Body: { url }
 */
export const addTaskLink = async (taskId, url) => {
  const res = await fetch(`${BASE_URL}/tasksite/${taskId}/links/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ url }),
  });
  return handleResponse(res);
};

/**
 * DELETE /tasksite/:taskId/links/:linkId/
 */
export const deleteTaskLink = async (taskId, linkId) => {
  const res = await fetch(`${BASE_URL}/tasksite/${taskId}/links/${linkId}/`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Delete link failed (${res.status})`);
  }
};

// ── Task Comments ─────────────────────────────────────────────────────────────

/**
 * GET /tasksite/:id/comments/
 */
export const getTaskComments = async (taskId) => {
  const res = await fetch(`${BASE_URL}/tasksite/${taskId}/comments/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch comments');
  return Array.isArray(data) ? data : (data.results || []);
};

/**
 * POST /tasksite/:id/comments/
 * Body: { content }
 */
export const addTaskComment = async (taskId, content) => {
  const res = await fetch(`${BASE_URL}/tasksite/${taskId}/comments/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ content }),
  });
  return handleResponse(res);
};

// ─────────────────────────────────────────────────────────────────────────────
// TASK AI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /task-ai/refine-text/
 * Body: { text, type }  — type: 'optimize_title' | 'refine_description' | 'generate_description'
 * Returns: refined string
 */
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

/**
 * POST /task-ai/suggest-task/
 * Body: { project_id, description }
 * Returns: AI-generated task fields
 */
export const suggestTaskAI = async (projectId, description) => {
  const res = await fetch(`${BASE_URL}/task-ai/suggest-task/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ project_id: projectId, description }),
  });
  return handleResponse(res);
};

/**
 * POST /task-ai/chat/agent/
 * Body: { message }  — free-text prompt (e.g. "find 30 min with Shifali tomorrow")
 * Returns: { action, data, reply }
 */
export const chatAgent = async (message) => {
  const res = await fetch(`${BASE_URL}/task-ai/chat/agent/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ message }),
  });
  return handleResponse(res);
};

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR / EVENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /daily-updates/events/
 * Returns: Event[]
 */
export const getEvents = async () => {
  const res = await fetch(`${BASE_URL}/daily-updates/events/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch events');
  return Array.isArray(data) ? data : (data.results || []);
};

/**
 * POST /daily-updates/events/
 * Body: { title, event_type, start_time, end_time, is_online_meeting, is_recurring, attendee_ids }
 */
export const createEvent = async (body) => {
  const res = await fetch(`${BASE_URL}/daily-updates/events/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * PATCH /daily-updates/events/:id/
 */
export const updateEvent = async (id, body) => {
  const res = await fetch(`${BASE_URL}/daily-updates/events/${id}/`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * DELETE /daily-updates/events/:id/
 */
export const deleteEvent = async (id) => {
  const res = await fetch(`${BASE_URL}/daily-updates/events/${id}/`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Delete failed (${res.status})`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /documents/
 * Follows pagination — returns all documents
 */
export const getDocuments = async () => {
  return fetchAllPages(`${BASE_URL}/documents/?ordering=-created_at`);
};

/**
 * POST /documents/
 * Body: FormData  — fields: source_file (file), project (id), name
 */
export const uploadDocument = async (formData) => {
  const res = await fetch(`${BASE_URL}/documents/`, {
    method: 'POST',
    headers: await authHeadersMultipart(),
    body: formData,
  });
  return handleResponse(res);
};

/**
 * PATCH /documents/:id/
 * Body: { status }  — status: 'draft' | 'in_review' | 'approved' | 'archived'
 */
export const updateDocument = async (id, body) => {
  const res = await fetch(`${BASE_URL}/documents/${id}/`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * DELETE /documents/:id/
 */
export const deleteDocument = async (id) => {
  const res = await fetch(`${BASE_URL}/documents/${id}/`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Delete failed (${res.status})`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// QUICK NOTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /quicknotes/folders/
 * Returns: Folder[]
 */
export const getNoteFolders = async () => {
  const res = await fetch(`${BASE_URL}/quicknotes/folders/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch folders');
  return Array.isArray(data) ? data : (data.results || []);
};

/**
 * POST /quicknotes/folders/
 * Body: { name }
 */
export const createNoteFolder = async (name) => {
  const res = await fetch(`${BASE_URL}/quicknotes/folders/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ name }),
  });
  return handleResponse(res);
};

/**
 * DELETE /quicknotes/folders/:id/
 */
export const deleteNoteFolder = async (id) => {
  const res = await fetch(`${BASE_URL}/quicknotes/folders/${id}/`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Delete failed (${res.status})`);
  }
};

/**
 * GET /quicknotes/notes/
 * Returns: Note[]
 */
export const getNotes = async () => {
  const res = await fetch(`${BASE_URL}/quicknotes/notes/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch notes');
  return Array.isArray(data) ? data : (data.results || []);
};

/**
 * POST /quicknotes/notes/
 * Body: { content, folder, project }
 */
export const createNote = async (content, folderId, projectId) => {
  const res = await fetch(`${BASE_URL}/quicknotes/notes/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ content, folder: folderId, project: projectId }),
  });
  return handleResponse(res);
};

/**
 * PATCH /quicknotes/notes/:id/
 * Body: { content } or other fields
 */
export const updateNote = async (id, body) => {
  const res = await fetch(`${BASE_URL}/quicknotes/notes/${id}/`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
};

/**
 * DELETE /quicknotes/notes/:id/
 */
export const deleteNote = async (id) => {
  const res = await fetch(`${BASE_URL}/quicknotes/notes/${id}/`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Delete failed (${res.status})`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT / MESSAGES  (used by ChatScreen)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /chat/rooms/
 */
export const getChatRooms = async () => {
  const res = await fetch(`${BASE_URL}/chat/rooms/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch chat rooms');
  return Array.isArray(data) ? data : (data.results || []);
};

/**
 * GET /chat/rooms/:id/messages/
 */
export const getChatMessages = async (roomId) => {
  const res = await fetch(`${BASE_URL}/chat/rooms/${roomId}/messages/`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch messages');
  return Array.isArray(data) ? data : (data.results || []);
};

/**
 * POST /chat/rooms/:id/messages/
 * Body: { content }
 */
export const sendChatMessage = async (roomId, content) => {
  const res = await fetch(`${BASE_URL}/chat/rooms/${roomId}/messages/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ content }),
  });
  return handleResponse(res);
};
