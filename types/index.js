// ── Storage Keys 
export const STORAGE_KEYS = {
  AUTH_TOKEN:     'DYUKSA_AUTH_TOKEN',
  REFRESH_TOKEN:  'DYUKSA_REFRESH_TOKEN',
  AUTH_USER:      'DYUKSA_AUTH_USER',
  TOKEN_EXPIRY:   'DYUKSA_TOKEN_EXPIRY',
  WORKSPACE_ID:   'DYUKSA_WORKSPACE_ID',
  NOTIFICATIONS:  'DYUKSA_NOTIFICATIONS',
  SETTINGS:       'DYUKSA_SETTINGS',
  TASKS_CACHE:    'TASKS_CACHE_V1',
  QUICK_TASKS:    'DYUKSA_QUICK_TASKS',
  PROJECTS:       'DYUKSA_PROJECTS',
  OFFLINE_QUEUE:  'DYUKSA_OFFLINE_QUEUE',
  SCHEDULED_NOTIFS: 'DYUKSA_SCHEDULED_NOTIFS',
  ONBOARDING:     'DYUKSA_ONBOARDING_DONE',
};

// ── Central Auth Server Endpoints
export const CENTRAL_ENDPOINTS = {
  LOGIN:            '/auth/login/',
  FORGOT_PASSWORD:  '/auth/forgot-password/',
  VERIFY_OTP:       '/auth/verify-otp/',
  SET_NEW_PASSWORD: '/auth/set-new-password/',
  RESET_PASSWORD:   '/auth/reset-password/',
  SOCIAL_AUTH:      '/auth/social-auth/',
  SIGNUP:           '/organizations/signup/',
  SEND_OTP:         '/organizations/signup/send-otp/',
  ADD_PLATFORM:     '/organizations/add-platform/',
  INVITE_SEND:      '/auth/invite/send/',
  INVITE_VERIFY:    (token) => `/auth/invite/verify/${token}/`,
  INVITE_ACCEPT:    '/auth/invite/accept/',
};

// ── Signup Products 
export const SIGNUP_PRODUCTS = [
  { key: 'pm',   name: 'Project Management', description: 'Tasks, sprints, milestones, and team collaboration', icon: '📋', locked: true },
  { key: 'hrms', name: 'HRMS',               description: 'Employees, payroll, leave, and attendance',          icon: '👥', locked: false },
  { key: 'crm',  name: 'CRM',                description: 'Leads, deals, customers, and support tickets',       icon: '🤝', locked: false },
  { key: 'ims',  name: 'IMS',                description: 'Inventory, warehouses, orders, and dispatch',        icon: '📦', locked: false },
];

// ── Task Status 
export const TASK_STATUS = {
  PENDING:     'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
  BACKLOG:     'backlog',
  DEPLOYED:    'deployed',
  DEFERRED:    'deferred',
  REVIEW:      'review',
};

export const TASK_STATUS_OPTIONS = [
  'pending', 'in_progress', 'completed', 'backlog', 'deployed', 'deferred', 'review',
];

export const TASK_STATUS_LABELS = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
  backlog:     'Backlog',
  deployed:    'Deployed',
  deferred:    'Deferred',
  review:      'Review',
};

// Single source of truth for task status colors — used across ALL screens
export const TASK_STATUS_COLORS = {
  pending:     '#D97706',
  in_progress: '#3B72EE',
  completed:   '#22C55E',
  backlog:     '#F472B6',
  deployed:    '#3B72EE',
  deferred:    '#FBBF24',
  review:      '#A78BFA',
};

export const TASK_STATUS_BG = {
  pending:     '#FEF3C7',
  in_progress: '#EFF6FF',
  completed:   '#F0FDF4',
  backlog:     '#FDF2F8',
  deployed:    '#EFF6FF',
  deferred:    '#FFFBEB',
  review:      '#F5F3FF',
};

// ── Task Priority 
export const TASK_PRIORITY = {
  LOW:      'low',
  MEDIUM:   'medium',
  HIGH:     'high',
  URGENT:   'urgent',
  CRITICAL: 'critical',
};

export const TASK_PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

export const TASK_PRIORITY_LABELS = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  urgent:   'Urgent',
  critical: 'Critical',
};

