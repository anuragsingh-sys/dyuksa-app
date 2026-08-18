import * as client from './client';
import { ENDPOINTS, CENTRAL_ENDPOINTS } from '../types/index';

// ══════════════════════════════════════════════════════════════════════════════
// AUTH API
// ══════════════════════════════════════════════════════════════════════════════
export const authApi = {

  login: async (username, password) => {
    return client.postPublicCentral(CENTRAL_ENDPOINTS.LOGIN, { username, password });
  },

  logout: async (refreshToken) => {
    return client.post(ENDPOINTS.LOGOUT, { refresh: refreshToken }, { includeWorkspace: false });
  },

  refreshToken: async (refreshToken) => {
    return client.postPublic(ENDPOINTS.REFRESH, { refresh: refreshToken });
  },

  getMe: async () => {
    return client.get(ENDPOINTS.ME, { includeWorkspace: false });
  },

  updateProfile: async (payload) => {
    return client.patch(ENDPOINTS.ME, payload, { includeWorkspace: false });
  },

  forgotPassword: async (email) => {
    return client.postPublicCentral(CENTRAL_ENDPOINTS.FORGOT_PASSWORD, { email });
  },

  resetPassword: async (payload) => {
    return client.postCentral(CENTRAL_ENDPOINTS.RESET_PASSWORD, payload);
  },

  getUsers: async (page = null) => {
    const path = page ? `${ENDPOINTS.USERS}?page=${page}` : ENDPOINTS.USERS;
    const data = await client.get(path);
    return data?.results || (Array.isArray(data) ? data : []);
  },

  searchUsers: async (query) => {
    const data = await client.get(ENDPOINTS.SEARCH_USERS(query));
    return data?.results || (Array.isArray(data) ? data : []);
  },

  createUser: async (payload) => {
    return client.post(ENDPOINTS.USERS, payload);
  },

  updateRole: async (userId, role) => {
    return client.patch(ENDPOINTS.UPDATE_ROLE(userId), { role });
  },

  verifyOtp: async (email, otp) => {
    return client.postPublicCentral(CENTRAL_ENDPOINTS.VERIFY_OTP, { email, otp });
  },

  setNewPassword: async (payload) => {
    return client.postPublicCentral(CENTRAL_ENDPOINTS.SET_NEW_PASSWORD, payload);
  },

  sendOtp: async (email) => {
    return client.postPublicCentral(CENTRAL_ENDPOINTS.SEND_OTP, { email });
  },

  register: async (payload) => {
    return client.postPublicCentral(CENTRAL_ENDPOINTS.SIGNUP, payload);
  },

  addPlatform: async (email, password, platform) => {
    return client.postPublicCentral(CENTRAL_ENDPOINTS.ADD_PLATFORM, { email, password, platform });
  },

  sendInvite: async (payload) => {
    return client.post(ENDPOINTS.INVITE_SEND, payload);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// WORKSPACE API
// ══════════════════════════════════════════════════════════════════════════════
export const workspaceApi = {

  getAll: async () => {
    const data = await client.get(ENDPOINTS.WORKSPACES, { includeWorkspace: false });
    return Array.isArray(data) ? data : (data?.results || data?.workspaces || []);
  },

  switch: async (workspaceId) => {
    await client.setWorkspaceId(workspaceId);
    try {
      return await client.post(ENDPOINTS.WORKSPACE_SWITCH(workspaceId), {}, {
        extraHeaders: { 'X-Workspace-ID': String(workspaceId) },
        includeWorkspace: false,
      });
    } catch {
      return { workspace_id: workspaceId };
    }
  },

  getMembers: async (workspaceId) => {
    const data = await client.get(ENDPOINTS.WORKSPACE_MEMBERS(workspaceId));
    return Array.isArray(data) ? data : (data?.results || []);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// TASKS API
// ══════════════════════════════════════════════════════════════════════════════
export const tasksApi = {

  getAll: async () => {
    const data = await client.get(ENDPOINTS.TASKS);
    return data?.results || (Array.isArray(data) ? data : []);
  },

  getPage: async (page) => {
    const data = await client.get(`${ENDPOINTS.TASKS}?page=${page}`);
    return data;
  },

  getFullPageUrl: async (url) => {
    return client.getFullUrl(url);
  },

  getById: async (taskId) => {
    const raw = await client.get(ENDPOINTS.TASK_DETAIL(taskId));
    return raw?.task || raw;
  },

  create: async (formData) => {
    return client.post(ENDPOINTS.TASKS, formData, { isMultipart: true });
  },

  update: async (taskId, body) => {
    const isMultipart = body instanceof FormData;
    const raw = await client.patch(ENDPOINTS.TASK_DETAIL(taskId), body, { isMultipart });
    return raw?.task || raw;
  },

  delete: async (taskId) => {
    return client.del(ENDPOINTS.TASK_DETAIL(taskId));
  },

  getComments: async (taskId) => {
    const data = await client.get(ENDPOINTS.TASK_COMMENTS(taskId));
    return Array.isArray(data) ? data : (data?.results || []);
  },

  addComment: async (taskId, content) => {
    return client.post(ENDPOINTS.TASK_COMMENTS(taskId), { content });
  },

  addLink: async (taskId, url) => {
    return client.post(ENDPOINTS.TASK_LINKS(taskId), { url });
  },

  deleteLink: async (taskId, linkId) => {
    return client.del(ENDPOINTS.TASK_LINK_DELETE(taskId, linkId));
  },

  updateLinks: async (taskId, links) => {
    return client.patch(ENDPOINTS.TASK_DETAIL(taskId), { links });
  },

  search: async (query) => {
    const data = await client.get(ENDPOINTS.SEARCH_TASKS(query));
    return data?.results || (Array.isArray(data) ? data : []);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// PROJECTS API
// ══════════════════════════════════════════════════════════════════════════════
export const projectsApi = {

  getAll: async () => {
    const data = await client.get(ENDPOINTS.PROJECTS);
    return Array.isArray(data) ? data : (data?.projects || data?.results || []);
  },

  getById: async (projectId) => {
    return client.get(ENDPOINTS.PROJECT_DETAIL(projectId));
  },

  getMembers: async (projectId) => {
    const data = await client.get(ENDPOINTS.PROJECT_DETAIL(projectId));
    return Array.isArray(data?.assigned_members) ? data.assigned_members : [];
  },

  create: async (body) => {
    return client.post(ENDPOINTS.PROJECTS, body);
  },

  update: async (projectId, body) => {
    return client.patch(ENDPOINTS.PROJECT_DETAIL(projectId), body);
  },

  delete: async (projectId) => {
    return client.del(ENDPOINTS.PROJECT_DETAIL(projectId));
  },

  // 3-step presigned S3 upload
  getUploadUrl: async (projectId, fileInfo) => {
    return client.post(ENDPOINTS.PROJECT_UPLOAD_URL(projectId), fileInfo);
  },

  confirmUpload: async (projectId, confirmBody) => {
    return client.post(ENDPOINTS.PROJECT_CONFIRM(projectId), confirmBody);
  },

  search: async (query) => {
    const data = await client.get(ENDPOINTS.SEARCH_PROJECTS(query));
    return Array.isArray(data) ? data : (data?.results || []);
  },

  getTasksPage: async (url) => {
    return client.getFullUrl(url);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS API
// ══════════════════════════════════════════════════════════════════════════════
export const documentsApi = {

  getAll: async (params = '') => {
    const data = await client.get(`${ENDPOINTS.DOCUMENTS}${params}`);
    return { data: Array.isArray(data) ? data : (data?.results || []), count: data?.count || 0, next: data?.next, raw: data };
  },

  getById: async (docId) => {
    return client.get(ENDPOINTS.DOCUMENT_DETAIL(docId));
  },

  getByProject: async (projectId, page = 1) => {
    return client.get(`${ENDPOINTS.DOCS_BY_PROJECT(projectId)}?page=${page}`);
  },

  update: async (docId, body) => {
    return client.patch(ENDPOINTS.DOCUMENT_DETAIL(docId), body);
  },

  delete: async (docId) => {
    return client.del(ENDPOINTS.DOCUMENT_DETAIL(docId));
  },

  share: async (docId, payload) => {
    return client.post(ENDPOINTS.DOCUMENT_SHARE(docId), payload);
  },

  getTags: async () => {
    const data = await client.get(ENDPOINTS.DOCUMENT_TAGS);
    return Array.isArray(data) ? data : (data?.results || []);
  },

  // 3-step S3 presigned upload
  getUploadUrl: async (projectId, fileInfo) => {
    return client.post(ENDPOINTS.PROJECT_UPLOAD_URL(projectId), fileInfo);
  },

  confirmUpload: async (projectId, confirmBody) => {
    return client.post(ENDPOINTS.PROJECT_CONFIRM(projectId), confirmBody);
  },

  search: async (query) => {
    const data = await client.get(ENDPOINTS.SEARCH_DOCS(query));
    return data?.results || (Array.isArray(data) ? data : []);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// CHAT API
// ══════════════════════════════════════════════════════════════════════════════
export const chatApi = {

  getRooms: async () => {
    const data = await client.get(ENDPOINTS.CHAT_ROOMS);
    return Array.isArray(data) ? data : (data?.results || []);
  },

  getMessages: async (roomId) => {
    const data = await client.get(ENDPOINTS.CHAT_MESSAGES(roomId));
    return Array.isArray(data) ? data : (data?.results || []);
  },

  createRoom: async (payload) => {
    return client.post(ENDPOINTS.CHAT_ROOMS, payload);
  },

  updateRoomSettings: async (roomId, payload) => {
    return client.patch(ENDPOINTS.CHAT_ROOM_SETTINGS(roomId), payload);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR / EVENTS API
// ══════════════════════════════════════════════════════════════════════════════
export const calendarApi = {

  getEvents: async (params = '') => {
    const data = await client.get(`${ENDPOINTS.EVENTS}${params}`);
    return { results: data?.results || (Array.isArray(data) ? data : []), next: data?.next, count: data?.count };
  },

  getEventById: async (eventId) => {
    return client.get(ENDPOINTS.EVENT_DETAIL(eventId));
  },

  createEvent: async (payload) => {
    return client.post(ENDPOINTS.EVENTS, payload);
  },

  updateEvent: async (eventId, payload) => {
    return client.patch(ENDPOINTS.EVENT_DETAIL(eventId), payload);
  },

  deleteEvent: async (eventId) => {
    return client.del(ENDPOINTS.EVENT_DETAIL(eventId));
  },

  getRsvpStatus: async (eventId) => {
    return client.get(ENDPOINTS.EVENT_RSVP(eventId));
  },

  updateRsvp: async (eventId, status) => {
    return client.post(ENDPOINTS.EVENT_RSVP(eventId), { status });
  },

  getDailyUpdates: async (params = '') => {
    return client.get(`${ENDPOINTS.DAILY_UPDATES}${params}`);
  },

  createDailyUpdate: async (payload) => {
    return client.post(ENDPOINTS.DAILY_UPDATES, payload);
  },

  updateDailyUpdate: async (id, payload) => {
    return client.patch(`${ENDPOINTS.DAILY_UPDATES}${id}/`, payload);
  },

  getFullUrl: async (url) => {
    return client.getFullUrl(url);
  },
};

// NOTIFICATIONS API
export const notificationsApi = {

  getAll: async () => {
    return client.get(ENDPOINTS.NOTIFICATIONS);
    // Returns { notifications: [], unread_count, total_unread, other_workspaces }
  },

  markRead: async (notifId) => {
    return client.post(ENDPOINTS.NOTIFICATION_READ(notifId), {});
  },

  markAllRead: async (ids) => {
    return Promise.all(ids.map(id =>
      client.post(ENDPOINTS.NOTIFICATION_READ(id), {}).catch(() => { })
    ));
  },

  delete: async (notifId) => {
    return client.del(ENDPOINTS.NOTIFICATION_DELETE(notifId));
  },

  deleteAll: async (ids) => {
    return Promise.all(ids.map(id =>
      client.del(ENDPOINTS.NOTIFICATION_DELETE(id)).catch(() => { })
    ));
  },
};

// SEARCH API
export const searchApi = {

  searchAll: async (query) => {
    const encoded = encodeURIComponent(query);
    const [tasksRes, projectsRes, docsRes, usersRes] = await Promise.allSettled([
      client.get(`${ENDPOINTS.TASKS}?search=${encoded}`),
      client.get(`${ENDPOINTS.PROJECTS}?search=${encoded}`),
      client.get(`${ENDPOINTS.DOCUMENTS}?search=${encoded}`),
      client.get(`${ENDPOINTS.USERS}?search=${encoded}`),
    ]);
    return {
      tasks: tasksRes.status === 'fulfilled' ? (tasksRes.value?.results || []) : [],
      projects: projectsRes.status === 'fulfilled' ? (projectsRes.value?.results || Array.isArray(projectsRes.value) ? (projectsRes.value?.results || projectsRes.value) : []) : [],
      documents: docsRes.status === 'fulfilled' ? (docsRes.value?.results || []) : [],
      users: usersRes.status === 'fulfilled' ? (usersRes.value?.results || []) : [],
    };
  },
};

// QUICK NOTES API
export const quickNotesApi = {

  getFolders: async () => {
    return client.get(ENDPOINTS.NOTES_FOLDERS);
  },

  createFolder: async (payload) => {
    return client.post(ENDPOINTS.NOTES_FOLDERS, payload);
  },

  getNotes: async () => {
    return client.get(ENDPOINTS.NOTES);
  },

  getNotesPage: async (url) => {
    return client.getFullUrl(url);
  },

  getNote: async (noteId) => {
    return client.get(ENDPOINTS.NOTE_DETAIL(noteId));
  },

  createNote: async (payload) => {
    return client.post(ENDPOINTS.NOTES, payload);
  },

  updateNote: async (noteId, payload) => {
    return client.patch(ENDPOINTS.NOTE_DETAIL(noteId), payload);
  },

  deleteNote: async (noteId) => {
    return client.del(ENDPOINTS.NOTE_DETAIL(noteId));
  },

  uploadAttachment: async (formData) => {
    return client.post(ENDPOINTS.NOTE_ATTACHMENTS, formData, { isMultipart: true });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// AI API
// ══════════════════════════════════════════════════════════════════════════════
export const aiApi = {

  refineText: async (text, type) => {
    const data = await client.post(ENDPOINTS.AI_REFINE_TEXT, { text, type });
    return data?.refined_text || data?.data || data?.enhanced_text || '';
  },

  suggestTask: async (projectId, description) => {
    return client.post(ENDPOINTS.AI_SUGGEST_TASK, { project_id: projectId, description });
  },

  chatAgent: async (message) => {
    return client.post(ENDPOINTS.AI_CHAT_AGENT, { message });
  },
};

// TEAM API
export const teamApi = {

  getTeams: async () => {
    const data = await client.get('/teams/');
    return Array.isArray(data) ? data : (data?.results || []);
  },

  updateUser: async (userId, payload) => {
    return client.patch(`${ENDPOINTS.USERS}${userId}/`, payload);
  },
};

export const { getAccessToken, getWorkspaceId, setWorkspaceId, setCachedToken, clearTokenCache, setOnTokenExpired } = client;

export const getWorkspaces = workspaceApi.getAll;
export const switchWorkspace = workspaceApi.switch;

export const getUsers = authApi.getUsers;

export const getProjects = projectsApi.getAll;
export const createProject = projectsApi.create;

export const getTasks = tasksApi.getAll;
export const createTask = tasksApi.create;

export const refineTextAI = aiApi.refineText;

// Backward-compat: profileApi is now part of authApi
export const profileApi = {
  getMe: authApi.getMe,
  updateMe: authApi.updateProfile,
};

export default {
  authApi,
  workspaceApi,
  tasksApi,
  projectsApi,
  documentsApi,
  chatApi,
  calendarApi,
  notificationsApi,
  searchApi,
  quickNotesApi,
  aiApi,
  profileApi,
  teamApi,
  // client utilities
  getAccessToken: client.getAccessToken,
  getWorkspaceId: client.getWorkspaceId,
  setWorkspaceId: client.setWorkspaceId,
  setCachedToken: client.setCachedToken,
  clearTokenCache: client.clearTokenCache,
};