import React, { useState, useCallback, useContext, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Platform, Modal, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken, getWorkspaceId, getTasks } from '../services/ApiService';
import { API_BASE, BASE_URL } from '../config';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

// ── Token colours ─────────────────────────────────────────────────────────────
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

const PROJECT_COLORS = [T.cBlue, T.cPurple, T.cGreen, T.cYellow, T.cRed, '#0EA5E9', '#10B981', '#F97316'];
const TASK_TYPE_LABELS = { client: 'Client', internal: 'Internal', content_creation: 'Content Creation', ideas: 'Ideas' };
const TASK_STATUS_COLORS = { pending: '#888899', in_progress: '#4ECDC4', completed: '#4ADE80', backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA' };
const TASK_STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review' };
const DOC_COLORS = { pdf: T.cRed, doc: T.cBlue, docx: T.cBlue, xls: T.cGreen, xlsx: T.cGreen, ppt: T.cYellow, pptx: T.cYellow };
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#22A06B', '#F59E0B', '#E5484D', '#0EA5E9', '#10B981', '#F97316'];

const DOCS_API     = `${API_BASE}/api/v1/documents/`;
const TASKSITE_API = `${API_BASE}/api/v1/tasksite/`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

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

const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d || '—'; }
};

const guessMime = (fn = '') => {
  const ext = String(fn).split('?')[0].split('.').pop().toLowerCase();
  if (['png','jpg','jpeg','gif','webp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  if (ext === 'pdf') return 'application/pdf';
  if (['doc','docx'].includes(ext)) return 'application/msword';
  if (['xls','xlsx','csv'].includes(ext)) return 'application/vnd.ms-excel';
  return 'application/octet-stream';
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProjectDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const isDark     = theme === 'Dark';

  const bg   = isDark ? '#0D0D0F' : T.surfaceAlt;
  const card = isDark ? '#1A1A20' : T.surface;
  const txt  = isDark ? '#FFFFFF' : T.ink;
  const sub  = isDark ? '#9898A6' : T.ink3;
  const bdr  = isDark ? '#252530' : T.hairline;

  // Project from route params
  const [project,     setProject]     = useState(route?.params?.project || null);
  const projectId = route?.params?.projectId || route?.params?.id || project?.id;

  // ── State ─────────────────────────────────────────────────────────────────
  const [projectTasks,    setProjectTasks]    = useState([]);
  const [projectDocs,     setProjectDocs]     = useState([]);
  const [loadingTasks,    setLoadingTasks]    = useState(false);
  const [loadingDocs,     setLoadingDocs]     = useState(false);
  const [activeTab,       setActiveTab]       = useState('overview');
  const [taskSearch,      setTaskSearch]      = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading,       setUploading]       = useState(false);

  // Pick project color based on id
  const projColor = '#4A7FE5';
  const memberList  = getProjectMembers(project);
  const memberCount = project?.member_count ?? memberList.length;
  const progress    = project?.progress || project?.completion_percentage || 0;

  const totalT    = projectTasks.length;
  const doneT     = projectTasks.filter(t => (t.status||'').toLowerCase() === 'completed').length;
  const inProgT   = projectTasks.filter(t => (t.status||'').toLowerCase() === 'in_progress').length;
  const pendingT  = projectTasks.filter(t => (t.status||'').toLowerCase() === 'pending').length;
  const overdueT  = projectTasks.filter(t => {
    const s = (t.status||'').toLowerCase();
    const due = t.end_date || t.due_date;
    return s !== 'completed' && due && due < new Date().toISOString().slice(0, 10);
  }).length;
  const dueFmt = project?.end_date || project?.due_date
    ? new Date(project.end_date || project.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';

  // ── Fetch tasks ───────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    setLoadingTasks(true);
    try {
      const all = await getTasks();
      const forThis = (all || []).filter(t => {
        const pid = t.project_details?.id ?? t.project ?? t.project_id;
        return String(pid) === String(projectId);
      });
      setProjectTasks(forThis);
    } catch (e) { console.warn('fetchTasks:', e.message); }
    finally { setLoadingTasks(false); }
  }, [projectId]);

  // ── Fetch docs ────────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    if (!projectId) return;
    setLoadingDocs(true);
    try {
      const token = await getAccessToken();
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      // Direct project docs
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

      // Task attachments
      const taskAtts = [];
      let tUrl = `${TASKSITE_API}?project=${projectId}`;
      let ts = 10;
      while (tUrl && ts-- > 0) {
        const res = await fetch(tUrl, { headers });
        if (!res.ok) break;
        const json = await res.json();
        const tasks = Array.isArray(json) ? json : (json.results || []);
        tasks.forEach(t => (t.attachments || []).forEach(a => taskAtts.push({ ...a, _taskId: t.id, _taskHeading: t.heading })));
        tUrl = (!Array.isArray(json) && json.next) || null;
      }

      const norm = (d, source) => {
        const name = d.name || d.file_name || 'Untitled';
        const mt = guessMime(name);
        return { id: `${source}_${d.id}`, name, uri: d.source_file || d.file_url || null, mimeType: mt, size: d.file_size ?? null, uploadedAt: d.updated_at || d.created_at, type: mt.startsWith('image/') ? 'image' : 'file', source };
      };

      const combined = [
        ...out.map(d => norm(d, 'project')),
        ...taskAtts.map(d => norm(d, 'task')),
      ].sort((x, y) => new Date(y.uploadedAt || 0) - new Date(x.uploadedAt || 0));

      setProjectDocs(combined);
    } catch (e) { console.warn('fetchDocs:', e?.message); setProjectDocs([]); }
    finally { setLoadingDocs(false); }
  }, [projectId]);

  // ── Fetch project detail ──────────────────────────────────────────────────
  const fetchProject = useCallback(async () => {
    if (!projectId || route?.params?.project) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/projects/${projectId}/`, { headers });
      if (res.ok) setProject(await res.json());
    } catch (e) { console.warn('fetchProject:', e.message); }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchTasks();
    fetchDocs();
  }, [projectId]);

  // ── Toggle pin ────────────────────────────────────────────────────────────
  const togglePin = async () => {
    if (!project) return;
    const key = detectFavKey(project);
    const next = !isProjectFav(project);
    setProject(p => p ? { ...p, [key]: next } : p);
    try {
      const headers = await authHeaders();
      await fetch(`${BASE_URL}/projects/${projectId}/`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ [key]: next }),
      });
    } catch { setProject(p => p ? { ...p, [key]: !next } : p); }
  };

  // ── Document upload ───────────────────────────────────────────────────────
  const addDocument = async (doc) => {
    try {
      const token = await getAccessToken();
      const step1 = await fetch(`${API_BASE}/api/v1/projects/${projectId}/get-upload-url/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: doc.name, file_type: doc.mimeType || 'application/octet-stream' }),
      });
      const presigned = await step1.json().catch(() => ({}));
      if (!step1.ok) throw new Error(presigned.detail || `upload failed (${step1.status})`);
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
      if (!step3.ok) throw new Error(`confirm failed (${step3.status})`);
      await fetchDocs();
    } catch (e) { Alert.alert('Upload Failed', e?.message || 'Could not upload document.'); }
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
      await addDocument({ name: `Photo_${Date.now()}.jpg`, uri: a.uri, mimeType: 'image/jpeg' });
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
      for (const a of result.assets) await addDocument({ name: a.fileName || `Image_${Date.now()}.jpg`, uri: a.uri, mimeType: a.mimeType || 'image/jpeg' });
    } catch (e) { Alert.alert('Error', e.message); } finally { setUploading(false); }
  };

  const pickFromFiles = async () => {
    setUploadModalOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      for (const a of result.assets) await addDocument({ name: a.name, uri: a.uri, mimeType: a.mimeType || 'application/octet-stream' });
    } catch (e) { Alert.alert('Error', e.message); } finally { setUploading(false); }
  };

  const isFav = isProjectFav(project);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle="light-content" backgroundColor={projColor} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Hero ── */}
        <View style={{ backgroundColor: projColor, paddingTop: Platform.OS === 'ios' ? insets.top + 8 : (StatusBar.currentHeight || 24) + 10, paddingHorizontal: 18, paddingBottom: 20 }}>

          {/* Top row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36, height: 36, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={togglePin} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 3l-6 6-4 1 9 9 1-4 6-6-6-6z"
                  fill={isFav ? '#585858' : 'none'}
                  stroke={isFav ? '#585858' : '#fff'}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
                <Path d="M9 9l6 6M3 21l4-4" stroke={isFav ? '#585858' : '#fff'} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>•••</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar + name */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{(project?.name || 'P').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 }} numberOfLines={1}>{project?.name || 'Project'}</Text>
              {project?.description && (
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 3 }} numberOfLines={1}>{project.description}</Text>
              )}
            </View>
          </View>

          {/* Progress glass card */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>Progress</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{progress}%</Text>
            </View>
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 6 }}>
              <View style={{ height: 6, width: `${Math.min(100, progress)}%`, backgroundColor: '#fff', borderRadius: 6, opacity: 0.9 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
              {[
                { label: 'Tasks',   value: String(totalT) },
                { label: 'Done',    value: String(doneT) },
                { label: 'Members', value: String(memberCount) },
                { label: 'Due',     value: dueFmt },
              ].map((item, i) => (
                <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{item.value}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={{ flexDirection: 'row', backgroundColor: card, borderBottomWidth: 1, borderBottomColor: bdr, paddingHorizontal: 16 }}>
          {['Overview', 'Tasks', 'Docs', 'Team'].map(tabId => {
            const key = tabId === 'Team' ? 'members' : tabId === 'Docs' ? 'documents' : tabId.toLowerCase();
            const isActive = activeTab === key;
            return (
              <TouchableOpacity
                key={tabId}
                onPress={() => setActiveTab(key)}
                style={{ paddingVertical: 12, paddingHorizontal: 4, marginRight: 20, borderBottomWidth: 2, borderBottomColor: isActive ? T.brand : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? T.brand : sub }}>{tabId}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab content ── */}
        <View style={{ padding: 14 }}>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <View style={{ gap: 20 }}>
              {/* Task breakdown */}
              <View style={{ backgroundColor: card, borderRadius: T.rMd, borderWidth: 1, borderColor: bdr, padding: 16 }}>
                {[
                  { label: 'In Progress', value: inProgT,  color: '#3B82F6' },
                  { label: 'Pending',     value: pendingT, color: '#F59E0B' },
                  { label: 'Completed',   value: doneT,    color: '#22A06B' },
                  { label: 'Overdue',     value: overdueT, color: '#E5484D' },
                ].map((item, i, arr) => (
                  <View key={item.label} style={{ marginBottom: i < arr.length - 1 ? 16 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                        <Text style={{ fontSize: 13, color: sub, fontWeight: '500' }}>{item.label}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: txt }}>{item.value}</Text>
                    </View>
                    <View style={{ height: 5, backgroundColor: isDark ? '#252530' : T.hairlineSoft, borderRadius: 5 }}>
                      <View style={{ height: 5, width: `${totalT > 0 ? (item.value / totalT) * 100 : 0}%`, backgroundColor: item.color, borderRadius: 5 }} />
                    </View>
                  </View>
                ))}
              </View>

              {/* Activity */}
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: txt, marginBottom: 10 }}>Activity</Text>
                {projectDocs.length === 0 ? (
                  <View style={{ backgroundColor: card, borderRadius: T.rMd, borderWidth: 1, borderColor: bdr, padding: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: sub }}>No recent activity</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: card, borderRadius: T.rMd, borderWidth: 1, borderColor: bdr }}>
                    {projectDocs.slice(0, 6).map((doc, i) => {
                      const name  = doc.name || 'Untitled';
                      const ext   = name.split('.').pop().toLowerCase();
                      const color = DOC_COLORS[ext] || T.ink3;
                      const when  = formatDocDate(doc.uploadedAt || doc.created_at);
                      return (
                        <View key={doc.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i < Math.min(projectDocs.length, 6) - 1 ? 1 : 0, borderBottomColor: bdr }}>
                          <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: color + '22', justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color, letterSpacing: 0.3 }}>{ext.toUpperCase().slice(0, 3)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: txt }} numberOfLines={1}>{name}</Text>
                            <Text style={{ fontSize: 11, color: sub, marginTop: 2 }}>{when}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TASKS TAB */}
          {activeTab === 'tasks' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>Tasks ({totalT})</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Tasks', params: { openCreateModal: true, presetProjectId: projectId } })}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: T.brand }}>+ Add task</Text>
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
                    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
                      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={txt} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                      <Path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={txt} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                      <Path d="M9 12h6M9 16h4" stroke={txt} strokeWidth={1.5} strokeLinecap="round"/>
                    </Svg>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>{projectTasks.length === 0 ? 'No tasks yet' : 'No matches'}</Text>
                    <Text style={{ fontSize: 13, color: sub }}>{projectTasks.length === 0 ? 'Tap + Add task to create one' : 'Try a different search'}</Text>
                  </View>
                );
                return (
                  <View style={{ backgroundColor: card, borderRadius: T.rMd, borderWidth: 1, borderColor: bdr }}>
                    {filteredTasks.map((t, i) => {
                      const statusKey   = (t.status || 'pending').toLowerCase();
                      const isDone      = statusKey === 'completed';
                      const statusLabel = TASK_STATUS_LABELS[statusKey] || statusKey;
                      const statusColor = TASK_STATUS_COLORS[statusKey] || '#888';
                      const projName    = t.project_details?.name || t.project_name || 'DYUKSA';
                      const dueDate     = t.end_date || t.due_date;
                      return (
                        <TouchableOpacity
                          key={t.id || i}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: i < filteredTasks.length - 1 ? 1 : 0, borderBottomColor: bdr }}
                          onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isDone ? T.cGreen : (isDark ? '#404055' : '#CDCFDA'), backgroundColor: isDone ? T.cGreen : 'transparent', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                            {isDone && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: isDone ? sub : txt, textDecorationLine: isDone ? 'line-through' : 'none' }} numberOfLines={1}>
                              {t.heading || t.title || 'Untitled'}
                            </Text>
                            <Text style={{ fontSize: 11, color: sub, marginTop: 2 }}>
                              {projName}{dueDate ? ` • ${fmtDate(dueDate)}` : ''}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
            </>
          )}

          {/* DOCS TAB */}
          {activeTab === 'documents' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>Documents</Text>
                <TouchableOpacity onPress={() => setUploadModalOpen(true)} disabled={uploading}>
                  {uploading
                    ? <ActivityIndicator size="small" color={T.brand} />
                    : <Text style={{ fontSize: 14, fontWeight: '600', color: T.brand }}>+ Upload</Text>
                  }
                </TouchableOpacity>
              </View>
              {loadingDocs ? (
                <ActivityIndicator color={T.brand} style={{ marginTop: 40 }} />
              ) : projectDocs.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 56, gap: 8 }}>
                  <Text style={{ fontSize: 48, opacity: 0.3 }}>📄</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>No documents</Text>
                  <Text style={{ fontSize: 13, color: sub }}>Tap + Upload to add files</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: card, borderRadius: T.rMd, borderWidth: 1, borderColor: bdr }}>
                  {projectDocs.map((doc, i) => {
                    const name  = doc.name || 'Untitled';
                    const ext   = name.split('.').pop().toLowerCase();
                    const color = DOC_COLORS[ext] || T.ink3;
                    const size  = doc.size ? (doc.size > 1048576 ? `${(doc.size / 1048576).toFixed(1)} MB` : `${(doc.size / 1024).toFixed(0)} KB`) : '';
                    const when  = formatDocDate(doc.uploadedAt || doc.created_at);
                    return (
                      <View key={doc.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: i < projectDocs.length - 1 ? 1 : 0, borderBottomColor: bdr }}>
                        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: color + '22', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color, letterSpacing: 0.3 }}>{ext.toUpperCase().slice(0, 3)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: txt }} numberOfLines={1}>{name}</Text>
                          <Text style={{ fontSize: 11, color: sub, marginTop: 2 }}>{[size, when].filter(Boolean).join(' · ')}</Text>
                        </View>
                        <Text style={{ fontSize: 20, color: sub }}>›</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* TEAM TAB */}
          {activeTab === 'members' && (
            memberList.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 56, gap: 8 }}>
                <Text style={{ fontSize: 48, opacity: 0.3 }}>👥</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>No members</Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>Team members ({memberCount})</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('InviteUser')}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: T.brand }}>+ Invite</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ backgroundColor: card, borderRadius: T.rMd, borderWidth: 1, borderColor: bdr }}>
                  {memberList.map((m, i) => {
                    const u        = m.user || m.user_details || {};
                    const name     = u.full_name || (`${u.first_name || ''} ${u.last_name || ''}`).trim() || u.username || 'Unknown';
                    const initials = name.split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
                    const role     = m.role || 'member';
                    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                    const isOwner  = role.toLowerCase() === 'owner';
                    const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    return (
                      <View key={m.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: i < memberList.length - 1 ? 1 : 0, borderBottomColor: bdr }}>
                        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: avatarColor, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>{name}</Text>
                          <Text style={{ fontSize: 12, color: sub, marginTop: 1 }}>{TASK_TYPE_LABELS[m.role] || roleLabel}</Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isOwner ? T.cBlue : sub }}>{roleLabel}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )
          )}

        </View>
      </ScrollView>

      {/* FAB — add task */}
      {activeTab === 'tasks' && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Main', { screen: 'Tasks', params: { openCreateModal: true, presetProjectId: projectId } })}
          style={{ position: 'absolute', right: 18, bottom: 36, width: 56, height: 56, borderRadius: 28, backgroundColor: projColor, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8 }}
        >
          <Text style={{ fontSize: 28, color: '#fff', fontWeight: '300', marginTop: -2 }}>+</Text>
        </TouchableOpacity>
      )}

      {/* Upload source picker */}
      {uploadModalOpen && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setUploadModalOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <View style={{ width: '100%', maxWidth: 400, borderRadius: 20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: card }}>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 4, color: txt }}>Upload Document</Text>
              <Text style={{ fontSize: 13, color: sub, marginBottom: 20 }}>Choose a source</Text>
              {[
                { icon: '📷', label: 'Camera',  desc: 'Take a photo',        onPress: pickFromCamera },
                { icon: '🖼️', label: 'Gallery', desc: 'Pick from photos',    onPress: pickFromGallery },
                { icon: '📁', label: 'Files',   desc: 'Browse device files', onPress: pickFromFiles },
              ].map((opt, i, arr) => (
                <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.hairlineSoft }} onPress={opt.onPress}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.cBlueSoft, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: txt }}>{opt.label}</Text>
                    <Text style={{ fontSize: 12, color: sub, marginTop: 2 }}>{opt.desc}</Text>
                  </View>
                  <Text style={{ fontSize: 20, color: sub }}>›</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={{ marginTop: 14, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: isDark ? '#252530' : '#F5F5F7' }} onPress={() => setUploadModalOpen(false)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: sub }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
