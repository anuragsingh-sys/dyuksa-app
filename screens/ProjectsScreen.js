import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, Platform,
  ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NotificationsContext } from '../context/NotificationsContext';
import { AuthContext } from '../context/AuthContext';
import { getProjects, getTasks, getAccessToken } from '../services/ApiService';
import { API_BASE } from '../config';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';
import Svg, { Path, Rect } from 'react-native-svg';

// ── Token colours ─────────────────────────────────────────────────────────────
const T = {
  brand: '#3B72EE', ink: '#0E1726', ink2: '#3B4658', ink3: '#6B7588', ink4: '#9AA3B2',
  hairline: '#E6E9EF', hairlineSoft: '#F0F2F6', surface: '#FFFFFF', surfaceAlt: '#F7F8FB',
  cBlue: '#3B72EE', cGreen: '#22A06B', cYellow: '#E5A60E',
  cPurple: '#7A5AF8', cRed: '#E5484D',
  rMd: 14,
};

const PROJECT_COLORS = [T.cBlue, T.cPurple, T.cGreen, T.cYellow, T.cRed, '#0EA5E9', '#10B981', '#F97316'];
const getProjectColor = (idx) => PROJECT_COLORS[idx % PROJECT_COLORS.length];

const TASK_TYPE_LABELS = {
  client: 'Client', internal: 'Internal',
  content_creation: 'Content Creation', ideas: 'Ideas',
};

const FILTER_TABS = ['All', 'In Progress', 'Completed', 'Starred'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const getProjectMembers = (project) => {
  if (!project) return [];
  if (Array.isArray(project.members)) return project.members;
  if (Array.isArray(project.assigned_members)) return project.assigned_members;
  return [];
};

const isProjectFav = (project) => {
  if (!project) return false;
  return !!(project.is_favourite || project.is_favorite || project.is_starred ||
    project.is_pinned || project.favourite || project.favorite || project.starred);
};

const detectFavKey = (project) => {
  const candidates = ['is_favourite', 'is_favorite', 'is_starred', 'is_pinned', 'favourite', 'favorite', 'starred'];
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(project || {}, key)) return key;
  }
  return 'is_favourite';
};

// ── Mini components ───────────────────────────────────────────────────────────
function Progress({ value = 0, color = T.brand, h = 5 }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View style={{ height: h, backgroundColor: T.hairlineSoft, borderRadius: h }}>
      <View style={{ height: h, width: `${pct}%`, backgroundColor: color, borderRadius: h }} />
    </View>
  );
}

