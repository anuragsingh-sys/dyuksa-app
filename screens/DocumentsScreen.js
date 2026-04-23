import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, Platform, ScrollView, ActivityIndicator,
  Linking, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken } from '../services/ApiService';

const DOCS_API = 'http://192.168.1.164:8000/api/v1/documents/all/';

// File type → icon + color mapping
const TYPE_META = {
  // Images
  png:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  jpg:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  jpeg: { icon: '🖼️', color: '#A78BFA', group: 'image' },
  gif:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  webp: { icon: '🖼️', color: '#A78BFA', group: 'image' },
  svg:  { icon: '🖼️', color: '#A78BFA', group: 'image' },
  // Documents
  pdf:  { icon: '📕', color: '#EF4444', group: 'document' },
  doc:  { icon: '📘', color: '#3B82F6', group: 'document' },
  docx: { icon: '📘', color: '#3B82F6', group: 'document' },
  xls:  { icon: '📗', color: '#4ADE80', group: 'document' },
  xlsx: { icon: '📗', color: '#4ADE80', group: 'document' },
  csv:  { icon: '📗', color: '#4ADE80', group: 'document' },
  ppt:  { icon: '📙', color: '#F97316', group: 'document' },
  pptx: { icon: '📙', color: '#F97316', group: 'document' },
  txt:  { icon: '📄', color: '#9898A6', group: 'document' },
  // Code
  js:   { icon: '💻', color: '#FBBF24', group: 'code' },
  ts:   { icon: '💻', color: '#3B82F6', group: 'code' },
  tsx:  { icon: '💻', color: '#4ECDC4', group: 'code' },
  jsx:  { icon: '💻', color: '#4ECDC4', group: 'code' },
  py:   { icon: '💻', color: '#4ADE80', group: 'code' },
  json: { icon: '💻', color: '#FBBF24', group: 'code' },
  // Archives
  zip:  { icon: '📦', color: '#888899', group: 'other' },
  rar:  { icon: '📦', color: '#888899', group: 'other' },
  '7z': { icon: '📦', color: '#888899', group: 'other' },
  // Video
  mp4:  { icon: '🎬', color: '#F472B6', group: 'other' },
  mov:  { icon: '🎬', color: '#F472B6', group: 'other' },
  avi:  { icon: '🎬', color: '#F472B6', group: 'other' },
};

const FALLBACK_META = { icon: '📄', color: '#9898A6', group: 'other' };

// Type groups for filter pills
const TYPE_GROUPS = [
  { id: 'all',      label: 'All Types' },
  { id: 'image',    label: 'Images' },
  { id: 'document', label: 'Documents' },
  { id: 'code',     label: 'Code' },
  { id: 'other',    label: 'Other' },
];

const SOURCE_GROUPS = [
  { id: 'all',     label: 'All' },
  { id: 'Project', label: 'Project' },
  { id: 'Task',    label: 'Task' },
];

// Extract file extension (lowercase), handling multi-dot filenames
const getExt = (name) => {
  if (!name) return '';
  const parts = name.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase().trim();
};