// Single source of truth for priority colors 
export const TASK_PRIORITY_COLORS = {
  low:      '#22C55E',
  medium:   '#3B72EE',
  high:     '#F97316',
  urgent:   '#EF4444', 
  critical: '#EF4444',
};

// ── Project Types 
export const PROJECT_TYPE = {
  CLIENT:           'client',
  INTERNAL:         'internal',
  CONTENT_CREATION: 'content_creation',
  IDEAS:            'ideas',
};

export const PROJECT_TYPE_OPTIONS = ['client', 'internal', 'content_creation', 'ideas'];

export const PROJECT_TYPE_LABELS = {
  client:           'Client',
  internal:         'Internal',
  content_creation: 'Content Creation',
  ideas:            'Ideas',
};

// ── User Roles
export const USER_ROLE = {
  ADMIN:     'admin',
  MANAGER:   'manager',
  DEVELOPER: 'developer',
  ANNOTATOR: 'annotator',
  VIEWER:    'viewer',
};

export const USER_ROLE_OPTIONS = ['admin', 'manager', 'developer', 'annotator', 'viewer'];

export const USER_ROLE_LABELS = {
  admin:     'Admin',
  manager:   'Manager',
  developer: 'Developer',
  annotator: 'Annotator',
  viewer:    'Viewer',
};

// ── Project Membership Roles 
export const PROJECT_ROLE = {
  ADMIN:   'project_admin',
  MANAGER: 'project_manager',
  MEMBER:  'project_member',
  VIEWER:  'project_viewer',
};

export const PROJECT_ROLE_OPTIONS = [
  'project_admin',
  'project_manager',
  'project_member',
  'project_viewer',
];

// Display labels for new project roles
export const PROJECT_ROLE_LABELS = {
  project_admin:   'Project Admin',
  project_manager: 'Project Manager',
  project_member:  'Project Member',
  project_viewer:  'Project Viewer',
  owner:       'Project Admin',
  admin:       'Project Admin',
  manager:     'Project Manager',
  member:      'Project Member',
  viewer:      'Project Viewer',
  frontend:    'Project Member',
  backend:     'Project Member',
  tester:      'Project Member',
  devops:      'Project Member',
  social_media:'Project Member',
};
// ── Notification Types 
export const NOTIFICATION_TYPE = {
  TASK_ASSIGNED:       'task_assigned',
  TASK_COMPLETED:      'task_completed',
  TASK_STATUS_UPDATED: 'task_status_updated',
  DOCUMENT_SHARED:     'document_shared',
  EVENT_CREATED:       'event_created',
  NEW_MESSAGE:         'new_message',
  SYSTEM:              'system',
  REMINDER:            'reminder',
};

export const NOTIFICATION_TYPE_META = {
  task_assigned:       { icon: '📋', color: '#4ECDC4' },
  task_completed:      { icon: '✅', color: '#4ADE80' },
  task_status_updated: { icon: '🔄', color: '#60A5FA' },
  document_shared:     { icon: '📄', color: '#A78BFA' },
  event_created:       { icon: '📅', color: '#FBBF24' },
  new_message:         { icon: '💬', color: '#F472B6' },
  system:              { icon: '🔔', color: '#9898A6' },
  reminder:            { icon: '⏰', color: '#F59E0B' },
  // Local/in-app notification types
  task:                { icon: '📋', color: '#4ECDC4' },
  project:             { icon: '🗂️', color: '#3B82F6' },
  event:               { icon: '📅', color: '#FBBF24' },
  default:             { icon: '🔔', color: '#9898A6' },
};

// ── Theme / Design Tokens 
export const COLORS = {
  brand:        '#3B72EE',
  brandDark:    '#2D6AE3',
  dark:         '#1A2340',
  white:        '#FFFFFF',

  // Text
  textPrimary:  '#0E1726',
  textSecondary:'#3B4658',
  textTertiary: '#6B7588',
  textMuted:    '#9AA3B2',

  // Borders & surfaces
  hairline:     '#E6E9EF',
  hairlineSoft: '#F0F2F6',
  surface:      '#FFFFFF',
  surfaceAlt:   '#F7F8FB',

  // Semantic
  blue:         '#3B72EE',
  blueSoft:     '#EAF1FE',
  green:        '#22A06B',
  greenSoft:    '#E2F5EC',
  yellow:       '#E5A60E',
  yellowSoft:   '#FEF3CE',
  purple:       '#7A5AF8',
  purpleSoft:   '#EEEAFE',
  red:          '#E5484D',
  redSoft:      '#FBE3E3',

  // Dark mode overrides (use conditionally in screens)
  darkBg:       '#0D0D0F',
  darkCard:     '#1A1A20',
  darkBorder:   '#252530',
  darkText:     '#FFFFFF',
  darkSub:      '#9898A6',
};

