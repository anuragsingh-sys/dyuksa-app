import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, Platform, ScrollView, ActivityIndicator,
  Linking, RefreshControl, Alert, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';

// DocumentPicker — loaded lazily so screen still works if package isn't installed
let DocumentPicker = null;
try { DocumentPicker = require('expo-document-picker'); } catch {}

const API_BASE     = 'http://192.168.1.164:8000';
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

export default function DocumentsScreen() {
  const navigation = useNavigation();
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
  const [projectFilter,setProjectFilter]= useState('all'); // 'all' | numeric project id (as string)
  const [pickerOpen,   setPickerOpen]   = useState(null);  // null | 'type' | 'project'

  // ── Upload modal state ──
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

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // ── Open file in native viewer / browser ──
  const openDoc = async (doc) => {
    const url = doc.source_file || doc.source_file_url || doc.file_url;
    if (!url) {
      Alert.alert('Unavailable', 'This document does not have a viewable URL.');
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot open', 'Your device cannot open this file type.');
      }
    } catch {
      Alert.alert('Error', 'Unable to open document.');
    }
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

    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: card, borderColor: bdr }]}
        onPress={() => openDoc(item)}
        activeOpacity={0.7}
      >
        {/* File icon — matches webpage style */}
        <FileIcon ext={ext} meta={meta} />

        {/* Main content */}
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text
            style={[styles.fileName, { color: txt, fontSize: fs(13) }]}
            numberOfLines={1}
          >
            {name}
          </Text>

          {/* Pills: project + type + task + status */}
          <View style={styles.metaRow}>
            {/* Project pill */}
            <View style={[styles.projectPill, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
              <Text style={[styles.projectPillText, { color: sub, fontSize: fs(9) }]} numberOfLines={1}>
                {projectName}
              </Text>
            </View>
            {/* Task pill (when applicable) */}
            {taskId != null && (
              <View style={[styles.taskPill, { backgroundColor: isDark ? '#1F3F4F' : '#CFFAFE' }]}>
                <Text style={[styles.taskPillText, { color: '#06B6D4', fontSize: fs(9) }]}>
                  Task #{taskId}
                </Text>
              </View>
            )}
            {/* Status pill */}
            {status === 'draft' && (
              <View style={styles.draftPill}>
                <Text style={[styles.draftPillText, { fontSize: fs(9) }]}>DRAFT</Text>
              </View>
            )}
          </View>

          {/* Date + Shared-by row */}
          <View style={styles.bottomRow}>
            <Text style={[styles.dateText, { color: sub, fontSize: fs(10) }]}>
              {formatRelative(item.updated_at || item.created_at || item.uploaded_at)}
            </Text>
            <Text style={[styles.dotSep, { color: sub, fontSize: fs(10) }]}>·</Text>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(creatorName) }]}>
              <Text style={styles.avatarText}>{getInitials(creatorName)}</Text>
            </View>
            <Text
              style={[styles.sharedByText, { color: sub, fontSize: fs(10) }]}
              numberOfLines={1}
            >
              {creatorName}
            </Text>
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
        active && { backgroundColor: isDark ? '#4ECDC4' : '#1A1A2E', borderColor: isDark ? '#4ECDC4' : '#1A1A2E' },
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Docs" />
          <TouchableOpacity
            style={styles.logoBox}
            onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}
            activeOpacity={0.7}
          >
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={[styles.brandName, { color: txt, fontSize: fs(15) }]}>Documents</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={[styles.navIconBtn, { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr }]}>
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Sub header with count + action buttons */}
      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: txt, fontSize: fs(17) }]}>All Documents</Text>
          <Text style={[styles.pageSub, { color: sub, fontSize: fs(12) }]}>
            {loading ? 'Loading…' : `${filtered.length} of ${docs.length} document${docs.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.uploadBtn, { borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
            onPress={openUploadModal}
            activeOpacity={0.7}
          >
            <Text style={[styles.uploadBtnText, { color: txt }]}>⬆ Upload</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newDocBtn}
            onPress={openUploadModal}
            activeOpacity={0.7}
          >
            <Text style={styles.newDocBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <View style={[styles.searchWrap, { backgroundColor: card, borderColor: bdr }]}>
          <Text style={{ marginRight: 6, fontSize: 14 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: txt, fontSize: fs(13) }]}
            placeholder="Search documents..."
            placeholderTextColor={sub}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: sub, fontSize: 14, paddingHorizontal: 6 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter dropdowns: All Projects / All Types */}
      <View style={styles.dropdownRow}>
        <TouchableOpacity
          onPress={() => setPickerOpen('project')}
          activeOpacity={0.7}
          style={[styles.dropdownBtn, { backgroundColor: card, borderColor: bdr }]}
        >
          <Text
            style={[styles.dropdownText, { color: projectFilter === 'all' ? sub : txt, fontSize: fs(13) }]}
            numberOfLines={1}
          >
            {currentProjectLabel}
          </Text>
          <Text style={[styles.dropdownCaret, { color: sub }]}>▾</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setPickerOpen('type')}
          activeOpacity={0.7}
          style={[styles.dropdownBtn, { backgroundColor: card, borderColor: bdr }]}
        >
          <Text
            style={[styles.dropdownText, { color: typeFilter === 'all' ? sub : txt, fontSize: fs(13) }]}
            numberOfLines={1}
          >
            {currentTypeLabel}
          </Text>
          <Text style={[styles.dropdownCaret, { color: sub }]}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* List / loading / empty / error */}
      {loading && docs.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={[styles.emptySub, { color: sub, marginTop: 12 }]}>Loading documents…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={{ fontSize: 40, opacity: 0.4 }}>⚠️</Text>
          <Text style={[styles.emptyTitle, { color: txt }]}>Couldn't load documents</Text>
          <Text style={[styles.emptySub, { color: sub, textAlign: 'center', marginTop: 4 }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); loadAll(); }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={{ fontSize: 52, opacity: 0.3 }}>📄</Text>
          <Text style={[styles.emptyTitle, { color: txt }]}>
            {docs.length === 0 ? 'No documents yet' : 'No matching documents'}
          </Text>
          <Text style={[styles.emptySub, { color: sub }]}>
            {docs.length === 0
              ? 'Upload files from inside any project to see them here.'
              : 'Try changing filters or search terms.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => String(item.id) + '_' + idx}
          contentContainerStyle={{ padding: 12, paddingBottom: 110 }}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4ECDC4"
              colors={['#4ECDC4']}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Picker modal (project / type) */}
      <Modal
        visible={pickerOpen !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(null)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(null)}>
          <Pressable
            style={[styles.pickerSheet, { backgroundColor: card, borderColor: bdr }]}
            onPress={() => { /* swallow */ }}
          >
            <View style={[styles.pickerHeader, { borderBottomColor: bdr }]}>
              <Text style={[styles.pickerTitle, { color: txt, fontSize: fs(15) }]}>
                {pickerOpen === 'project' ? 'Filter by project' : 'Filter by type'}
              </Text>
              <TouchableOpacity onPress={() => setPickerOpen(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: sub, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {(pickerOpen === 'project' ? projectOptions : TYPE_GROUPS).map(opt => {
                const active = pickerOpen === 'project'
                  ? projectFilter === opt.id
                  : typeFilter === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.pickerRow,
                      { borderBottomColor: bdr },
                      active && { backgroundColor: isDark ? '#252530' : '#F5F5F7' },
                    ]}
                    onPress={() => {
                      if (pickerOpen === 'project') setProjectFilter(opt.id);
                      else setTypeFilter(opt.id);
                      setPickerOpen(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pickerRowText,
                        { color: active ? (isDark ? '#4ECDC4' : '#1A1A2E') : txt, fontSize: fs(14) },
                        active && { fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                    {active && <Text style={{ color: isDark ? '#4ECDC4' : '#1A1A2E', fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
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
                style={[styles.filePicker, { borderColor: uploadFile ? '#4ECDC4' : bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
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
                style={[styles.projectSelector, { borderColor: uploadPickerOpen ? '#4ECDC4' : bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
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
                <View style={[styles.uploadDropdown, { backgroundColor: card, borderColor: '#4ECDC4' }]}>
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
                            <Text style={[{ flex: 1, fontSize: fs(13), color: active ? '#4ECDC4' : txt, fontWeight: active ? '700' : '500' }]} numberOfLines={1}>
                              {p.name}
                            </Text>
                            {active && <Text style={{ color: '#4ECDC4', fontSize: 14 }}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Info box */}
              <View style={[styles.uploadInfo, { borderColor: 'rgba(78,205,196,0.3)', backgroundColor: 'rgba(78,205,196,0.06)' }]}>
                <Text style={{ fontSize: fs(12), color: '#4ECDC4', lineHeight: 18 }}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Navbar
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2,
  },
  navLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox:  { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName:{ fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  navIcon: { fontSize: 16 },

  // Sub header
  subHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  pageTitle: { fontWeight: '700' },
  pageSub: { marginTop: 2 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, paddingVertical: 0 },

  // Chips
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    height: 30, justifyContent: 'center', alignItems: 'center',
  },
  chipText: { fontSize: 12, fontWeight: '500' },

  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 12, borderWidth: 1, gap: 12,
  },
  iconTile: { width: 48, height: 58, flexShrink: 0 }, // kept for spacing reference only
  fileName: { fontWeight: '600', marginBottom: 4 },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  projectPill: {
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, maxWidth: 140,
  },
  projectPillText: { fontWeight: '600' },
  typePill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontWeight: '700', letterSpacing: 0.3 },
  taskPill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  taskPillText: { fontWeight: '600' },
  draftPill: {
    backgroundColor: '#FEF3C7', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  draftPillText: { color: '#92400E', fontWeight: '700', letterSpacing: 0.5 },

  // Bottom row: date · avatar · shared-by name
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dateText:    {},
  dotSep:      { marginHorizontal: 6 },
  avatar: {
    width: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 5,
  },
  avatarText:  { fontSize: 8, fontWeight: '700', color: '#FFFFFF' },
  sharedByText:{ flexShrink: 1 },

  // Empty / loading / error states
  centerState: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub:   { fontSize: 13 },
  retryBtn: {
    marginTop: 16, backgroundColor: '#4ECDC4',
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8,
  },
  retryBtnText: { color: '#0D0D0F', fontSize: 14, fontWeight: '700' },

  // Dropdown row (replaces chip rows)
  dropdownRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  dropdownText: { flex: 1, fontWeight: '600', marginRight: 8 },
  dropdownCaret: { fontSize: 12 },

  // Picker modal
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerSheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pickerTitle: { fontWeight: '700' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowText: { flex: 1, marginRight: 8 },

  // ── Upload button styles (sub-header) ──
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1,
  },
  uploadBtnText: { fontSize: 12, fontWeight: '600' },
  newDocBtn: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8,
  },
  newDocBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ── Upload modal styles ──
  uploadSheet: {
    width: '100%', maxWidth: 440,
    borderRadius: 16, borderWidth: 1,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  uploadLabel: {
    fontSize: 12, fontWeight: '600',
    marginBottom: 6, letterSpacing: 0.3,
  },
  filePicker: {
    minHeight: 90,
    borderWidth: 1.5, borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 10,
  },
  projectSelector: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 14, height: 46,
  },
  uploadDropdown: {
    borderWidth: 1.5, borderRadius: 10,
    marginTop: 4, marginBottom: 8,
    overflow: 'hidden',
  },
  uploadDropdownSearch: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  uploadDropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  uploadInfo: {
    borderWidth: 1, borderRadius: 10,
    padding: 12, marginTop: 14, marginBottom: 16,
  },
  uploadCancelBtn: {
    flex: 1, height: 48, borderWidth: 1,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  uploadSubmitBtn: {
    flex: 1, height: 48,
    backgroundColor: '#1A1A2E',
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
});
