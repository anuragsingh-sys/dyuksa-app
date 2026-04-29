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
import { getAccessToken } from '../services/ApiService';

const API_BASE     = 'http://192.168.1.164:8000';
const DOCS_API     = `${API_BASE}/api/v1/documents/`;
const PROJECTS_API = `${API_BASE}/api/v1/projects/`;

// ─────────────────────────────────────────────────────────────
// File type → icon + colour mapping
// ─────────────────────────────────────────────────────────────
const TYPE_META = {
  // Images
  png:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  jpg:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  jpeg: { icon: '🖼️', color: '#A78BFA', group: 'image' },
  gif:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  webp: { icon: '🖼️', color: '#A78BFA', group: 'image' },
  svg:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  heic: { icon: '🖼️', color: '#A78BFA', group: 'image' },
  bmp:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  // Documents
  pdf:  { icon: '📕', color: '#EF4444', group: 'document' },
  doc:  { icon: '📘', color: '#3B82F6', group: 'document' },
  docx: { icon: '📘', color: '#3B82F6', group: 'document' },
  xls:  { icon: '📗', color: '#4ADE80', group: 'document' },
  xlsx: { icon: '📗', color: '#4ADE80', group: 'document' },
  csv:  { icon: '📗', color: '#4ADE80', group: 'document' },
  ppt:  { icon: '📙', color: '#F97316', group: 'document' },
  pptx: { icon: '📙', color: '#F97316', group: 'document' },
  key:  { icon: '📙', color: '#F97316', group: 'document' },
  txt:  { icon: '📄', color: '#9898A6', group: 'document' },
  rtf:  { icon: '📄', color: '#9898A6', group: 'document' },
  // Code
  js:   { icon: '💻', color: '#FBBF24', group: 'code' },
  ts:   { icon: '💻', color: '#3B82F6', group: 'code' },
  tsx:  { icon: '💻', color: '#4ECDC4', group: 'code' },
  jsx:  { icon: '💻', color: '#4ECDC4', group: 'code' },
  py:   { icon: '💻', color: '#4ADE80', group: 'code' },
  java: { icon: '💻', color: '#F97316', group: 'code' },
  html: { icon: '💻', color: '#F97316', group: 'code' },
  css:  { icon: '💻', color: '#3B82F6', group: 'code' },
  json: { icon: '💻', color: '#FBBF24', group: 'code' },
  xml:  { icon: '💻', color: '#FBBF24', group: 'code' },
  yml:  { icon: '💻', color: '#FBBF24', group: 'code' },
  yaml: { icon: '💻', color: '#FBBF24', group: 'code' },
  // Archives
  zip:  { icon: '📦', color: '#888899', group: 'other' },
  rar:  { icon: '📦', color: '#888899', group: 'other' },
  '7z': { icon: '📦', color: '#888899', group: 'other' },
  tar:  { icon: '📦', color: '#888899', group: 'other' },
  gz:   { icon: '📦', color: '#888899', group: 'other' },
  // Video
  mp4:  { icon: '🎬', color: '#F472B6', group: 'other' },
  mov:  { icon: '🎬', color: '#F472B6', group: 'other' },
  avi:  { icon: '🎬', color: '#F472B6', group: 'other' },
  mkv:  { icon: '🎬', color: '#F472B6', group: 'other' },
  webm: { icon: '🎬', color: '#F472B6', group: 'other' },
  // Audio
  mp3:  { icon: '🎵', color: '#8B5CF6', group: 'other' },
  wav:  { icon: '🎵', color: '#8B5CF6', group: 'other' },
  m4a:  { icon: '🎵', color: '#8B5CF6', group: 'other' },
};

const FALLBACK_META = { icon: '📄', color: '#9898A6', group: 'other' };

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

  // ── Fetch all documents (follow `next` pagination) ──
  const fetchDocs = useCallback(async (token) => {
    const all = [];
    let url = DOCS_API;
    let safety = 20; // cap: 20 pages max

    while (url && safety-- > 0) {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
  const fetchProjectMap = useCallback(async (token) => {
    try {
      const res = await fetch(PROJECTS_API, {
        method: 'GET',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
      const token = await getAccessToken();
      const [docsList, projMap] = await Promise.all([
        fetchDocs(token),
        fetchProjectMap(token),
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
        {/* Icon tile */}
        <View style={[styles.iconTile, { backgroundColor: meta.color + '22' }]}>
          <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
        </View>

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
            {/* Type pill */}
            <View style={[styles.typePill, { backgroundColor: meta.color + '22' }]}>
              <Text style={[styles.typePillText, { color: meta.color, fontSize: fs(9) }]}>
                {displayExt}
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

      {/* Sub header with count */}
      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View>
          <Text style={[styles.pageTitle, { color: txt, fontSize: fs(17) }]}>All Documents</Text>
          <Text style={[styles.pageSub, { color: sub, fontSize: fs(12) }]}>
            {loading ? 'Loading…' : `${filtered.length} of ${docs.length} document${docs.length !== 1 ? 's' : ''}`}
          </Text>
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
  iconTile: {
    width: 44, height: 44, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
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
});