// Project color palette 
export const PROJECT_COLORS = [
  '#2D6AE3', '#7A5AF8', '#22A06B', '#E5A60E',
  '#E5484D', '#F97316', '#0EA5E9', '#10B981',
];

// Avatar colors 
export const AVATAR_COLORS = [
  '#3B72EE', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#22A06B',
];

// Document file type colors & labels
export const DOC_TYPE_META = {
  pdf:  { label: 'PDF',  color: '#EF4444', bg: '#FEF2F2' },
  doc:  { label: 'DOC',  color: '#2563EB', bg: '#EFF6FF' },
  docx: { label: 'DOCX', color: '#2563EB', bg: '#EFF6FF' },
  xls:  { label: 'XLS',  color: '#16A34A', bg: '#F0FDF4' },
  xlsx: { label: 'XLSX', color: '#16A34A', bg: '#F0FDF4' },
  csv:  { label: 'CSV',  color: '#16A34A', bg: '#F0FDF4' },
  ppt:  { label: 'PPT',  color: '#EA580C', bg: '#FFF7ED' },
  pptx: { label: 'PPTX', color: '#EA580C', bg: '#FFF7ED' },
  png:  { label: 'IMG',  color: '#8B5CF6', bg: '#F5F3FF' },
  jpg:  { label: 'IMG',  color: '#8B5CF6', bg: '#F5F3FF' },
  jpeg: { label: 'IMG',  color: '#8B5CF6', bg: '#F5F3FF' },
  ts:   { label: 'TS',   color: '#2563EB', bg: '#EFF6FF' },
  js:   { label: 'JS',   color: '#D97706', bg: '#FFFBEB' },
};
export const DOC_TYPE_FALLBACK = { label: 'FILE', color: '#6B7280', bg: '#F9FAFB' };

// ── Screen Names 
export const SCREENS = {
  // Auth
  LOGIN:           'Login',
  SIGNUP:          'Signup',
  FORGOT_PASSWORD: 'ForgotPassword',
  ONBOARDING:      'Onboarding',

  // Main tabs
  DASHBOARD:       'Dashboard',
  PROJECTS:        'Projects',
  TASKS:           'Tasks',
  CHAT:            'Chat',

  // Stacks
  CALENDAR:        'Calendar',
  DOCS:            'Docs',
  QUICK_NOTES:     'QuickNotes',
  SETTINGS:        'Settings',
  PROFILE:         'Profile',
  EDIT_PROFILE:    'EditProfile',
  TEAM_MANAGEMENT: 'TeamManagement',
  CHANGE_PASSWORD: 'ChangePassword',
  PROJECT_DETAIL:  'ProjectDetail',
  TASK_DETAIL:     'TaskDetail',
  NOTIFICATIONS:   'Notifications',
  SEARCH:          'Search',
  TEAM:            'Team',
  MY_WORK:         'MyWork',
  REPORTS:         'Reports',
  DOCUMENT_VIEWER: 'DocumentViewer',
  QUICK_CREATE:    'QuickCreate',
  CREATE_PROJECT:  'CreateProject',
  CREATE_TASK:     'CreateTask',
  INVITE_USER:     'InviteUser',
  ROLES:           'Roles',
  MAIN:            'Main',
};

// Screens where global navbar should NOT render
export const NAV_HIDDEN_SCREENS = [
  SCREENS.LOGIN, SCREENS.SIGNUP, SCREENS.FORGOT_PASSWORD,
  SCREENS.QUICK_CREATE, SCREENS.CREATE_PROJECT, SCREENS.CREATE_TASK,
  SCREENS.DOCUMENT_VIEWER, SCREENS.PROJECT_DETAIL, SCREENS.TASK_DETAIL,
  SCREENS.CHANGE_PASSWORD, SCREENS.INVITE_USER, SCREENS.SETTINGS,
];

