import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Animated, Image, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useContext, useEffect, useCallback, useMemo } from 'react';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { NotificationsContext } from '../../context/NotificationsContext';
import { AuthContext } from '../../context/AuthContext';
import { getUsers, getProjects, createProject, getAccessToken } from '../../services/ApiService';
import SidebarMenu from '../../components/SidebarMenu';
import { ThemeContext } from '../../context/ThemeContext';
import NotificationBell from '../../components/NotificationBell';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

import { API_BASE as CONFIG_API_BASE, BASE_URL } from '../../config';
import useProjects, { invalidateProjectsCache } from './hooks/useProjects';
import { SkeletonList } from '../../components/SkeletonLoader';

// ── API config ────────────────────────────────────────────────────────────────
const API_BASE     = CONFIG_API_BASE;

// ── Constants ─────────────────────────────────────────────────────────────────
const TASK_TYPES = ['client', 'internal', 'content_creation', 'ideas'];
const TASK_TYPE_LABELS = {
  client: 'Client', internal: 'Internal',
  content_creation: 'Content Creation', ideas: 'Ideas',
};
const ROLES = ['manager', 'annotator', 'viewer', 'admin'];
const FILTER_COLORS = { client: '#3B82F6', internal: '#4ADE80', content_creation: '#F472B6', ideas: '#FBBF24' };
const STATUS_COLORS = { 'In Progress': '#4ECDC4', Completed: '#4ADE80', 'On Hold': '#FBBF24' };
const TASK_STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review' };
const TASK_STATUS_COLORS = { pending: '#888899', in_progress: '#4ECDC4', completed: '#4ADE80', backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA' };
const PRIORITY_COLORS = { low: '#4ADE80', medium: '#FBBF24', high: '#F97316', urgent: '#EF4444' };

// ── Module-level task count cache ────────────────────────────────────────────
// Persists across re-renders and screen focus changes
// Re-fetches only when cache is older than TASK_COUNT_TTL
let _taskCountCache = null;       // { [projectId]: count }
let _taskCountFetchedAt = 0;
const TASK_COUNT_TTL = 5 * 60 * 1000; // 5 minutes

// ── Token colours (from dev_1) ─────────────────────────────────────────────
const T = {
  brand: '#2D6AE3', ink: '#0E1726', ink2: '#3B4658', ink3: '#6B7588', ink4: '#9AA3B2',
  hairline: '#E6E9EF', hairlineSoft: '#F0F2F6', surface: '#FFFFFF', surfaceAlt: '#F7F8FB',
  cBlue: '#2D6AE3', cBlueSoft: '#E6EEFC',
  cGreen: '#22A06B', cGreenSoft: '#E2F5EC',
  cYellow: '#E5A60E', cYellowSoft: '#FEF3CE',
  cPurple: '#7A5AF8', cPurpleSoft: '#EEEAFE',
  cRed: '#E5484D', cRedSoft: '#FBE3E3',
  r: 10, rMd: 14, rLg: 20,
};

// Project colors cycle
const PROJECT_COLORS = [T.cBlue, T.cPurple, T.cGreen, T.cYellow, T.cRed, '#0EA5E9', '#10B981', '#F97316'];
const getProjectColor = (idx) => PROJECT_COLORS[idx % PROJECT_COLORS.length];

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

// ── Mini UI components (dev_1 style, no external dep) ─────────────────────────
function Card({ children, style, padding = 16, onPress }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      activeOpacity={0.75}
      style={[{
        backgroundColor: T.surface, borderRadius: T.rMd,
        borderWidth: 1, borderColor: T.hairline, padding,
      }, style]}
    >
      {children}
    </Wrap>
  );
}

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

