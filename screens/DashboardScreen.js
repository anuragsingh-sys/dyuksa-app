import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import { useRef, useCallback, useState, useContext } from 'react';
import { getProjects, getTasks, getAccessToken } from '../services/ApiService';

const API_BASE = 'http://192.168.1.164:8000';

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

// Task status options + labels + colours (mirrors TasksScreen.js)
const TASK_STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'backlog', 'deployed', 'deferred', 'review'];
const TASK_STATUS_LABELS  = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review' };
const TASK_STATUS_COLORS  = { pending: '#888899', in_progress: '#F59E0B', completed: '#4ADE80', backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA' };

// Document status options + labels + colours (matches the web's dropdown)
const DOC_STATUS_OPTIONS = ['draft', 'in_review', 'approved', 'archived'];
const DOC_STATUS_LABELS  = { draft: 'Draft', in_review: 'In Review', approved: 'Approved', archived: 'Archived' };
const DOC_STATUS_COLORS  = { draft: '#888899', in_review: '#F59E0B', approved: '#4ADE80', archived: '#9CA3AF' };

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
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Note composer modal state
  const [composerVisible, setComposerVisible] = useState(false);
  const [draftContent,    setDraftContent]    = useState('');
  const [draftFolderId,   setDraftFolderId]   = useState(null);
  const [draftProjectId,  setDraftProjectId]  = useState(null);
  const [savingNote,      setSavingNote]      = useState(false);
  const [foldersList,     setFoldersList]     = useState([]);
  const [projectsList,    setProjectsList]    = useState([]);
  const [picker,          setPicker]          = useState(null);   // 'folder' | 'project' | null

  // ── Backend-wired sections ─────────────────────────────────────────────
  const [inProgressTasks, setInProgressTasks] = useState([]);
  const [recentDocs, setRecentDocs]           = useState([]);
  const [favProjects, setFavProjects]         = useState([]);
  const [loadingTasks, setLoadingTasks]       = useState(true);
  const [loadingDocs, setLoadingDocs]         = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Status picker state — one is open at a time. type identifies which list.
  // shape: { type: 'task'|'doc', id }
  const [statusPicker,    setStatusPicker]    = useState(null);
  const [savingStatus,    setSavingStatus]    = useState(false);
  // Track which fav-project row is currently being toggled (for spinner / disable)
  const [togglingFavId,   setTogglingFavId]   = useState(null);

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

  // ── Quick Notes ─────────────────────────────────────────────────────────
  // GET /api/v1/quicknotes/notes/  → DRF paginated { count, results: [...] }
  // Each note: { id, user, folder, project, title, content, attachments, created_at, updated_at }
  // (title is auto-generated server-side, content is plain text)
  const fetchQuickNotes = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/quicknotes/notes/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`notes ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      list.sort((a, b) => {
        const da = new Date(a.created_at || a.updated_at || 0).getTime();
        const db = new Date(b.created_at || b.updated_at || 0).getTime();
        return db - da;
      });
      setQuickNotes(list.slice(0, 10));   // keep top 10 in state, render top 5
    } catch (e) {
      console.warn('fetchQuickNotes failed:', e?.message || e);
      setQuickNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  // Lazy-load folders and projects only when the composer opens — avoids the
  // unconditional double-fetch on every dashboard mount.
  const ensureComposerData = async () => {
    try {
      const token = await getAccessToken();
      const tasks = [];
      if (foldersList.length === 0) {
        tasks.push(
          fetch(`${API_BASE}/api/v1/quicknotes/folders/`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }).then(r => r.ok ? r.json() : null)
        );
      } else { tasks.push(null); }
      if (projectsList.length === 0) {
        tasks.push(getProjects().catch(() => null));
      } else { tasks.push(null); }
      const [foldersResp, projectsResp] = await Promise.all(tasks);
      if (foldersResp) {
        const folders = Array.isArray(foldersResp) ? foldersResp : (foldersResp.results || []);
        setFoldersList(folders);
        if (!draftFolderId && folders[0]) setDraftFolderId(folders[0].id);
      }
      if (projectsResp) {
        const projects = Array.isArray(projectsResp) ? projectsResp : (projectsResp.results || []);
        setProjectsList(projects);
        if (!draftProjectId && projects[0]) setDraftProjectId(projects[0].id);
      }
    } catch (e) {
      console.warn('ensureComposerData failed:', e?.message || e);
    }
  };

  const openComposer = async () => {
    setDraftContent('');
    setComposerVisible(true);
    ensureComposerData();   // fire-and-forget; modal renders immediately
  };

  const closeComposer = () => {
    if (savingNote) return;
    setComposerVisible(false);
    setPicker(null);
  };

  const submitNote = async () => {
    const content = draftContent.trim();
    if (!content) {
      Alert.alert('Empty note', 'Type something to save.');
      return;
    }
    if (!draftFolderId || !draftProjectId) {
      Alert.alert(
        'Missing folder or project',
        'Both are required by the backend. Pick them from the dropdowns above.',
      );
      return;
    }
    setSavingNote(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/quicknotes/notes/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          content,
          folder:  draftFolderId,
          project: draftProjectId,
        }),
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try { const e = await res.json(); detail = e.detail || JSON.stringify(e); } catch {}
        throw new Error(detail);
      }
      const created = await res.json();
      // Prepend to state so it appears immediately, then refresh in background
      setQuickNotes(prev => [created, ...prev].slice(0, 10));
      setComposerVisible(false);
      setDraftContent('');
      setNotesExpanded(true);     // expand the panel so the new note is visible
      fetchQuickNotes();          // sync with server
    } catch (e) {
      Alert.alert('Could not save note', e?.message || 'Try again later.');
    } finally {
      setSavingNote(false);
    }
  };

  useFocusEffect(useCallback(() => {
    // Refresh all backend-wired sections every time we land here
    setLoadingTasks(true);
    setLoadingDocs(true);
    setLoadingProjects(true);
    setLoadingNotes(true);
    fetchInProgress();
    fetchRecentDocs();
    fetchFavProjects();
    fetchQuickNotes();

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
  }, [route.params?.scrollToNotes, fetchInProgress, fetchRecentDocs, fetchFavProjects, fetchQuickNotes]));

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

  // ── Inline status updates ───────────────────────────────────────────────
  // Task: PATCH /api/v1/tasksite/{id}/  body { status }
  // Doc:  PATCH /api/v1/documents/{id}/ body { status }
  // If the new status moves the row out of the section's filter (e.g. task
  // changes from in_progress → completed), we drop it from local state so it
  // visually leaves the dashboard immediately. The Tasks tab on next focus
  // will reflect the up-to-date data anyway.
  const updateStatus = async (newStatus) => {
    if (!statusPicker || !newStatus) return;
    const { type, id } = statusPicker;
    const list  = type === 'task' ? inProgressTasks : recentDocs;
    const target = list.find(x => x.id === id);
    if (!target || target.status === newStatus) {
      setStatusPicker(null);
      return;
    }
    setSavingStatus(true);
    const url = type === 'task'
      ? `${API_BASE}/api/v1/tasksite/${id}/`
      : `${API_BASE}/api/v1/documents/${id}/`;
    try {
      const token = await getAccessToken();
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try { const e = await res.json(); detail = e.detail || JSON.stringify(e); } catch {}
        throw new Error(detail);
      }
      if (type === 'task') {
        if (newStatus === 'in_progress') {
          // Stay in this section, just update the local copy
          setInProgressTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
        } else {
          // Moves out of "In Progress" — drop it
          setInProgressTasks(prev => prev.filter(t => t.id !== id));
        }
      } else {
        // Doc status change — keep it in the Recent Documents list, just update label
        setRecentDocs(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
      }
    } catch (e) {
      Alert.alert(
        type === 'task' ? 'Could not update task' : 'Could not update document',
        e?.message || 'Try again later.',
      );
    } finally {
      setSavingStatus(false);
      setStatusPicker(null);
    }
  };

  // Toggle favourite on a project — defensive about field name (matches
  // ProjectsScreen): tries is_favourite first, falls back through other
  // common keys. Optimistically removes from this list since the section
  // shows favourites only.
  const toggleFavProject = async (project) => {
    if (!project?.id || togglingFavId) return;
    const candidates = ['is_favourite', 'is_favorite', 'is_starred', 'is_pinned', 'favourite', 'favorite', 'starred'];
    let key = candidates.find(k => Object.prototype.hasOwnProperty.call(project, k)) || 'is_favourite';

    setTogglingFavId(project.id);
    // Optimistic: remove from this section (the next refresh will sync)
    setFavProjects(prev => prev.filter(p => p.id !== project.id));

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/projects/${project.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ [key]: false }),
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try { const e = await res.json(); detail = e.detail || JSON.stringify(e); } catch {}
        throw new Error(detail);
      }
    } catch (e) {
      // Restore the project to the list on failure
      setFavProjects(prev => [project, ...prev]);
      Alert.alert(
        'Could not unfavourite',
        e?.message || 'Try again later.',
      );
    } finally {
      setTogglingFavId(null);
    }
  };

  const userFirstName = (user?.name || user?.username || 'there').split(' ')[0];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0D0D0F" : "#fff"} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Dashboard" />
          <TouchableOpacity
            style={styles.logoBox}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            activeOpacity={0.7}
          >
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
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

      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, { backgroundColor: bg }]}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >

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
                  <View
                    key={task.id}
                    style={[styles.taskRow, { borderColor: bdr }]}
                  >
                    <View style={[styles.priorityBar, { backgroundColor: prioColor }]} />
                    {/* Tapping the content opens the task detail */}
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => openTask(task)}
                      activeOpacity={0.7}
                    >
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
                    </TouchableOpacity>
                    {/* Sibling tappable pill — opens status picker only */}
                    <TouchableOpacity
                      style={[styles.statusPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                      onPress={() => setStatusPicker({ type: 'task', id: task.id })}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.statusPillText}>{TASK_STATUS_LABELS[task.status] || task.status || 'In Progress'}</Text>
                      <Text style={[styles.statusPillText, { fontSize: 8 }]}>▾</Text>
                    </TouchableOpacity>
                  </View>
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
                const docStatus = (doc.status || 'draft').toLowerCase();
                const statusColor = DOC_STATUS_COLORS[docStatus] || '#888899';
                return (
                  <View
                    key={doc.id}
                    style={[styles.docRow, { borderColor: bdr }]}
                  >
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
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
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.docStatusPill, { backgroundColor: statusColor + '20' }]}
                      onPress={() => setStatusPicker({ type: 'doc', id: doc.id })}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.docStatusText, { color: statusColor }]} numberOfLines={1}>
                        {(DOC_STATUS_LABELS[docStatus] || docStatus).toUpperCase()}
                      </Text>
                      <Text style={[styles.docStatusText, { color: statusColor, fontSize: 8 }]}>▾</Text>
                    </TouchableOpacity>
                  </View>
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
                // Detect if this project actually has the favourite flag set
                // (true favourites). The section may also include "most recently
                // updated" fallback rows when no favourites exist — those will
                // show an unfilled star instead of gold.
                const isFav = !!(
                  proj.is_favourite || proj.is_favorite ||
                  proj.is_starred   || proj.is_pinned   ||
                  proj.favourite    || proj.favorite    ||
                  proj.starred
                );
                const busy = togglingFavId === proj.id;
                return (
                  <View
                    key={proj.id}
                    style={[styles.projectRow, { borderColor: bdr }]}
                  >
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
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
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.projectFavBtn}
                      onPress={() => {
                        if (isFav) {
                          toggleFavProject(proj);
                        } else {
                          Alert.alert(
                            'Favourite this project?',
                            'Use the star on the Projects tab to add it to your favourites.',
                          );
                        }
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      disabled={busy}
                      activeOpacity={0.6}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#F59E0B" />
                      ) : (
                        <Text style={[styles.projectFavIcon, isFav && styles.projectFavIconActive]}>
                          {isFav ? '★' : '☆'}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <Text style={[styles.chevron, { color: sub }]}>›</Text>
                  </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={openComposer}>
                    <Text style={[styles.notesAddNew, { color: '#4ECDC4' }]}>+ New</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setNotesExpanded(false)}>
                    <Text style={[styles.notesCollapse, { color: sub }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {loadingNotes ? (
                <View style={styles.notesEmpty}>
                  <ActivityIndicator size="small" color="#4ECDC4" />
                </View>
              ) : quickNotes.length === 0 ? (
                <View style={styles.notesEmpty}>
                  <Text style={[styles.notesEmptyText, { color: sub }]}>No notes yet — tap + New to create one</Text>
                </View>
              ) : (
                quickNotes.slice(0, 5).map((note, index, arr) => (
                  <View
                    key={note.id}
                    style={[
                      styles.noteCard,
                      { borderBottomColor: isDark ? '#252530' : '#F5F5F7' },
                      index === arr.length - 1 && { borderBottomWidth: 0, marginBottom: 0 },
                    ]}
                  >
                    <View style={styles.noteLine} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.noteName, { color: txt }]} numberOfLines={1}>
                        {note.title || 'Untitled note'}
                      </Text>
                      {!!note.content && (
                        <Text style={[styles.noteDesc, { color: sub }]} numberOfLines={2}>
                          {note.content}
                        </Text>
                      )}
                      <Text style={[styles.noteDate, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>
                        {formatDate(note.created_at)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── Quick Note Composer Modal ────────────────────────────────────── */}
      <Modal
        visible={composerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeComposer}
      >
        <View style={styles.composerBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.composerCard, { backgroundColor: card, borderColor: bdr }]}>
              <View style={styles.composerHeader}>
                <Text style={[styles.composerTitle, { color: txt }]}>New Quick Note</Text>
                <TouchableOpacity onPress={closeComposer} disabled={savingNote} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={[styles.composerClose, { color: sub }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.composerHint, { color: sub }]}>
                Title is generated automatically when you save.
              </Text>

              <TextInput
                style={[styles.composerInput, { color: txt, borderColor: bdr, backgroundColor: bg }]}
                placeholder="Type your note here…"
                placeholderTextColor={isDark ? '#5C5C6E' : '#AAAABC'}
                value={draftContent}
                onChangeText={setDraftContent}
                multiline
                autoFocus
                editable={!savingNote}
              />

              {/* Folder + Project pickers (both required by backend) */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.composerPickerBtn, { borderColor: bdr }]}
                  onPress={() => setPicker('folder')}
                  disabled={savingNote}
                >
                  <Text style={[styles.composerPickerLabel, { color: sub }]}>Folder</Text>
                  <Text style={[styles.composerPickerValue, { color: txt }]} numberOfLines={1}>
                    {foldersList.find(f => f.id === draftFolderId)?.name || 'Choose folder'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.composerPickerBtn, { borderColor: bdr }]}
                  onPress={() => setPicker('project')}
                  disabled={savingNote}
                >
                  <Text style={[styles.composerPickerLabel, { color: sub }]}>Project</Text>
                  <Text style={[styles.composerPickerValue, { color: txt }]} numberOfLines={1}>
                    {projectsList.find(p => p.id === draftProjectId)?.name || 'Choose project'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.composerBtn, styles.composerCancel, { borderColor: bdr }]}
                  onPress={closeComposer}
                  disabled={savingNote}
                >
                  <Text style={[styles.composerCancelText, { color: txt }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.composerBtn, styles.composerSave, savingNote && { opacity: 0.6 }]}
                  onPress={submitNote}
                  disabled={savingNote}
                >
                  {savingNote ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.composerSaveText}>Save Note</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Folder / Project picker (nested modal, shown above composer) */}
      <Modal
        visible={!!picker}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <TouchableOpacity
          style={styles.composerBackdrop}
          activeOpacity={1}
          onPress={() => setPicker(null)}
        >
          <View style={[styles.pickerSheet, { backgroundColor: card, borderColor: bdr }]}>
            <Text style={[styles.composerTitle, { color: txt, marginBottom: 10 }]}>
              Choose {picker === 'folder' ? 'folder' : 'project'}
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {(picker === 'folder' ? foldersList : projectsList).map(item => {
                const active = picker === 'folder' ? item.id === draftFolderId : item.id === draftProjectId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.pickerItem, { borderBottomColor: bdr }, active && { backgroundColor: 'rgba(78,205,196,0.08)' }]}
                    onPress={() => {
                      if (picker === 'folder') setDraftFolderId(item.id);
                      else setDraftProjectId(item.id);
                      setPicker(null);
                    }}
                  >
                    <Text style={[{ fontSize: 14, color: txt, flex: 1 }, active && { color: '#4ECDC4', fontWeight: '700' }]}>
                      {item.name || `#${item.id}`}
                    </Text>
                    {active && <Text style={{ color: '#4ECDC4', fontSize: 14, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              {(picker === 'folder' ? foldersList : projectsList).length === 0 && (
                <Text style={[styles.notesEmptyText, { color: sub, padding: 16 }]}>
                  Loading…
                </Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Status Picker Modal (used by both task pills and doc pills) ─── */}
      <Modal
        visible={!!statusPicker}
        transparent
        animationType="fade"
        onRequestClose={() => !savingStatus && setStatusPicker(null)}
      >
        <TouchableOpacity
          style={styles.composerBackdrop}
          activeOpacity={1}
          onPress={() => !savingStatus && setStatusPicker(null)}
        >
          <View style={[styles.statusPickerCard, { backgroundColor: card, borderColor: bdr }]}>
            {(() => {
              if (!statusPicker) return null;
              const isTask = statusPicker.type === 'task';
              const target = isTask
                ? inProgressTasks.find(x => x.id === statusPicker.id)
                : recentDocs.find(x => x.id === statusPicker.id);
              const opts    = isTask ? TASK_STATUS_OPTIONS : DOC_STATUS_OPTIONS;
              const labels  = isTask ? TASK_STATUS_LABELS  : DOC_STATUS_LABELS;
              const colors  = isTask ? TASK_STATUS_COLORS  : DOC_STATUS_COLORS;
              const current = (target?.status || (isTask ? 'in_progress' : 'draft')).toLowerCase();
              return (
                <>
                  <Text style={[styles.composerTitle, { color: txt }]}>
                    Change {isTask ? 'Task' : 'Document'} Status
                  </Text>
                  <Text style={[styles.composerHint, { color: sub }]} numberOfLines={1}>
                    {target?.heading || target?.name || ''}
                  </Text>
                  <View style={{ height: 6 }} />
                  {opts.map(opt => {
                    const active = current === opt;
                    const color  = colors[opt] || '#888';
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.statusOptionRow,
                          { borderColor: bdr },
                          active && { backgroundColor: color + '15', borderColor: color },
                        ]}
                        onPress={() => updateStatus(opt)}
                        disabled={savingStatus}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.statusDot, { backgroundColor: color }]} />
                        <Text style={[
                          styles.statusOptionText,
                          { color: txt },
                          active && { color, fontWeight: '700' },
                        ]}>
                          {labels[opt]}
                        </Text>
                        {active && <Text style={[styles.statusOptionCheck, { color }]}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                  {savingStatus && (
                    <View style={styles.statusOverlay}>
                      <ActivityIndicator size="small" color="#4ECDC4" />
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
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
  notesAddNew: { fontSize: 12, fontWeight: '700' },

  // ── Quick Note Composer Modal ─────────────────────────────────────────
  composerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 16,
  },
  composerCard: {
    width: '100%', maxWidth: 400,
    borderRadius: 14, borderWidth: 1,
    padding: 16,
  },
  composerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  composerTitle: { fontSize: 16, fontWeight: '700' },
  composerClose: { fontSize: 18, fontWeight: '600', paddingHorizontal: 4 },
  composerHint: { fontSize: 11, marginBottom: 10 },
  composerInput: {
    minHeight: 110, maxHeight: 200,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, lineHeight: 20,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  composerPickerBtn: {
    flex: 1, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  composerPickerLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  composerPickerValue: { fontSize: 13, fontWeight: '600' },
  composerBtn: {
    flex: 1, height: 42, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  composerCancel: { borderWidth: 1, backgroundColor: 'transparent' },
  composerCancelText: { fontSize: 14, fontWeight: '600' },
  composerSave: { backgroundColor: '#1A1A2E' },
  composerSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Folder / Project picker sheet (shown above composer)
  pickerSheet: {
    width: '100%', maxWidth: 360,
    borderRadius: 14, borderWidth: 1,
    padding: 14,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 12,
    borderBottomWidth: 1,
  },

  // Doc status pill in Recent Documents
  docStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  docStatusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },

  // Favourite star button on Favourite Projects rows
  projectFavBtn: {
    paddingHorizontal: 6, paddingVertical: 2,
    marginRight: 4,
    minWidth: 28, alignItems: 'center',
  },
  projectFavIcon: { fontSize: 20, color: '#C0C0CE', lineHeight: 22 },
  projectFavIconActive: { color: '#F59E0B' },

  // Status picker modal (shared between task and doc)
  statusPickerCard: {
    width: '100%', maxWidth: 360,
    borderRadius: 14, borderWidth: 1,
    padding: 16,
  },
  statusOptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 10, borderWidth: 1, marginBottom: 6,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { flex: 1, fontSize: 13, fontWeight: '500' },
  statusOptionCheck: { fontSize: 14, fontWeight: '700' },
  statusOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
});