// ── API Endpoint Paths
export const ENDPOINTS = {
  // Auth
  LOGIN:           '/auth/login/',
  LOGOUT:          '/auth/logout/',
  REFRESH:         '/auth/refresh/',
  ME:              '/auth/me/',
  FORGOT_PASSWORD: '/auth/forgot-password/',
  RESET_PASSWORD:  '/auth/reset-password/',
  INVITE_SEND:     '/auth/invite/send/',
  USERS:           '/auth/users/',
  UPDATE_ROLE:     (userId) => `/auth/update-role/${userId}/`,

  // Workspaces
  WORKSPACES:          '/organizations/workspaces/',
  WORKSPACE_SWITCH:    (wsId) => `/organizations/workspaces/${wsId}/switch/`,
  WORKSPACE_MEMBERS:   (wsId) => `/organizations/workspaces/${wsId}/members/`,

  // Tasks
  TASKS:               '/tasksite/',
  TASK_DETAIL:         (id) => `/tasksite/${id}/`,
  TASK_COMMENTS:       (id) => `/tasksite/${id}/comments/`,
  TASK_LINKS:          (id) => `/tasksite/${id}/links/`,
  TASK_LINK_DELETE:    (id, linkId) => `/tasksite/${id}/links/${linkId}/`,

  // Projects
  PROJECTS:            '/projects/',
  PROJECT_DETAIL:      (id) => `/projects/${id}/`,
  PROJECT_UPLOAD_URL:  (id) => `/projects/${id}/get-upload-url/`,
  PROJECT_CONFIRM:     (id) => `/projects/${id}/confirm-upload/`,

  // Documents
  DOCUMENTS:           '/documents/',
  DOCUMENT_DETAIL:     (id) => `/documents/${id}/`,
  DOCUMENT_SHARE:      (id) => `/documents/${id}/share/`,
  DOCUMENT_TAGS:       '/documents/tags/',
  DOCS_BY_PROJECT:     (projectId) => `/documents/project/${projectId}/all/`,

  // Chat
  CHAT_ROOMS:          '/chat/rooms/',
  CHAT_MESSAGES:       (roomId) => `/chat/rooms/${roomId}/messages/`,
  CHAT_ROOM_SETTINGS:  (roomId) => `/chat/rooms/${roomId}/settings/`,

  // Calendar / Events
  EVENTS:              '/daily-updates/events/',
  EVENT_DETAIL:        (id) => `/daily-updates/events/${id}/`,
  EVENT_RSVP:          (id) => `/daily-updates/events/${id}/rsvp-status/`,
  DAILY_UPDATES:       '/daily-updates/',

  // Notifications
  NOTIFICATIONS:       '/notification/',
  NOTIFICATION_READ:   (id) => `/notification/${id}/mark-read/`,
  NOTIFICATION_DELETE: (id) => `/notification/${id}/`,

  // Search
  SEARCH_TASKS:     (q) => `/tasksite/?search=${encodeURIComponent(q)}`,
  SEARCH_PROJECTS:  (q) => `/projects/?search=${encodeURIComponent(q)}`,
  SEARCH_DOCS:      (q) => `/documents/?search=${encodeURIComponent(q)}`,
  SEARCH_USERS:     (q) => `/auth/users/?search=${encodeURIComponent(q)}`,

  // Quick Notes
  NOTES_FOLDERS:    '/quicknotes/folders/',
  NOTES:            '/quicknotes/notes/',
  NOTE_DETAIL:      (id) => `/quicknotes/notes/${id}/`,
  NOTE_ATTACHMENTS: '/quicknotes/attachments/',

  // AI
  AI_REFINE_TEXT:   '/task-ai/refine-text/',
  AI_SUGGEST_TASK:  '/task-ai/suggest-task/',
  AI_CHAT_AGENT:    '/task-ai/chat/agent/',
};


// ── Default Settings Schema 
export const DEFAULT_SETTINGS = {
  theme:           'Light',
  fontSize:        'Medium',
  dataMode:        'Local',
  projectView:     'Grid',
  collapseSidebar: false,
  desktopNotif:    true,
  emailNotif:      false,
  chatMention:     true,
  taskAssign:      true,
  notifSound:      true,
  sessionAlerts:   true,
};