// ── InlineDropdown (unchanged from main) ──────────────────────────────────────
function InlineDropdown({ options, selected, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg = isDark ? '#252530' : '#F5F5F7';
  const bgOpen = isDark ? '#1A1A20' : '#FFFFFF';
  const bdr = isDark ? '#2F2F3D' : '#EBEBF0';
  const txt = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub = isDark ? '#9898A6' : '#888899';
  const placeholderColor = isDark ? '#6C6C80' : '#AAAABC';
  const itemBorder = isDark ? '#2F2F3D' : '#F0F0F5';
  return (
    <View>
      <TouchableOpacity
        style={[pk.trigger, { backgroundColor: bg, borderColor: bdr }, open && { borderColor: '#4ECDC4', backgroundColor: bgOpen }]}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={[pk.triggerText, { color: txt }, !selected && { color: placeholderColor }]} numberOfLines={1}>
          {selected || placeholder}
        </Text>
        <Text style={[pk.arrow, { color: sub }]}>{open ? '▲' : '▾'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[pk.list, { backgroundColor: bgOpen, borderColor: '#4ECDC4' }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[pk.item, { borderBottomColor: itemBorder }, i === options.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[pk.itemText, { color: txt }, selected === opt.label && { color: '#4ECDC4', fontWeight: '700' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const pk = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 12, height: 46 },
  triggerText: { fontSize: 13, color: '#1A1A2E', flex: 1 },
  arrow: { fontSize: 11, color: '#888899', marginLeft: 4 },
  list: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', marginTop: 4, maxHeight: 180 },
  item: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  itemText: { fontSize: 13, color: '#1A1A2E' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

// ── Reusable SVG search icon ─────────────────────────────────────────────────
const SearchIcon = ({ size = 20, color = '#3B72EE' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

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
  const { token } = useContext(AuthContext);

  // ── Data state ────────────────────────────────────────────────────────────
  // ── Data from SWR cache — renders instantly if prefetched after login ────────
  const {
    projects,
    taskCountMap,
    users,
    isLoading:   loadingProjects,
    isValidating,
    refreshing,
    onRefresh:   handlePullRefresh,
    toggleFavouriteOptimistic,
    setProjects,
  } = useProjects();
  const [activeFilter,    setActiveFilter]    = useState('All');
  const [search,          setSearch]          = useState('');
  const [sortOrder,       setSortOrder]       = useState('default');
  const [sortDropOpen,    setSortDropOpen]    = useState(false);
  const [gridMode,        setGridMode]        = useState(false);

  // ── Create modal state ────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [projectName,  setProjectName]  = useState('');
  const [description,  setDescription]  = useState('');
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0]);
  const [taskType,     setTaskType]     = useState(null);
  const [projectImages,setProjectImages]= useState([]);
  const [members,      setMembers]      = useState([{ user: null, role: null }]);
  const slideAnim = useRef(new Animated.Value(-600)).current;


  // ── Data fetching handled by useProjects hook (SWR — no duplicate calls) ──

  // ── Favourite toggle ──────────────────────────────────────────────────────
  const toggleFavourite = async (project) => {
    if (!project?.id) return;
    const key = detectFavKey(project);
    const currentlyFav = isProjectFav(project);
    const next = !currentlyFav;
    // Optimistic update via hook (updates SWR cache + UI instantly)
    toggleFavouriteOptimistic(project.id, key, next);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/projects/${project.id}/`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch (e) {
      // Revert on failure
      toggleFavouriteOptimistic(project.id, key, currentlyFav);
      Alert.alert('Could not update favourite', e?.message || 'Try again later.');
    }
  };

  // ── Reopen after task create ──────────────────────────────────────────────
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

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openModal = () => {
    navigation.navigate('CreateProject');
  };

  const closeModal = () => {
    Animated.timing(slideAnim, { toValue: -600, duration: 250, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      setProjectName('');
      setDescription('');
      setProjectColor(PROJECT_COLORS[0]);
      setTaskType(null);
      setProjectImages([]);
      setMembers([{ user: null, role: null }]);
    });
  };

  const openDetails = (project) => {
    navigation.navigate('ProjectDetail', { project, projectId: project.id });
  };


  // ── Camera/gallery for project create form ────────────────────────────────
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera access is needed.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) setProjectImages(p => [...p, result.assets[0].uri]);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Gallery access is needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled && result.assets?.length) setProjectImages(p => [...p, ...result.assets.map(a => a.uri)]);
  };

  // ── Member helpers ────────────────────────────────────────────────────────
  const addMemberRow    = () => setMembers(m => [...m, { user: null, role: null }]);
  const removeMemberRow = (i) => setMembers(m => m.filter((_, idx) => idx !== i));
  const setMemberUser   = (i, user) => setMembers(m => m.map((r, idx) => idx === i ? { ...r, user } : r));
  const setMemberRole   = (i, role) => setMembers(m => m.map((r, idx) => idx === i ? { ...r, role } : r));

  // ── Create project ────────────────────────────────────────────────────────
  const addProject = async () => {
    if (!projectName.trim()) { Alert.alert('Required', 'Enter a project name.'); return; }
    if (!taskType)           { Alert.alert('Required', 'Select a task type.'); return; }
    const validMembers = members.filter(m => m.user && m.role);
    const body = {
      name: projectName.trim(), task_type: taskType,
      description: description.trim() || undefined,
      assigned_members: validMembers.map(m => ({ user_id: m.user.id, role: m.role })),
      project_settings: { priority: 'high' },
    };
    setSaving(true);
    try {
      await createProject(body);
      addNotification({ type: 'project', icon: '🗂️', title: 'Project Created', body: `"${projectName.trim()}" was created successfully.` });
      invalidateProjectsCache();
      closeModal();
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally { setSaving(false); }
  };

  // ── Filtered projects (dev_1 style filter tabs) ───────────────────────────
  const filtered = useMemo(() => {
    let list = projects;
    if (activeFilter === 'In Progress') list = list.filter(p => p.is_active && !isProjectFav(p));
    else if (activeFilter === 'Completed') list = list.filter(p => !p.is_active);
    else if (activeFilter === 'Starred') list = list.filter(p => isProjectFav(p));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q));
    }
    if (sortOrder === 'az')               list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortOrder === 'za')          list = [...list].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    else if (sortOrder === 'progress_hi') list = [...list].sort((a, b) => (b.progress || b.completion_percentage || 0) - (a.progress || a.completion_percentage || 0));
    else if (sortOrder === 'progress_lo') list = [...list].sort((a, b) => (a.progress || a.completion_percentage || 0) - (b.progress || b.completion_percentage || 0));
    else if (sortOrder === 'newest')      list = [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    else if (sortOrder === 'oldest')      list = [...list].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    return list;
  }, [projects, activeFilter, search, sortOrder]);

  // Summary counts
  const activeCount    = projects.filter(p => p.is_active).length;
  const completedCount = projects.filter(p => !p.is_active).length;
  const pinnedCount    = projects.filter(p => isProjectFav(p)).length;

  const userOptions = users.map(u => ({ label: `${u.first_name} ${u.last_name}`.trim() || u.username, ...u }));
  const roleOptions = ROLES.map(r => ({ label: r.charAt(0).toUpperCase() + r.slice(1), value: r }));
  const typeOptions = TASK_TYPES.map(t => ({ label: TASK_TYPE_LABELS[t], value: t }));

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} translucent={false} />

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Projects" />
          <View>
            <Text style={[s.brandName, { color: txt }]}>Projects</Text>
            <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>{projects.length} workspace{projects.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={s.navRight}>
          <TouchableOpacity
            style={{ padding: 6 }}
            onPress={() => navigation.navigate('Search')}
          >
            <SearchIcon size={20} color='#3B72EE' />
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
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            tintColor={T.brand}
            colors={[T.brand]}
          />
        }
      >
        {/* Summary tiles */}
        <View style={s.summaryRow}>
          <SummaryTile label="Active"  count={activeCount}   dotColor={T.cBlue} />
          <SummaryTile label="Done"    count={completedCount} dotColor={T.cGreen} />
          <SummaryTile label="Pinned"  count={pinnedCount}   dotColor={T.cYellow} />
        </View>

        {/* Search bar + Create */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <View style={[s.searchBar, { flex: 1, marginBottom: 0, backgroundColor: isDark ? '#1A1A20' : T.surfaceAlt, borderColor: bdr }]}>
            <SearchIcon size={16} color='#3B72EE' />
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
          <TouchableOpacity onPress={openModal} style={{ paddingHorizontal: 2 }}>
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

        {/* Skeleton — only shown on first open when cache is empty */}
        {loadingProjects ? (
          <SkeletonList count={5} type="card" isDark={isDark} />
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
            <Text style={{ fontSize: 48, opacity: 0.3 }}>📋</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: txt }}>
              {projects.length === 0 ? 'No projects yet' : 'No matches'}
            </Text>
            <Text style={{ fontSize: 13, color: sub }}>
              {projects.length === 0 ? 'Tap + New to create one' : 'Try a different filter'}
            </Text>
            {projects.length === 0 && (
              <TouchableOpacity style={s.newBtn} onPress={openModal}>
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
                    const progress = proj.progress || proj.completion_percentage || 0;
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
                              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                <Path
                                  d="M15 3l-6 6-4 1 9 9 1-4 6-6-6-6z"
                                  fill="#585858"
                                  stroke="#585858"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <Path
                                  d="M9 9l6 6M3 21l4-4"
                                  stroke="#585858"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </Svg>
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: txt, marginBottom: 2 }} numberOfLines={1}>{proj.name}</Text>
                          <Text style={{ fontSize: 11, color: sub, marginBottom: 10 }} numberOfLines={2}>
                            {proj.description || TASK_TYPE_LABELS[proj.task_type] || proj.task_type || 'Project'}
                          </Text>
                          <Progress value={progress} color={color} h={4} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            {/* Member avatars */}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {getProjectMembers(proj).slice(0, 3).map((m, midx) => {
                                const name = m.user?.full_name || m.user?.username || m.user_details?.username || 'U';
                                const initial = String(name).charAt(0).toUpperCase();
                                const avatarColors = [T.cBlue, T.cGreen, T.cPurple, T.cYellow, T.cRed];
                                return (
                                  <View key={m.id || midx} style={[s.memberAvatar, { marginLeft: midx === 0 ? 0 : -8, zIndex: 4 - midx, borderColor: card, backgroundColor: avatarColors[midx % avatarColors.length] + '33' }]}>
                                    <Text style={[s.memberAvatarText, { color: avatarColors[midx % avatarColors.length] }]}>{initial}</Text>
                                  </View>
                                );
                              })}
                              {getProjectMembers(proj).length > 3 && (
                                <View style={[s.memberAvatar, { marginLeft: -8, backgroundColor: T.hairlineSoft, borderColor: card }]}>
                                  <Text style={[s.memberAvatarText, { color: sub }]}>+{getProjectMembers(proj).length - 3}</Text>
                                </View>
                              )}
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
                    {sortOrder === 'default'      ? 'Sort'
                    : sortOrder === 'az'          ? 'A → Z'
                    : sortOrder === 'za'          ? 'Z → A'
                    : sortOrder === 'progress_hi' ? 'Progress ↓'
                    : sortOrder === 'progress_lo' ? 'Progress ↑'
                    : sortOrder === 'newest'      ? 'Newest'
                    : 'Oldest'}
                  </Text>
                  <Text style={{ fontSize: 10, color: sub }}>{sortDropOpen ? '▲' : '▾'}</Text>
                </TouchableOpacity>
                {sortDropOpen && (
                  <View style={{
                    position: 'absolute', top: 34, right: 0, zIndex: 100,
                    backgroundColor: isDark ? '#1A1A20' : '#fff',
                    borderRadius: 10, borderWidth: 1, borderColor: isDark ? '#252530' : T.hairline,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
                    minWidth: 140,
                  }}>
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
                        style={{
                          paddingHorizontal: 14, paddingVertical: 11,
                          borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                          borderBottomColor: isDark ? '#252530' : T.hairlineSoft,
                        }}
                      >
                        <Text style={{
                          fontSize: 13, fontWeight: sortOrder === opt.key ? '700' : '500',
                          color: sortOrder === opt.key ? T.brand : (isDark ? '#fff' : T.ink),
                        }}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              </View>
            </View>

            <View style={gridMode ? { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } : {}}>
            {filtered.map((proj, idx) => {
              const color = getProjectColor(idx);
              const progress = proj.progress || proj.completion_percentage || 0;
              const memberList = getProjectMembers(proj);
              const taskCount = taskCountMap[String(proj.id)] || proj.task_count || proj.tasks_count || proj.total_tasks || 0;
              const isFav = isProjectFav(proj);

              const avatarColors = [T.cBlue, T.cGreen, T.cPurple, T.cYellow, T.cRed, '#0EA5E9', '#10B981'];

              return (
                <TouchableOpacity
                  key={proj.id}
                  onPress={() => openDetails(proj)}
                  activeOpacity={0.75}
                  style={[s.listCard, { backgroundColor: card, borderColor: bdr }, gridMode && { width: '47.5%' }]}
                >
                  {/* Top row — icon + name + description + status chip */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={[s.projectIconLarge, { backgroundColor: color }]}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>
                        {(proj.name?.[0] || '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: txt, flex: 1 }} numberOfLines={1}>{proj.name}</Text>
                        <View style={[s.statusChip, { backgroundColor: (proj.is_active ? T.cBlue : T.cGreen) + '20' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: proj.is_active ? T.cBlue : T.cGreen }}>
                            {proj.is_active ? 'In Progress' : 'Completed'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: sub, marginTop: 2 }} numberOfLines={1}>
                        {proj.description || TASK_TYPE_LABELS[proj.task_type] || proj.task_type || ''}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar + % */}
                  <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Progress value={progress} color={color} h={5} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#9AA3B2' : T.ink2, minWidth: 34, textAlign: 'right' }}>{progress}%</Text>
                  </View>

                  {/* Footer — member avatars + task count + chevron */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
                    {/* Member avatars */}
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

                    {/* Task count — just before chevron */}
                    {taskCount > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 6 }}>
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                          <Path d="M9 11l3 3L22 4" stroke={sub} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                          <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke={sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                        </Svg>
                        <Text style={{ fontSize: 11, color: sub }}>{taskCount} task{taskCount !== 1 ? 's' : ''}</Text>
                      </View>
                    )}

                    <Text style={{ fontSize: 20, color: sub }}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Create Project Modal ────────────────────────────────────────────── */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal} statusBarTranslucent>
          <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[ms.topModal, { backgroundColor: card, paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24), transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={[ms.handle, { backgroundColor: isDark ? '#3A3A48' : '#DEDEE8' }]} />
              <ScrollView style={ms.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={ms.modalHeader}>
                  <Text style={[ms.modalTitle, { color: txt }]}>Create Project</Text>
                  <TouchableOpacity style={[ms.closeCircle, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]} onPress={closeModal}>
                    <Text style={[ms.closeCircleText, { color: sub }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Color picker */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: projectColor + '22', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 30, fontWeight: '800', color: projectColor }}>
                      {(projectName.trim()[0] || 'P').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                    {PROJECT_COLORS.map(c => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setProjectColor(c)}
                        style={[{
                          width: 28, height: 28, borderRadius: 14,
                          backgroundColor: c, justifyContent: 'center', alignItems: 'center',
                        }, projectColor === c && { borderWidth: 2.5, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}
                      >
                        {projectColor === c && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Text style={[ms.fieldLabel, { color: sub }]}>Project Name *</Text>
                <TextInput
                  placeholder="Enter project name..." placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  style={[ms.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', color: txt }]}
                  value={projectName} onChangeText={setProjectName} autoFocus
                />

                <Text style={[ms.fieldLabel, { color: sub }]}>Description</Text>
                <TextInput
                  placeholder="What's this project about?"
                  placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  multiline
                  style={[ms.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', color: txt, height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                  value={description} onChangeText={setDescription}
                />

                <Text style={[ms.fieldLabel, { color: sub }]}>Assigned To</Text>
                {members.map((m, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <InlineDropdown placeholder="Select User" options={userOptions}
                      selected={m.user ? (`${m.user.first_name} ${m.user.last_name}`.trim() || m.user.username) : null}
                      onSelect={u => setMemberUser(i, u)} />
                    <View style={{ height: 8 }} />
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <InlineDropdown placeholder="Select Role" options={roleOptions}
                          selected={m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) : null}
                          onSelect={r => setMemberRole(i, r.value)} />
                      </View>
                      {members.length > 1 && (
                        <TouchableOpacity style={[ms.removeRowBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FFF0F0' }]} onPress={() => removeMemberRow(i)}>
                          <Text style={{ color: '#EF4444', fontSize: 16 }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={ms.addMemberBtn} onPress={addMemberRow}>
                  <Text style={ms.addMemberText}>＋ Add another member</Text>
                </TouchableOpacity>

                <Text style={[ms.fieldLabel, { color: sub, marginTop: 16 }]}>Task Type *</Text>
                <View style={{ marginBottom: 14, zIndex: 100 }}>
                  <InlineDropdown placeholder="Select Task Type..." options={typeOptions}
                    selected={taskType ? TASK_TYPE_LABELS[taskType] : null} onSelect={t => setTaskType(t.value)} />
                </View>

                <Text style={[ms.fieldLabel, { color: sub }]}>Attach Images</Text>
                <View style={ms.attachRow}>
                  {[{ icon: '📷', label: 'Camera', sub: 'Take a photo', onPress: openCamera },
                    { icon: '🖼️', label: 'Gallery', sub: 'Pick from photos', onPress: openGallery }].map((btn, i) => (
                    <TouchableOpacity key={i} style={[ms.attachBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]} onPress={btn.onPress}>
                      <View style={[ms.attachIconWrap, { backgroundColor: card, borderColor: bdr }]}>
                        <Text style={{ fontSize: 22 }}>{btn.icon}</Text>
                      </View>
                      <Text style={[ms.attachLabel, { color: txt }]}>{btn.label}</Text>
                      <Text style={[ms.attachSub, { color: sub }]}>{btn.sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {projectImages.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[ms.fieldLabel, { color: sub, marginBottom: 8 }]}>{projectImages.length} image{projectImages.length > 1 ? 's' : ''} attached</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {projectImages.map((uri, i) => (
                        <View key={i} style={{ position: 'relative', marginRight: 10 }}>
                          <Image source={{ uri }} style={[ms.previewImg, { borderColor: bdr }]} />
                          <TouchableOpacity style={ms.removeImg} onPress={() => setProjectImages(p => p.filter((_, idx) => idx !== i))}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={[ms.modalBtns, { marginBottom: 28 }]}>
                  <TouchableOpacity style={[ms.cancelBtn, { borderColor: bdr, backgroundColor: card }]} onPress={closeModal} disabled={saving}>
                    <Text style={[ms.cancelBtnText, { color: sub }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[ms.submitBtn, saving && { opacity: 0.7 }]} onPress={addProject} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ms.submitBtnText}>Create Project</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}

    </SafeAreaView>
  );
}
// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontWeight: '700', fontSize: 15 },
  newBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  newBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  // Summary tiles
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryTile: { flex: 1, backgroundColor: T.surface, borderRadius: T.rMd, borderWidth: 1, borderColor: T.hairline, padding: 12 },
  summaryLabel: { fontSize: 11, color: T.ink3, fontWeight: '500' },
  summaryCount: { fontSize: 22, fontWeight: '700', color: T.ink, letterSpacing: -0.4 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: T.rMd, borderWidth: 1, height: 44, paddingHorizontal: 12, gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, height: 44 },

  // Filter chips
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipActive: { backgroundColor: T.ink, borderColor: T.ink },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  // Pinned card
  pinnedCard: { width: 200, borderRadius: T.rMd, borderWidth: 1, overflow: 'hidden' },
  pinnedColorBar: { height: 4 },
  projectIconSmall: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // List card
  listCard: { borderRadius: T.rMd, borderWidth: 1, padding: 14, marginBottom: 10 },
  projectIconLarge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  memberAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  memberAvatarText: { color: '#7C3AED', fontSize: 10, fontWeight: '700' },
});

// Modal styles
const ms = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topModal: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxHeight: '94%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  modalScroll: { paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  removeRowBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  addMemberBtn: { paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#4ECDC4', borderRadius: 10, borderStyle: 'dashed', marginBottom: 4 },
  addMemberText: { fontSize: 13, color: '#4ECDC4', fontWeight: '600' },
  attachRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  attachBtn: { flex: 1, backgroundColor: '#F5F5F7', borderRadius: 12, borderWidth: 1.5, borderColor: '#EBEBF0', paddingVertical: 12, alignItems: 'center', gap: 3 },
  attachIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 2, borderWidth: 1, borderColor: '#EBEBF0' },
  attachLabel: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  attachSub: { fontSize: 10, color: '#AAAABC' },
  previewImg: { width: 80, height: 80, borderRadius: 10, borderWidth: 1 },
  removeImg: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F87171', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },
  submitBtn: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  uploadCard: { width: '100%', maxWidth: 400, borderRadius: 20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20 },
  uploadOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  uploadOptionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  uploadCancelBtn: { marginTop: 14, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  importCard: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 20 },
  importTextarea: { borderRadius: 10, borderWidth: 1, padding: 12, minHeight: 140, maxHeight: 200, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 4, marginBottom: 10 },
  importFileBtn: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  importFileBtnText: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  importProgress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, padding: 10, backgroundColor: 'rgba(78,205,196,0.08)', borderRadius: 10 },
  importProgressText: { fontSize: 12, color: '#4ECDC4', fontWeight: '600' },
});