function SummaryTile({ label, count, dotColor }) {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  return (
    <View style={[s.summaryTile, {
      backgroundColor: isDark ? '#1A1A20' : T.surface,
      borderColor: isDark ? '#252530' : T.hairline,
    }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <View style={[s.dot, { backgroundColor: dotColor }]} />
        <Text style={[s.summaryLabel, { color: isDark ? '#9898A6' : T.ink3 }]}>{label}</Text>
      </View>
      <Text style={[s.summaryCount, { color: isDark ? '#FFFFFF' : T.ink }]}>{count}</Text>
    </View>
  );
}

const SearchIcon = ({ size = 20, color = T.brand }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProjectsScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { theme }  = useContext(ThemeContext);
  const isDark     = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : T.surfaceAlt;
  const card = isDark ? '#1A1A20' : T.surface;
  const txt  = isDark ? '#FFFFFF' : T.ink;
  const sub  = isDark ? '#9898A6' : T.ink3;
  const bdr  = isDark ? '#252530' : T.hairline;

  const { addNotification } = useContext(NotificationsContext);

  // ── State ─────────────────────────────────────────────────────────────────
  const [projects,        setProjects]        = useState([]);
  const [taskCounts,      setTaskCounts]      = useState({});
  const [doneCounts,      setDoneCounts]      = useState({}); // projectId → completed+deployed count
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeFilter,    setActiveFilter]    = useState('All');
  const [search,          setSearch]          = useState('');
  const [sortOrder,       setSortOrder]       = useState('default');
  const [sortDropOpen,    setSortDropOpen]    = useState(false);
  const [gridMode,        setGridMode]        = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => { fetchProjects(); }, []);
  useFocusEffect(useCallback(() => { fetchProjects(); }, []));

  // Reopen project after task create
  useFocusEffect(useCallback(() => {
    const reopenId = route.params?.reopenProjectId;
    if (!reopenId) return;
    navigation.setParams({ reopenProjectId: null });
    setTimeout(async () => {
      try {
        const list = await getProjects();
        setProjects(list);
        const found = list.find(p => String(p.id) === String(reopenId));
        if (found) openDetails(found);
      } catch {
        const found = projects.find(p => String(p.id) === String(reopenId));
        if (found) openDetails(found);
      }
    }, 200);
  }, [route.params?.reopenProjectId]));

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const list = await getProjects();
      setProjects(Array.isArray(list) ? list : []);
      fetchTaskCounts(); // after projects succeed so token is proven valid
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not load projects.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchTaskCounts = async () => {
    try {
      const all = await getTasks();
      const counts = {};
      const done   = {};
      const DONE_STATUSES = ['completed', 'deployed', 'done'];
      (all || []).forEach(t => {
        const pid = String(t.project_details?.id ?? t.project ?? t.project_id ?? '');
        if (!pid) return;
        counts[pid] = (counts[pid] || 0) + 1;
        if (DONE_STATUSES.includes((t.status || '').toLowerCase())) {
          done[pid] = (done[pid] || 0) + 1;
        }
      });
      setTaskCounts(counts);
      setDoneCounts(done);
    } catch (e) { console.warn('fetchTaskCounts:', e.message); }
  };

  // ── Favourite toggle ──────────────────────────────────────────────────────
  const toggleFavourite = async (project) => {
    if (!project?.id) return;
    const key = detectFavKey(project);
    const currentlyFav = isProjectFav(project);
    const next = !currentlyFav;
    // Optimistic update
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, [key]: next } : p));
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/projects/${project.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch (e) {
      // Rollback on failure
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, [key]: currentlyFav } : p));
      Alert.alert('Could not update pin', e?.message || 'Try again later.');
    }
  };

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = projects;
    if (activeFilter === 'In Progress') list = list.filter(p => p.is_active);
    else if (activeFilter === 'Completed') list = list.filter(p => !p.is_active);
    else if (activeFilter === 'Starred') list = list.filter(p => isProjectFav(p));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q));
    }
    if (sortOrder === 'az')               list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortOrder === 'za')          list = [...list].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    else if (sortOrder === 'progress_hi') list = [...list].sort((a, b) => {
      const pctA = taskCounts[String(a.id)] ? Math.round((doneCounts[String(a.id)] || 0) / taskCounts[String(a.id)] * 100) : (a.progress || a.completion_percentage || 0);
      const pctB = taskCounts[String(b.id)] ? Math.round((doneCounts[String(b.id)] || 0) / taskCounts[String(b.id)] * 100) : (b.progress || b.completion_percentage || 0);
      return pctB - pctA;
    });
    else if (sortOrder === 'progress_lo') list = [...list].sort((a, b) => {
      const pctA = taskCounts[String(a.id)] ? Math.round((doneCounts[String(a.id)] || 0) / taskCounts[String(a.id)] * 100) : (a.progress || a.completion_percentage || 0);
      const pctB = taskCounts[String(b.id)] ? Math.round((doneCounts[String(b.id)] || 0) / taskCounts[String(b.id)] * 100) : (b.progress || b.completion_percentage || 0);
      return pctA - pctB;
    });
    else if (sortOrder === 'newest')      list = [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    else if (sortOrder === 'oldest')      list = [...list].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    return list;
  }, [projects, activeFilter, search, sortOrder]);

  const activeCount    = projects.filter(p => p.is_active).length;
  const completedCount = projects.filter(p => !p.is_active).length;
  const pinnedCount    = projects.filter(p => isProjectFav(p)).length;

  const openDetails = (project) => navigation.navigate('ProjectDetail', { project, projectId: project.id });
  const openCreate  = () => navigation.navigate('CreateProject');

  const avatarColors = [T.cBlue, T.cGreen, T.cPurple, T.cYellow, T.cRed, '#0EA5E9', '#10B981'];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Projects" />
          <View>
            <Text style={[s.brandName, { color: txt }]}>Projects</Text>
            <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={s.navRight}>
          <TouchableOpacity style={{ padding: 6 }} onPress={() => navigation.navigate('Search')}>
            <SearchIcon size={20} color={T.brand} />
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingProjects}
            onRefresh={fetchProjects}
            tintColor={T.brand}
            colors={[T.brand]}
          />
        }
      >
        {/* Summary tiles */}
        <View style={s.summaryRow}>
          <SummaryTile label="Active"  count={activeCount}    dotColor={T.cBlue} />
          <SummaryTile label="Done"    count={completedCount} dotColor={T.cGreen} />
          <SummaryTile label="Pinned"  count={pinnedCount}    dotColor={T.cYellow} />
        </View>

        {/* Search + Create */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <View style={[s.searchBar, { flex: 1, marginBottom: 0, backgroundColor: isDark ? '#1A1A20' : T.surfaceAlt, borderColor: bdr }]}>
            <SearchIcon size={16} color={T.brand} />
            <TextInput
              style={[s.searchInput, { color: txt }]}
              placeholder="Search projects…"
              placeholderTextColor={sub}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: sub, fontSize: 14, paddingHorizontal: 6 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={openCreate} style={{ paddingHorizontal: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#fff' : '#1A1A2E' }}>+ Create</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {FILTER_TABS.map(f => {
            const active = f === activeFilter;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[s.chip, { backgroundColor: isDark ? '#1A1A20' : T.surface, borderColor: bdr }, active && s.chipActive]}
              >
                <Text style={[s.chipText, { color: sub }, active && s.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Body */}
        {loadingProjects ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator size="large" color={T.brand} />
            <Text style={{ color: sub, marginTop: 10 }}>Loading projects…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
            <Text style={{ fontSize: 48, opacity: 0.3 }}>📋</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: txt }}>
              {projects.length === 0 ? 'No projects yet' : 'No matches'}
            </Text>
            <Text style={{ fontSize: 13, color: sub }}>
              {projects.length === 0 ? 'Tap + Create to add one' : 'Try a different filter'}
            </Text>
            {projects.length === 0 && (
              <TouchableOpacity style={s.newBtn} onPress={openCreate}>
                <Text style={s.newBtnText}>+ Create Project</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* Pinned horizontal scroll */}
            {pinnedCount > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#ccc' : T.ink }}>
                    Pinned ({pinnedCount})
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4, marginBottom: 16 }}>
                  {projects.filter(p => isProjectFav(p)).map((proj, idx) => {
                    const color = getProjectColor(idx);
                    const total    = taskCounts[String(proj.id)] || 0;
                    const done     = doneCounts[String(proj.id)] || 0;
                    const progress = total > 0 ? Math.round(done / total * 100) : (proj.progress || proj.completion_percentage || 0);
                    return (
                      <TouchableOpacity
                        key={proj.id}
                        onPress={() => openDetails(proj)}
                        activeOpacity={0.75}
                        style={[s.pinnedCard, { backgroundColor: card, borderColor: bdr }]}
                      >
                        <View style={[s.pinnedColorBar, { backgroundColor: color }]} />
                        <View style={{ padding: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={[s.projectIconSmall, { backgroundColor: color }]}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                                {(proj.name?.[0] || '?').toUpperCase()}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={(e) => { e.stopPropagation(); toggleFavourite(proj); }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                <Path d="M15 3l-6 6-4 1 9 9 1-4 6-6-6-6z" fill="#585858" stroke="#585858" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <Path d="M9 9l6 6M3 21l4-4" stroke="#585858" strokeWidth="2" strokeLinecap="round"/>
                              </Svg>
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: txt, marginBottom: 2 }} numberOfLines={1}>{proj.name}</Text>
                          <Text style={{ fontSize: 11, color: sub, marginBottom: 10 }} numberOfLines={2}>
                            {proj.description || TASK_TYPE_LABELS[proj.task_type] || proj.task_type || 'Project'}
                          </Text>
                          <Progress value={progress} color={color} h={4} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {getProjectMembers(proj).slice(0, 3).map((m, midx) => {
                                const name = m.user?.full_name || m.user?.username || m.user_details?.username || 'U';
                                const initial = String(name).charAt(0).toUpperCase();
                                return (
                                  <View key={m.id || midx} style={[s.memberAvatar, { marginLeft: midx === 0 ? 0 : -8, zIndex: 4 - midx, borderColor: card, backgroundColor: avatarColors[midx % avatarColors.length] + '33' }]}>
                                    <Text style={[s.memberAvatarText, { color: avatarColors[midx % avatarColors.length] }]}>{initial}</Text>
                                  </View>
                                );
                              })}
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#9AA3B2' : T.ink2 }}>{progress}%</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* All projects list */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#ccc' : T.ink }}>
                All projects ({filtered.length})
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Grid/List toggle */}
                <TouchableOpacity onPress={() => setGridMode(v => !v)} style={{ padding: 4 }}>
                  {gridMode ? (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M3 12h18M3 6h18M3 18h18"/>
                    </Svg>
                  ) : (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Rect x="3" y="3" width="7" height="7" rx="1"/>
                      <Rect x="14" y="3" width="7" height="7" rx="1"/>
                      <Rect x="14" y="14" width="7" height="7" rx="1"/>
                      <Rect x="3" y="14" width="7" height="7" rx="1"/>
                    </Svg>
                  )}
                </TouchableOpacity>

                {/* Sort dropdown */}
                <View>
                  <TouchableOpacity
                    onPress={() => setSortDropOpen(o => !o)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? '#252530' : T.hairlineSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#9AA3B2' : T.ink3 }}>
                      {sortOrder === 'default' ? 'Sort' : sortOrder === 'az' ? 'A → Z' : sortOrder === 'za' ? 'Z → A' : sortOrder === 'progress_hi' ? 'Progress ↓' : sortOrder === 'progress_lo' ? 'Progress ↑' : sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                    </Text>
                    <Text style={{ fontSize: 10, color: sub }}>{sortDropOpen ? '▲' : '▾'}</Text>
                  </TouchableOpacity>
                  {sortDropOpen && (
                    <View style={{ position: 'absolute', top: 34, right: 0, zIndex: 100, backgroundColor: isDark ? '#1A1A20' : '#fff', borderRadius: 10, borderWidth: 1, borderColor: isDark ? '#252530' : T.hairline, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8, minWidth: 140 }}>
                      {[
                        { key: 'default',      label: 'Default' },
                        { key: 'az',           label: 'Name A → Z' },
                        { key: 'za',           label: 'Name Z → A' },
                        { key: 'progress_hi',  label: 'Progress ↓' },
                        { key: 'progress_lo',  label: 'Progress ↑' },
                        { key: 'newest',       label: 'Newest first' },
                        { key: 'oldest',       label: 'Oldest first' },
                      ].map((opt, i, arr) => (
                        <TouchableOpacity
                          key={opt.key}
                          onPress={() => { setSortOrder(opt.key); setSortDropOpen(false); }}
                          style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: isDark ? '#252530' : T.hairlineSoft }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: sortOrder === opt.key ? '700' : '500', color: sortOrder === opt.key ? T.brand : (isDark ? '#fff' : T.ink) }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={gridMode ? { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } : {}}>
              {filtered.map((proj, idx) => {
                const color      = getProjectColor(idx);
                const total      = taskCounts[String(proj.id)] || 0;
                const done       = doneCounts[String(proj.id)] || 0;
                const progress   = total > 0 ? Math.round(done / total * 100) : (proj.progress || proj.completion_percentage || 0);
                const memberList = getProjectMembers(proj);
                const taskCount  = total;

                return (
                  <TouchableOpacity
                    key={proj.id}
                    onPress={() => openDetails(proj)}
                    activeOpacity={0.75}
                    style={[s.listCard, { backgroundColor: card, borderColor: bdr }, gridMode && { width: '47.5%' }]}
                  >
                    {/* Top row */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={[s.projectIconLarge, { backgroundColor: color }]}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>
                          {(proj.name?.[0] || '?').toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: txt, marginBottom: 4 }} numberOfLines={1}>{proj.name}</Text>
                        <View style={[s.statusChip, { backgroundColor: (proj.is_active ? T.cBlue : T.cGreen) + '20', alignSelf: 'flex-start' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: proj.is_active ? T.cBlue : T.cGreen }}>
                            {proj.is_active ? 'In Progress' : 'Completed'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: sub, marginTop: 4 }} numberOfLines={1}>
                          {proj.description || TASK_TYPE_LABELS[proj.task_type] || proj.task_type || ''}
                        </Text>
                      </View>
                    </View>

                    {/* Progress bar */}
                    <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Progress value={progress} color={color} h={5} />
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#9AA3B2' : T.ink2, minWidth: 34, textAlign: 'right' }}>{progress}%</Text>
                    </View>

                    {/* Footer */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {memberList.slice(0, 4).map((m, midx) => {
                          const name = m.user?.full_name || m.user?.username || m.user_details?.username || 'U';
                          const initial = String(name).charAt(0).toUpperCase();
                          return (
                            <View key={m.id || midx} style={[s.memberAvatar, { marginLeft: midx === 0 ? 0 : -8, zIndex: 4 - midx, borderColor: card, backgroundColor: avatarColors[midx % avatarColors.length] + '33' }]}>
                              <Text style={[s.memberAvatarText, { color: avatarColors[midx % avatarColors.length] }]}>{initial}</Text>
                            </View>
                          );
                        })}
                        {memberList.length > 4 && (
                          <View style={[s.memberAvatar, { marginLeft: -8, backgroundColor: T.hairlineSoft, borderColor: card }]}>
                            <Text style={[s.memberAvatarText, { color: sub }]}>+{memberList.length - 4}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 11, color: sub }}>☑</Text>
                        <Text style={{ fontSize: 11, color: sub }}>{taskCount} task{taskCount !== 1 ? 's' : ''}</Text>
                      </View>
                      <Text style={{ fontSize: 20, color: sub }}>›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1 },
  navbar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontWeight: '700', fontSize: 17 },

  summaryRow:   { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryTile:  { flex: 1, borderRadius: T.rMd, borderWidth: 1, padding: 12 },
  summaryLabel: { fontSize: 11, fontWeight: '500' },
  summaryCount: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  dot:          { width: 8, height: 8, borderRadius: 4 },

  searchBar:   { flexDirection: 'row', alignItems: 'center', borderRadius: T.rMd, borderWidth: 1, height: 44, paddingHorizontal: 12, gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, height: 44 },

  chipRow:      { flexDirection: 'row', gap: 8, paddingVertical: 2, marginBottom: 14 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipActive:   { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  chipText:     { fontSize: 12, fontWeight: '600' },
  chipTextActive:{ color: '#FFFFFF' },

  pinnedCard:      { width: 200, borderRadius: T.rMd, borderWidth: 1, overflow: 'hidden' },
  pinnedColorBar:  { height: 4 },
  projectIconSmall:{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  listCard:        { borderRadius: T.rMd, borderWidth: 1, padding: 14, marginBottom: 10 },
  projectIconLarge:{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusChip:      { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  memberAvatar:    { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  memberAvatarText:{ fontSize: 10, fontWeight: '700' },

  newBtn:    { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  newBtnText:{ color: '#fff', fontSize: 12, fontWeight: '700' },
});
