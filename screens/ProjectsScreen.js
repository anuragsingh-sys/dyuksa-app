import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Animated, Image, Alert, ActivityIndicator, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useContext, useEffect, useCallback, useMemo } from 'react';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { NotificationsContext } from '../context/NotificationsContext';
import { AuthContext } from '../context/AuthContext';
import { getUsers, getProjects, createProject, getTasks, createTask, getAccessToken } from '../services/ApiService';
import SidebarMenu from '../components/SidebarMenu';
import TaskDetailModal from '../components/TaskDetailModal';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

import { API_BASE as CONFIG_API_BASE, BASE_URL } from '../config';

// ── API config ────────────────────────────────────────────────────────────────
const API_BASE     = CONFIG_API_BASE;
const DOCS_API     = `${API_BASE}/api/v1/documents/`;
const TASKSITE_API = `${API_BASE}/api/v1/tasksite/`;

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
const SCREEN_WIDTH = Dimensions.get('window').width;

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
const PROJECT_COLORS = [T.cBlue, T.cPurple, T.cGreen, T.cYellow, T.cRed];
const getProjectColor = (idx) => PROJECT_COLORS[idx % PROJECT_COLORS.length];

const FILTER_TABS = ['All', 'In Progress', 'Completed', 'Pinned'];

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
  const [projects,        setProjects]        = useState([]);
  const [users,           setUsers]           = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeFilter,    setActiveFilter]    = useState('All');
  const [search,          setSearch]          = useState('');

  // ── Create modal state ────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [projectName,  setProjectName]  = useState('');
  const [taskType,     setTaskType]     = useState(null);
  const [projectImages,setProjectImages]= useState([]);
  const [members,      setMembers]      = useState([{ user: null, role: null }]);
  const slideAnim = useRef(new Animated.Value(-600)).current;

  // ── Details modal state ───────────────────────────────────────────────────
  const [detailsVisible,  setDetailsVisible]  = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTasks,    setProjectTasks]    = useState([]);
  const [loadingTasks,    setLoadingTasks]    = useState(false);
  const [detailsTab,      setDetailsTab]      = useState('tasks');
  const [taskSearch,      setTaskSearch]      = useState('');
  const [projectDocs,     setProjectDocs]     = useState([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText,  setImportJsonText]  = useState('');
  const [importing,       setImporting]       = useState(false);
  const [importProgress,  setImportProgress]  = useState('');
  const [detailTask,      setDetailTask]      = useState(null);
  const detailsSlideAnim = useRef(new Animated.Value(0)).current;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => { fetchProjects(); fetchUsers(); }, []);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const list = await getProjects();
      setProjects(list);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not load projects.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchUsers = async () => {
    try { setUsers(await getUsers()); } catch (e) { console.warn('fetchUsers:', e.message); }
  };

  // ── Favourite toggle ──────────────────────────────────────────────────────
  const toggleFavourite = async (project) => {
    if (!project?.id) return;
    const key = detectFavKey(project);
    const currentlyFav = isProjectFav(project);
    const next = !currentlyFav;
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, [key]: next } : p));
    if (selectedProject?.id === project.id) setSelectedProject(p => p ? { ...p, [key]: next } : p);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/projects/${project.id}/`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch (e) {
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, [key]: currentlyFav } : p));
      if (selectedProject?.id === project.id) setSelectedProject(p => p ? { ...p, [key]: currentlyFav } : p);
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
    setModalVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, { toValue: -600, duration: 250, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      setProjectName(''); setTaskType(null); setProjectImages([]);
      setMembers([{ user: null, role: null }]);
    });
  };

  const openDetails = async (project) => {
    setSelectedProject(project);
    setDetailsVisible(true);
    setProjectTasks([]); setProjectDocs([]);
    setDetailsTab('tasks'); setTaskSearch('');
    Animated.timing(detailsSlideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    fetchProjectDocs(project.id);
    setLoadingTasks(true);
    try {
      const all = await getTasks();
      const forThis = (all || []).filter(t => {
        const pid = t.project_details?.id ?? t.project ?? t.project_id;
        return String(pid) === String(project.id);
      });
      setProjectTasks(forThis);
    } catch (e) {
      console.warn('fetch project tasks:', e.message);
    } finally {
      setLoadingTasks(false);
    }
  };

  const closeDetails = () => {
    Animated.timing(detailsSlideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setDetailsVisible(false); setSelectedProject(null);
      setProjectTasks([]); setProjectDocs([]);
      setUploadModalOpen(false); setDetailsTab('tasks');
    });
  };

  // ── Fetch project docs ────────────────────────────────────────────────────
  const fetchProjectDocs = useCallback(async (projectId) => {
    if (projectId == null) return;
    try {
      const token = await getAccessToken();
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      const projectDocPromise = (async () => {
        const out = [];
        let url = `${DOCS_API}?project=${projectId}`;
        let safety = 10;
        while (url && safety-- > 0) {
          const res = await fetch(url, { headers });
          if (!res.ok) break;
          const json = await res.json();
          out.push(...(Array.isArray(json) ? json : (json.results || json.documents || [])));
          url = (!Array.isArray(json) && json.next) || null;
        }
        return out;
      })();

      const taskAttachmentsPromise = (async () => {
        const tasks = [];
        let url = `${TASKSITE_API}?project=${projectId}`;
        let safety = 10;
        while (url && safety-- > 0) {
          const res = await fetch(url, { headers });
          if (!res.ok) break;
          const json = await res.json();
          tasks.push(...(Array.isArray(json) ? json : (json.results || [])));
          url = (!Array.isArray(json) && json.next) || null;
        }
        const forThis = tasks.filter(t => {
          const pid = t.project_details?.id ?? t.project ?? t.project_id;
          return String(pid) === String(projectId);
        });
        const flat = [];
        forThis.forEach(t => (t.attachments || []).forEach(a => flat.push({ ...a, _taskId: t.id, _taskHeading: t.heading })));
        return flat;
      })();

      const [direct, taskAtts] = await Promise.all([projectDocPromise, taskAttachmentsPromise]);

      const guessMime = (fn = '') => {
        const ext = String(fn).split('?')[0].split('.').pop().toLowerCase();
        if (['png','jpg','jpeg','gif','webp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        if (ext === 'pdf') return 'application/pdf';
        if (['doc','docx'].includes(ext)) return 'application/msword';
        if (['xls','xlsx','csv'].includes(ext)) return 'application/vnd.ms-excel';
        return 'application/octet-stream';
      };

      const norm = (d, source) => {
        const name = d.name || d.file_name || 'Untitled';
        const mt = guessMime(name);
        return {
          id: `${source}_${d.id}`, name, uri: d.source_file || d.file_url || null,
          mimeType: mt, size: d.file_size ?? null,
          uploadedAt: d.updated_at || d.created_at,
          type: mt.startsWith('image/') ? 'image' : 'file',
          source, taskId: d._taskId, taskHeading: d._taskHeading, _backend: true,
        };
      };

      const combined = [
        ...direct.map(d => norm(d, 'project')),
        ...taskAtts.map(d => norm(d, 'task')),
      ].sort((x, y) => new Date(y.uploadedAt || 0) - new Date(x.uploadedAt || 0));

      setProjectDocs(combined);
    } catch (e) {
      console.warn('fetchProjectDocs:', e?.message);
      setProjectDocs([]);
    }
  }, []);

  // ── Document upload (3-step S3 flow) ──────────────────────────────────────
  const addDocument = async (doc) => {
    if (!selectedProject?.id) { Alert.alert('Error', 'No project selected.'); return; }
    const projectId = selectedProject.id;
    try {
      const token = await getAccessToken();
      const step1 = await fetch(`${API_BASE}/api/v1/projects/${projectId}/get-upload-url/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: doc.name, file_type: doc.mimeType || 'application/octet-stream' }),
      });
      const presigned = await step1.json().catch(() => ({}));
      if (!step1.ok) throw new Error(presigned.detail || `get-upload-url failed (${step1.status})`);
      const { url: s3Url, fields, file_key } = presigned;
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
      form.append('file', { uri: doc.uri, name: doc.name, type: doc.mimeType || 'application/octet-stream' });
      const step2 = await fetch(s3Url, { method: 'POST', body: form });
      if (!step2.ok) throw new Error(`S3 upload failed (${step2.status})`);
      const step3 = await fetch(`${API_BASE}/api/v1/projects/${projectId}/confirm-upload/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_key, file_name: doc.name, file_type: doc.mimeType }),
      });
      if (!step3.ok) throw new Error(`confirm-upload failed (${step3.status})`);
      await fetchProjectDocs(projectId);
    } catch (e) {
      Alert.alert('Upload Failed', e?.message || 'Could not upload document.');
    }
  };

  const deleteDocument = (docId) => {
    const target = projectDocs.find(d => d.id === docId);
    Alert.alert('Cannot delete here', target?.source === 'task'
      ? 'This file is attached to a task. Open the task to remove it.'
      : 'Project documents must be deleted from the web dashboard.');
  };

  const pickFromCamera = async () => {
    setUploadModalOpen(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Camera Access Needed', 'Please allow camera access.'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      setUploading(true);
      await addDocument({ id: `doc_${Date.now()}`, name: `Photo_${Date.now()}.jpg`, uri: a.uri, mimeType: 'image/jpeg', size: a.fileSize || null, type: 'image', uploadedAt: new Date().toISOString() });
    } catch (e) { Alert.alert('Error', e.message); } finally { setUploading(false); }
  };

  const pickFromGallery = async () => {
    setUploadModalOpen(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Photo Access Needed', 'Please allow photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.85 });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      for (const a of result.assets) await addDocument({ id: `doc_${Date.now()}`, name: a.fileName || `Image_${Date.now()}.jpg`, uri: a.uri, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize || null, type: 'image', uploadedAt: new Date().toISOString() });
    } catch (e) { Alert.alert('Error', e.message); } finally { setUploading(false); }
  };

  const pickFromFiles = async () => {
    setUploadModalOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      for (const a of result.assets) await addDocument({ id: `doc_${Date.now()}`, name: a.name, uri: a.uri, mimeType: a.mimeType || 'application/octet-stream', size: a.size || null, type: 'file', uploadedAt: new Date().toISOString() });
    } catch (e) { Alert.alert('Error', e.message); } finally { setUploading(false); }
  };

  const getFileKind = (doc) => {
    const mt = (doc.mimeType || '').toLowerCase();
    const name = (doc.name || '').toLowerCase();
    if (mt.startsWith('image/')) return { label: 'IMG', icon: '🖼️' };
    if (mt.includes('pdf')) return { label: 'PDF', icon: '📕' };
    if (mt.includes('word') || name.endsWith('.docx')) return { label: 'DOC', icon: '📘' };
    if (mt.includes('sheet') || name.endsWith('.xlsx') || name.endsWith('.csv')) return { label: 'XLS', icon: '📗' };
    if (mt.startsWith('video/')) return { label: 'VID', icon: '🎬' };
    return { label: 'FILE', icon: '📎' };
  };

  const formatDocDate = (iso) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const m = Math.floor(diff / 60000);
      if (m < 1) return 'Just now';
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const d = Math.floor(h / 24);
      if (d < 7) return `${d}d ago`;
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  // ── Import tasks via JSON ─────────────────────────────────────────────────
  const openImportModal = () => { setImportJsonText(''); setImportProgress(''); setImportModalOpen(true); };
  const closeImportModal = () => { if (importing) return; setImportModalOpen(false); setImportJsonText(''); setImportProgress(''); };

  const pickJsonFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const text = await (await fetch(result.assets[0].uri)).text();
      setImportJsonText(text);
    } catch (e) { Alert.alert('Error', e.message || 'Could not read JSON file.'); }
  };

  const submitImportTasks = async () => {
    if (!importJsonText.trim()) { Alert.alert('Required', 'Paste JSON or pick a .json file.'); return; }
    if (!selectedProject) return;
    let parsed;
    try { parsed = JSON.parse(importJsonText.trim()); } catch { Alert.alert('Invalid JSON', 'The text is not valid JSON.'); return; }
    const tasksList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.tasks) ? parsed.tasks : null);
    if (!tasksList?.length) { Alert.alert('Invalid Format', 'JSON should contain a "tasks" array.'); return; }
    setImporting(true);
    let successCount = 0, failCount = 0;
    const failReasons = [];
    for (let i = 0; i < tasksList.length; i++) {
      const t = tasksList[i];
      setImportProgress(`Creating ${i + 1} of ${tasksList.length}...`);
      try {
        const assigneeIds = [];
        if (Array.isArray(t.assignee_emails)) t.assignee_emails.forEach(email => { const u = users.find(u => u.email?.toLowerCase() === email.toLowerCase()); if (u) assigneeIds.push(u.id); });
        if (Array.isArray(t.assigned_to)) t.assigned_to.forEach(id => { if (!assigneeIds.includes(id)) assigneeIds.push(id); });
        const formData = new FormData();
        formData.append('heading', String(t.heading || t.title || 'Untitled'));
        formData.append('project', String(selectedProject.id));
        if (t.description) formData.append('description', t.description);
        if (t.status) formData.append('status', t.status);
        if (t.priority) formData.append('priority', t.priority);
        if (t.start_date) formData.append('start_date', t.start_date);
        if (t.end_date) formData.append('end_date', t.end_date);
        assigneeIds.forEach(id => formData.append('assigned_to', String(id)));
        await createTask(formData);
        successCount++;
      } catch (e) { failCount++; failReasons.push(`Task ${i + 1}: ${e.message}`); }
    }
    setImporting(false); setImportProgress('');
    try {
      const all = await getTasks();
      setProjectTasks((all || []).filter(tk => String(tk.project_details?.id ?? tk.project ?? tk.project_id) === String(selectedProject.id)));
    } catch {}
    closeImportModal();
    if (successCount > 0) addNotification({ type: 'task', icon: '📋', title: 'Tasks Imported', body: `${successCount} task${successCount !== 1 ? 's' : ''} created in ${selectedProject.name}.` });
    if (failCount > 0 && successCount === 0) Alert.alert('Import Failed', `No tasks created.\n${failReasons.slice(0, 3).join('\n')}`);
    else if (failCount > 0) Alert.alert('Partial Success', `${successCount} created, ${failCount} failed.`);
    else Alert.alert('Success', `${successCount} task${successCount !== 1 ? 's' : ''} imported.`);
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
      assigned_members: validMembers.map(m => ({ user_id: m.user.id, role: m.role })),
      project_settings: { priority: 'high' },
    };
    setSaving(true);
    try {
      await createProject(body);
      addNotification({ type: 'project', icon: '🗂️', title: 'Project Created', body: `"${projectName.trim()}" was created successfully.` });
      await fetchProjects();
      closeModal();
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally { setSaving(false); }
  };

  // ── Filtered projects (dev_1 style filter tabs) ───────────────────────────
  const filtered = useMemo(() => {
    let list = projects;
    if (activeFilter === 'In Progress') list = list.filter(p => (p.status || 'In Progress') === 'In Progress');
    else if (activeFilter === 'Completed') list = list.filter(p => p.status === 'Completed');
    else if (activeFilter === 'Pinned') list = list.filter(p => isProjectFav(p));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [projects, activeFilter, search]);

  // Summary counts
  const activeCount   = projects.filter(p => (p.status || 'In Progress') === 'In Progress').length;
  const completedCount= projects.filter(p => p.status === 'Completed').length;
  const pinnedCount   = projects.filter(p => isProjectFav(p)).length;

  const userOptions = users.map(u => ({ label: `${u.first_name} ${u.last_name}`.trim() || u.username, ...u }));
  const roleOptions = ROLES.map(r => ({ label: r.charAt(0).toUpperCase() + r.slice(1), value: r }));
  const typeOptions = TASK_TYPES.map(t => ({ label: TASK_TYPE_LABELS[t], value: t }));

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Projects" />
          <TouchableOpacity style={s.logoBox} onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}>
            <Text style={s.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={[s.brandName, { color: txt }]}>Projects</Text>
        </View>
        <View style={s.navRight}>
          <TouchableOpacity
            style={[s.newBtn]}
            onPress={openModal}
          >
            <Text style={s.newBtnText}>+ New</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <ActivityIndicator
            animating={loadingProjects}
            color={T.brand}
          />
        }
      >
        {/* Summary tiles */}
        <View style={s.summaryRow}>
          <SummaryTile label="Active"    count={activeCount}    dotColor={T.cBlue} />
          <SummaryTile label="Done"      count={completedCount} dotColor={T.cGreen} />
          <SummaryTile label="Pinned"    count={pinnedCount}    dotColor={T.cYellow} />
        </View>

        {/* Search bar */}
        <View style={[s.searchBar, { backgroundColor: isDark ? '#1A1A20' : T.surfaceAlt, borderColor: bdr }]}>
          <Text style={{ fontSize: 15, marginRight: 6 }}>🔍</Text>
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

        {/* Loading */}
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
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#ccc' : T.ink2 }}>📌 Pinned</Text>
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
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={[s.projectIconSmall, { backgroundColor: color }]}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                                {(proj.name?.[0] || '?').toUpperCase()}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 14 }}>📌</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: txt, marginBottom: 3 }} numberOfLines={1}>{proj.name}</Text>
                          <Text style={{ fontSize: 11, color: sub, marginBottom: 10 }} numberOfLines={1}>
                            {TASK_TYPE_LABELS[proj.task_type] || proj.task_type || 'Project'}
                          </Text>
                          <Progress value={progress} color={color} h={5} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                            <Text style={{ fontSize: 11, color: sub }}>
                              {getProjectMembers(proj).length} member{getProjectMembers(proj).length !== 1 ? 's' : ''}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: T.ink2 }}>{progress}%</Text>
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
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#ccc' : T.ink2 }}>
                All Projects ({filtered.length})
              </Text>
            </View>

            {filtered.map((proj, idx) => {
              const color = getProjectColor(idx);
              const progress = proj.progress || proj.completion_percentage || 0;
              const memberList = getProjectMembers(proj);
              const taskCount = proj.task_count || proj.tasks_count || proj.total_tasks || 0;
              const isFav = isProjectFav(proj);

              return (
                <TouchableOpacity
                  key={proj.id}
                  onPress={() => openDetails(proj)}
                  activeOpacity={0.75}
                  style={[s.listCard, { backgroundColor: card, borderColor: bdr }]}
                >
                  {/* Top row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[s.projectIconLarge, { backgroundColor: color }]}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>
                        {(proj.name?.[0] || '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: txt }} numberOfLines={1}>{proj.name}</Text>
                      <Text style={{ fontSize: 12, color: sub, marginTop: 2 }}>
                        {TASK_TYPE_LABELS[proj.task_type] || proj.task_type || 'Project'}
                      </Text>
                    </View>
                    {/* Status chip */}
                    <View style={[s.statusChip, { backgroundColor: (STATUS_COLORS[proj.status] || T.cBlue) + '20' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: STATUS_COLORS[proj.status] || T.cBlue }}>
                        {proj.status || 'In Progress'}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={{ marginTop: 12 }}>
                    <Progress value={progress} color={color} h={5} />
                  </View>

                  {/* Footer */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
                    {/* Member avatars */}
                    {memberList.length > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {memberList.slice(0, 4).map((m, midx) => {
                          const name = m.user?.full_name || m.user?.username || m.user_details?.username || 'U';
                          const initial = String(name).charAt(0).toUpperCase();
                          return (
                            <View key={m.id || midx} style={[s.memberAvatar, { marginLeft: midx === 0 ? 0 : -8, zIndex: 4 - midx, borderColor: card }]}>
                              <Text style={s.memberAvatarText}>{initial}</Text>
                            </View>
                          );
                        })}
                        {memberList.length > 4 && (
                          <View style={[s.memberAvatar, { marginLeft: -8, backgroundColor: T.hairlineSoft, borderColor: card }]}>
                            <Text style={[s.memberAvatarText, { color: sub }]}>+{memberList.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 11, color: sub }}>No members</Text>
                    )}

                    {taskCount > 0 && (
                      <Text style={{ fontSize: 11, color: sub }}>· {taskCount} task{taskCount !== 1 ? 's' : ''}</Text>
                    )}

                    <View style={{ flex: 1 }} />

                    {/* Fav star */}
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); toggleFavourite(proj); }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={{ fontSize: 18, color: isFav ? '#F59E0B' : sub }}>{isFav ? '★' : '☆'}</Text>
                    </TouchableOpacity>

                    <Text style={{ fontSize: 12, fontWeight: '700', color: T.ink3 }}>{progress}%</Text>
                    <Text style={{ fontSize: 20, color: sub }}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
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

                <Text style={[ms.fieldLabel, { color: sub }]}>Project Name *</Text>
                <TextInput
                  placeholder="Enter project name..." placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  style={[ms.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', color: txt }]}
                  value={projectName} onChangeText={setProjectName} autoFocus
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

      {/* ── Project Details Full-Screen Modal ───────────────────────────────── */}
      {detailsVisible && selectedProject && (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bg, zIndex: 99 }} />
          <Animated.View style={[ds.screen, { backgroundColor: bg, zIndex: 100, transform: [{ translateX: detailsSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_WIDTH, 0] }) }] }]}>
            <View style={{ flex: 1, backgroundColor: bg }}>
              <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

              {/* Header */}
              <View style={[ds.header, { backgroundColor: card, borderBottomColor: bdr }]}>
                <TouchableOpacity style={ds.backBtn} onPress={closeDetails}>
                  <Text style={[ds.backIcon, { color: txt }]}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[ds.headerIcon, { backgroundColor: FILTER_COLORS[selectedProject.task_type] || T.cGreen }]}>
                    <Text style={ds.headerIconText}>{selectedProject.name?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ds.headerName, { color: txt }]} numberOfLines={1}>{selectedProject.name}</Text>
                    <Text style={[ds.headerType, { color: sub }]}>{TASK_TYPE_LABELS[selectedProject.task_type] || selectedProject.task_type}</Text>
                  </View>
                </View>
                <View style={[s.statusChip, { backgroundColor: (STATUS_COLORS[selectedProject.status] || T.cBlue) + '20' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: STATUS_COLORS[selectedProject.status] || T.cBlue }}>{selectedProject.status || 'In Progress'}</Text>
                </View>
              </View>

              {/* Tabs */}
              <View style={[ds.tabsRow, { backgroundColor: card, borderBottomColor: bdr }]}>
                {[
                  { id: 'tasks', label: 'Tasks', count: projectTasks.length },
                  { id: 'members', label: 'Members', count: getProjectMembers(selectedProject).length },
                  { id: 'documents', label: 'Documents', count: projectDocs.length },
                ].map(t => {
                  const isActive = detailsTab === t.id;
                  const activeColor = isDark ? '#4ECDC4' : '#1A1A2E';
                  return (
                    <TouchableOpacity key={t.id} style={[ds.tab, isActive && { borderBottomColor: activeColor }]} onPress={() => setDetailsTab(t.id)}>
                      <Text style={[ds.tabText, { color: sub }, isActive && { color: activeColor, fontWeight: '700' }]}>{t.label}</Text>
                      <View style={[ds.tabCount, { backgroundColor: isDark ? '#252530' : '#EBEBF0' }, isActive && { backgroundColor: activeColor }]}>
                        <Text style={[ds.tabCountText, { color: sub }, isActive && { color: isDark ? '#0D0D0F' : '#4ECDC4' }]}>{t.count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tab content */}
              <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 12 }}>

                {/* TASKS TAB */}
                {detailsTab === 'tasks' && (
                  <>
                    <View style={[ds.searchWrap, { backgroundColor: card, borderColor: bdr, marginBottom: 10 }]}>
                      <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
                      <TextInput style={[ds.searchInput, { color: txt }]} placeholder="Search tasks..." placeholderTextColor={sub} value={taskSearch} onChangeText={setTaskSearch} />
                    </View>
                    <View style={ds.taskActionsRow}>
                      <TouchableOpacity style={[ds.createTaskBtn, { flex: 1 }]} onPress={() => { closeDetails(); setTimeout(() => navigation.navigate('Main', { screen: 'Tasks', params: { openCreateModal: true, presetProjectId: selectedProject.id } }), 260); }}>
                        <Text style={ds.createTaskBtnText}>+ Create Task</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[ds.importBtn, { flex: 1 }]} onPress={openImportModal}>
                        <Text style={ds.importBtnText}>⬆ Import Tasks</Text>
                      </TouchableOpacity>
                    </View>
                    {loadingTasks ? (
                      <View style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
                        <ActivityIndicator size="large" color={T.brand} />
                        <Text style={{ color: sub }}>Loading tasks…</Text>
                      </View>
                    ) : (() => {
                      const q = taskSearch.trim().toLowerCase();
                      const filteredTasks = q ? projectTasks.filter(t => (t.heading || t.title || '').toLowerCase().includes(q)) : projectTasks;
                      if (filteredTasks.length === 0) return (
                        <View style={{ alignItems: 'center', paddingVertical: 56, gap: 8 }}>
                          <Text style={{ fontSize: 48, opacity: 0.3 }}>📋</Text>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>{projectTasks.length === 0 ? 'No tasks yet' : 'No matches'}</Text>
                          <Text style={{ fontSize: 13, color: sub }}>{projectTasks.length === 0 ? 'Tap + Create Task to add one' : 'Try a different search'}</Text>
                        </View>
                      );
                      return filteredTasks.map((t, i) => {
                        const statusKey = t.status || 'pending';
                        const statusColor = TASK_STATUS_COLORS[statusKey] || '#888';
                        const statusLabel = TASK_STATUS_LABELS[statusKey] || statusKey;
                        const priorityKey = t.priority || 'medium';
                        const priorityColor = PRIORITY_COLORS[priorityKey] || '#888';
                        const rawAssignees = Array.isArray(t.assigned_to_user_details) && t.assigned_to_user_details.length > 0 ? t.assigned_to_user_details : (Array.isArray(t.assigned_to) ? t.assigned_to : (Array.isArray(t.assignees) ? t.assignees : []));
                        const assigneeUsers = rawAssignees.map(a => typeof a === 'object' && a !== null ? a : (users.find(u => String(u.id) === String(a)) || { id: a, first_name: '?' }));
                        const dueDate = t.end_date || t.due_date;
                        const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch { return d; } };
                        return (
                          <TouchableOpacity key={t.id || i} style={[ds.taskCard, { backgroundColor: card, borderColor: bdr }]} onPress={() => setDetailTask(t)} activeOpacity={0.7}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                              <Text style={{ flex: 1, fontSize: 14, color: txt, fontWeight: '600', lineHeight: 19 }} numberOfLines={2}>{t.heading || t.title || 'Untitled task'}</Text>
                              <View style={[ds.taskStatusChip, { backgroundColor: statusColor + '20' }]}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {assigneeUsers.length > 0 ? assigneeUsers.slice(0, 3).map((u, idx) => (
                                  <View key={u.id || idx} style={[ds.assigneeAvatar, { marginLeft: idx === 0 ? 0 : -6, zIndex: 3 - idx, borderColor: card }]}>
                                    <Text style={{ color: '#7C3AED', fontSize: 9, fontWeight: '700' }}>{(u.first_name || u.username || '?').charAt(0).toUpperCase()}</Text>
                                  </View>
                                )) : <Text style={{ fontSize: 11, color: sub }}>Unassigned</Text>}
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: priorityColor }} />
                                <Text style={{ fontSize: 11, color: priorityColor, fontWeight: '600' }}>{priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1)}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ fontSize: 11 }}>📅</Text>
                                <Text style={{ fontSize: 11, color: dueDate ? sub : '#AAAABC' }}>{dueDate ? fmtDate(dueDate) : '—'}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </>
                )}

                {/* MEMBERS TAB */}
                {detailsTab === 'members' && (() => {
                  const memberList = getProjectMembers(selectedProject);
                  if (memberList.length === 0) return (
                    <View style={{ alignItems: 'center', paddingVertical: 56, gap: 8 }}>
                      <Text style={{ fontSize: 48, opacity: 0.3 }}>👥</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>No members</Text>
                    </View>
                  );
                  return memberList.map((m, i) => {
                    const u = m.user || m.user_details || {};
                    const name = u.full_name || (`${u.first_name || ''} ${u.last_name || ''}`).trim() || u.username || 'Unknown';
                    const initial = name.charAt(0).toUpperCase();
                    const role = (m.role || 'member').toLowerCase();
                    return (
                      <View key={m.id || i} style={[ds.memberCard, { backgroundColor: card, borderColor: bdr }]}>
                        <View style={ds.memberAvatar}>
                          <Text style={ds.memberAvatarText}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>{name}</Text>
                          <Text style={{ fontSize: 12, color: sub, marginTop: 1 }}>@{u.username || '—'}</Text>
                          {u.email && <Text style={{ fontSize: 11, color: sub, marginTop: 2 }}>{u.email}</Text>}
                        </View>
                        <View style={[ds.roleChip, { backgroundColor: '#E9D5FF' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                        </View>
                      </View>
                    );
                  });
                })()}

                {/* DOCUMENTS TAB */}
                {detailsTab === 'documents' && (
                  <>
                    <TouchableOpacity style={[ds.uploadBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]} onPress={() => setUploadModalOpen(true)} disabled={uploading}>
                      {uploading ? <ActivityIndicator size="small" color={T.brand} /> : <Text style={{ fontSize: 14, color: T.brand, fontWeight: '700' }}>⬆ Upload Document</Text>}
                    </TouchableOpacity>
                    {projectDocs.length === 0 ? (
                      <View style={{ alignItems: 'center', paddingVertical: 56, gap: 8 }}>
                        <Text style={{ fontSize: 48, opacity: 0.3 }}>📄</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>No documents</Text>
                        <Text style={{ fontSize: 13, color: sub }}>Upload files to get started</Text>
                      </View>
                    ) : projectDocs.map((doc, i) => {
                      const { label, icon } = getFileKind(doc);
                      return (
                        <View key={doc.id || i} style={[ds.docCard, { backgroundColor: card, borderColor: bdr }]}>
                          <View style={[ds.docThumb, { backgroundColor: T.cBlueSoft }]}>
                            <Text style={{ fontSize: 20 }}>{icon}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: txt, marginBottom: 4 }} numberOfLines={1}>{doc.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <View style={[ds.docTypePill]}>
                                <Text style={ds.docTypePillText}>{label}</Text>
                              </View>
                              {doc.taskHeading && (
                                <View style={[ds.docTaskPill]}>
                                  <Text style={ds.docTaskPillText}>TASK</Text>
                                </View>
                              )}
                              <Text style={{ fontSize: 11, color: sub }}>{formatDocDate(doc.uploadedAt)}</Text>
                            </View>
                          </View>
                          <TouchableOpacity style={ds.docDeleteBtn} onPress={() => deleteDocument(doc.id)}>
                            <Text style={{ fontSize: 14 }}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </>
                )}
              </ScrollView>
            </View>
          </Animated.View>
        </>
      )}

      {/* Upload source picker modal */}
      {uploadModalOpen && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setUploadModalOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <View style={[ms.uploadCard, { backgroundColor: card }]}>
              <Text style={[{ fontSize: 18, fontWeight: '700', marginBottom: 4, color: txt }]}>Upload Document</Text>
              <Text style={[{ fontSize: 13, color: sub, marginBottom: 20 }]}>Choose a source</Text>
              {[
                { icon: '📷', label: 'Camera', desc: 'Take a photo', onPress: pickFromCamera },
                { icon: '🖼️', label: 'Gallery', desc: 'Pick from photos', onPress: pickFromGallery },
                { icon: '📁', label: 'Files', desc: 'Browse device files', onPress: pickFromFiles },
              ].map((opt, i, arr) => (
                <TouchableOpacity key={i} style={[ms.uploadOption, i === arr.length - 1 && { borderBottomWidth: 0 }]} onPress={opt.onPress}>
                  <View style={[ms.uploadOptionIcon, { backgroundColor: T.cBlueSoft }]}>
                    <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: txt }}>{opt.label}</Text>
                    <Text style={{ fontSize: 12, color: sub, marginTop: 2 }}>{opt.desc}</Text>
                  </View>
                  <Text style={{ fontSize: 20, color: sub }}>›</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[ms.uploadCancelBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]} onPress={() => setUploadModalOpen(false)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: sub }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Import JSON modal */}
      {importModalOpen && (
        <Modal transparent visible animationType="fade" onRequestClose={closeImportModal}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
            <View style={[ms.importCard, { backgroundColor: card }]}>
              <View style={ms.modalHeader}>
                <Text style={[ms.modalTitle, { color: txt }]}>Import Tasks</Text>
                <TouchableOpacity style={[ms.closeCircle, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]} onPress={closeImportModal} disabled={importing}>
                  <Text style={[ms.closeCircleText, { color: sub }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[ms.fieldLabel, { color: sub }]}>Paste JSON or pick a file</Text>
              <TextInput
                style={[ms.importTextarea, { backgroundColor: isDark ? '#252530' : '#F5F5F7', color: txt, borderColor: bdr }]}
                placeholder={'[\n  { "heading": "Task 1", "priority": "high" }\n]'}
                placeholderTextColor={sub}
                value={importJsonText}
                onChangeText={setImportJsonText}
                multiline editable={!importing}
              />
              <TouchableOpacity style={ms.importFileBtn} onPress={pickJsonFile} disabled={importing}>
                <Text style={ms.importFileBtnText}>📁 Pick JSON File</Text>
              </TouchableOpacity>
              {importProgress ? (
                <View style={ms.importProgress}>
                  <ActivityIndicator size="small" color={T.brand} />
                  <Text style={ms.importProgressText}>{importProgress}</Text>
                </View>
              ) : null}
              <View style={[ms.modalBtns, { marginTop: 14 }]}>
                <TouchableOpacity style={[ms.cancelBtn, { borderColor: bdr, backgroundColor: card }]} onPress={closeImportModal} disabled={importing}>
                  <Text style={[ms.cancelBtnText, { color: sub }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.submitBtn, (importing || !importJsonText.trim()) && { opacity: 0.6 }]} onPress={submitImportTasks} disabled={importing || !importJsonText.trim()}>
                  {importing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ms.submitBtnText}>Import</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Task detail modal */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          users={users}
          onClose={() => setDetailTask(null)}
          onUpdate={(updatedTask) => {
            if (selectedProject) {
              getTasks().then(all => {
                const forThis = (all || []).filter(t => String(t.project_details?.id ?? t.project ?? t.project_id) === String(selectedProject.id));
                setProjectTasks(forThis);
              }).catch(() => {});
            }
            if (updatedTask) setDetailTask(updatedTask);
          }}
        />
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

// Details modal styles
const ds = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 32, fontWeight: '300', marginTop: -3 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerIconText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  headerName: { fontSize: 16, fontWeight: '700' },
  headerType: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, marginRight: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabCount: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  tabCountText: { fontSize: 10, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  taskActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  createTaskBtn: { backgroundColor: '#1A1A2E', borderRadius: 10, paddingHorizontal: 14, height: 40, justifyContent: 'center', alignItems: 'center' },
  createTaskBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  importBtn: { borderWidth: 1.5, borderColor: '#1A1A2E', borderRadius: 10, height: 40, justifyContent: 'center', alignItems: 'center' },
  importBtnText: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
  taskCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  taskStatusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  assigneeAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#7C3AED', fontSize: 17, fontWeight: '700' },
  roleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  uploadBtn: { borderRadius: 10, borderWidth: 1, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 8 },
  docThumb: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  docTypePill: { backgroundColor: '#1A1A2E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  docTypePillText: { color: '#4ECDC4', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  docTaskPill: { backgroundColor: '#CFFAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  docTaskPillText: { color: '#06B6D4', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  docDeleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
});