// ── JWT helpers ───────────────────────────────────────────────────────────────
/**
 * Decode a JWT payload without verifying signature (verification is backend's job).
 * Works in React Native where atob may not be available.
 */
export const decodeTokenPayload = (token) => {
  try {
    const base64 = token.split('.')[1];
    // Handle URL-safe base64
    const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      Array.from(
        // Use a Uint8Array approach that works in RN without atob
        Uint8Array.from(
          globalThis.atob
            ? [...globalThis.atob(padded)].map(c => c.charCodeAt(0))
            : Buffer.from(padded, 'base64')
        ),
        (byte) => '%' + byte.toString(16).padStart(2, '0')
      ).join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/**
 * Returns true if the given JWT access token includes 'pm' in its platforms array.
 */
export const hasPMAccess = (accessToken) => {
  if (!accessToken) return false;
  const payload = decodeTokenPayload(accessToken);
  return Array.isArray(payload?.platforms) && payload.platforms.includes('pm');
};

// ── Response shape helpers (normalize inconsistent API responses) 
/**
 * Normalize a user object from any API response shape to a consistent shape.
 * @param {object} raw - Raw user from API
 * @returns {{ id, name, username, email, role, avatar, avatarUrl, skills, createdAt }}
 */
export const normalizeUser = (raw) => ({
  id:        raw.id,
  name:      [raw.first_name, raw.last_name].filter(Boolean).join(' ') || raw.username || '',
  username:  raw.username || '',
  email:     raw.email || '',
  role:      raw.role || null,
  avatar:    ([raw.first_name, raw.last_name].filter(Boolean).join(' ') || raw.username || 'U')[0]?.toUpperCase() || 'U',
  avatarUrl: raw.avatar || raw.avatar_url || null,
  skills:    raw.skills || [],
  createdAt: raw.date_joined || raw.created_at || new Date().toISOString(),
});

/**
 * Normalize a task object to a consistent shape.
 */
export const normalizeTask = (raw) => ({
  id:          raw.id,
  heading:     raw.heading || raw.title || 'Untitled',
  description: raw.description || raw.desc || '',
  status:      raw.status || TASK_STATUS.PENDING,
  priority:    raw.priority || TASK_PRIORITY.MEDIUM,
  project:     raw.project,
  projectName: raw.project_details?.name || raw.project_name || '',
  projectDetails: raw.project_details || null,
  assignedTo:  raw.assigned_to || [],
  assignedToDetails: raw.assigned_to_user_details || [],
  assignedByDetails: raw.assigned_by_user_details || raw.created_by || null,
  startDate:   raw.start_date || null,
  endDate:     raw.end_date || raw.due_date || null,
  startTime:   raw.start_time || '',
  endTime:     raw.end_time || '',
  links:       raw.links || [],
  uploadedLinks: raw.uploaded_links || '',
  attachments: raw.attachments || [],
  comments:    raw.comments || [],
  createdAt:   raw.created_at || new Date().toISOString(),
  updatedAt:   raw.updated_at || new Date().toISOString(),
});

/**
 * Normalize a notification from the API to a consistent app shape.
 */
export const normalizeNotification = (raw) => {
  const toStr = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v.replace(/<[^>]*>/g, '').trim();
    if (typeof v === 'object') return v.full_name || v.username || v.name || String(v.id || '');
    return String(v);
  };
  const type = toStr(raw.notification_type || raw.type || 'system');
  const meta = NOTIFICATION_TYPE_META[type] || NOTIFICATION_TYPE_META.default;
  return {
    id:         String(raw.id),
    title:      toStr(raw.title || raw.heading || 'Notification'),
    body:       toStr(raw.message || raw.body || raw.content || ''),
    type,
    icon:       meta.icon,
    color:      meta.color,
    read:       raw.is_read ?? raw.read ?? false,
    time:       raw.created_at || raw.timestamp || new Date().toISOString(),
    time_since: toStr(raw.time_since || ''),
    priority:   toStr(raw.priority || 'medium'),
    actor:      toStr(raw.actor_name || raw.actor || raw.sender || ''),
    metadata:   raw.metadata || raw.data || {},
  };
};
