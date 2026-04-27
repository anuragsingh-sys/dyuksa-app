import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Animated, Image, Alert, ActivityIndicator, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useContext, useEffect, useCallback } from 'react';
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

// Backend endpoints used to populate the project's Documents tab. Matches what
// DocumentsScreen + TaskDetailModal use.
const API_BASE     = 'http://192.168.1.164:8000';
const DOCS_API     = `${API_BASE}/api/v1/documents/`;
const TASKSITE_API = `${API_BASE}/api/v1/tasksite/`;

const TASK_TYPES = ['client', 'internal', 'content_creation', 'ideas'];
const TASK_TYPE_LABELS = {
  client: 'Client',
  internal: 'Internal',
  content_creation: 'Content Creation',
  ideas: 'Ideas',
};
const ROLES = ['manager', 'annotator', 'viewer', 'admin'];
const FILTER_COLORS = { client: '#3B82F6', internal: '#4ADE80', content_creation: '#F472B6', ideas: '#FBBF24' };
const STATUS_COLORS = { 'In Progress': '#4ECDC4', Completed: '#4ADE80', 'On Hold': '#FBBF24' };

// Task status colors — matches TasksScreen
const TASK_STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review' };
const TASK_STATUS_COLORS = { pending: '#888899', in_progress: '#4ECDC4', completed: '#4ADE80', backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA' };

// Task priority colors — matches TasksScreen
const PRIORITY_COLORS = { low: '#4ADE80', medium: '#FBBF24', high: '#F97316', urgent: '#EF4444' };

const SCREEN_WIDTH = Dimensions.get('window').width;

// Helper: get member array from project (backend uses `members`, legacy code used `assigned_members`)
const getProjectMembers = (project) => {
  if (!project) return [];
  if (Array.isArray(project.members)) return project.members;
  if (Array.isArray(project.assigned_members)) return project.assigned_members;
  return [];
};

// ── Inline dropdown (no nested Modal — works inside Modal on iOS) ────────────
function InlineDropdown({ options, selected, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg    = isDark ? '#252530' : '#F5F5F7';
  const bgOpen= isDark ? '#1A1A20' : '#FFFFFF';
  const bdr   = isDark ? '#2F2F3D' : '#EBEBF0';
  const txt   = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub   = isDark ? '#9898A6' : '#888899';
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
  triggerOpen: { borderColor: '#4ECDC4', backgroundColor: '#fff' },
  triggerText: { fontSize: 13, color: '#1A1A2E', flex: 1 },
  arrow: { fontSize: 11, color: '#888899', marginLeft: 4 },
  list: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', marginTop: 4, maxHeight: 180 },
  item: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  itemText: { fontSize: 13, color: '#1A1A2E' },
});

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function ProjectsScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { theme, projectView } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';

  const { addNotification } = useContext(NotificationsContext);
  const { token } = useContext(AuthContext);

  // ── Data ──
  const [projects,        setProjects]        = useState([]);
  const [users,           setUsers]           = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeFilter,    setActiveFilter]    = useState(null);

  // ── Modal ──
  const [modalVisible, setModalVisible] = useState(false);
  const [saving,       setSaving]       = useState(false);

  // ── Project details modal ──
  const [detailsVisible,   setDetailsVisible]   = useState(false);
  const [selectedProject,  setSelectedProject]  = useState(null);
  const [projectTasks,     setProjectTasks]     = useState([]);
  const [loadingTasks,     setLoadingTasks]     = useState(false);
  const [detailsTab,       setDetailsTab]       = useState('tasks'); // tasks | members | documents
  const [taskSearch,       setTaskSearch]       = useState('');
  // Documents (local-only until backend wired)
  const [projectDocs,      setProjectDocs]      = useState([]);
  const [uploadModalOpen,  setUploadModalOpen]  = useState(false);
  const [uploading,        setUploading]        = useState(false);
  // Import tasks from JSON
  const [importModalOpen,  setImportModalOpen]  = useState(false);
  const [importJsonText,   setImportJsonText]   = useState('');
  const [importing,        setImporting]        = useState(false);
  const [importProgress,   setImportProgress]   = useState(''); // e.g. "Creating 3 of 10..."
  // Task detail modal
  const [detailTask,       setDetailTask]       = useState(null);
  const detailsSlideAnim = useRef(new Animated.Value(0)).current; // 0 = hidden (off-screen right), 1 = visible

  // ── Form fields ──
  const [projectName,   setProjectName]   = useState('');
  const [taskType,      setTaskType]      = useState(null);
  const [projectImages, setProjectImages] = useState([]);
  const [members,       setMembers]       = useState([{ user: null, role: null }]);

  const slideAnim = useRef(new Animated.Value(-600)).current;

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

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

  // ── Favourite toggle ────────────────────────────────────────────────────
  // Defensive: backend field name varies (is_favourite / is_favorite / is_starred / is_pinned).
  // 1. Detect which field the project object already has  → use that key.
  // 2. Fall back to `is_favourite` (UK spelling, most common in this codebase).
  // 3. Optimistically flip the UI; revert + alert if the PATCH fails.
  const detectFavKey = (project) => {
    const candidates = [
      'is_favourite', 'is_favorite',
      'is_starred', 'is_pinned',
      'favourite', 'favorite', 'starred',
    ];
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(project || {}, key)) return key;
    }
    return 'is_favourite';
  };

  const isProjectFav = (project) => {
    if (!project) return false;
    return !!(
      project.is_favourite ||
      project.is_favorite  ||
      project.is_starred   ||
      project.is_pinned    ||
      project.favourite    ||
      project.favorite     ||
      project.starred
    );
  };

  const toggleFavourite = async (project) => {
    if (!project?.id) return;
    const key = detectFavKey(project);
    const currentlyFav = isProjectFav(project);
    const next = !currentlyFav;

    // Optimistic UI update — flip the flag in the local list immediately
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, [key]: next } : p));
    if (selectedProject?.id === project.id) {
      setSelectedProject(p => p ? { ...p, [key]: next } : p);
    }

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/projects/${project.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) {
        // Surface backend error if PATCH rejects the field name
        let detail = `${res.status}`;
        try { const e = await res.json(); detail = e.detail || JSON.stringify(e); } catch {}
        throw new Error(detail);
      }
    } catch (e) {
      // Revert on failure
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, [key]: currentlyFav } : p));
      if (selectedProject?.id === project.id) {
        setSelectedProject(p => p ? { ...p, [key]: currentlyFav } : p);
      }
      Alert.alert(
        'Could not update favourite',
        `${e?.message || 'Try again later.'}\n\nIf this keeps happening, the backend field name may be different.`,
      );
    }
  };


  const fetchUsers = async () => {
    try {
      const list = await getUsers();
      console.log('Users loaded:', list.length);
      setUsers(list);
    } catch (e) {
      console.error('fetchUsers error:', e.message);
    }
  };

  // When user comes back to Projects tab after creating a task inside a project,
  // auto-reopen that project's details so they stay in context.
  useFocusEffect(
    useCallback(() => {
      const reopenId = route.params?.reopenProjectId;
      if (!reopenId) return;

      // Clear the param immediately so it doesn't re-trigger
      navigation.setParams({ reopenProjectId: null });

      const tryReopen = async () => {
        // Refresh projects list first so the newly-created task's project
        // carries the up-to-date task_count, members, etc.
        try {
          const list = await getProjects();
          setProjects(list);
          const found = list.find(p => String(p.id) === String(reopenId));
          if (found) {
            openDetails(found);
          }
        } catch (e) {
          // If fetch fails, try to open from current state
          const found = projects.find(p => String(p.id) === String(reopenId));
          if (found) openDetails(found);
        }
      };
      // Small delay to let tab-switch animation settle
      setTimeout(tryReopen, 200);
    }, [route.params?.reopenProjectId])
  );

  // ── Modal open/close ──
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

  // ── Project details modal open/close ──
  const openDetails = async (project) => {
    setSelectedProject(project);
    setDetailsVisible(true);
    setProjectTasks([]);
    setProjectDocs([]);
    setDetailsTab('tasks');
    setTaskSearch('');
    Animated.timing(detailsSlideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();

    // Load documents for this project from backend (project-direct docs + task attachments)
    fetchProjectDocs(project.id);

    // Fetch tasks and filter by project id
    setLoadingTasks(true);
    try {
      const all = await getTasks();
      const forThisProject = (all || []).filter(t => {
        // Backend returns task.project as id + task.project_details.id
        const pid = t.project_details?.id ?? t.project ?? t.project_id;
        return String(pid) === String(project.id);
      });
      setProjectTasks(forThisProject);
    } catch (e) {
      console.error('fetch project tasks:', e.message);
      setProjectTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  // ── Fetch documents from backend for the open project ──
  // Combines:
  //   1. /api/v1/documents/?project={id}   → project-direct uploads
  //   2. /api/v1/tasksite/?project={id}    → tasks for this project, then their attachments[]
  // Both shapes are normalised into the same structure the existing render uses.
  const fetchProjectDocs = useCallback(async (projectId) => {
    if (projectId == null) return;
    try {
      const token = await getAccessToken();
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      // ── (a) project-direct documents (paginated, follow `next`) ──
      const projectDocPromise = (async () => {
        const out = [];
        let url = `${DOCS_API}?project=${projectId}`;
        let safety = 10;
        while (url && safety-- > 0) {
          const res = await fetch(url, { headers });
          if (!res.ok) break;
          const json = await res.json();
          const list = Array.isArray(json) ? json : (json.results || json.documents || []);
          out.push(...list);
          url = (!Array.isArray(json) && json.next) || null;
        }
        return out;
      })();

      // ── (b) tasks for this project → their attachments ──
      const taskAttachmentsPromise = (async () => {
        const tasks = [];
        let url = `${TASKSITE_API}?project=${projectId}`;
        let safety = 10;
        while (url && safety-- > 0) {
          const res = await fetch(url, { headers });
          if (!res.ok) break;
          const json = await res.json();
          const list = Array.isArray(json) ? json : (json.results || []);
          tasks.push(...list);
          url = (!Array.isArray(json) && json.next) || null;
        }
        // Belt-and-suspenders: filter again by project id (some backends ignore the query param)
        const forThisProject = tasks.filter(t => {
          const pid = t.project_details?.id ?? t.project ?? t.project_id;
          return String(pid) === String(projectId);
        });
        // Flatten attachments, tagging each with its task id/title
        const flat = [];
        forThisProject.forEach(t => {
          (t.attachments || []).forEach(a => flat.push({ ...a, _taskId: t.id, _taskHeading: t.heading }));
        });
        return flat;
      })();

      const [projectDirect, taskAttachments] = await Promise.all([projectDocPromise, taskAttachmentsPromise]);

      // Normalise both into the shape the existing render expects:
      //   { id, name, type: 'image'|'file', uri, mimeType, size, uploadedAt, source: 'project'|'task',
      //     taskId?, taskHeading?, _backend: true }  ← _backend used to skip local-only delete
      const guessMime = (filename = '') => {
        const ext = String(filename).split('?')[0].split('#')[0].split('.').pop().toLowerCase();
        if (['png','jpg','jpeg','gif','webp','heic','bmp','svg'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        if (ext === 'pdf')                                 return 'application/pdf';
        if (['doc','docx'].includes(ext))                  return 'application/msword';
        if (['xls','xlsx','csv'].includes(ext))            return 'application/vnd.ms-excel';
        if (['ppt','pptx'].includes(ext))                  return 'application/vnd.ms-powerpoint';
        if (ext === 'json')                                return 'application/json';
        if (ext === 'txt' || ext === 'rtf')                return 'text/plain';
        if (['mp4','mov','avi','mkv','webm'].includes(ext))return `video/${ext}`;
        if (['mp3','wav','m4a','ogg'].includes(ext))       return `audio/${ext}`;
        return 'application/octet-stream';
      };

      const normalisedDirect = projectDirect.map(d => {
        const name = d.name || d.file_name || 'Untitled';
        const mt   = guessMime(name);
        const url  = d.source_file || d.source_file_url || d.file_url || null;
        return {
          id:         `doc_${d.id}`,
          name,
          uri:        url,
          mimeType:   mt,
          size:       d.file_size ?? null,
          uploadedAt: d.updated_at || d.created_at,
          type:       mt.startsWith('image/') ? 'image' : 'file',
          source:     'project',
          _backend:   true,
        };
      });

      const normalisedTask = taskAttachments.map(a => {
        const name = a.file_name || a.name || 'Untitled';
        const mt   = guessMime(name);
        const url  = a.file_url || a.source_file || null;
        return {
          id:           `att_${a.id}`,
          name,
          uri:          url,
          mimeType:     mt,
          size:         a.file_size ?? null,
          uploadedAt:   a.uploaded_at || a.created_at,
          type:         mt.startsWith('image/') ? 'image' : 'file',
          source:       'task',
          taskId:       a._taskId,
          taskHeading:  a._taskHeading,
          _backend:     true,
        };
      });

      // Newest first
      const combined = [...normalisedDirect, ...normalisedTask].sort((x, y) => {
        const dx = x.uploadedAt ? new Date(x.uploadedAt).getTime() : 0;
        const dy = y.uploadedAt ? new Date(y.uploadedAt).getTime() : 0;
        return dy - dx;
      });

      setProjectDocs(combined);
    } catch (e) {
      console.error('fetchProjectDocs error:', e?.message || e);
      setProjectDocs([]);
    }
  }, []);

  const closeDetails = () => {
    Animated.timing(detailsSlideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setDetailsVisible(false);
      setSelectedProject(null);
      setProjectTasks([]);
      setProjectDocs([]);
      setUploadModalOpen(false);
      setDetailsTab('tasks');
    });
  };

  // ── Document upload helpers (3-step presigned S3 flow) ──
  // 1. POST /api/v1/projects/{id}/get-upload-url/   → { url, fields, file_key }
  // 2. POST {url}  with form-data { ...fields, file: <binary> }   (direct to S3)
  // 3. POST /api/v1/projects/{id}/confirm-upload/   → backend creates Document row
  //
  // After step 3 we re-fetch the project's docs so the new file appears.
  const addDocument = async (doc) => {
    if (!selectedProject?.id) {
      Alert.alert('Error', 'No project selected.');
      return;
    }
    const projectId = selectedProject.id;
    try {
      const token = await getAccessToken();

      // ── Step 1: ask backend for a presigned S3 upload URL ──
      const step1 = await fetch(
        `${API_BASE}/api/v1/projects/${projectId}/get-upload-url/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            file_name: doc.name,
            file_type: doc.mimeType || 'application/octet-stream',
          }),
        },
      );
      const presigned = await step1.json().catch(() => ({}));
      if (!step1.ok) {
        throw new Error(presigned.detail || presigned.message || `get-upload-url failed (${step1.status})`);
      }
      const { url: s3Url, fields, file_key } = presigned;
      if (!s3Url || !fields || !file_key) {
        throw new Error('Invalid response from get-upload-url.');
      }

      // ── Step 2: upload the binary directly to S3 ──
      // S3 requires the form fields IN ORDER, with `file` last.
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
      form.append('file', {
        uri:  doc.uri,
        name: doc.name,
        type: doc.mimeType || 'application/octet-stream',
      });
      const step2 = await fetch(s3Url, {
        method: 'POST',
        body: form,
        // Don't set Authorization or Content-Type — fetch sets the multipart boundary,
        // and S3 auth is handled by the policy/signature fields above.
      });
      if (!step2.ok) {
        const text = await step2.text().catch(() => '');
        throw new Error(`S3 upload failed (${step2.status}). ${text.slice(0, 200)}`);
      }

      // ── Step 3: tell backend the upload is done ──
      const step3 = await fetch(
        `${API_BASE}/api/v1/projects/${projectId}/confirm-upload/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            file_key,
            file_name: doc.name,
            file_type: doc.mimeType || 'application/octet-stream',
          }),
        },
      );
      const confirmed = await step3.json().catch(() => ({}));
      if (!step3.ok) {
        throw new Error(confirmed.detail || confirmed.message || `confirm-upload failed (${step3.status})`);
      }

      // Reload the project's docs so the new file shows up
      await fetchProjectDocs(projectId);

      addNotification({
        type: 'project', icon: '📄',
        title: 'Document Uploaded',
        body: `"${doc.name}" added to ${selectedProject?.name || 'project'}.`,
      });
    } catch (e) {
      console.error('addDocument error:', e?.message || e);
      Alert.alert('Upload Failed', e?.message || 'Could not upload document.');
    }
  };

  const deleteDocument = (docId) => {
    // All docs are now backend-owned. Deletion endpoints differ depending on
    // origin (project document vs. task attachment), so for now we point users
    // at the right place and skip the destructive call locally.
    const target = projectDocs.find(d => d.id === docId);
    if (target?.source === 'task') {
      Alert.alert(
        'Cannot delete here',
        'This file is attached to a task. Open the task detail screen to remove it.',
      );
      return;
    }
    Alert.alert(
      'Cannot delete here',
      'Project documents must be deleted from the web dashboard for now.',
    );
  };

  const pickFromCamera = async () => {
    setUploadModalOpen(false);
    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Access Needed',
          canAskAgain
            ? 'Please allow camera access to take photos.'
            : 'Camera access was denied earlier. Please enable it in Settings.',
          canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      setUploading(true);
      await addDocument({
        id: `doc_${Date.now()}`,
        name: `Photo_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.jpg`,
        uri: a.uri,
        mimeType: 'image/jpeg',
        size: a.fileSize || null,
        type: 'image',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'You',
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not take photo.');
    } finally {
      setUploading(false);
    }
  };

  const pickFromGallery = async () => {
    setUploadModalOpen(false);
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Access Needed',
          canAskAgain
            ? 'Please allow photo library access to pick images.'
            : 'Photo library access was denied earlier. To fix this: open iOS Settings → Expo Go → Photos → choose "All Photos".',
          canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.85 });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      for (const a of result.assets) {
        await addDocument({
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: a.fileName || `Image_${Date.now()}.jpg`,
          uri: a.uri,
          mimeType: a.mimeType || 'image/jpeg',
          size: a.fileSize || null,
          type: 'image',
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'You',
        });
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not select images.');
    } finally {
      setUploading(false);
    }
  };

  const pickFromFiles = async () => {
    setUploadModalOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      for (const a of result.assets) {
        await addDocument({
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: a.name,
          uri: a.uri,
          mimeType: a.mimeType || 'application/octet-stream',
          size: a.size || null,
          type: 'file',
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'You',
        });
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not select files.');
    } finally {
      setUploading(false);
    }
  };

  // Helper: get file type label + icon from mime type / filename
  const getFileKind = (doc) => {
    const mt = (doc.mimeType || '').toLowerCase();
    const name = (doc.name || '').toLowerCase();
    if (mt.startsWith('image/'))       return { label: 'IMG',  icon: '🖼️' };
    if (mt.includes('pdf'))            return { label: 'PDF',  icon: '📕' };
    if (mt.includes('json') || name.endsWith('.json'))   return { label: 'JSON', icon: '📋' };
    if (mt.includes('word') || name.endsWith('.docx') || name.endsWith('.doc'))  return { label: 'DOC',  icon: '📘' };
    if (mt.includes('sheet')|| name.endsWith('.xlsx') || name.endsWith('.csv'))  return { label: 'XLS',  icon: '📗' };
    if (mt.includes('text') || name.endsWith('.txt'))    return { label: 'TXT',  icon: '📄' };
    if (mt.startsWith('video/'))        return { label: 'VID',  icon: '🎬' };
    if (mt.startsWith('audio/'))        return { label: 'AUD',  icon: '🎵' };
    return { label: 'FILE', icon: '📎' };
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDocDate = (iso) => {
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const m = Math.floor(diff / 60000);
      if (m < 1)  return 'Just now';
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  // ── Import Tasks via JSON ──
  const openImportModal = () => {
    setImportJsonText('');
    setImportProgress('');
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    if (importing) return; // don't close mid-import
    setImportModalOpen(false);
    setImportJsonText('');
    setImportProgress('');
  };

  const pickJsonFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      // Read the file content
      const response = await fetch(file.uri);
      const text = await response.text();
      setImportJsonText(text);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not read JSON file.');
    }
  };

  const submitImportTasks = async () => {
    if (!importJsonText.trim()) {
      Alert.alert('Required', 'Paste JSON or pick a .json file.');
      return;
    }
    if (!selectedProject) return;

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(importJsonText.trim());
    } catch (e) {
      Alert.alert('Invalid JSON', 'The pasted text is not valid JSON. Please check and try again.');
      return;
    }

    // Accept either { tasks: [...] } OR a plain array [...]
    const tasksList = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed?.tasks) ? parsed.tasks : null);

    if (!tasksList || tasksList.length === 0) {
      Alert.alert('Invalid Format', 'JSON should contain a "tasks" array with at least one task.');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failCount = 0;
    const failReasons = [];

    for (let i = 0; i < tasksList.length; i++) {
      const t = tasksList[i];
      setImportProgress(`Creating ${i + 1} of ${tasksList.length}...`);

      try {
        // Resolve assignees: convert assignee_emails → user ids (match against loaded users list)
        const assigneeIds = [];
        if (Array.isArray(t.assignee_emails)) {
          t.assignee_emails.forEach(email => {
            const u = users.find(u => (u.email || '').toLowerCase() === String(email).toLowerCase());
            if (u) assigneeIds.push(u.id);
          });
        }
        // Also accept assigned_to array of ids if provided
        if (Array.isArray(t.assigned_to)) {
          t.assigned_to.forEach(id => { if (!assigneeIds.includes(id)) assigneeIds.push(id); });
        }

        const formData = new FormData();
        formData.append('heading', String(t.heading || t.title || 'Untitled'));
        formData.append('project', String(selectedProject.id));
        if (t.description) formData.append('description', t.description);
        if (t.status)      formData.append('status', t.status);
        if (t.priority)    formData.append('priority', t.priority);
        if (t.start_date)  formData.append('start_date', t.start_date);
        if (t.end_date)    formData.append('end_date', t.end_date);
        assigneeIds.forEach(id => formData.append('assigned_to', String(id)));

        await createTask(formData);
        successCount++;
      } catch (e) {
        failCount++;
        failReasons.push(`Task ${i + 1}: ${e.message || 'unknown error'}`);
      }
    }

    setImporting(false);
    setImportProgress('');

    // Refresh task list
    try {
      const all = await getTasks();
      const forThisProject = (all || []).filter(tk => {
        const pid = tk.project_details?.id ?? tk.project ?? tk.project_id;
        return String(pid) === String(selectedProject.id);
      });
      setProjectTasks(forThisProject);
    } catch {}

    closeImportModal();

    // Notify + feedback
    if (successCount > 0) {
      addNotification({
        type: 'task', icon: '📋',
        title: 'Tasks Imported',
        body: `${successCount} task${successCount !== 1 ? 's' : ''} created in ${selectedProject.name}${failCount > 0 ? ` (${failCount} failed)` : ''}.`,
      });
    }

    if (failCount > 0 && successCount === 0) {
      Alert.alert('Import Failed', `No tasks were created.\n\n${failReasons.slice(0, 3).join('\n')}`);
    } else if (failCount > 0) {
      Alert.alert('Partial Success', `${successCount} created, ${failCount} failed.\n\n${failReasons.slice(0, 2).join('\n')}`);
    } else {
      Alert.alert('Success', `${successCount} task${successCount !== 1 ? 's' : ''} imported successfully.`);
    }
  };

  // ── Camera / Gallery ──
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

  // ── Member helpers ──
  const addMemberRow    = () => setMembers(m => [...m, { user: null, role: null }]);
  const removeMemberRow = (i) => setMembers(m => m.filter((_, idx) => idx !== i));
  const setMemberUser   = (i, user) => setMembers(m => m.map((r, idx) => idx === i ? { ...r, user } : r));
  const setMemberRole   = (i, role) => setMembers(m => m.map((r, idx) => idx === i ? { ...r, role } : r));

  // ── Create project ──
  const addProject = async () => {
    if (!projectName.trim()) { Alert.alert('Required', 'Enter a project name.'); return; }
    if (!taskType)           { Alert.alert('Required', 'Select a task type.'); return; }

    const validMembers = members.filter(m => m.user && m.role);
    const body = {
      name: projectName.trim(),
      task_type: taskType,
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
      Alert.alert('Error', e.message || 'Network error. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = activeFilter
    ? projects.filter(p => (p.task_type || p.type) === activeFilter)
    : projects;

  const userOptions = users.map(u => ({
    label: `${u.first_name} ${u.last_name}`.trim() || u.username,
    ...u,
  }));

  const roleOptions = ROLES.map(r => ({
    label: r.charAt(0).toUpperCase() + r.slice(1),
    value: r,
  }));

  const typeOptions = TASK_TYPES.map(t => ({
    label: TASK_TYPE_LABELS[t],
    value: t,
  }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D0D0F' : '#fff'} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Projects" />
          <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
          <Text style={[styles.brandName, { color: txt }]}>Projects</Text>
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

      {/* Sub header */}
      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View>
          <Text style={[styles.pageTitle, { color: txt }]}>Projects</Text>
          <Text style={[styles.pageSub, { color: sub }]}>{projects.length} project{projects.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={openModal}>
          <Text style={styles.newBtnText}>+ New Project</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={[styles.filterBar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <Text style={[styles.filterLabel, { color: sub }]}>Filter:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          {TASK_TYPES.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, { borderColor: bdr }, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(activeFilter === f ? null : f)}
            >
              <View style={[styles.dot, { backgroundColor: FILTER_COLORS[f] }]} />
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
                {TASK_TYPE_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Project list */}
      {loadingProjects ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={[styles.emptySub, { color: sub }]}>Loading projects...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, opacity: 0.3 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: txt }]}>{projects.length === 0 ? 'No projects yet' : 'No matches'}</Text>
          <Text style={[styles.emptySub, { color: sub }]}>{projects.length === 0 ? 'Tap + New Project to create one' : 'Try a different filter'}</Text>
          {projects.length === 0 && (
            <TouchableOpacity style={styles.newBtn} onPress={openModal}>
              <Text style={styles.newBtnText}>+ Create Project</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 12 }}
          onRefresh={fetchProjects}
          refreshing={loadingProjects}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: card, borderColor: bdr }]}
              onPress={() => openDetails(item)}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <View style={styles.projectIcon}>
                  <Text style={styles.projectIconText}>{item.name?.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.projectName, { color: txt }]}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <View style={[styles.dot, { backgroundColor: FILTER_COLORS[item.task_type || item.type] || '#888' }]} />
                    <Text style={[styles.projectMeta, { color: sub }]}>{TASK_TYPE_LABELS[item.task_type] || item.task_type}</Text>
                  </View>
                </View>
                <View style={[styles.statusChip, { backgroundColor: (STATUS_COLORS[item.status] || '#4ECDC4') + '20' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: STATUS_COLORS[item.status] || '#4ECDC4' }}>
                    {item.status || 'In Progress'}
                  </Text>
                </View>
              </View>
              <View style={[styles.progressBg, { backgroundColor: bdr }]}>
                <View style={[styles.progressFill, { width: `${item.progress || 0}%` }]} />
              </View>

              {/* Footer row — always render so the favourite star + chevron are visible,
                  even on projects without members */}
              {(() => {
                const memberList = getProjectMembers(item);
                return (
                  <View style={styles.cardMembersRow}>
                    {memberList.length > 0 ? (
                      <>
                        <View style={styles.cardAvatarStack}>
                          {memberList.slice(0, 4).map((m, idx) => {
                            const name = m.user?.full_name || m.user?.username || m.user_details?.full_name || m.user_details?.username || 'U';
                            const initial = String(name).charAt(0).toUpperCase();
                            return (
                              <View
                                key={m.id || idx}
                                style={[
                                  styles.cardAvatar,
                                  { marginLeft: idx === 0 ? 0 : -8, zIndex: 4 - idx, borderColor: card },
                                ]}
                              >
                                <Text style={styles.cardAvatarText}>{initial}</Text>
                              </View>
                            );
                          })}
                          {memberList.length > 4 && (
                            <View style={[styles.cardAvatar, styles.cardAvatarExtra, { marginLeft: -8, borderColor: card }]}>
                              <Text style={styles.cardAvatarExtraText}>+{memberList.length - 4}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.cardMembersLabel, { color: sub }]}>
                          {memberList.length} member{memberList.length !== 1 ? 's' : ''}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.cardMembersLabel, { color: sub, marginLeft: 0 }]}>
                        No members
                      </Text>
                    )}
                    <TouchableOpacity
                      style={styles.cardFavBtn}
                      onPress={(e) => { e.stopPropagation(); toggleFavourite(item); }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.cardFavIcon, isProjectFav(item) && styles.cardFavIconActive]}>
                        {isProjectFav(item) ? '★' : '☆'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.cardChevron, { color: sub }]}>›</Text>
                  </View>
                );
              })()}
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Create Project Modal ── */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal} statusBarTranslucent>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[
            styles.topModal,
            {
              backgroundColor: card,
              paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24),
              transform: [{ translateY: slideAnim }],
            },
          ]}>
            <SafeAreaView>
              <View style={[styles.handle, { backgroundColor: isDark ? '#3A3A48' : '#DEDEE8' }]} />
              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: txt }]}>Create Project</Text>
                  <TouchableOpacity
                    style={[styles.closeCircle, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                    onPress={closeModal}
                  >
                    <Text style={[styles.closeCircleText, { color: sub }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Project Name */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Project Name *</Text>
                <TextInput
                  placeholder="Enter project name..."
                  placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  style={[
                    styles.input,
                    { backgroundColor: isDark ? '#252530' : '#F5F5F7', color: txt },
                  ]}
                  value={projectName}
                  onChangeText={setProjectName}
                  autoFocus
                />

                {/* Assigned To */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Assigned To</Text>
                {members.map((m, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <InlineDropdown
                      placeholder="Select User"
                      options={userOptions}
                      selected={m.user ? (`${m.user.first_name} ${m.user.last_name}`.trim() || m.user.username) : null}
                      onSelect={u => setMemberUser(i, u)}
                    />
                    <View style={{ height: 8 }} />
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <InlineDropdown
                          placeholder="Select Role"
                          options={roleOptions}
                          selected={m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) : null}
                          onSelect={r => setMemberRole(i, r.value)}
                        />
                      </View>
                      {members.length > 1 && (
                        <TouchableOpacity
                          style={[styles.removeRowBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FFF0F0' }]}
                          onPress={() => removeMemberRow(i)}
                        >
                          <Text style={{ color: '#EF4444', fontSize: 16 }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.addMemberBtn} onPress={addMemberRow}>
                  <Text style={styles.addMemberText}>＋ Add another member</Text>
                </TouchableOpacity>

                {/* Task Type */}
                <Text style={[styles.fieldLabel, { color: sub, marginTop: 16 }]}>Task Type *</Text>
                <View style={{ marginBottom: 14, zIndex: 100 }}>
                  <InlineDropdown
                    placeholder="Select Task Type..."
                    options={typeOptions}
                    selected={taskType ? TASK_TYPE_LABELS[taskType] : null}
                    onSelect={t => setTaskType(t.value)}
                  />
                </View>

                {/* Attach Images */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Attach Images</Text>
                <View style={styles.attachRow}>
                  <TouchableOpacity
                    style={[styles.attachBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                    onPress={openCamera}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.attachIconWrap, { backgroundColor: card, borderColor: bdr }]}>
                      <Text style={{ fontSize: 22 }}>📷</Text>
                    </View>
                    <Text style={[styles.attachLabel, { color: txt }]}>Camera</Text>
                    <Text style={[styles.attachSub, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>Take a photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.attachBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                    onPress={openGallery}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.attachIconWrap, { backgroundColor: card, borderColor: bdr }]}>
                      <Text style={{ fontSize: 22 }}>🖼️</Text>
                    </View>
                    <Text style={[styles.attachLabel, { color: txt }]}>Gallery</Text>
                    <Text style={[styles.attachSub, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>Pick from photos</Text>
                  </TouchableOpacity>
                </View>

                {projectImages.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, { color: sub, marginBottom: 8 }]}>
                      {projectImages.length} image{projectImages.length > 1 ? 's' : ''} attached
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {projectImages.map((uri, i) => (
                        <View key={i} style={{ position: 'relative', marginRight: 10 }}>
                          <Image source={{ uri }} style={[styles.previewImg, { borderColor: bdr }]} />
                          <TouchableOpacity style={styles.removeImg} onPress={() => setProjectImages(p => p.filter((_, idx) => idx !== i))}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Buttons — same size */}
                <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: bdr, backgroundColor: card }]}
                    onPress={closeModal}
                    disabled={saving}
                  >
                    <Text style={[styles.cancelBtnText, { color: sub }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                    onPress={addProject}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.submitBtnText}>Create Project</Text>
                    }
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}

      {/* ── Project Details Full-Screen Modal ── */}
      {detailsVisible && selectedProject && (
        <>
          {/* Full-bleed dark backdrop — covers ALL safe areas */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bg, zIndex: 99 }} />
          <Animated.View
            style={[
              styles.pd_screen,
              {
                backgroundColor: bg,
                zIndex: 100,
                transform: [{
                  translateX: detailsSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SCREEN_WIDTH, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={{ flex: 1, backgroundColor: bg }}>
              <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} translucent={false} />

              {/* Header bar with back button + project name */}
              <View style={[styles.pd_header, { backgroundColor: card, borderBottomColor: bdr }]}>
                <TouchableOpacity style={styles.pd_backBtn} onPress={closeDetails} activeOpacity={0.7}>
                  <Text style={[styles.pd_backIcon, { color: txt }]}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.pd_headerIcon, { backgroundColor: FILTER_COLORS[selectedProject.task_type] || '#4ADE80' }]}>
                    <Text style={styles.pd_headerIconText}>
                      {selectedProject.name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pd_headerName, { color: txt }]} numberOfLines={1}>
                      {selectedProject.name}
                    </Text>
                    <Text style={[styles.pd_headerType, { color: sub }]}>
                      {TASK_TYPE_LABELS[selectedProject.task_type] || selectedProject.task_type}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusChip, { backgroundColor: (STATUS_COLORS[selectedProject.status] || '#4ECDC4') + '20' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: STATUS_COLORS[selectedProject.status] || '#4ECDC4' }}>
                    {selectedProject.status || 'In Progress'}
                  </Text>
                </View>
              </View>

              {/* Tabs */}
              <View style={[styles.pd_tabsRow, { backgroundColor: card, borderBottomColor: bdr }]}>
                {[
                  { id: 'tasks',     label: 'Tasks',     count: projectTasks.length },
                  { id: 'members',   label: 'Members',   count: getProjectMembers(selectedProject).length },
                  { id: 'documents', label: 'Documents', count: projectDocs.length },
                ].map(t => {
                  const isActive = detailsTab === t.id;
                  // Theme-aware active color — cyan in dark, dark-navy in light
                  const activeColor = isDark ? '#4ECDC4' : '#1A1A2E';
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.pd_tab,
                        isActive && { borderBottomColor: activeColor },
                      ]}
                      onPress={() => setDetailsTab(t.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.pd_tabText,
                          { color: sub },
                          isActive && { color: activeColor, fontWeight: '700' },
                        ]}
                      >
                        {t.label}
                      </Text>
                      <View
                        style={[
                          styles.pd_tabCount,
                          { backgroundColor: isDark ? '#252530' : '#EBEBF0' },
                          isActive && { backgroundColor: activeColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pd_tabCountText,
                            { color: sub },
                            isActive && { color: isDark ? '#0D0D0F' : '#4ECDC4' },
                          ]}
                        >
                          {t.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tab content */}
              <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 12 }}>

                {/* ── TASKS TAB ── */}
                {detailsTab === 'tasks' && (
                  <>
                    {/* Search on its own row */}
                    <View style={[styles.pd_searchWrap, { backgroundColor: card, borderColor: bdr, marginBottom: 10 }]}>
                      <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
                      <TextInput
                        style={[styles.pd_searchInput, { color: txt }]}
                        placeholder="Search tasks..."
                        placeholderTextColor={sub}
                        value={taskSearch}
                        onChangeText={setTaskSearch}
                      />
                    </View>

                    {/* Create + Import buttons row */}
                    <View style={styles.pd_taskActionsRow}>
                      <TouchableOpacity
                        style={[styles.pd_createTaskBtn, { flex: 1 }]}
                        onPress={() => {
                          closeDetails();
                          // Brief delay so the close animation finishes before navigating
                          setTimeout(() => {
                            navigation.navigate('Main', {
                              screen: 'Tasks',
                              params: { openCreateModal: true, presetProjectId: selectedProject.id },
                            });
                          }, 260);
                        }}
                      >
                        <Text style={styles.pd_createTaskBtnText}>+ Create Task</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pd_importBtn, { flex: 1 }]}
                        onPress={openImportModal}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.pd_importBtnText}>⬆ Import Tasks</Text>
                      </TouchableOpacity>
                    </View>

                    {loadingTasks ? (
                      <View style={styles.pd_loadingState}>
                        <ActivityIndicator size="large" color="#4ECDC4" />
                        <Text style={[styles.pd_emptyText, { color: sub }]}>Loading tasks...</Text>
                      </View>
                    ) : (() => {
                      const q = taskSearch.trim().toLowerCase();
                      const filtered = q
                        ? projectTasks.filter(t => (t.heading || t.title || '').toLowerCase().includes(q))
                        : projectTasks;

                      if (filtered.length === 0) {
                        return (
                          <View style={styles.pd_emptyState}>
                            <Text style={{ fontSize: 48, opacity: 0.3 }}>📋</Text>
                            <Text style={[styles.pd_emptyTitle, { color: txt }]}>
                              {projectTasks.length === 0 ? 'No tasks yet' : 'No matches'}
                            </Text>
                            <Text style={[styles.pd_emptyText, { color: sub }]}>
                              {projectTasks.length === 0 ? 'Tap + Create Task to add one' : 'Try a different search'}
                            </Text>
                          </View>
                        );
                      }

                      return filtered.map((t, i) => {
                        const statusKey = t.status || 'pending';
                        const statusColor = TASK_STATUS_COLORS[statusKey] || '#888';
                        const statusLabel = TASK_STATUS_LABELS[statusKey] || statusKey;
                        const priorityKey = t.priority || 'medium';
                        const priorityColor = PRIORITY_COLORS[priorityKey] || '#888';

                        const rawAssignees = Array.isArray(t.assigned_to_user_details) && t.assigned_to_user_details.length > 0
                          ? t.assigned_to_user_details
                          : (Array.isArray(t.assigned_to)
                              ? t.assigned_to
                              : (Array.isArray(t.assignees) ? t.assignees : []));
                        const assigneeUsers = rawAssignees.map(a => {
                          if (typeof a === 'object' && a !== null) return a;
                          return users.find(u => String(u.id) === String(a)) || { id: a, first_name: '?' };
                        });

                        const dueDate = t.end_date || t.due_date;
                        const fmtDate = (d) => {
                          try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
                          catch { return d; }
                        };

                        return (
                          <TouchableOpacity
                            key={t.id || i}
                            style={[styles.taskCard, { backgroundColor: card, borderColor: bdr }]}
                            onPress={() => setDetailTask(t)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.taskCardTop}>
                              <Text style={[styles.taskCardTitle, { color: txt }]} numberOfLines={2}>
                                {t.heading || t.title || 'Untitled task'}
                              </Text>
                              <View style={[styles.taskStatusChip, { backgroundColor: statusColor + '20' }]}>
                                <Text style={[styles.taskStatusText, { color: statusColor }]}>
                                  {statusLabel}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.taskCardBottom}>
                              <View style={styles.taskCardMeta}>
                                {assigneeUsers.length > 0 ? (
                                  <View style={styles.taskAssigneeStack}>
                                    {assigneeUsers.slice(0, 3).map((u, idx) => {
                                      const initial = (u.first_name || u.username || '?').charAt(0).toUpperCase();
                                      return (
                                        <View
                                          key={u.id || idx}
                                          style={[
                                            styles.taskAssigneeAvatar,
                                            { marginLeft: idx === 0 ? 0 : -6, zIndex: 3 - idx, borderColor: card },
                                          ]}
                                        >
                                          <Text style={styles.taskAssigneeText}>{initial}</Text>
                                        </View>
                                      );
                                    })}
                                    {assigneeUsers.length > 3 && (
                                      <View style={[styles.taskAssigneeAvatar, styles.taskAssigneeExtra, { marginLeft: -6, borderColor: card }]}>
                                        <Text style={styles.taskAssigneeExtraText}>+{assigneeUsers.length - 3}</Text>
                                      </View>
                                    )}
                                  </View>
                                ) : (
                                  <Text style={[styles.taskMetaDim, { color: sub }]}>Unassigned</Text>
                                )}
                              </View>
                              <View style={styles.taskCardMeta}>
                                <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                                <Text style={[styles.taskMetaText, { color: priorityColor, fontWeight: '600' }]}>
                                  {priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1)}
                                </Text>
                              </View>
                              <View style={styles.taskCardMeta}>
                                <Text style={styles.taskMetaIcon}>📅</Text>
                                <Text style={[styles.taskMetaText, { color: dueDate ? sub : '#AAAABC' }]}>
                                  {dueDate ? fmtDate(dueDate) : '—'}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </>
                )}

                {/* ── MEMBERS TAB ── */}
                {detailsTab === 'members' && (() => {
                  const memberList = getProjectMembers(selectedProject);
                  if (memberList.length === 0) {
                    return (
                      <View style={styles.pd_emptyState}>
                        <Text style={{ fontSize: 48, opacity: 0.3 }}>👥</Text>
                        <Text style={[styles.pd_emptyTitle, { color: txt }]}>No members yet</Text>
                        <Text style={[styles.pd_emptyText, { color: sub }]}>This project doesn't have any members assigned</Text>
                      </View>
                    );
                  }
                  return memberList.map((m, i) => {
                    // Backend shape: { id, user: { id, username, full_name, avatar }, role, joined_at }
                    const userObj  = m.user || m.user_details || m;
                    const fullName = userObj.full_name
                      || `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim()
                      || userObj.username
                      || 'Unknown';
                    const username = userObj.username || '';
                    const initial  = (fullName || username || 'U').charAt(0).toUpperCase();
                    const role     = m.role || userObj.role || 'member';
                    const email    = userObj.email || '';

                    return (
                      <View key={m.id || i} style={[styles.pd_memberCard, { backgroundColor: card, borderColor: bdr }]}>
                        <View style={styles.pd_memberAvatar}>
                          <Text style={styles.pd_memberAvatarText}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pd_memberName, { color: txt }]}>{fullName}</Text>
                          {!!username && <Text style={[styles.pd_memberUsername, { color: sub }]}>@{username}</Text>}
                          {!!email && <Text style={[styles.pd_memberEmail, { color: sub }]}>{email}</Text>}
                        </View>
                        <View style={[styles.dm_roleChip, styles[`dm_role_${role}`] || styles.dm_role_member]}>
                          <Text style={[styles.dm_roleText, styles[`dm_roleText_${role}`] || styles.dm_roleText_member]}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </Text>
                        </View>
                      </View>
                    );
                  });
                })()}

                {/* ── DOCUMENTS TAB ── */}
                {detailsTab === 'documents' && (
                  <>
                    {/* Upload button row */}
                    <View style={styles.pd_taskActions}>
                      <TouchableOpacity
                        style={[styles.pd_createTaskBtn, { flex: 1, flexDirection: 'row', gap: 6 }]}
                        onPress={() => setUploadModalOpen(true)}
                        disabled={uploading}
                        activeOpacity={0.8}
                      >
                        {uploading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>⬆</Text>
                            <Text style={styles.pd_createTaskBtnText}>Upload Documents</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Document list */}
                    {projectDocs.length === 0 ? (
                      <View style={styles.pd_emptyState}>
                        <Text style={{ fontSize: 48, opacity: 0.3 }}>📄</Text>
                        <Text style={[styles.pd_emptyTitle, { color: txt }]}>
                          No documents yet
                        </Text>
                        <Text style={[styles.pd_emptyText, { color: sub }]}>
                          Tap Upload Documents to add from Camera, Gallery or Files. Files attached to this project's tasks will also appear here.
                        </Text>
                      </View>
                    ) : (
                      projectDocs.map((d) => {
                        const kind = getFileKind(d);
                        const openDoc = () => {
                          if (d.uri) Linking.openURL(d.uri).catch(() => {});
                        };
                        return (
                          <TouchableOpacity
                            key={d.id}
                            style={[styles.docCard, { backgroundColor: card, borderColor: bdr }]}
                            activeOpacity={0.7}
                            onPress={openDoc}
                          >
                            {d.type === 'image' ? (
                              <Image source={{ uri: d.uri }} style={styles.docThumb} />
                            ) : (
                              <View style={[styles.docThumb, styles.docThumbIcon]}>
                                <Text style={{ fontSize: 22 }}>{kind.icon}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.docName, { color: txt }]} numberOfLines={1}>{d.name}</Text>
                              <View style={styles.docMetaRow}>
                                <View style={styles.docTypePill}>
                                  <Text style={styles.docTypePillText}>{kind.label}</Text>
                                </View>
                                {/* Task attribution badge (only for task-attachment docs) */}
                                {d.source === 'task' && d.taskId != null && (
                                  <View style={styles.docTaskPill}>
                                    <Text style={styles.docTaskPillText}>Task #{d.taskId}</Text>
                                  </View>
                                )}
                                {!!d.size && <Text style={[styles.docMetaText, { color: sub }]}>{formatSize(d.size)}</Text>}
                                <Text style={[styles.docMetaText, { color: sub }]}>{formatDocDate(d.uploadedAt)}</Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.docDeleteBtn}
                              onPress={() => deleteDocument(d.id)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text style={{ fontSize: 14, color: '#EF4444' }}>✕</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </>
                )}

              </ScrollView>

              {/* ── Upload Source Picker (inline, renders on top of details screen) ── */}
              {uploadModalOpen && (
                <>
                  <TouchableOpacity
                    style={styles.uploadModalOverlay}
                    activeOpacity={1}
                    onPress={() => setUploadModalOpen(false)}
                  />
                  <View style={styles.uploadModalWrap} pointerEvents="box-none">
                    <View style={styles.uploadModalCard}>
                      <View style={styles.uploadHandle} />
                      <Text style={styles.uploadTitle}>Upload Documents</Text>
                      <Text style={styles.uploadSubtitle}>Choose a source</Text>

                      <TouchableOpacity style={styles.uploadOption} onPress={pickFromCamera} activeOpacity={0.7}>
                        <View style={[styles.uploadOptionIcon, { backgroundColor: '#FEF2F2' }]}>
                          <Text style={{ fontSize: 22 }}>📷</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.uploadOptionTitle}>Camera</Text>
                          <Text style={styles.uploadOptionDesc}>Take a photo right now</Text>
                        </View>
                        <Text style={styles.uploadChevron}>›</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.uploadOption} onPress={pickFromGallery} activeOpacity={0.7}>
                        <View style={[styles.uploadOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                          <Text style={{ fontSize: 22 }}>🖼️</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.uploadOptionTitle}>Gallery</Text>
                          <Text style={styles.uploadOptionDesc}>Pick photos from your library</Text>
                        </View>
                        <Text style={styles.uploadChevron}>›</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.uploadOption} onPress={pickFromFiles} activeOpacity={0.7}>
                        <View style={[styles.uploadOptionIcon, { backgroundColor: '#F0FDF4' }]}>
                          <Text style={{ fontSize: 22 }}>📁</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.uploadOptionTitle}>Files</Text>
                          <Text style={styles.uploadOptionDesc}>PDF, JSON, DOCX, and any other</Text>
                        </View>
                        <Text style={styles.uploadChevron}>›</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.uploadCancelBtn}
                        onPress={() => setUploadModalOpen(false)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.uploadCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* ── Import Tasks via JSON Modal (inline) ── */}
              {importModalOpen && (
                <>
                  <TouchableOpacity
                    style={styles.uploadModalOverlay}
                    activeOpacity={1}
                    onPress={closeImportModal}
                  />
                  <View style={styles.uploadModalWrap} pointerEvents="box-none">
                    <View style={[styles.uploadModalCard, { maxWidth: 440 }]}>
                      <Text style={styles.uploadTitle}>⬆ Import Tasks via JSON</Text>
                      <Text style={styles.uploadSubtitle}>
                        Paste JSON or pick a .json file
                      </Text>

                      {/* JSON textarea */}
                      <TextInput
                        style={styles.importTextarea}
                        placeholder='Paste your JSON here... e.g. {"tasks":[{"heading":"...","priority":"high"}]}'
                        placeholderTextColor="#AAAABC"
                        value={importJsonText}
                        onChangeText={setImportJsonText}
                        multiline
                        textAlignVertical="top"
                        editable={!importing}
                      />

                      {/* Select .json file button */}
                      <TouchableOpacity
                        style={styles.importFileBtn}
                        onPress={pickJsonFile}
                        disabled={importing}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.importFileBtnText}>📄 Select .json File</Text>
                      </TouchableOpacity>

                      {/* Progress indicator */}
                      {importing && (
                        <View style={styles.importProgress}>
                          <ActivityIndicator size="small" color="#4ECDC4" />
                          <Text style={styles.importProgressText}>{importProgress || 'Creating tasks...'}</Text>
                        </View>
                      )}

                      {/* Action buttons */}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <TouchableOpacity
                          style={styles.importCancelBtn}
                          onPress={closeImportModal}
                          disabled={importing}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.uploadCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.importSubmitBtn, { opacity: importing ? 0.5 : 1 }]}
                          onPress={submitImportTasks}
                          disabled={importing}
                          activeOpacity={0.8}
                        >
                          {importing ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={styles.pd_createTaskBtnText}>Create Tasks</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        </>
      )}

      {/* Task Detail Modal (full-screen) */}
      <TaskDetailModal
        visible={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onUpdated={(updatedTask) => {
          // Refresh the project's task list and keep modal open with updated data
          if (selectedProject) {
            getTasks().then(all => {
              const forThisProject = (all || []).filter(t => {
                const pid = t.project_details?.id ?? t.project ?? t.project_id;
                return String(pid) === String(selectedProject.id);
              });
              setProjectTasks(forThisProject);
            }).catch(() => {});
          }
          if (updatedTask) setDetailTask(updatedTask);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },
  subHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 17, fontWeight: '700' },
  pageSub: { fontSize: 12, marginTop: 2 },
  newBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  filterLabel: { fontSize: 13, fontWeight: '500' },
  filterChips: { flexDirection: 'row', gap: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  filterChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterChipText: { fontSize: 12, color: '#888899', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, marginBottom: 8 },
  card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  projectIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  projectIconText: { color: '#4ECDC4', fontSize: 16, fontWeight: '700' },
  projectName: { fontSize: 14, fontWeight: '600' },
  projectMeta: { fontSize: 11 },
  progressBg: { height: 4, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#4ECDC4', borderRadius: 2 },
  statusChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  // Modal
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topModal: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxHeight: '94%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  modalScroll: { paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  memberRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 12, height: 46 },
  dropdownText: { fontSize: 13, color: '#1A1A2E', flex: 1 },
  dropdownArrow: { fontSize: 11, color: '#888899', marginLeft: 4 },
  removeRowBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  addMemberBtn: { paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#4ECDC4', borderRadius: 10, borderStyle: 'dashed', marginBottom: 4 },
  addMemberText: { fontSize: 13, color: '#4ECDC4', fontWeight: '600' },
  attachRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  attachBtn: { flex: 1, backgroundColor: '#F5F5F7', borderRadius: 12, borderWidth: 1.5, borderColor: '#EBEBF0', paddingVertical: 12, alignItems: 'center', gap: 3 },
  attachIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 2, borderWidth: 1, borderColor: '#EBEBF0' },
  attachLabel: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  attachSub: { fontSize: 10, color: '#AAAABC' },
  previewImg: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0' },
  removeImg: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F87171', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
  submitBtn: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },

  // ── Card member preview (stacked avatars on list item) ──
  cardMembersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  cardAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  cardAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  cardAvatarText: { color: '#7C3AED', fontSize: 10, fontWeight: '700' },
  cardAvatarExtra: { backgroundColor: '#EBEBF0' },
  cardAvatarExtraText: { color: '#888899', fontSize: 9, fontWeight: '700' },
  cardMembersLabel: {
    fontSize: 11, fontWeight: '500', marginLeft: 10, flex: 1,
  },
  cardChevron: { fontSize: 20, fontWeight: '300' },
  cardFavBtn: {
    paddingHorizontal: 6, paddingVertical: 2,
    marginRight: 4,
  },
  cardFavIcon: { fontSize: 20, color: '#C0C0CE', lineHeight: 22 },
  cardFavIconActive: { color: '#F59E0B' },

  // ── Project Details Modal ──
  detailsHeaderCard: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  detailsIconLarge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#4ADE80',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  detailsIconText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  detailsProjectName: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  detailsProjectType: { fontSize: 13, color: '#888899', fontWeight: '500' },

  detailsSection: {
    marginBottom: 18,
  },
  detailsSectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailsSectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#1A1A2E',
  },
  detailsCountPill: {
    backgroundColor: 'rgba(78,205,196,0.12)',
    minWidth: 26, height: 22, borderRadius: 11,
    paddingHorizontal: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  detailsCountText: { fontSize: 11, color: '#4ECDC4', fontWeight: '700' },

  // Member row in details modal
  dm_memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#F0F0F5',
    padding: 10, marginBottom: 8,
  },
  dm_memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center', alignItems: 'center',
  },
  dm_memberAvatarText: { color: '#7C3AED', fontSize: 16, fontWeight: '700' },
  dm_memberName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  dm_memberUsername: { fontSize: 12, color: '#888899', marginTop: 1 },
  dm_roleChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  dm_roleText: { fontSize: 11, fontWeight: '700' },
  // role-specific colors
  dm_role_owner:      { backgroundColor: 'rgba(168,139,250,0.15)' },
  dm_roleText_owner:  { color: '#A78BFA' },
  dm_role_manager:    { backgroundColor: 'rgba(59,130,246,0.12)' },
  dm_roleText_manager:{ color: '#3B82F6' },
  dm_role_annotator:  { backgroundColor: 'rgba(78,205,196,0.12)' },
  dm_roleText_annotator:{ color: '#4ECDC4' },
  dm_role_viewer:     { backgroundColor: 'rgba(136,136,153,0.15)' },
  dm_roleText_viewer: { color: '#888899' },
  dm_role_admin:      { backgroundColor: 'rgba(239,68,68,0.12)' },
  dm_roleText_admin:  { color: '#EF4444' },
  dm_role_member:     { backgroundColor: '#EBEBF0' },
  dm_roleText_member: { color: '#5C5C6E' },

  dm_memberEmpty: {
    alignItems: 'center', paddingVertical: 20, gap: 6,
    backgroundColor: '#FAFAFA',
    borderRadius: 12, borderWidth: 1, borderColor: '#F0F0F5',
  },
  dm_memberEmptyText: { fontSize: 12, color: '#AAAABC' },

  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  metaLabel: { fontSize: 13, color: '#888899' },
  metaValue: { fontSize: 13, color: '#1A1A2E', fontWeight: '600' },

  // Task card inside project details modal
  taskCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0F0F5',
    padding: 12,
    marginBottom: 8,
  },
  taskCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  taskCardTitle: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '600',
    lineHeight: 19,
  },
  taskCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  taskCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  taskMetaIcon: { fontSize: 11 },
  taskMetaText: { fontSize: 11, color: '#5C5C6E', fontWeight: '500' },
  taskMetaDim: { fontSize: 11, color: '#AAAABC', fontWeight: '500' },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  taskStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  taskStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Assignee stack inside task cards
  taskAssigneeStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskAssigneeAvatar: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FAFAFA',
  },
  taskAssigneeText: { color: '#7C3AED', fontSize: 9, fontWeight: '700' },
  taskAssigneeExtra: { backgroundColor: '#EBEBF0' },
  taskAssigneeExtraText: { color: '#888899', fontSize: 8, fontWeight: '700' },

  // ── Project Detail Full-Screen Modal ──
  pd_screen: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24),
  },
  pd_header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pd_backBtn: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  pd_backIcon: { fontSize: 32, fontWeight: '300', marginTop: -3 },
  pd_headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  pd_headerIconText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  pd_headerName: { fontSize: 16, fontWeight: '700' },
  pd_headerType: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  // Tabs
  pd_tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  pd_tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  pd_tabActive: { borderBottomColor: '#1A1A2E' },
  pd_tabText: { fontSize: 13, color: '#888899', fontWeight: '600' },
  pd_tabTextActive: { color: '#1A1A2E', fontWeight: '700' },
  pd_tabCount: {
    minWidth: 20, height: 18, borderRadius: 9,
    paddingHorizontal: 6,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EBEBF0',
  },
  pd_tabCountActive: { backgroundColor: '#1A1A2E' },
  pd_tabCountText: { fontSize: 10, color: '#888899', fontWeight: '700' },
  pd_tabCountTextActive: { color: '#4ECDC4' },

  // Task actions (search + create)
  pd_taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pd_searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 40,
  },
  pd_searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  pd_createTaskBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pd_createTaskBtnText: {
    color: '#fff', fontSize: 13, fontWeight: '700',
  },

  // Empty / loading states in tabs
  pd_emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
    gap: 8,
  },
  pd_loadingState: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  pd_emptyTitle: {
    fontSize: 16, fontWeight: '700',
  },
  pd_emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // Member card in members tab
  pd_memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  pd_memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center', alignItems: 'center',
  },
  pd_memberAvatarText: { color: '#7C3AED', fontSize: 17, fontWeight: '700' },
  pd_memberName: { fontSize: 14, fontWeight: '600' },
  pd_memberUsername: { fontSize: 12, marginTop: 1 },
  pd_memberEmail: { fontSize: 11, marginTop: 2 },

  // ── Document card in Documents tab ──
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  docThumb: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: '#F5F5F7',
  },
  docThumbIcon: {
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EBEBF0',
  },
  docName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  docMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  docTypePill: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  docTypePillText: { color: '#4ECDC4', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  docTaskPill: {
    backgroundColor: '#CFFAFE',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  docTaskPillText: { color: '#06B6D4', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  docMetaText: { fontSize: 11, fontWeight: '500' },
  docDeleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Upload source picker modal ──
  uploadModalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
    elevation: 100,
  },
  uploadModalWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 101,
    elevation: 101,
  },
  uploadModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  uploadHandle: {
    display: 'none', // hidden — only needed for bottom sheets
  },
  uploadTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  uploadSubtitle: { fontSize: 13, color: '#888899', marginBottom: 20 },
  uploadOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  uploadOptionIcon: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  uploadOptionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  uploadOptionDesc: { fontSize: 12, color: '#888899', marginTop: 2 },
  uploadChevron: { fontSize: 20, color: '#AAAABC', fontWeight: '300' },
  uploadCancelBtn: {
    marginTop: 14,
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadCancelText: { fontSize: 14, fontWeight: '600', color: '#5C5C6E' },

  // ── Tasks tab: buttons row (Create + Import) ──
  pd_taskActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pd_importBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#1A1A2E',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pd_importBtnText: {
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Import JSON modal ──
  importTextarea: {
    backgroundColor: '#F5F5F7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EBEBF0',
    padding: 12,
    minHeight: 140,
    maxHeight: 200,
    fontSize: 12,
    color: '#1A1A2E',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    marginBottom: 10,
  },
  importFileBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  importFileBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  importProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(78,205,196,0.08)',
    borderRadius: 10,
  },
  importProgressText: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  importCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  importSubmitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