// Extract project ID from S3 URL path like:
// .../projects/63/documents/... → "63"
// .../task_documents/task_490/... → null (it's a task doc)
const extractProjectId = (fileUrl) => {
  if (!fileUrl) return null;
  const m = fileUrl.match(/\/projects\/(\d+)\//);
  return m ? m[1] : null;
};

// Pretty relative date
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

  const [docs,       setDocs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');   // all / image / document / code / other
  const [sourceFilter, setSourceFilter] = useState('all'); // all / Project / Task

  // ── Fetch all documents from backend ──
  const fetchDocs = useCallback(async () => {
    try {
      setError(null);
      const token = await getAccessToken();
      const res = await fetch(DOCS_API, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Error ${res.status}`);
      }
      const data = await res.json();
      // Backend returns { message, total_files, documents: [...] }
      const list = Array.isArray(data.documents) ? data.documents : [];
      setDocs(list);
    } catch (err) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchDocs(); }, [fetchDocs]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocs();
  };

  // ── Open document in native viewer / browser ──
  const openDoc = async (doc) => {
    if (!doc.file_url) {
      Alert.alert('Unavailable', 'This document does not have a viewable URL.');
      return;
    }
    try {
      const supported = await Linking.canOpenURL(doc.file_url);
      if (supported) {
        await Linking.openURL(doc.file_url);
      } else {
        Alert.alert('Cannot open', 'Your device cannot open this file type.');
      }
    } catch {
      Alert.alert('Error', 'Unable to open document.');
    }
  };

  // ── Filter + search logic ──
  const filtered = docs.filter(d => {
    // Search match
    const q = search.trim().toLowerCase();
    if (q && !(d.file_name || '').toLowerCase().includes(q)) return false;
    // Type filter
    if (typeFilter !== 'all') {
      const ext = getExt(d.file_name);
      const group = (TYPE_META[ext] || FALLBACK_META).group;
      if (group !== typeFilter) return false;
    }
    // Source filter
    if (sourceFilter !== 'all' && d.source !== sourceFilter) return false;
    return true;
  });

  // ── Render row ──
  const renderItem = ({ item }) => {
    const ext = getExt(item.file_name);
    const meta = TYPE_META[ext] || FALLBACK_META;
    const displayExt = ext ? ext.toUpperCase() : 'FILE';
    const projectId = extractProjectId(item.file_url);

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
            {item.file_name}
          </Text>
          <View style={styles.metaRow}>
            {/* Type pill */}
            <View style={[styles.typePill, { backgroundColor: meta.color + '22' }]}>
              <Text style={[styles.typePillText, { color: meta.color, fontSize: fs(9) }]}>
                {displayExt}
              </Text>
            </View>
            {/* Source pill */}
            <View style={[styles.sourcePill, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
              <Text style={[styles.sourcePillText, { color: sub, fontSize: fs(9) }]}>
                {item.source === 'Task' ? `Task${item.task_id ? ` #${item.task_id}` : ''}` : 'Project'}
                {projectId ? ` · ${projectId}` : ''}
              </Text>
            </View>
          </View>
          {item.task_heading ? (
            <Text
              style={[styles.taskHeading, { color: sub, fontSize: fs(10) }]}
              numberOfLines={1}
            >
              📋 {item.task_heading}
            </Text>
          ) : null}
          <Text style={[styles.dateText, { color: sub, fontSize: fs(10) }]}>
            {formatRelative(item.updated_at || item.uploaded_at)}
          </Text>
        </View>

        {/* Chevron */}
        <Text style={{ color: sub, fontSize: 18 }}>›</Text>
      </TouchableOpacity>
    );
  };

  // ── Chip helper ──
  const Chip = ({ id, label, active, onPress, color }) => (
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
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Docs" />
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>D</Text>
          </View>
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

      {/* Type filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 10, maxHeight: 40 }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
      >
        {TYPE_GROUPS.map(g => (
          <Chip
            key={g.id}
            label={g.label}
            active={typeFilter === g.id}
            onPress={() => setTypeFilter(g.id)}
          />
        ))}
      </ScrollView>

      {/* Source filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 6, maxHeight: 40 }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
      >
        {SOURCE_GROUPS.map(g => (
          <Chip
            key={g.id}
            label={g.label}
            active={sourceFilter === g.id}
            onPress={() => setSourceFilter(g.id)}
          />
        ))}
      </ScrollView>

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
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchDocs(); }}>
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
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
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
  metaRow:  { flexDirection: 'row', gap: 6, marginBottom: 4 },
  typePill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontWeight: '700', letterSpacing: 0.3 },
  sourcePill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  sourcePillText: { fontWeight: '600' },
  taskHeading: { marginBottom: 2 },
  dateText:    {},

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
});
