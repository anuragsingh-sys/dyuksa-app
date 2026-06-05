import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken, getWorkspaceId, getProjects } from '../services/ApiService';
import { BASE_URL } from '../config';

const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

const STATUS_COLORS = {
  pending: '#F59E0B', in_progress: '#3B82F6', completed: '#22C55E',
  backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA',
};
const STATUS_LABELS = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed',
  backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review',
};

const QUICK_FILTERS = [
  { label: 'My tasks',       icon: '📋', color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'Due this week',  icon: '📅', color: '#D97706', bg: '#FFFBEB' },
  { label: 'High priority',  icon: '🚨', color: '#9333EA', bg: '#FDF4FF' },
  { label: 'Completed',      icon: '✅', color: '#16A34A', bg: '#F0FDF4' },
  { label: 'In progress',    icon: '⚡', color: '#2563EB', bg: '#EFF6FF' },
];

export default function SearchScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F7F8FB';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#0E1726';
  const sub  = isDark ? '#9898A6' : '#6B7588';
  const bdr  = isDark ? '#252530' : '#E6E9EF';

  const inputRef = useRef(null);
  const [query,    setQuery]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [results,  setResults]  = useState(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [tasksRes, projectsRes, docsRes, usersRes] = await Promise.all([
        fetch(`${BASE_URL}/tasksite/?search=${encodeURIComponent(q)}`, { headers }),
        fetch(`${BASE_URL}/projects/?search=${encodeURIComponent(q)}`, { headers }),
        fetch(`${BASE_URL}/documents/?search=${encodeURIComponent(q)}`, { headers }),
        fetch(`${BASE_URL}/auth/users/?search=${encodeURIComponent(q)}`, { headers }),
      ]);
      const parse = async (res) => {
        if (!res.ok) return [];
        const data = await res.json().catch(() => ({}));
        return Array.isArray(data) ? data : (data.results || []);
      };
      const [tasks, projects, docs, users] = await Promise.all([
        parse(tasksRes), parse(projectsRes), parse(docsRes), parse(usersRes),
      ]);
      setResults({ tasks, projects, docs, users });
    } catch { setResults({ tasks: [], projects: [], docs: [], users: [] }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 400);
    return () => clearTimeout(t);
  }, [query, search]);

  const hasResults = results && (
    results.tasks.length + results.projects.length +
    results.docs.length + results.users.length > 0
  );

  const getDocExt = (name = '') => name.split('.').pop().toUpperCase().slice(0, 4);
  const getInitial = (u) => {
    const n = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || '?';
    return n.charAt(0).toUpperCase();
  };
  const getUserName = (u) => u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'User';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Search navbar */}
      <View style={[s.searchNav, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ color: '#4ECDC4', fontSize: 26, fontWeight: '300', marginTop: -3 }}>‹</Text>
        </TouchableOpacity>
        <View style={[s.searchInputWrap, { backgroundColor: isDark ? '#252530' : '#F7F8FB', borderColor: bdr }]}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={[s.searchInput, { color: txt }]}
            placeholder="Search tasks, projects, docs, people…"
            placeholderTextColor={sub}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[{ color: sub, fontSize: 16, fontWeight: '600' }]}>✕</Text>
            </TouchableOpacity>
          )}
          {loading && <ActivityIndicator size="small" color="#4ECDC4" style={{ marginLeft: 6 }} />}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* No query — show quick filters */}
        {!query.trim() && (
          <>
            <Text style={[s.sectionTitle, { color: txt }]}>Quick Filters</Text>
            <View style={s.quickRow}>
              {QUICK_FILTERS.map((f, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.quickChip, { backgroundColor: isDark ? f.color + '22' : f.bg }]}
                  onPress={() => setQuery(f.label.toLowerCase())}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 14 }}>{f.icon}</Text>
                  <Text style={[s.quickLabel, { color: isDark ? f.color : f.color }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Results */}
        {hasResults && (
          <>
            {/* Tasks */}
            {results.tasks.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>Tasks ({results.tasks.length})</Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {results.tasks.slice(0, 5).map((t, i) => {
                    const sc = STATUS_COLORS[t.status] || '#888';
                    const sl = STATUS_LABELS[t.status] || t.status;
                    return (
                      <TouchableOpacity
                        key={t.id || i}
                        onPress={() => navigation.navigate('TaskDetail', { taskId: t.id, task: t })}
                        style={[s.resultRow, i < Math.min(results.tasks.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                        activeOpacity={0.7}
                      >
                        <View style={[s.resultIcon, { backgroundColor: sc + '18' }]}>
                          <Text style={{ fontSize: 16 }}>📋</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.resultTitle, { color: txt }]} numberOfLines={1}>{t.heading || t.title || 'Untitled'}</Text>
                          <Text style={[s.resultSub, { color: sub }]}>{t.project_details?.name || ''}</Text>
                        </View>
                        <View style={[s.statusPill, { backgroundColor: sc + '18' }]}>
                          <Text style={[s.statusPillText, { color: sc }]}>{sl}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Projects */}
            {results.projects.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>Projects ({results.projects.length})</Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {results.projects.slice(0, 4).map((p, i) => (
                    <TouchableOpacity
                      key={p.id || i}
                      onPress={() => navigation.navigate('ProjectDetail', { id: p.id, project: p })}
                      style={[s.resultRow, i < Math.min(results.projects.length, 4) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                      activeOpacity={0.7}
                    >
                      <View style={[s.resultIcon, { backgroundColor: '#E9D5FF' }]}>
                        <Text style={{ fontSize: 16 }}>🗂</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.resultTitle, { color: txt }]} numberOfLines={1}>{p.name || 'Project'}</Text>
                        <Text style={[s.resultSub, { color: sub }]}>{p.description || p.desc || ''}</Text>
                      </View>
                      <Text style={{ color: sub, fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Documents */}
            {results.docs.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>Documents ({results.docs.length})</Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {results.docs.slice(0, 4).map((d, i) => {
                    const name = d.name || d.file_name || 'Untitled';
                    const ext  = getDocExt(name);
                    return (
                      <View
                        key={d.id || i}
                        style={[s.resultRow, i < Math.min(results.docs.length, 4) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                      >
                        <View style={[s.resultIcon, { backgroundColor: '#FEE2E2' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#EF4444' }}>{ext}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.resultTitle, { color: txt }]} numberOfLines={1}>{name}</Text>
                          <Text style={[s.resultSub, { color: sub }]}>
                            {d.created_by?.full_name || d.created_by?.username || ''}
                          </Text>
                        </View>
                        <Text style={{ color: sub, fontSize: 18 }}>›</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* People */}
            {results.users.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>People ({results.users.length})</Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {results.users.slice(0, 4).map((u, i) => (
                    <View
                      key={u.id || i}
                      style={[s.resultRow, i < Math.min(results.users.length, 4) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                    >
                      <View style={[s.avatar, { backgroundColor: '#E9D5FF' }]}>
                        <Text style={[s.avatarText, { color: '#7C3AED' }]}>{getInitial(u)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.resultTitle, { color: txt }]}>{getUserName(u)}</Text>
                        <Text style={[s.resultSub, { color: sub }]}>@{u.username || '—'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* No results */}
        {results && !hasResults && !loading && (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
            <Text style={{ fontSize: 48, opacity: 0.3 }}>🔍</Text>
            <Text style={[{ fontSize: 16, fontWeight: '600', color: txt }]}>No results found</Text>
            <Text style={[{ fontSize: 13, color: sub }]}>Try a different search term</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  searchNav: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, height: 42, paddingHorizontal: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, height: 42 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  quickLabel: { fontSize: 12, fontWeight: '600' },
  groupCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  resultIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resultTitle: { fontSize: 14, fontWeight: '600' },
  resultSub: { fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 14, fontWeight: '700' },
});
