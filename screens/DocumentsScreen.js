import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, Platform, ScrollView, ActivityIndicator,
  Linking, RefreshControl, Alert, Modal, Pressable, KeyboardAvoidingView,
  Animated, Dimensions, Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';
import Svg, { Path, Rect } from 'react-native-svg';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
// DocumentPicker — loaded lazily so screen still works if package isn't installed
let DocumentPicker = null;
try { DocumentPicker = require('expo-document-picker'); } catch {}

// API_BASE → imported from config
const DOCS_API     = `${API_BASE}/api/v1/documents/`;
const PROJECTS_API = `${API_BASE}/api/v1/projects/`;

// Always includes X-Workspace-ID so every request is workspace-aware
const buildAuthHeaders = async (isMultipart = false) => {
  const token       = await getAccessToken();
  const workspaceId = await getWorkspaceId();
  const h = isMultipart
    ? { 'Authorization': `Bearer ${token}` }
    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  if (workspaceId) h['X-Workspace-ID'] = workspaceId;
  return h;
};

// ─────────────────────────────────────────────────────────────
// File type → icon + colour mapping
// ─────────────────────────────────────────────────────────────
const TYPE_META = {
  // Images
  png:  { label: 'PNG',  color: '#8B5CF6', bg: '#F5F3FF', group: 'image' },
  jpg:  { label: 'JPG',  color: '#8B5CF6', bg: '#F5F3FF', group: 'image' },
  jpeg: { label: 'JPG',  color: '#8B5CF6', bg: '#F5F3FF', group: 'image' },
  gif:  { label: 'GIF',  color: '#8B5CF6', bg: '#F5F3FF', group: 'image' },
  webp: { label: 'WEBP', color: '#8B5CF6', bg: '#F5F3FF', group: 'image' },
  svg:  { label: 'SVG',  color: '#8B5CF6', bg: '#F5F3FF', group: 'image' },
  heic: { label: 'HEIC', color: '#8B5CF6', bg: '#F5F3FF', group: 'image' },
  bmp:  { label: 'BMP',  color: '#8B5CF6', bg: '#F5F3FF', group: 'image' },
  // Documents
  pdf:  { label: 'PDF',  color: '#EF4444', bg: '#FEF2F2', group: 'document' },
  doc:  { label: 'DOC',  color: '#2563EB', bg: '#EFF6FF', group: 'document' },
  docx: { label: 'DOCX', color: '#2563EB', bg: '#EFF6FF', group: 'document' },
  xls:  { label: 'XLS',  color: '#16A34A', bg: '#F0FDF4', group: 'document' },
  xlsx: { label: 'XLSX', color: '#16A34A', bg: '#F0FDF4', group: 'document' },
  csv:  { label: 'CSV',  color: '#16A34A', bg: '#F0FDF4', group: 'document' },
  ppt:  { label: 'PPT',  color: '#EA580C', bg: '#FFF7ED', group: 'document' },
  pptx: { label: 'PPTX', color: '#EA580C', bg: '#FFF7ED', group: 'document' },
  key:  { label: 'KEY',  color: '#EA580C', bg: '#FFF7ED', group: 'document' },
  txt:  { label: 'TXT',  color: '#6B7280', bg: '#F9FAFB', group: 'document' },
  rtf:  { label: 'RTF',  color: '#6B7280', bg: '#F9FAFB', group: 'document' },
  md:   { label: 'MD',   color: '#6B7280', bg: '#F9FAFB', group: 'document' },
  // Code
  js:   { label: 'JS',   color: '#D97706', bg: '#FFFBEB', group: 'code' },
  ts:   { label: 'TS',   color: '#2563EB', bg: '#EFF6FF', group: 'code' },
  tsx:  { label: 'TSX',  color: '#0891B2', bg: '#ECFEFF', group: 'code' },
  jsx:  { label: 'JSX',  color: '#0891B2', bg: '#ECFEFF', group: 'code' },
  py:   { label: 'PY',   color: '#16A34A', bg: '#F0FDF4', group: 'code' },
  java: { label: 'JAVA', color: '#EA580C', bg: '#FFF7ED', group: 'code' },
  html: { label: 'HTML', color: '#EA580C', bg: '#FFF7ED', group: 'code' },
  css:  { label: 'CSS',  color: '#2563EB', bg: '#EFF6FF', group: 'code' },
  json: { label: 'JSON', color: '#D97706', bg: '#FFFBEB', group: 'code' },
  xml:  { label: 'XML',  color: '#D97706', bg: '#FFFBEB', group: 'code' },
  yml:  { label: 'YML',  color: '#D97706', bg: '#FFFBEB', group: 'code' },
  yaml: { label: 'YAML', color: '#D97706', bg: '#FFFBEB', group: 'code' },
  ipynb:{ label: 'IPYNB',color: '#D97706', bg: '#FFFBEB', group: 'code' },
  pem:  { label: 'PEM',  color: '#6B7280', bg: '#F9FAFB', group: 'code' },
  // Archives
  zip:  { label: 'ZIP',  color: '#6B7280', bg: '#F9FAFB', group: 'other' },
  rar:  { label: 'RAR',  color: '#6B7280', bg: '#F9FAFB', group: 'other' },
  '7z': { label: '7Z',   color: '#6B7280', bg: '#F9FAFB', group: 'other' },
  tar:  { label: 'TAR',  color: '#6B7280', bg: '#F9FAFB', group: 'other' },
  gz:   { label: 'GZ',   color: '#6B7280', bg: '#F9FAFB', group: 'other' },
  // Video
  mp4:  { label: 'MP4',  color: '#DB2777', bg: '#FDF2F8', group: 'other' },
  mov:  { label: 'MOV',  color: '#DB2777', bg: '#FDF2F8', group: 'other' },
  avi:  { label: 'AVI',  color: '#DB2777', bg: '#FDF2F8', group: 'other' },
  mkv:  { label: 'MKV',  color: '#DB2777', bg: '#FDF2F8', group: 'other' },
  webm: { label: 'WEBM', color: '#DB2777', bg: '#FDF2F8', group: 'other' },
  // Audio
  mp3:  { label: 'MP3',  color: '#7C3AED', bg: '#F5F3FF', group: 'other' },
  wav:  { label: 'WAV',  color: '#7C3AED', bg: '#F5F3FF', group: 'other' },
  m4a:  { label: 'M4A',  color: '#7C3AED', bg: '#F5F3FF', group: 'other' },
};

const FALLBACK_META = { label: 'FILE', color: '#6B7280', bg: '#F9FAFB', group: 'other' };

const TYPE_GROUPS = [
  { id: 'all',      label: 'All Types' },
  { id: 'image',    label: 'Images' },
  { id: 'document', label: 'Documents' },
  { id: 'code',     label: 'Code' },
  { id: 'other',    label: 'Other' },
];

