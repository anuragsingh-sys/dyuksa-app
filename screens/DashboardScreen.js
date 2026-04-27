import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef, useCallback, useState, useContext } from 'react';
import { getProjects, getTasks, getAccessToken } from '../services/ApiService';

const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';
const API_BASE   = 'http://192.168.1.164:8000';

// Map common file extensions to a small label + colour for the doc icon
const fileMeta = (name = '') => {
  const ext = String(name).split('.').pop().toLowerCase();
  if (['pdf'].includes(ext))                             return { label: 'PDF',  color: '#EF4444' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { label: 'IMG',  color: '#06B6D4' };
  if (['doc', 'docx'].includes(ext))                     return { label: 'DOC',  color: '#3B82F6' };
  if (['xls', 'xlsx', 'csv'].includes(ext))              return { label: 'XLS',  color: '#10B981' };
  if (['ppt', 'pptx'].includes(ext))                     return { label: 'PPT',  color: '#F97316' };
  if (['zip', 'rar', '7z'].includes(ext))                return { label: 'ZIP',  color: '#A855F7' };
  if (['txt', 'md'].includes(ext))                       return { label: 'TXT',  color: '#6B7280' };
  return { label: 'FILE', color: '#6B7280' };
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs   = now - d;
    const diffMin  = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay  = Math.floor(diffMs / 86400000);
    if (diffMin < 1)  return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7)  return `${diffDay}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

const PRIORITY_COLORS = {
  low: '#9CA3AF', medium: '#F59E0B', high: '#EF4444', critical: '#DC2626',
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const route = useRoute();
  const scrollRef = useRef(null);
  const quickActionsRef = useRef(null);
  const [quickNotes, setQuickNotes] = useState([]);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // ── Backend-wired sections ─────────────────────────────────────────────
  const [inProgressTasks, setInProgressTasks] = useState([]);
  const [recentDocs, setRecentDocs]           = useState([]);
  const [favProjects, setFavProjects]         = useState([]);
  const [loadingTasks, setLoadingTasks]       = useState(true);
  const [loadingDocs, setLoadingDocs]         = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Resolve "is this task assigned to me?" by id, username, or email — covers
  // backends that put any of those in `assigned_to` / `assigned_to_user_details`.
  const isTaskMine = useCallback((task) => {
    if (!user) return false;
    const myId    = user.id;
    const myEmail = (user.email || '').toLowerCase();
    const myUname = (user.username || user.name || '').toLowerCase();
    const ids = task.assigned_to || [];
    if (myId != null && ids.some((x) => String(x) === String(myId))) return true;
    const details = task.assigned_to_user_details || [];
    return details.some((u) => {
      if (myId != null && String(u.id) === String(myId)) return true;
      if (myEmail && (u.email || '').toLowerCase() === myEmail) return true;
      if (myUname && (u.username || '').toLowerCase() === myUname) return true;
      return false;
    });
  }, [user]);

  // Fetch in-progress tasks assigned to me
  const fetchInProgress = useCallback(async () => {
    try {
      const all = await getTasks();
      const list = Array.isArray(all) ? all : (all?.results || []);
      const mine = list
        .filter((t) => t && t.status === 'in_progress' && isTaskMine(t))
        .sort((a, b) => {
          const da = new Date(a.updated_at || a.created_at || 0).getTime();
          const db = new Date(b.updated_at || b.created_at || 0).getTime();
          return db - da;
        })
        .slice(0, 5);
      setInProgressTasks(mine);
    } catch (e) {
      console.warn('fetchInProgress failed:', e?.message || e);
      setInProgressTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [isTaskMine]);

  // Fetch the 3 most recently uploaded documents
  const fetchRecentDocs = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/documents/?ordering=-created_at`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`docs ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      // Server-side ordering may not always be supported — sort client-side too
      list.sort((a, b) => {
        const da = new Date(a.created_at || a.updated_at || 0).getTime();
        const db = new Date(b.created_at || b.updated_at || 0).getTime();
        return db - da;
      });
      setRecentDocs(list.slice(0, 3));
    } catch (e) {
      console.warn('fetchRecentDocs failed:', e?.message || e);
      setRecentDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  // Fetch favourite projects.
  // Backend exact field name varies — defensively check several common keys.
  // If none of the projects have a favourite flag set, gracefully fall back to
  // the 3 most recently updated projects so the section isn't empty.
  const fetchFavProjects = useCallback(async () => {
    try {
      const list = await getProjects();
      const projects = Array.isArray(list) ? list : (list?.results || []);
      const isFav = (p) =>
        p.is_favourite === true ||
        p.is_favorite  === true ||
        p.is_starred   === true ||
        p.is_pinned    === true ||
        p.favourite    === true ||
        p.favorite     === true ||
        p.starred      === true;

      const favs = projects.filter(isFav);
      let result;
      if (favs.length > 0) {
        favs.sort((a, b) => {
          const da = new Date(a.updated_at || a.created_at || 0).getTime();
          const db = new Date(b.updated_at || b.created_at || 0).getTime();
          return db - da;
        });
        result = favs.slice(0, 3);
      } else {
        // Fallback: 3 most recently updated projects
        const sorted = [...projects].sort((a, b) => {
          const da = new Date(a.updated_at || a.created_at || 0).getTime();
          const db = new Date(b.updated_at || b.created_at || 0).getTime();
          return db - da;
        });
        result = sorted.slice(0, 3);
      }
      setFavProjects(result);
    } catch (e) {
      console.warn('fetchFavProjects failed:', e?.message || e);
      setFavProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // Quick notes (existing behavior)
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) {
        const all = JSON.parse(data);
        setQuickNotes(all.filter(e => e.type === 'task').slice(0, 5));
      } else {
        setQuickNotes([]);
      }
    });

    // Refresh all backend-wired sections every time we land here
    setLoadingTasks(true);
    setLoadingDocs(true);
    setLoadingProjects(true);
    fetchInProgress();
    fetchRecentDocs();
    fetchFavProjects();

    // If navigated here with scrollToNotes param, expand and scroll to Quick Actions
    if (route.params?.scrollToNotes) {
      setNotesExpanded(true);
      setTimeout(() => {
        quickActionsRef.current?.measureLayout(
          scrollRef.current,
          (_x, y) => scrollRef.current?.scrollTo({ y: y - 12, animated: true }),
          () => {}
        );
      }, 400);
      navigation.setParams({ scrollToNotes: false });
    }
  }, [route.params?.scrollToNotes, fetchInProgress, fetchRecentDocs, fetchFavProjects]));

  const handleQuickNotesPress = () => {
    setNotesExpanded(prev => !prev);
    if (!notesExpanded) {
      setTimeout(() => {
        quickActionsRef.current?.measureLayout(
          scrollRef.current,
          (_x, y) => scrollRef.current?.scrollTo({ y: y - 12, animated: true }),
          () => {}
        );
      }, 100);
    }
  };

  const formatDate = iso => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  // Navigate to Tasks tab and open the specific task
  const openTask = (task) => {
    try { navigation.jumpTo('Tasks', { openTaskId: task.id }); }
    catch { navigation.navigate('Main', { screen: 'Tasks', params: { openTaskId: task.id } }); }
  };

  // Navigate to a project's detail view
  const openProject = (project) => {
    try { navigation.jumpTo('Projects', { openProjectId: project.id }); }
    catch { navigation.navigate('Main', { screen: 'Projects', params: { openProjectId: project.id } }); }
  };

  const goToTasksFiltered = () => {
    try { navigation.jumpTo('Tasks', { presetFilter: 'in_progress' }); }
    catch { navigation.navigate('Main', { screen: 'Tasks', params: { presetFilter: 'in_progress' } }); }
  };

  const userFirstName = (user?.name || user?.username || 'there').split(' ')[0];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0D0D0F" : "#fff"} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Dashboard" />
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>D</Text>
          </View>
          <Text style={[styles.brandName, { color: txt }]}>DYUKSA</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity
            style={[styles.navIconBtn, { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr }]}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Welcome Header */}
      <View style={[styles.pageHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <Text style={[styles.welcomeText, { color: txt }]}>Welcome back, {userFirstName}!</Text>
        <Text style={[styles.subText, { color: sub }]}>Here's a quick overview of your workspace.</Text>
      </View>

      <ScrollView ref={scrollRef} style={[styles.scroll, { backgroundColor: bg }]} showsVerticalScrollIndicator={false}>

        {/* ── Section 1 — In Progress ───────────────────────────────────── */}
        <View style={[styles.card, styles.fixedCard, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt, marginBottom: 0 }]}>
              In Progress {inProgressTasks.length > 0 ? `(${inProgressTasks.length})` : ''}
            </Text>
            {inProgressTasks.length > 0 && (
              <TouchableOpacity onPress={goToTasksFiltered}>
                <Text style={[styles.viewAll, { color: sub }]}>View All →</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingTasks ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#4ECDC4" />
            </View>
          ) : inProgressTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🕐</Text>
              <Text style={[styles.emptyLabel, { color: sub }]}>No in-progress tasks assigned to you</Text>
              <Text style={[styles.emptySubLabel, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>
                Tasks you're actively working on will appear here.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {inProgressTasks.slice(0, 3).map((task) => {
                const projName = task.project_details?.name || `Project #${task.project ?? '—'}`;
                const due = task.end_date ? new Date(task.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
                const prioColor = PRIORITY_COLORS[(task.priority || '').toLowerCase()] || '#9CA3AF';
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.taskRow, { borderColor: bdr }]}
                    onPress={() => openTask(task)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.priorityBar, { backgroundColor: prioColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskHeading, { color: txt }]} numberOfLines={1}>
                        {task.heading || 'Untitled task'}
                      </Text>
                      <View style={styles.taskMeta}>
                        <Text style={[styles.taskMetaText, { color: sub }]} numberOfLines={1}>{projName}</Text>
                        {due && (
                          <>
                            <Text style={[styles.taskMetaDot, { color: sub }]}>•</Text>
                            <Text style={[styles.taskMetaText, { color: sub }]}>Due {due}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>In Progress</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {inProgressTasks.length > 3 && (
                <TouchableOpacity onPress={goToTasksFiltered} style={{ paddingVertical: 6 }}>
                  <Text style={[{ fontSize: fs(12), color: '#4ECDC4', fontWeight: '600', textAlign: 'center' }]}>
                    +{inProgressTasks.length - 3} more
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── Section 2 — Recent Documents ──────────────────────────────── */}
        <View style={[styles.card, styles.fixedCard, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt, marginBottom: 0 }]}>Recent Documents</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Docs')}>
              <Text style={[styles.viewAll, { color: sub }]}>View All →</Text>
            </TouchableOpacity>
          </View>

          {loadingDocs ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#4ECDC4" />
            </View>
          ) : recentDocs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={[styles.emptyLabel, { color: sub }]}>No documents yet</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {recentDocs.map((doc) => {
                const meta = fileMeta(doc.name);
                const uploader = doc.created_by?.full_name || doc.created_by?.username || 'Unknown';
                const when = fmtRelative(doc.created_at || doc.updated_at);
                return (
                  <TouchableOpacity
                    key={doc.id}
                    style={[styles.docRow, { borderColor: bdr }]}
                    onPress={() => navigation.navigate('Docs')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.docIcon, { backgroundColor: meta.color + '22' }]}>
                      <Text style={[styles.docIconText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docName, { color: txt }]} numberOfLines={1}>
                        {doc.name || 'Untitled'}
                      </Text>
                      <Text style={[styles.docMeta, { color: sub }]} numberOfLines={1}>
                        {uploader} • {when}
                      </Text>
                    </View>
                    <Text style={[styles.chevron, { color: sub }]}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Section 3 — Favourite Projects ────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt, marginBottom: 0 }]}>Favourite Projects</Text>
            <TouchableOpacity onPress={() => (() => { try { navigation.jumpTo('Projects'); } catch { navigation.navigate('Main', { screen: 'Projects' }); } })()}>
              <Text style={[styles.viewAll, { color: sub }]}>View All →</Text>
            </TouchableOpacity>
          </View>

          {loadingProjects ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#4ECDC4" />
            </View>
          ) : favProjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={[styles.emptyLabel, { color: sub }]}>No projects yet</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {favProjects.map((proj) => {
                const initial = (proj.name || '?').charAt(0).toUpperCase();
                const memberCount = (proj.members || proj.assigned_members || []).length;
                const status = proj.status || proj.project_status;
                return (
                  <TouchableOpacity
                    key={proj.id}
                    style={[styles.projectRow, { borderColor: bdr }]}
                    onPress={() => openProject(proj)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.projectAvatar}>
                      <Text style={styles.projectAvatarText}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.projectName, { color: txt }]} numberOfLines={1}>
                        {proj.name || 'Untitled project'}
                      </Text>
                      <Text style={[styles.projectMeta, { color: sub }]} numberOfLines={1}>
                        {memberCount > 0 ? `${memberCount} member${memberCount !== 1 ? 's' : ''}` : 'No members'}
                        {status ? ` • ${status}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.chevron, { color: sub }]}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Section 4 — Quick Actions (with inline Quick Notes expansion) ── */}
        <View ref={quickActionsRef} style={[styles.card, { marginBottom: 24, backgroundColor: card, borderColor: bdr }]}>
          <Text style={[styles.cardTitle, { color: txt }]}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => (() => { try { navigation.jumpTo('Calendar'); } catch { navigation.navigate('Main', { screen: 'Calendar' }); } })()}
            >
              <Text style={styles.quickIcon}>📅</Text>
              <Text style={[styles.quickLabel, { color: sub }]}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => (() => { try { navigation.jumpTo('Tasks', { presetFilter: 'mine' }); } catch { navigation.navigate('Main', { screen: 'Tasks', params: { presetFilter: 'mine' } }); } })()}
            >
              <Text style={styles.quickIcon}>📋</Text>
              <Text style={[styles.quickLabel, { color: sub }]}>My Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => navigation.navigate('Docs')}
            >
              <Text style={styles.quickIcon}>📄</Text>
              <Text style={[styles.quickLabel, { color: sub }]}>Documents</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }, notesExpanded && styles.quickBtnActive]}
              onPress={handleQuickNotesPress}
            >
              <Text style={styles.quickIcon}>⚡</Text>
              <Text style={[styles.quickLabel, { color: sub }, notesExpanded && styles.quickLabelActive]}>
                Quick{'\n'}Notes
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline Quick Notes panel — shown when expanded */}
          {notesExpanded && (
            <View style={[styles.notesPanel, { borderTopColor: bdr }]}>
              <View style={styles.notesPanelHeader}>
                <Text style={[styles.notesPanelTitle, { color: txt }]}>⚡ Quick Notes</Text>
                <TouchableOpacity onPress={() => setNotesExpanded(false)}>
                  <Text style={[styles.notesCollapse, { color: sub }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {quickNotes.length === 0 ? (
                <View style={styles.notesEmpty}>
                  <Text style={[styles.notesEmptyText, { color: sub }]}>No notes yet — tap ＋ to create one</Text>
                </View>
              ) : (
                quickNotes.map((note, index) => (
                  <View
                    key={note.id}
                    style={[
                      styles.noteCard,
                      { borderBottomColor: isDark ? '#252530' : '#F5F5F7' },
                      index === quickNotes.length - 1 && { borderBottomWidth: 0, marginBottom: 0 },
                    ]}
                  >
                    <View style={styles.noteLine} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.noteName, { color: txt }]} numberOfLines={1}>{note.name}</Text>
                      {!!note.description && (
                        <Text style={[styles.noteDesc, { color: sub }]} numberOfLines={2}>{note.description}</Text>
                      )}
                      <Text style={[styles.noteDate, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>{formatDate(note.createdAt)}</Text>
                    </View>
                    <View style={[
                      styles.noteBadge,
                      { backgroundColor: note.status === 'Done' ? 'rgba(74,222,128,0.12)' : 'rgba(78,205,196,0.12)' },
                    ]}>
                      <Text style={[
                        styles.noteBadgeText,
                        { color: note.status === 'Done' ? '#4ADE80' : '#4ECDC4' },
                      ]}>
                        {note.status}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', letterSpacing: 1 },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },
  pageHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  welcomeText: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  subText: { fontSize: 12, color: '#888899', marginTop: 2 },
  scroll: { flex: 1, padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EBEBF0' },
  fixedCard: { minHeight: 160 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 10 },
  viewAll: { fontSize: 12, color: '#888899' },

  // Empty / loading states
  emptyState: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  loadingState: { paddingVertical: 28, alignItems: 'center' },
  emptyIcon: { fontSize: 28, opacity: 0.3 },
  emptyLabel: { fontSize: 13, color: '#888899', textAlign: 'center', fontWeight: '500' },
  emptySubLabel: { fontSize: 11, color: '#AAAABC', textAlign: 'center' },

  // Task row (In Progress section)
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1, overflow: 'hidden',
  },
  priorityBar: { width: 3, height: 36, borderRadius: 2 },
  taskHeading: { fontSize: 13, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  taskMetaText: { fontSize: 11, flexShrink: 1 },
  taskMetaDot: { fontSize: 11 },
  statusPill: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: { color: '#F59E0B', fontSize: 10, fontWeight: '700' },

  // Doc row (Recent Documents section)
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1,
  },
  docIcon: {
    width: 38, height: 38, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  docIconText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  docName: { fontSize: 13, fontWeight: '600' },
  docMeta: { fontSize: 11, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '300' },

  // Project row (Favourite Projects section)
  projectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1,
  },
  projectAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#7C3AED',
    justifyContent: 'center', alignItems: 'center',
  },
  projectAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  projectName: { fontSize: 13, fontWeight: '600' },
  projectMeta: { fontSize: 11, marginTop: 2 },

  // Quick Actions
  quickRow: { flexDirection: 'row', gap: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: { width: '48%', alignItems: 'center', paddingVertical: 18, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0', gap: 8 },
  quickBtnActive: { borderColor: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.06)' },
  quickIcon: { fontSize: 26 },
  quickLabel: { fontSize: 10, color: '#888899', textAlign: 'center', fontWeight: '500', lineHeight: 14 },
  quickLabelActive: { color: '#4ECDC4', fontWeight: '700' },

  // Inline notes panel inside Quick Actions card
  notesPanel: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F5', paddingTop: 12 },
  notesPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  notesPanelTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  notesCollapse: { fontSize: 13, color: '#AAAABC', fontWeight: '600', paddingHorizontal: 4 },
  notesEmpty: { paddingVertical: 14, alignItems: 'center' },
  notesEmptyText: { fontSize: 12, color: '#AAAABC' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F7', marginBottom: 2 },
  noteLine: { width: 3, height: 40, backgroundColor: '#4ECDC4', borderRadius: 2, marginTop: 2 },
  noteName: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  noteDesc: { fontSize: 12, color: '#888899', marginTop: 2, lineHeight: 17 },
  noteDate: { fontSize: 11, color: '#AAAABC', marginTop: 4 },
  noteBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  noteBadgeText: { fontSize: 10, fontWeight: '600' },
});