// Deterministic avatar colours — same user always gets same hue
const AVATAR_COLORS = ['#EF4444', '#F97316', '#EAB308', '#4ADE80', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// Extract file extension from name, ignoring any query string.
const getExt = (name) => {
  if (!name) return '';
  const clean = String(name).split('?')[0].split('#')[0];
  const parts = clean.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase().trim();
};

// Detect task doc from S3 URL path like .../task_documents/task_490/...
const extractTaskId = (fileUrl) => {
  if (!fileUrl) return null;
  const m = String(fileUrl).match(/task_documents\/task_(\d+)\//);
  return m ? Number(m[1]) : null;
};

// Fallback project-id extraction from URL (when `project` field missing).
const extractProjectIdFromUrl = (fileUrl) => {
  if (!fileUrl) return null;
  const m = String(fileUrl).match(/\/projects\/(\d+)\//);
  return m ? Number(m[1]) : null;
};

// Friendly relative date
const formatRelative = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr  = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1)  return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr  < 24) return `${diffHr}h ago`;
    if (diffDay < 7)  return `${diffDay}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

// Initials from "Harshit Shukla" → "HS"
const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Deterministic colour hash from a string
const getAvatarColor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// FileIcon — renders a document-style icon matching the web app
// Shape: white rectangle with folded top-right corner, colored bottom bar
// with extension label — same visual language as the webpage
// ─────────────────────────────────────────────────────────────────────────────
function FileIcon({ ext, meta }) {
  const color = meta?.color || '#6B7280';
  const bg    = meta?.bg    || '#F9FAFB';
  const label = (meta?.label || (ext ? ext.toUpperCase() : 'FILE')).slice(0, 4);

  return (
    <View style={fileIconStyles.wrap}>
      {/* Main file body */}
      <View style={[fileIconStyles.body, { backgroundColor: bg, borderColor: color + '30' }]}>
        {/* Folded corner — top right */}
        <View style={[fileIconStyles.corner, { borderTopColor: color + '40', borderLeftColor: color + '40' }]} />
        {/* Content lines */}
        <View style={fileIconStyles.lines}>
          <View style={[fileIconStyles.line, { backgroundColor: color + '35', width: '80%' }]} />
          <View style={[fileIconStyles.line, { backgroundColor: color + '35', width: '60%' }]} />
          <View style={[fileIconStyles.line, { backgroundColor: color + '35', width: '70%' }]} />
        </View>
        {/* Colored footer with label */}
        <View style={[fileIconStyles.footer, { backgroundColor: color }]}>
          <Text style={fileIconStyles.footerText}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const fileIconStyles = StyleSheet.create({
  wrap: {
    width: 48, height: 58,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    width: 44, height: 54,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    top: 0, right: 0,
    width: 12, height: 12,
    borderTopWidth: 12,
    borderLeftWidth: 12,
    borderTopColor: '#E5E7EB',
    borderLeftColor: 'transparent',
    backgroundColor: 'transparent',
  },
  lines: {
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 4,
    flex: 1,
  },
  line: {
    height: 3,
    borderRadius: 2,
  },
  footer: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});


// ── SVG Search Icon ───────────────────────────────────────────────────────────
const SearchIcon = ({ size = 20, color = '#3B72EE' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

export default function DocumentsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const [docs,         setDocs]         = useState([]);
  const [projectMap,   setProjectMap]   = useState({}); // { [id]: name }
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [projectFilter,setProjectFilter]= useState('all');
  const [pickerOpen,   setPickerOpen]   = useState(null);

  // ── Selection state ──
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [shareModalDoc,  setShareModalDoc]  = useState(null);
  const [users,          setUsers]          = useState([]);
  const [shareUserId,    setShareUserId]    = useState(null);
  const [shareUserOpen,  setShareUserOpen]  = useState(false);
  const [sharing,        setSharing]        = useState(false);
  const [sharedWithMap,  setSharedWithMap]  = useState({}); // { [docId]: [{user}] }

  // ── Move modal state ──
  const [moveModalDoc,   setMoveModalDoc]   = useState(null);
  const [moveProjectId,  setMoveProjectId]  = useState(null);
  const [moveProjects,   setMoveProjects]   = useState([]);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [moving,         setMoving]         = useState(false);

  // ── Tags modal state ──
  const [tagsModalDoc,   setTagsModalDoc]   = useState(null);
  const [availableTags,  setAvailableTags]  = useState([]);
  const [selectedTags,   setSelectedTags]   = useState([]);
  const [tagSearch,      setTagSearch]      = useState('');
  const [addingTags,     setAddingTags]     = useState(false);
  const [loadingTags,    setLoadingTags]    = useState(false);

  const isSelecting    = selectedIds.size > 0;
  const toggleSelect   = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadFile,         setUploadFile]         = useState(null);   // { name, uri, mimeType, size }
  const [uploadProjectId,    setUploadProjectId]    = useState(null);
  const [uploadProjectSearch,setUploadProjectSearch]= useState('');
  const [uploadProjects,     setUploadProjects]     = useState([]);
  const [uploading,          setUploading]          = useState(false);
  const [uploadPickerOpen,   setUploadPickerOpen]   = useState(false);

  // ── Fetch all documents (follow `next` pagination) ──
  const fetchDocs = useCallback(async () => {
    const all = [];
    let url = DOCS_API;
    let safety = 20; // cap: 20 pages max

    while (url && safety-- > 0) {
      const res = await fetch(url, {
        method: 'GET',
        headers: await buildAuthHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Error ${res.status}`);
      }
      const data = await res.json();

      // Tolerate three response shapes: array | {results:[]} | {documents:[]}
      let pageDocs = [];
      let nextUrl  = null;
      if (Array.isArray(data)) {
        pageDocs = data;
      } else if (Array.isArray(data.results)) {
        pageDocs = data.results;
        nextUrl  = data.next || null;
      } else if (Array.isArray(data.documents)) {
        pageDocs = data.documents;
        nextUrl  = data.next || null;
      }

      all.push(...pageDocs);
      url = nextUrl;
    }
    return all;
  }, []);

  // ── Fetch projects → build id→name map ──
  const fetchProjectMap = useCallback(async () => {
    try {
      const res = await fetch(PROJECTS_API, {
        method: 'GET',
        headers: await buildAuthHeaders(),
      });
      if (!res.ok) return {};
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : (data.results || data.projects || []);
      const map = {};
      list.forEach(p => {
        if (p && p.id != null) {
          map[p.id] = p.name || p.title || `Project ${p.id}`;
        }
      });
      return map;
    } catch {
      return {};
    }
  }, []);

  // ── Load everything ──
  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [docsList, projMap] = await Promise.all([
        fetchDocs(),
        fetchProjectMap(),
      ]);
      setDocs(docsList);
      setProjectMap(projMap);
      // Populate sharedWithMap from shared_with field in each doc
      const swMap = {};
      docsList.forEach(d => {
        if (d.shared_with?.length > 0) {
          swMap[d.id] = d.shared_with.map((u, i) => ({ id: u.id || i, user: u }));
        }
      });
      setSharedWithMap(swMap);
    } catch (err) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchDocs, fetchProjectMap]);

  // ── Upload helpers ──────────────────────────────────────────────────────
  const openUploadModal = async () => {
    // Load projects for the picker
    try {
      const res = await fetch(PROJECTS_API, {
        headers: await buildAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.results || data.projects || []);
        setUploadProjects(list);
        if (list.length > 0 && !uploadProjectId) setUploadProjectId(list[0].id);
      }
    } catch {}
    setUploadFile(null);
    setUploadProjectSearch('');
    setUploadPickerOpen(false);
    setUploadModalVisible(true);
  };

  const pickDocument = async () => {
    if (!DocumentPicker) {
      Alert.alert('Not available', 'expo-document-picker is not installed.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0] || result;
      setUploadFile({
        name:     asset.name || 'document',
        uri:      asset.uri,
        mimeType: asset.mimeType || 'application/octet-stream',
        size:     asset.size,
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not pick file.');
    }
  };

  const submitUpload = async () => {
    if (!uploadFile) { Alert.alert('No file', 'Please pick a file first.'); return; }
    if (!uploadProjectId) { Alert.alert('No project', 'Please select a project.'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('source_file', {
        uri:  uploadFile.uri,
        name: uploadFile.name,
        type: uploadFile.mimeType,
      });
      formData.append('project', String(uploadProjectId));
      formData.append('name',    uploadFile.name);

      const res = await fetch(DOCS_API, {
        method: 'POST',
        headers: await buildAuthHeaders(true),
        body: formData,
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try { const e = await res.json(); detail = e.detail || JSON.stringify(e); } catch {}
        throw new Error(detail);
      }
      setUploadModalVisible(false);
      setUploadFile(null);
      // Refresh list
      setLoading(true);
      loadAll();
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Try again later.');
    } finally {
      setUploading(false);
    }
  };

  const filteredUploadProjects = uploadProjects.filter(p =>
    (p.name || '').toLowerCase().includes(uploadProjectSearch.toLowerCase())
  );

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // Open upload modal directly when navigated from FAB / QuickCreate
  useFocusEffect(useCallback(() => {
    if (route.params?.openUpload) {
      navigation.setParams({ openUpload: false });
      // Small delay so the screen finishes mounting first
      setTimeout(() => openUploadModal(), 350);
    }
  }, [route.params?.openUpload]));

  // ── Fetch users for share modal ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const headers = await buildAuthHeaders();
        const res = await fetch(`${API_BASE}/api/v1/tasksite/all-users/`, { headers });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || data.results || (Array.isArray(data) ? data : []));
        }
      } catch {}
    })();
  }, []);

  // ── Share document ────────────────────────────────────────────────
  const shareDocument = async (doc, userId) => {
    if (!userId) { Alert.alert('Select a user', 'Please select a user to share with.'); return; }
    setSharing(true);
    try {
      const headers = await buildAuthHeaders();

      // Try POST with user_id
      const res = await fetch(`${API_BASE}/api/v1/documents/${doc.id}/share/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId }),
      });
      const responseText = await res.text();

      if (!res.ok) {
        let errMsg = `Share failed (${res.status})`;
        try {
          const e = JSON.parse(responseText);
          errMsg = e.detail || e.message || e.error || Object.values(e)[0] || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const selectedUser = users.find(u => u.id === userId);
      setSharedWithMap(prev => ({
        ...prev,
        [doc.id]: [...(prev[doc.id] || []), { id: userId, user: selectedUser || { id: userId } }],
      }));
      setDocs(prev => prev.map(d => d.id === doc.id
        ? { ...d, shared_with: [...(d.shared_with || []), selectedUser].filter(Boolean) }
        : d
      ));
      Alert.alert('✅ Shared', `Document shared with ${selectedUser?.full_name || selectedUser?.username || 'user'} successfully.`);
      setShareUserId(null);
      clearSelection();
    } catch (e) {
      Alert.alert('Could not share', e.message || 'Try again.');
    } finally {
      setSharing(false);
    }
  }; // end shareDocument

  // ── Bulk delete ───────────────────────────────────────────────────
  const bulkDelete = () => {
    Alert.alert(
      `Delete ${selectedIds.size} document${selectedIds.size > 1 ? 's' : ''}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const headers = await buildAuthHeaders();
              await Promise.all([...selectedIds].map(id =>
                fetch(`${API_BASE}/api/v1/documents/${id}/`, { method: 'DELETE', headers })
              ));
              setDocs(prev => prev.filter(d => !selectedIds.has(d.id)));
              clearSelection();
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not delete.');
            }
          },
        },
      ]
    );
  };

  // ── Bulk status change ────────────────────────────────────────────
  const bulkChangeStatus = (newStatus) => {
    Alert.alert(
      `Change status to "${newStatus}"?`,
      `This will update ${selectedIds.size} document${selectedIds.size > 1 ? 's' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              const headers = await buildAuthHeaders();
              await Promise.all([...selectedIds].map(id =>
                fetch(`${API_BASE}/api/v1/documents/${id}/`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify({ status: newStatus }),
                })
              ));
              setDocs(prev => prev.map(d => selectedIds.has(d.id) ? { ...d, status: newStatus } : d));
              clearSelection();
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not update status.');
            }
          },
        },
      ]
    );
  };

  // ── Open Move modal ───────────────────────────────────────────────
  const openMoveModal = async () => {
    const doc = docs.find(d => selectedIds.has(d.id));
    if (!doc) return;
    setMoveProjectId(null);
    setMovePickerOpen(false);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/projects/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMoveProjects(Array.isArray(data) ? data : (data.results || []));
      }
    } catch {}
    setMoveModalDoc(doc);
  };

  // ── Move document to project ──────────────────────────────────────
  const moveDocument = async () => {
    if (!moveProjectId) { Alert.alert('Select a project', 'Please select a project to move to.'); return; }
    setMoving(true);
    try {
      const headers = await buildAuthHeaders();
      await Promise.all([...selectedIds].map(id =>
        fetch(`${API_BASE}/api/v1/documents/${id}/`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ project: moveProjectId }),
        })
      ));
      const projName = moveProjects.find(p => p.id === moveProjectId)?.name || 'project';
      setDocs(prev => prev.map(d => selectedIds.has(d.id) ? { ...d, project: moveProjectId } : d));
      setProjectMap(prev => ({ ...prev, [moveProjectId]: projName }));
      setMoveModalDoc(null);
      clearSelection();
      Alert.alert('✅ Moved', `Moved to ${projName}.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not move document.');
    } finally {
      setMoving(false);
    }
  };

  // ── Open Tags modal ───────────────────────────────────────────────
  const openTagsModal = async () => {
    const doc = docs.find(d => selectedIds.has(d.id));
    if (!doc) return;
    setTagSearch('');
    setSelectedTags(doc.tags?.map(t => t.id || t) || []);
    setLoadingTags(true);
    setTagsModalDoc(doc);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/documents/tags/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAvailableTags(Array.isArray(data) ? data : (data.results || []));
      }
    } catch (e) {
      console.warn('fetchTags:', e.message);
    } finally {
      setLoadingTags(false);
    }
  };

  // ── Add tags to document ──────────────────────────────────────────
  const applyTags = async () => {
    setAddingTags(true);
    try {
      const headers = await buildAuthHeaders();
      await Promise.all([...selectedIds].map(id =>
        fetch(`${API_BASE}/api/v1/documents/${id}/`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ tags: selectedTags }),
        })
      ));
      setDocs(prev => prev.map(d => selectedIds.has(d.id)
        ? { ...d, tags: availableTags.filter(t => selectedTags.includes(t.id)) }
        : d
      ));
      setTagsModalDoc(null);
      clearSelection();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not update tags.');
    } finally {
      setAddingTags(false);
    }
  };

  // ── Fetch shared-with for a doc ───────────────────────────────────
  const fetchSharedWith = async (docId) => {
    // First check if we already have it from the document data
    const doc = docs.find(d => d.id === docId);
    if (doc?.shared_with?.length > 0) {
      setSharedWithMap(prev => ({ ...prev, [docId]: doc.shared_with.map((u, i) => ({ id: i, user: u })) }));
    }
    // Also try the dedicated endpoint
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/documents/${docId}/`, { headers });
      if (res.ok) {
        const data = await res.json();
        const sharedWith = data.shared_with || [];
        if (sharedWith.length > 0) {
          setSharedWithMap(prev => ({
            ...prev,
            [docId]: sharedWith.map((u, i) => ({ id: u.id || i, user: u })),
          }));
        }
      }
    } catch (e) {
      console.warn('fetchSharedWith:', e.message);
    }
  };

  // ── Revoke share ──────────────────────────────────────────────────
  const revokeShare = async (docId, shareEntry) => {
    const userId = shareEntry?.user?.id || shareEntry?.id;
    const userName = shareEntry?.user?.full_name || shareEntry?.user?.username || 'this user';
    Alert.alert('Revoke access?', `${userName} will no longer have access to this document.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive',
        onPress: async () => {
          try {
            const headers = await buildAuthHeaders();
            // Try revoke endpoint with user_id
            const res = await fetch(`${API_BASE}/api/v1/documents/${docId}/share/`, {
              method: 'DELETE',
              headers,
              body: JSON.stringify({ user_id: userId }),
            });
            if (!res.ok && res.status !== 204) {
              const txt = await res.text();
              console.warn('Revoke failed:', txt);
            }
            // Update local state regardless
            setSharedWithMap(prev => ({
              ...prev,
              [docId]: (prev[docId] || []).filter(s => (s.user?.id || s.id) !== userId),
            }));
            setDocs(prev => prev.map(d => d.id === docId
              ? { ...d, shared_with: (d.shared_with || []).filter(u => u.id !== userId) }
              : d
            ));
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not revoke access.');
          }
        },
      },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // ── Open file in native viewer / browser ──
  const [detailDoc,   setDetailDoc]   = useState(null);
  const [showWebView, setShowWebView] = useState(false);
  const [showInfo,    setShowInfo]    = useState(false);

  const openDoc = (doc) => {
    if (isSelecting) { toggleSelect(doc.id); return; }
    setShowWebView(false);
    setShowInfo(false);
    setDetailDoc(doc);
  };

  // ── Filter + search ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => {
      const name = d.name || d.file_name || '';
      if (q && !name.toLowerCase().includes(q)) return false;

      if (typeFilter !== 'all') {
        const ext = getExt(name);
        const group = (TYPE_META[ext] || FALLBACK_META).group;
        if (group !== typeFilter) return false;
      }

      if (projectFilter !== 'all') {
        const docProjectId = d.project != null
          ? d.project
          : extractProjectIdFromUrl(d.source_file || d.file_url);
        if (String(docProjectId) !== String(projectFilter)) return false;
      }

      return true;
    });
  }, [docs, search, typeFilter, projectFilter]);

  // ── Build unique project list for dropdown from docs we actually have ──
  const projectOptions = useMemo(() => {
    const seen = new Set();
    const out = [{ id: 'all', label: 'All Projects' }];
    docs.forEach(d => {
      const pid = d.project != null
        ? d.project
        : extractProjectIdFromUrl(d.source_file || d.file_url);
      if (pid != null && !seen.has(pid)) {
        seen.add(pid);
        out.push({
          id: String(pid),
          label: projectMap[pid] || `Project ${pid}`,
        });
      }
    });
    // Sort everything after "All Projects" alphabetically
    const [head, ...rest] = out;
    rest.sort((a, b) => a.label.localeCompare(b.label));
    return [head, ...rest];
  }, [docs, projectMap]);

  // ── Helpers for current selection labels ──
  const currentProjectLabel = projectOptions.find(p => p.id === projectFilter)?.label || 'All Projects';
  const currentTypeLabel    = TYPE_GROUPS.find(t => t.id === typeFilter)?.label || 'All Types';

  // ── Row ──
  const renderItem = ({ item }) => {
    const name    = item.name || item.file_name || 'Untitled';
    const fileUrl = item.source_file || item.source_file_url || item.file_url;
    const ext     = getExt(name);
    const meta    = TYPE_META[ext] || FALLBACK_META;
    const displayExt = ext ? ext.toUpperCase() : 'FILE';

    const taskId    = extractTaskId(fileUrl);
    const projectId = item.project != null ? item.project : extractProjectIdFromUrl(fileUrl);
    const projectName = (projectId != null && projectMap[projectId])
      ? projectMap[projectId]
      : (projectId != null ? `Project ${projectId}` : 'Project');

    const creator     = item.created_by || {};
    const creatorName = creator.full_name || creator.username || 'Unknown';
    const status      = item.status || null;

    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: isSelected ? (isDark ? '#1A2E2E' : '#F0FFFE') : card, borderColor: isSelected ? '#3B72EE' : bdr },
        ]}
        onPress={() => {
          if (isSelecting) {
            toggleSelect(item.id);
          } else {
            openDoc(item);
          }
        }}
        onLongPress={() => toggleSelect(item.id)}
        delayLongPress={300}
        activeOpacity={0.7}
      >
        {/* Selection checkbox */}
        {isSelecting && (
          <View style={[
            styles.selectionCheck,
            { borderColor: isSelected ? '#3B72EE' : bdr, backgroundColor: isSelected ? '#3B72EE' : 'transparent' },
          ]}>
            {isSelected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>}
          </View>
        )}

        {/* File icon — matches webpage style */}
        <FileIcon ext={ext} meta={meta} />

        {/* Main content — 3 rows */}
        <View style={{ flex: 1, marginRight: 4 }}>

          {/* Row 1 — File name */}
          <Text style={[styles.fileName, { color: txt, fontSize: fs(13) }]} numberOfLines={1}>
            {name}
          </Text>

          {/* Row 2 — Project · Tags · Status */}
          <View style={[styles.metaRow, { marginBottom: 4 }]}>
            {/* Project pill */}
            <View style={[styles.projectPill, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
              <Text style={[styles.projectPillText, { color: sub, fontSize: fs(9) }]} numberOfLines={1}>
                {projectName}
              </Text>
            </View>
            {/* Tags */}
            {(item.tags || []).slice(0, 2).map((tag, ti) => (
              <View
                key={ti}
                style={[styles.tagPill, { backgroundColor: (tag.color || '#6B7280') + '22', borderColor: (tag.color || '#6B7280') + '44' }]}
              >
                <Text style={[styles.tagPillTxt, { color: tag.color || '#6B7280', fontSize: fs(9) }]}>
                  {tag.name || tag}
                </Text>
              </View>
            ))}
            {/* Status */}
            {!!status && (
              <View style={[styles.statusPill, {
                backgroundColor:
                  status === 'approved'  ? (isDark ? 'rgba(34,160,107,0.15)' : '#D1FAE5') :
                  status === 'in_review' ? (isDark ? 'rgba(229,166,14,0.15)' : '#FEF3C7') :
                  status === 'archived'  ? (isDark ? '#252530' : '#F3F4F6') :
                                           (isDark ? '#252530' : '#F5F5F7'),
              }]}>
                <Text style={[styles.statusPillTxt, {
                  color:
                    status === 'approved'  ? (isDark ? '#4ADE80' : '#065F46') :
                    status === 'in_review' ? (isDark ? '#FCD34D' : '#92400E') :
                    status === 'archived'  ? (isDark ? '#9898A6' : '#6B7280') :
                                             (isDark ? '#9898A6' : '#374151'),
                  fontSize: fs(9),
                }]}>
                  {status === 'in_review' ? 'IN REVIEW' : status.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Row 3 — Date · Owner avatar · Owner name · Shared badge */}
          <View style={styles.bottomRow}>
            <Text style={[styles.dateText, { color: sub, fontSize: fs(10) }]}>
              {formatRelative(item.updated_at || item.created_at || item.uploaded_at)}
            </Text>
            <Text style={[styles.dotSep, { color: sub }]}>·</Text>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(creatorName) }]}>
              <Text style={styles.avatarText}>{getInitials(creatorName)}</Text>
            </View>
            <Text style={[styles.sharedByText, { color: sub, fontSize: fs(10) }]} numberOfLines={1}>
              {creatorName}
            </Text>
            {/* Shared indicator */}
            {((item.shared_with?.length > 0) || (sharedWithMap[item.id]?.length > 0)) && (
              <TouchableOpacity
                style={[styles.sharedBadge, { backgroundColor: isDark ? '#1A2E2E' : '#F0FFFE', borderColor: '#3B72EE' }]}
                onPress={() => {
                  fetchSharedWith(item.id);
                  setShareUserId(null);
                  setShareUserOpen(false);
                  setShareModalDoc(item);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={{ fontSize: 9, color: '#3B72EE', fontWeight: '700' }}>
                  ⤴ Shared ({item.shared_with?.length || sharedWithMap[item.id]?.length || 0})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Text style={{ color: sub, fontSize: 18 }}>›</Text>
      </TouchableOpacity>
    );
  };

  // ── Chip ──
  const Chip = ({ label, active, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: card, borderColor: bdr },
        active && { backgroundColor: isDark ? '#3B72EE' : '#1A1A2E', borderColor: isDark ? '#3B72EE' : '#1A1A2E' },
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.chipText,
          { color: sub },
          active && { color: isDark ? '#0D0D0F' : '#FFFFFF', fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ── Folder grouping ──
  const folderMap = {};
  filtered.forEach(doc => {
    const pid = doc.project != null ? doc.project : extractProjectIdFromUrl(doc.source_file || doc.file_url);
    const pName = (pid != null && projectMap[pid]) ? projectMap[pid] : 'Uncategorized';
    if (!folderMap[pName]) folderMap[pName] = [];
    folderMap[pName].push(doc);
  });
  const folders = Object.entries(folderMap).map(([name, files]) => ({ name, count: files.length }));
  folders.sort((a, b) => b.count - a.count);

  const [fileFilter,       setFileFilter]       = useState('recent');
  const [gridView,         setGridView]         = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Storage mock (replace with real API when available)
  const totalFiles = docs.length;
  const storageUsed = 12.4;
  const storageTotal = 50;
  const storagePercent = (storageUsed / storageTotal) * 100;

  // Filter + sort docs
  const FILE_FILTERS = [
    { key: 'recent', label: 'Recent' },
    { key: 'jpg',    label: 'JPG' },
    { key: 'pdf',    label: 'PDF' },
    { key: 'docx',   label: 'DOCX' },
    { key: 'xlsx',   label: 'XLSX' },
    { key: 'pptx',   label: 'PPTX' },
    { key: 'csv',    label: 'CSV' },
    { key: 'html',   label: 'HTML' },
    { key: 'other',  label: 'Others' },
  ];

  const EXT_GROUPS = {
    jpg:  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'svg'],
    pdf:  ['pdf'],
    docx: ['doc', 'docx', 'rtf', 'txt', 'md'],
    xlsx: ['xls', 'xlsx', 'csv'],
    pptx: ['ppt', 'pptx', 'key'],
    csv:  ['csv'],
    html: ['html', 'htm'],
    other:['zip', 'rar', '7z', 'tar', 'gz', 'mp4', 'mov', 'avi', 'mp3', 'wav', 'js', 'ts', 'py', 'java', 'json', 'xml', 'yml'],
  };

  const sortedDocs = [...filtered]
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    .filter(doc => {
      if (fileFilter === 'recent') return true;
      const ext = getExt(doc.name || doc.file_name || '');
      const group = EXT_GROUPS[fileFilter] || [];
      return group.includes(ext);
    });

  const FOLDER_COLORS = ['#3B72EE', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} translucent={false} />

      {/* ── Navbar ── */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SidebarMenu activeScreen="Docs" />
          <View>
            <Text style={[styles.navTitle, { color: txt }]}>Documents</Text>
            <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>{totalFiles} files</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={{ padding: 6 }} onPress={() => navigation.navigate('Search')}>
            <SearchIcon size={20} color='#3B72EE' />
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor='#3B72EE' />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Storage card ── */}
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <View style={[styles.storageCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' }}>Storage</Text>
              <TouchableOpacity style={styles.upgradeBtn}>
                <Text style={{ fontSize: 12, color: '#3B72EE', fontWeight: '700' }}>Upgrade</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
              {storageUsed} <Text style={{ fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.7)' }}>/ {storageTotal} GB used</Text>
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${storagePercent}%` }]} />
            </View>
          </View>
        </View>

        {/* ── Folders ── */}
        <View style={{ paddingHorizontal: 14, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>Folders</Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '600' }}>See all</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color='#3B72EE' />
          ) : folders.length === 0 ? (
            <Text style={{ color: sub, fontSize: 13 }}>No folders yet</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {folders.slice(0, 4).map((folder, idx) => (
                <TouchableOpacity
                  key={folder.name}
                  style={[styles.folderCard, { backgroundColor: card, borderColor: bdr }]}
                  onPress={() => setProjectFilter(
                    Object.keys(folderMap).find(k => projectMap[k] === folder.name) || 'all'
                  )}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <View style={[styles.folderIcon, { backgroundColor: FOLDER_COLORS[idx % FOLDER_COLORS.length] + '18' }]}>
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke={FOLDER_COLORS[idx % FOLDER_COLORS.length]} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                    </View>
                    <Text style={{ color: sub, fontSize: 18, fontWeight: '300' }}>···</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: txt, marginBottom: 2 }} numberOfLines={1}>{folder.name}</Text>
                  <Text style={{ fontSize: 11, color: sub }}>{folder.count} files</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── All files ── */}
        <View style={{ paddingHorizontal: 14, paddingTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, zIndex: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>All files</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Recent dropdown */}
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  style={[styles.sortBtn, { borderColor: bdr, backgroundColor: card }]}
                  onPress={() => setShowSortDropdown(v => !v)}
                >
                  <Text style={{ fontSize: 12, color: sub, fontWeight: '500' }}>
                    {FILE_FILTERS.find(f => f.key === fileFilter)?.label || 'Recent'} {showSortDropdown ? '▲' : '▾'}
                  </Text>
                </TouchableOpacity>
                {showSortDropdown && (
                  <View style={{
                    position: 'absolute', top: 36, right: 0, zIndex: 100,
                    backgroundColor: card, borderRadius: 12, borderWidth: 1, borderColor: bdr,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12, shadowRadius: 8, elevation: 12,
                    minWidth: 140, overflow: 'hidden',
                  }}>
                    {FILE_FILTERS.map((f, idx) => {
                      const isActive = fileFilter === f.key;
                      return (
                        <TouchableOpacity
                          key={f.key}
                          onPress={() => { setFileFilter(f.key); setShowSortDropdown(false); }}
                          style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 14, paddingVertical: 11,
                            borderBottomWidth: idx < FILE_FILTERS.length - 1 ? StyleSheet.hairlineWidth : 0,
                            borderBottomColor: bdr,
                            backgroundColor: isActive ? '#3B72EE11' : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: isActive ? '600' : '400', color: isActive ? '#3B72EE' : txt }}>
                            {f.label}
                          </Text>
                          {isActive && <Text style={{ color: '#3B72EE', fontSize: 13 }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setGridView(v => !v)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 29, color: sub, lineHeight: 29 }}>{gridView ? '☰' : '⊞'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Dismiss dropdown on outside tap */}
          {showSortDropdown && (
            <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onPress={() => setShowSortDropdown(false)} />
          )}

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color='#3B72EE' />
              <Text style={{ color: sub, marginTop: 10, fontSize: 13 }}>Loading documents…</Text>
            </View>
          ) : sortedDocs.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 36, opacity: 0.2 }}>📄</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: txt, marginTop: 8 }}>No documents</Text>
              <Text style={{ fontSize: 12, color: sub, marginTop: 4 }}>Tap + to upload your first file</Text>
            </View>
          ) : gridView ? (
            // ── Grid view ──
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {sortedDocs.map((item) => {
                const name    = item.name || item.file_name || 'Untitled';
                const fileUrl = item.source_file || item.source_file_url || item.file_url;
                const ext     = getExt(name);
                const meta    = TYPE_META[ext] || FALLBACK_META;
                const isSelected = selectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.gridCard, { backgroundColor: isSelected ? '#EBF1FD' : card, borderColor: isSelected ? '#3B72EE' : bdr }]}
                    onPress={() => isSelecting ? toggleSelect(item.id) : openDoc(item)}
                    onLongPress={() => toggleSelect(item.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.typeBadge, { backgroundColor: meta.bg, width: 44, height: 44, marginBottom: 10 }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: meta.color, letterSpacing: 0.3 }}>
                        {(meta.label || ext?.toUpperCase() || 'FILE').slice(0, 4)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: txt, marginBottom: 3 }} numberOfLines={2}>{name}</Text>
                    <Text style={{ fontSize: 10, color: sub }}>{formatRelative(item.updated_at || item.created_at)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            // ── List view ──
            sortedDocs.map((item) => {
              const name    = item.name || item.file_name || 'Untitled';
              const fileUrl = item.source_file || item.source_file_url || item.file_url;
              const ext     = getExt(name);
              const meta    = TYPE_META[ext] || FALLBACK_META;
              const projectId   = item.project != null ? item.project : extractProjectIdFromUrl(fileUrl);
              const projectName = (projectId != null && projectMap[projectId]) ? projectMap[projectId] : null;
              const isSelected  = selectedIds.has(item.id);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.fileRow, { backgroundColor: isSelected ? '#EBF1FD' : card, borderColor: isSelected ? '#3B72EE' : bdr }]}
                  onPress={() => isSelecting ? toggleSelect(item.id) : openDoc(item)}
                  onLongPress={() => toggleSelect(item.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: meta.color, letterSpacing: 0.3 }}>
                      {(meta.label || ext?.toUpperCase() || 'FILE').slice(0, 4)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: txt, marginBottom: 3 }} numberOfLines={1}>{name}</Text>
                    <Text style={{ fontSize: 12, color: sub }} numberOfLines={1}>
                      {[projectName, item.tags?.[0]?.name].filter(Boolean).join(' / ') || 'No project'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={{ fontSize: 11, color: sub }}>{formatRelative(item.updated_at || item.created_at)}</Text>
                    {item.size && <Text style={{ fontSize: 10, color: sub }}>{(item.size / 1024).toFixed(0)} KB</Text>}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      


      <Modal visible={!!moveModalDoc} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !moving && setMoveModalDoc(null)}>
        <View style={styles.shareOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !moving && setMoveModalDoc(null)} />
          <View style={[styles.shareFloating, { backgroundColor: card, borderColor: bdr }]}>
            <View style={[styles.shareHeader, { borderBottomColor: bdr }]}>
              <Text style={{ fontSize: 16 }}>⇥</Text>
              <Text style={[styles.shareTitle, { color: txt }]}>Move Document</Text>
              <TouchableOpacity onPress={() => !moving && setMoveModalDoc(null)}>
                <Text style={{ color: sub, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <View style={[styles.shareDocName, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
                <Text style={{ fontSize: 13, color: sub }}>Document: </Text>
                <Text style={{ fontSize: 13, color: txt, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {moveModalDoc?.name || moveModalDoc?.file_name}
                </Text>
              </View>
              <Text style={[styles.shareFieldLabel, { color: sub }]}>Move to Project *</Text>
              <TouchableOpacity
                style={[styles.sharePickerBtn, { borderColor: movePickerOpen ? '#2563EB' : bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                onPress={() => setMovePickerOpen(v => !v)}
                disabled={moving}
              >
                <Text style={{ flex: 1, fontSize: 13, color: moveProjectId ? txt : sub }} numberOfLines={1}>
                  {moveProjects.find(p => p.id === moveProjectId)?.name || 'Select a project…'}
                </Text>
                <Text style={{ color: sub, fontSize: 11 }}>{movePickerOpen ? '▲' : '▾'}</Text>
              </TouchableOpacity>
              {movePickerOpen && (
                <View style={[styles.shareDropdown, { backgroundColor: card, borderColor: '#2563EB' }]}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {moveProjects.map(p => {
                      const sel = moveProjectId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.shareUserRow, { borderBottomColor: bdr }, sel && { backgroundColor: isDark ? '#1A203A' : '#EFF6FF' }]}
                          onPress={() => { setMoveProjectId(p.id); setMovePickerOpen(false); }}
                        >
                          <Text style={{ fontSize: 13, color: sel ? '#2563EB' : txt, fontWeight: sel ? '700' : '500', flex: 1 }}>{p.name}</Text>
                          {sel && <Text style={{ color: '#2563EB', fontWeight: '700' }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.shareCancelBtn, { borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]} onPress={() => setMoveModalDoc(null)} disabled={moving}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: sub }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shareConfirmBtn, { backgroundColor: '#2563EB' }, moving && { opacity: 0.6 }]} onPress={moveDocument} disabled={moving || !moveProjectId}>
                  {moving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Move</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Tags Modal ────────────────────────────────────────────────── */}
      <Modal visible={!!tagsModalDoc} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !addingTags && setTagsModalDoc(null)}>
        <View style={styles.shareOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !addingTags && setTagsModalDoc(null)} />
          <View style={[styles.shareFloating, { backgroundColor: card, borderColor: bdr }]}>
            <View style={[styles.shareHeader, { borderBottomColor: bdr }]}>
              <Text style={{ fontSize: 16 }}>🏷</Text>
              <Text style={[styles.shareTitle, { color: txt }]}>Add Tags to {selectedIds.size} Document{selectedIds.size > 1 ? 's' : ''}</Text>
              <TouchableOpacity onPress={() => !addingTags && setTagsModalDoc(null)}>
                <Text style={{ color: sub, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              {/* Search */}
              <View style={[styles.sharePickerBtn, { borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7', marginBottom: 12 }]}>
                <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
                <TextInput
                  style={{ flex: 1, fontSize: 13, color: txt }}
                  placeholder="Search tags…"
                  placeholderTextColor={sub}
                  value={tagSearch}
                  onChangeText={setTagSearch}
                />
              </View>
              {/* Create new label button */}
              <TouchableOpacity style={[styles.createTagBtn, { borderColor: bdr }]} onPress={() => Alert.alert('Create Tag', 'Tag creation coming soon.')}>
                <Text style={{ fontSize: 13, color: sub, fontWeight: '600' }}>+ Create New Label</Text>
              </TouchableOpacity>
              <Text style={[styles.shareFieldLabel, { color: sub, marginTop: 12 }]}>AVAILABLE TAGS</Text>
              {loadingTags ? (
                <ActivityIndicator color="#3B72EE" style={{ marginVertical: 20 }} />
              ) : (
                <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                  {availableTags
                    .filter(t => !tagSearch || (t.name || '').toLowerCase().includes(tagSearch.toLowerCase()))
                    .map(tag => {
                      const sel = selectedTags.includes(tag.id);
                      const color = tag.color || '#6B7280';
                      return (
                        <TouchableOpacity
                          key={tag.id}
                          style={[styles.tagRow, { backgroundColor: color, marginBottom: 8 }]}
                          onPress={() => setSelectedTags(prev => sel ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                        >
                          <View style={[styles.tagCheckbox, { borderColor: '#fff', backgroundColor: sel ? '#fff' : 'transparent' }]}>
                            {sel && <Text style={{ color, fontSize: 10, fontWeight: '800' }}>✓</Text>}
                          </View>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }}>{tag.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  {availableTags.length === 0 && !loadingTags && (
                    <Text style={{ color: sub, textAlign: 'center', padding: 16 }}>No tags found</Text>
                  )}
                </ScrollView>
              )}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.shareCancelBtn, { borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]} onPress={() => setTagsModalDoc(null)} disabled={addingTags}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: sub }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shareConfirmBtn, { backgroundColor: '#7C3AED' }, addingTags && { opacity: 0.6 }]} onPress={applyTags} disabled={addingTags}>
                  {addingTags ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>🏷 Add Tags</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Share Document Modal ─────────────────────────────────────────── */}
      <Modal
        visible={!!shareModalDoc}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !sharing && setShareModalDoc(null)}
      >
        <View style={styles.shareOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !sharing && setShareModalDoc(null)} />
          <View style={[styles.shareFloating, { backgroundColor: card, borderColor: bdr, shadowColor: '#000' }]}>
            {/* Header */}
            <View style={[styles.shareHeader, { borderBottomColor: bdr }]}>
              <Text style={{ fontSize: 16 }}>⤴</Text>
              <Text style={[styles.shareTitle, { color: txt }]}>Share Document</Text>
              <TouchableOpacity onPress={() => !sharing && setShareModalDoc(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: sub, fontSize: 18, fontWeight: '300' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              {/* Doc name */}
              <View style={[styles.shareDocName, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
                <Text style={{ fontSize: 13, color: sub }}>Sharing: </Text>
                <Text style={{ fontSize: 13, color: txt, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {shareModalDoc?.name || shareModalDoc?.file_name || 'Document'}
                </Text>
              </View>

              {/* Currently shared with */}
              {(sharedWithMap[shareModalDoc?.id] || []).length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.shareFieldLabel, { color: sub }]}>
                    CURRENTLY SHARED WITH ({sharedWithMap[shareModalDoc?.id]?.length})
                  </Text>
                  <View style={[{ borderRadius: 10, borderWidth: 1, borderColor: bdr, overflow: 'hidden' }]}>
                    {(sharedWithMap[shareModalDoc?.id] || []).map((s, i) => {
                      const sName = s.user?.full_name || s.user?.username || s.full_name || s.username || 'User';
                      return (
                        <View
                          key={s.id || i}
                          style={[styles.shareUserRow, { borderBottomColor: bdr }, i === sharedWithMap[shareModalDoc?.id].length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={[styles.shareUserAvatar, { backgroundColor: '#3B72EE' }]}>
                            <Text style={styles.shareUserAvatarTxt}>{sName[0]?.toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: txt, fontWeight: '600' }}>{sName}</Text>
                            {(s.user?.username || s.username) && (
                              <Text style={{ fontSize: 11, color: sub }}>{s.user?.username || s.username}</Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={[styles.revokeBtn, { borderColor: '#EF4444' }]}
                            onPress={() => revokeShare(shareModalDoc?.id, s)}
                          >
                            <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>🗑 Revoke</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Select user to share with */}
              <Text style={[styles.shareFieldLabel, { color: sub }]}>Select User *</Text>
              <TouchableOpacity
                style={[styles.sharePickerBtn, { borderColor: shareUserOpen ? '#3B72EE' : bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                onPress={() => setShareUserOpen(v => !v)}
                disabled={sharing}
              >
                <Text style={{ flex: 1, fontSize: 13, color: shareUserId ? txt : sub }} numberOfLines={1}>
                  {users.find(u => u.id === shareUserId)?.full_name ||
                   users.find(u => u.id === shareUserId)?.name ||
                   users.find(u => u.id === shareUserId)?.username || 'Click to select a user…'}
                </Text>
                <Text style={{ color: sub, fontSize: 11 }}>{shareUserOpen ? '▲' : '▾'}</Text>
              </TouchableOpacity>

              {/* User dropdown */}
              {shareUserOpen && (
                <View style={[styles.shareDropdown, { backgroundColor: card, borderColor: '#3B72EE', shadowColor: '#000' }]}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {users.map(u => {
                      const uName = u.full_name || u.name || u.username || 'User';
                      const selected = shareUserId === u.id;
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[
                            styles.shareUserRow,
                            { borderBottomColor: bdr },
                            selected && { backgroundColor: isDark ? '#1A2E2E' : '#F0FFFE' },
                          ]}
                          onPress={() => { setShareUserId(u.id); setShareUserOpen(false); }}
                        >
                          <View style={[styles.shareUserAvatar, { backgroundColor: '#3B72EE' }]}>
                            <Text style={styles.shareUserAvatarTxt}>{uName[0]?.toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: selected ? '#3B72EE' : txt, fontWeight: selected ? '700' : '500' }}>
                              {uName}
                            </Text>
                            {u.email && <Text style={{ fontSize: 11, color: sub }}>{u.email}</Text>}
                          </View>
                          {selected && <Text style={{ color: '#3B72EE', fontWeight: '700' }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.shareCancelBtn, { borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                  onPress={() => { setShareModalDoc(null); setShareUserId(null); setShareUserOpen(false); }}
                  disabled={sharing}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: sub }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareConfirmBtn, sharing && { opacity: 0.6 }]}
                  onPress={() => shareDocument(shareModalDoc, shareUserId)}
                  disabled={sharing || !shareUserId}
                >
                  {sharing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Share</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Upload / New Document Modal ─────────────────────────────────── */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !uploading && setUploadModalVisible(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => !uploading && setUploadModalVisible(false)}
        >
          <Pressable
            style={[styles.uploadSheet, { backgroundColor: card, borderColor: bdr }]}
            onPress={() => {}}
          >
            {/* Header */}
            <View style={[styles.pickerHeader, { borderBottomColor: bdr }]}>
              <Text style={[styles.pickerTitle, { color: txt, fontSize: fs(16) }]}>Upload Document</Text>
              <TouchableOpacity onPress={() => !uploading && setUploadModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: sub, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">

              {/* File picker area */}
              <Text style={[styles.uploadLabel, { color: sub }]}>File</Text>
              <TouchableOpacity
                style={[styles.filePicker, { borderColor: uploadFile ? '#3B72EE' : bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                onPress={pickDocument}
                activeOpacity={0.7}
                disabled={uploading}
              >
                {uploadFile ? (
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: fs(13), fontWeight: '600', color: txt }]} numberOfLines={1}>
                      📄 {uploadFile.name}
                    </Text>
                    {uploadFile.size && (
                      <Text style={[{ fontSize: fs(11), color: sub, marginTop: 2 }]}>
                        {(uploadFile.size / 1024).toFixed(1)} KB
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 32 }}>📁</Text>
                    <Text style={[{ fontSize: fs(13), fontWeight: '600', color: sub }]}>Tap to choose a file</Text>
                    <Text style={[{ fontSize: fs(11), color: isDark ? '#5C5C6E' : '#AAAABC' }]}>
                      PDF, DOCX, XLSX, PPTX, images, and more
                    </Text>
                  </View>
                )}
                {uploadFile && (
                  <TouchableOpacity
                    onPress={() => setUploadFile(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 8 }}
                  >
                    <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Project selector */}
              <Text style={[styles.uploadLabel, { color: sub, marginTop: 14 }]}>Project *</Text>
              <TouchableOpacity
                style={[styles.projectSelector, { borderColor: uploadPickerOpen ? '#3B72EE' : bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                onPress={() => setUploadPickerOpen(o => !o)}
                activeOpacity={0.7}
                disabled={uploading}
              >
                <Text style={[{ flex: 1, fontSize: fs(13), fontWeight: '600', color: uploadProjectId ? txt : sub }]} numberOfLines={1}>
                  {uploadProjects.find(p => p.id === uploadProjectId)?.name || 'Select project…'}
                </Text>
                <Text style={{ color: sub, fontSize: 12 }}>{uploadPickerOpen ? '▲' : '▾'}</Text>
              </TouchableOpacity>

              {/* Project dropdown */}
              {uploadPickerOpen && (
                <View style={[styles.uploadDropdown, { backgroundColor: card, borderColor: '#3B72EE' }]}>
                  {/* Search */}
                  <View style={[styles.uploadDropdownSearch, { borderBottomColor: bdr }]}>
                    <Text style={{ fontSize: 12, marginRight: 6 }}>🔍</Text>
                    <TextInput
                      style={[{ flex: 1, fontSize: fs(13), color: txt }]}
                      placeholder="Search projects…"
                      placeholderTextColor={sub}
                      value={uploadProjectSearch}
                      onChangeText={setUploadProjectSearch}
                      autoCapitalize="none"
                    />
                  </View>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredUploadProjects.length === 0 ? (
                      <Text style={[{ fontSize: fs(12), color: sub, padding: 14, textAlign: 'center', fontStyle: 'italic' }]}>No projects found</Text>
                    ) : (
                      filteredUploadProjects.map(p => {
                        const active = p.id === uploadProjectId;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.uploadDropdownItem, { borderBottomColor: bdr }, active && { backgroundColor: isDark ? '#252530' : '#F0FDF4' }]}
                            onPress={() => { setUploadProjectId(p.id); setUploadPickerOpen(false); setUploadProjectSearch(''); }}
                          >
                            <Text style={[{ flex: 1, fontSize: fs(13), color: active ? '#3B72EE' : txt, fontWeight: active ? '700' : '500' }]} numberOfLines={1}>
                              {p.name}
                            </Text>
                            {active && <Text style={{ color: '#3B72EE', fontSize: 14 }}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Info box */}
              <View style={[styles.uploadInfo, { borderColor: 'rgba(78,205,196,0.3)', backgroundColor: 'rgba(78,205,196,0.06)' }]}>
                <Text style={{ fontSize: fs(12), color: '#3B72EE', lineHeight: 18 }}>
                  💾  File will be uploaded and linked to the selected project. It will appear in the Documents list immediately.
                </Text>
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 24 }}>
                <TouchableOpacity
                  style={[styles.uploadCancelBtn, { borderColor: bdr }]}
                  onPress={() => setUploadModalVisible(false)}
                  disabled={uploading}
                >
                  <Text style={[{ fontSize: fs(14), fontWeight: '600', color: sub }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadSubmitBtn, (!uploadFile || !uploadProjectId || uploading) && { opacity: 0.6 }]}
                  onPress={submitUpload}
                  disabled={!uploadFile || !uploadProjectId || uploading}
                >
                  {uploading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontSize: fs(14), fontWeight: '700' }}>⬆ Upload</Text>
                  }
                </TouchableOpacity>
              </View>

            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Document Detail Panel ─────────────────────────────────────────── */}
      {detailDoc && (
        <Modal
          visible={!!detailDoc}
          transparent={false}
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => { setDetailDoc(null); setShowWebView(false); setShowInfo(false); }}
        >
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />
          <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right', 'bottom']}>

            {/* ── Header ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}>
              <TouchableOpacity onPress={() => { setDetailDoc(null); setShowWebView(false); setShowInfo(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: '#3B72EE', fontSize: 18 }}>‹</Text>
                <Text style={{ color: '#3B72EE', fontSize: 14, fontWeight: '600' }}>Back</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 14, fontWeight: '600', color: txt, flex: 1, textAlign: 'center', marginHorizontal: 12 }} numberOfLines={1}>
                {detailDoc?.name || detailDoc?.file_name || 'Document'}
              </Text>
              <TouchableOpacity
                onPress={() => { const url = detailDoc?.source_file || detailDoc?.source_file_url || detailDoc?.file_url; if (url) Linking.openURL(url).catch(() => {}); }}
                style={{ padding: 4 }}
              >
                <Text style={{ color: '#3B72EE', fontSize: 13, fontWeight: '600' }}>Open ↗</Text>
              </TouchableOpacity>
            </View>

            {showWebView ? (
              /* ── Preview ── */
              (() => {
                const url = detailDoc?.source_file || detailDoc?.source_file_url || detailDoc?.file_url;
                const ext = getExt(detailDoc?.name || '');
                const isImage  = ['png','jpg','jpeg','gif','webp','heic','bmp'].includes(ext);
                const isPdf    = ext === 'pdf';
                const isOffice = ['doc','docx','ppt','pptx','xls','xlsx'].includes(ext);
                const canPreview = isPdf || isOffice;
                const viewUrl = canPreview && url ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` : null;
                if (isImage) return (
                  <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                );
                if (canPreview && viewUrl) return (
                  <WebView source={{ uri: viewUrl }} style={{ flex: 1 }} startInLoadingState
                    renderLoading={() => <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#3B72EE" /></View>}
                    onError={() => setShowWebView(false)} />
                );
                return (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 32 }}>
                    <Text style={{ fontSize: 48, opacity: 0.3 }}>📄</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>Preview not available</Text>
                    <Text style={{ fontSize: 13, color: sub, textAlign: 'center', lineHeight: 20 }}>
                      {ext.toUpperCase()} files cannot be previewed in-app.
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: '#3B72EE', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
                      onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}
                    >
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Open in Browser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowWebView(false)}>
                      <Text style={{ color: sub, fontSize: 13 }}>← Back to details</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()
            ) : (
              /* ── Detail info ── */
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* File card */}
                <View style={{ backgroundColor: card, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: bdr, overflow: 'hidden', marginBottom: 16 }}>
                  {/* Top — icon + name */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
                    {(() => {
                      const ext = getExt(detailDoc?.name || '');
                      const meta = TYPE_META[ext] || FALLBACK_META;
                      return (
                        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: meta.bg, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: meta.color, letterSpacing: 0.3 }}>
                            {(meta.label || ext.toUpperCase() || 'FILE').slice(0, 4)}
                          </Text>
                        </View>
                      );
                    })()}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: txt, marginBottom: 3 }} numberOfLines={2}>
                        {detailDoc?.name || detailDoc?.file_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: sub }}>
                        {getExt(detailDoc?.name || '').toUpperCase()} file
                      </Text>
                    </View>
                  </View>

                  {/* Meta rows */}
                  {[
                    { label: 'Type',     value: getExt(detailDoc?.name || '').toUpperCase() || '—' },
                    { label: 'Status',   value: detailDoc?.status ? detailDoc.status.replace('_', ' ').toUpperCase() : 'DRAFT' },
                    { label: 'Project',  value: projectMap[detailDoc?.project] || '—' },
                    { label: 'Owner',    value: detailDoc?.created_by?.full_name || detailDoc?.created_by?.username || '—' },
                    { label: 'Created',  value: detailDoc?.created_at ? new Date(detailDoc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                    { label: 'Updated',  value: detailDoc?.updated_at ? new Date(detailDoc.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                    { label: 'Location', value: `/ ${projectMap[detailDoc?.project] || 'Documents'}` },
                  ].map(({ label, value }, i) => (
                    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: bdr }}>
                      <Text style={{ fontSize: 13, color: sub, fontWeight: '500', width: 80 }}>{label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: txt, flex: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}

                  {/* Tags */}
                  {(detailDoc?.tags || []).length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: bdr }}>
                      <Text style={{ fontSize: 13, color: sub, fontWeight: '500', width: 80 }}>Tags</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
                        {(detailDoc.tags || []).map((tag, i) => (
                          <View key={i} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: (tag.color || '#6B7280') + '22' }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: tag.color || '#6B7280' }}>{tag.name || tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Action buttons */}
                <TouchableOpacity
                  style={{ backgroundColor: '#3B72EE', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 }}
                  onPress={() => setShowWebView(true)}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Open Document</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: bdr, backgroundColor: card }}
                  onPress={() => {
                    const url = detailDoc?.source_file || detailDoc?.source_file_url || detailDoc?.file_url;
                    if (url) Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open URL.'));
                    else Alert.alert('Unavailable', 'No URL available for this document.');
                  }}
                >
                  <Text style={{ color: sub, fontSize: 14, fontWeight: '600' }}>🌐  Open in Browser</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1,
  },
  navTitle: { fontWeight: '700', fontSize: 17 },

  // Storage card
  storageCard: {
    backgroundColor: '#3B72EE', borderRadius: 16,
    padding: 18,
  },
  upgradeBtn: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 10, overflow: 'hidden',
  },
  progressFill: {
    height: 6, borderRadius: 3,
    backgroundColor: '#fff',
  },

  // Folders
  folderCard: {
    width: '47.5%', borderRadius: 14,
    borderWidth: 1, padding: 14,
  },
  folderIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },

  // Sort
  sortBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },

  // File rows
  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
    borderRadius: 12, borderWidth: 1,
    marginBottom: 10,
  },
  typeBadge: {
    width: 46, height: 46, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },

  // Grid card
  gridCard: {
    width: '47.5%', borderRadius: 12,
    borderWidth: 1, padding: 12,
    marginBottom: 0,
  },

});
