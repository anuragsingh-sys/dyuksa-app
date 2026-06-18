import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Image, Pressable,
  StyleSheet, ActivityIndicator, Alert, StatusBar, Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import { BASE_URL } from '../config';
import { invalidateTasksCache } from '../hooks/useTasksCache';

// Lazy load DateTimePicker
let DateTimePicker = null;
try { DateTimePicker = require('@react-native-community/datetimepicker').default; } catch {}
let DocumentPicker = null;
try { DocumentPicker = require('expo-document-picker'); } catch {}

// ── Token colours ─────────────────────────────────────────────────────────────
const T = {
  brand: '#3B72EE', brandSoft: '#EAF1FE',
  ink: '#0E1726', ink2: '#3B4658', ink3: '#6B7588', ink4: '#9AA3B2',
  hairline: '#E6E9EF', hairlineSoft: '#F0F2F6',
  surface: '#FFFFFF', surfaceAlt: '#F7F8FB', surfaceCool: '#F2F4F8',
  cBlue: '#2D6AE3', cGreen: '#22A06B', cYellow: '#E5A60E',
  cPurple: '#7A5AF8', cRed: '#E5484D',
  r: 10, rMd: 14,
};

const STATUS_COLORS = {
  pending: '#D97706', in_progress: '#3B82F6', completed: '#22C55E',
  backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA',
};
const STATUS_BG = {
  pending: '#FEF3C7', in_progress: '#EFF6FF', completed: '#F0FDF4',
  backlog: '#FDF2F8', deployed: '#EFF6FF', deferred: '#FFFBEB', review: '#F5F3FF',
};
const STATUS_LABELS = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed',
  backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review',
};
const PRIORITY_COLORS = { low: '#22C55E', medium: '#3B82F6', high: '#F97316', urgent: '#EF4444' };

// ── Auth headers ──────────────────────────────────────────────────────────────
const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return fmtDate(iso);
  } catch { return ''; }
};

const getInitial = (name = '') => name.trim().charAt(0).toUpperCase() || '?';

// ── Mini components ───────────────────────────────────────────────────────────
function Card({ children, style, padding = 16 }) {
  return (
    <View style={[{ backgroundColor: T.surface, borderRadius: T.rMd, borderWidth: 1, borderColor: T.hairline, padding }, style]}>
      {children}
    </View>
  );
}

function MetaRow({ label, children, isLast }) {
  return (
    <View style={[s.metaRow, !isLast && { borderBottomWidth: 1, borderBottomColor: T.hairline }]}>
      <Text style={s.metaLabel}>{label}</Text>
      <View style={s.metaRight}>{children}</View>
    </View>
  );
}

function SectionHeader({ children, right }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderText}>{children}</Text>
      {right}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

// ── Doc helpers ───────────────────────────────────────────────────────────────
const TYPE_META_ATT = {
  png:{ label:'PNG', color:'#8B5CF6', bg:'#F5F3FF' }, jpg:{ label:'JPG', color:'#8B5CF6', bg:'#F5F3FF' },
  jpeg:{ label:'JPG', color:'#8B5CF6', bg:'#F5F3FF' }, gif:{ label:'GIF', color:'#8B5CF6', bg:'#F5F3FF' },
  webp:{ label:'WEBP', color:'#8B5CF6', bg:'#F5F3FF' }, heic:{ label:'HEIC', color:'#8B5CF6', bg:'#F5F3FF' },
  pdf:{ label:'PDF', color:'#EF4444', bg:'#FEF2F2' },
  doc:{ label:'DOC', color:'#2563EB', bg:'#EFF6FF' }, docx:{ label:'DOCX', color:'#2563EB', bg:'#EFF6FF' },
  xls:{ label:'XLS', color:'#16A34A', bg:'#F0FDF4' }, xlsx:{ label:'XLSX', color:'#16A34A', bg:'#F0FDF4' },
  csv:{ label:'CSV', color:'#16A34A', bg:'#F0FDF4' },
  ppt:{ label:'PPT', color:'#EA580C', bg:'#FFF7ED' }, pptx:{ label:'PPTX', color:'#EA580C', bg:'#FFF7ED' },
  ts:{ label:'TS', color:'#2563EB', bg:'#EFF6FF' }, js:{ label:'JS', color:'#D97706', bg:'#FFFBEB' },
};
const FALLBACK_META_ATT = { label:'FILE', color:'#6B7280', bg:'#F9FAFB' };
const getAttExt = (name) => { if (!name) return ''; const p = String(name).split('?')[0].split('.'); return p.length < 2 ? '' : p[p.length-1].toLowerCase().trim(); };

export default function TaskDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const { user }   = useContext(AuthContext);

  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : T.surfaceAlt;
  const card = isDark ? '#1A1A20' : T.surface;
  const txt  = isDark ? '#FFFFFF' : T.ink;
  const sub  = isDark ? '#9898A6' : T.ink3;
  const bdr  = isDark ? '#252530' : T.hairline;

  // Task can be passed directly or fetched by ID
  const taskId = route?.params?.taskId || route?.params?.id;
  const passedTask = route?.params?.task;

  const [task,         setTask]         = useState(passedTask || null);
  const [loading,      setLoading]      = useState(true);
  const [comment,      setComment]      = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [comments,     setComments]     = useState(Array.isArray(passedTask?.comments) ? passedTask.comments : []);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusPicker,   setShowStatusPicker]   = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [updatingPriority,   setUpdatingPriority]   = useState(false);
  const [editingDesc,        setEditingDesc]        = useState(false);
  const [descDraft,          setDescDraft]          = useState('');
  const [uploading,          setUploading]          = useState(false);
  const [users,              setUsers]              = useState([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [assigningUser,      setAssigningUser]      = useState(false);
  const [datePicker,         setDatePicker]         = useState(null); // 'start' | 'end' | null
  const [datePickerValue,    setDatePickerValue]    = useState(new Date());
  const [showAllAssignees,   setShowAllAssignees]   = useState(false);
  const [subtasks,     setSubtasks]     = useState([]);
  const isUpdating = useRef(false);
  const [selectedAtt, setSelectedAtt] = useState(null);
  const [attWebView,  setAttWebView]  = useState(false);
  const [linkInput,   setLinkInput]   = useState('');
  const [taskLinks,   setTaskLinks]   = useState([]);
  const [attachments,  setAttachments]  = useState(Array.isArray(passedTask?.attachments) ? passedTask.attachments : []);

  // ── Fetch task ──────────────────────────────────────────────────────────────
  const fetchTask = useCallback(async () => {
    if (!taskId) { setLoading(false); return; }
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${taskId}/`, { headers });
      if (res.ok) {
        const raw = await res.json();
        const data = raw?.task || raw;
        if (!isUpdating.current) {
          setTask(data);
          if (Array.isArray(data.attachments)) setAttachments(data.attachments);
          if (Array.isArray(data.comments) && data.comments.length > 0) setComments(data.comments);
          if (Array.isArray(data.links)) setTaskLinks(data.links.map(l => l.url || l));
        }
      }
    } catch (e) { console.warn('fetchTask:', e.message); }
    finally { setLoading(false); }
  }, [taskId]);

  // ── Fetch comments ──────────────────────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    if (!taskId) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${taskId}/comments/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : (data.results || []));
      }
    } catch { /* comments are optional */ }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
    fetchComments();
  }, [taskId]);

  const fetchSubtasksAndAttachments = useCallback(async () => {
    if (!taskId) return;
    try {
      const headers = await authHeaders();
      const taskRes = await fetch(`${BASE_URL}/tasksite/${taskId}/`, { headers });
      if (taskRes.ok) {
        const data = await taskRes.json();
        // Attachments come directly in task response
        if (Array.isArray(data.attachments)) setAttachments(data.attachments);
        // Comments also come in task response
        if (Array.isArray(data.comments) && data.comments.length > 0) setComments(data.comments);
      }
    } catch { /* optional */ }
  }, [taskId]);

  // ── Update status ───────────────────────────────────────────────────────────
  const updateStatus = async (newStatus) => {
    const id = task?.id || taskId;
    if (!id) return;
    setShowStatusPicker(false);
    const prev = task?.status;
    setTask(t => ({ ...(t || {}), status: newStatus }));
    isUpdating.current = true;
    setUpdatingStatus(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTask(t => ({ ...(t || {}), status: prev }));
        Alert.alert('Error', 'Could not update status.');
      } else {
        const raw = await res.json();
        const data = raw?.task || raw;
        setTask(data);
        if (Array.isArray(data.attachments)) setAttachments(data.attachments);
      }
    } catch {
      setTask(t => ({ ...(t || {}), status: prev }));
    } finally {
      isUpdating.current = false;
      setUpdatingStatus(false);
    }
  };

  // ── Update priority ─────────────────────────────────────────────────────────
  const updatePriority = async (newPriority) => {
    const id = task?.id || taskId;
    if (!id) return;
    setShowPriorityPicker(false);
    const prev = task?.priority;
    setTask(t => ({ ...(t || {}), priority: newPriority }));
    isUpdating.current = true;
    setUpdatingPriority(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${id}/`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ priority: newPriority }),
      });
      if (!res.ok) {
        setTask(t => ({ ...(t || {}), priority: prev }));
        Alert.alert('Error', 'Could not update priority.');
      } else {
        const raw = await res.json();
        const data = raw?.task || raw;
        setTask(data);
      }
    } catch {
      setTask(t => ({ ...(t || {}), priority: prev }));
    } finally { isUpdating.current = false; setUpdatingPriority(false); }
  };

  // ── Update date ─────────────────────────────────────────────────────────────
  const updateDate = async (field, date) => {
    const id = task?.id || taskId;
    if (!id || !date) return;

    // Validation: due date can't be before start date
    if (field === 'end_date' && task.start_date) {
      const start = new Date(task.start_date);
      start.setHours(0,0,0,0);
      const due = new Date(date);
      due.setHours(0,0,0,0);
      if (due < start) {
        Alert.alert('Invalid Date', 'Due date cannot be before the start date.');
        return;
      }
    }
    if (field === 'start_date' && task.end_date) {
      const due = new Date(task.end_date);
      due.setHours(0,0,0,0);
      const start = new Date(date);
      start.setHours(0,0,0,0);
      if (start > due) {
        Alert.alert('Invalid Date', 'Start date cannot be after the due date.');
        return;
      }
    }

    const iso = date.toISOString();
    const prev = task[field];
    setTask(t => ({ ...t, [field]: iso }));
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${id}/`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ [field]: iso }),
      });
      if (!res.ok) setTask(t => ({ ...t, [field]: prev }));
    } catch { setTask(t => ({ ...t, [field]: prev })); }
  };

  // ── Add link ──────────────────────────────────────────────────────────────────
  const saveLinks = async (updated) => {
    const id = task?.id || taskId;
    if (!id) return;
    try {
      const headers = await authHeaders();
      await fetch(`${BASE_URL}/tasksite/${id}/`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ links: updated }),
      });
    } catch (e) { console.warn('saveLinks:', e.message); }
  };

  // ── Delete task ─────────────────────────────────────────────────────────────
  const deleteTask = async () => {
    const id = task?.id || taskId;
    if (!id) return;
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const headers = await authHeaders();
            const res = await fetch(`${BASE_URL}/tasksite/${id}/`, { method: 'DELETE', headers });
            if (res.ok || res.status === 204) {
              invalidateTasksCache();
              navigation.goBack();
            } else {
              Alert.alert('Error', 'Could not delete task.');
            }
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not delete task.');
          }
        },
      },
    ]);
  };

  // ── Fetch users for assignee picker ────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (users.length > 0) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/auth/users/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : (data.results || []));
      }
    } catch { /* optional */ }
  }, [users.length]);

  // ── Assign user to task ─────────────────────────────────────────────────────
  const assignUser = async (userId) => {
    if (!task?.id) return;
    const currentIds = Array.isArray(task.assigned_to) ? task.assigned_to : [];
    const isAlready = currentIds.includes(userId);
    const newIds = isAlready
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId];
    setAssigningUser(true);
    const prevTask = task;
    // Optimistic update
    const newUserDetails = users.filter(u => newIds.includes(u.id));
    setTask(t => ({ ...t, assigned_to: newIds, assigned_to_user_details: newUserDetails }));
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ assigned_to: newIds }),
      });
      if (!res.ok) setTask(prevTask);
    } catch { setTask(prevTask); }
    finally { setAssigningUser(false); }
  };

  // ── Upload attachment ───────────────────────────────────────────────────────
  const uploadAttachment = async () => {
    if (!DocumentPicker) {
      Alert.alert('Unavailable', 'Document picker not available in this build.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const picked = result.assets[0];
      setUploading(true);
      const token = await getAccessToken();
      const wsId  = await getWorkspaceId();
      const form  = new FormData();
      form.append('uploaded_files', {
        uri:  picked.uri,
        name: picked.name || 'upload',
        type: picked.mimeType || 'application/octet-stream',
      });
      const headers = { Authorization: `Bearer ${token}` };
      if (wsId) headers['X-Workspace-ID'] = wsId;
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/`, {
        method: 'PATCH', headers, body: form,
      });
      if (res.ok) {
        const raw = await res.json();
        const data = raw?.task || raw;
        if (Array.isArray(data.attachments)) setAttachments(data.attachments);
        setTask(prev => ({ ...(prev || {}), attachments: data.attachments || prev?.attachments }));
        Alert.alert('Uploaded', `${picked.name} uploaded successfully.`, [
          { text: 'OK', onPress: () => fetchTask() }
        ]);
      } else {
        Alert.alert('Error', 'Upload failed. Please try again.');
      }
    } catch (e) {
      if (!e?.message?.includes('cancel')) Alert.alert('Error', 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // ── Update description ──────────────────────────────────────────────────────
  const saveDescription = async () => {
    if (!task?.id) return;
    const prev = task.description;
    setTask(t => ({ ...t, description: descDraft }));
    setEditingDesc(false);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ description: descDraft }),
      });
      if (!res.ok) setTask(t => ({ ...t, description: prev }));
    } catch {
      setTask(t => ({ ...t, description: prev }));
    }
  };
  const sendComment = async () => {
    if (!comment.trim() || !task?.id) return;
    setSendingComment(true);
    const text = comment.trim();
    setComment('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/comments/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [...prev, data]);
      } else {
        // Optimistic fallback — show locally even if API not available
        setComments(prev => [...prev, {
          id: Date.now(),
          content: text,
          created_at: new Date().toISOString(),
          user: { first_name: user?.first_name || 'Me', username: user?.username },
        }]);
      }
    } catch {
      setComments(prev => [...prev, {
        id: Date.now(),
        content: text,
        created_at: new Date().toISOString(),
        user: { first_name: user?.first_name || 'Me', username: user?.username },
      }]);
    } finally {
      setSendingComment(false);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg }}>
        <ActivityIndicator size="large" color={'#3B72EE'} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg }}>
        <Text style={{ color: sub, fontSize: 16 }}>Task not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#3B72EE', fontWeight: '600' }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[task.status] || '#888';
  const statusBg    = STATUS_BG[task.status]    || '#F5F5F7';
  const statusLabel = STATUS_LABELS[task.status] || task.status || 'Unknown';
  const priorityKey = (task.priority || 'medium').toLowerCase();
  const priorityColor = PRIORITY_COLORS[priorityKey] || '#888';
  const isDone = (task.status || '').toLowerCase() === 'completed';

  const assignees = Array.isArray(task.assigned_to_user_details) ? task.assigned_to_user_details : [];
  const projectName = task.project_details?.name || task.project_name || (task.project ? `Project ${task.project}` : null) || 'Task Detail';
  const creatorName = (() => {
    const c = task.assigned_by_user_details || task.created_by;
    if (!c) return null;
    return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name || c.username || null;
  })();

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Nav bar ── */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => { invalidateTasksCache(); navigation.goBack(); }} style={s.backBtn}>
          <Text style={{ color: '#3B72EE', fontSize: 26, fontWeight: '300', marginTop: -3 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: txt }]} numberOfLines={1}>{projectName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            style={{ paddingHorizontal: 10, paddingVertical: 6 }}
            onPress={deleteTask}
          >
            <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingHorizontal: 10, paddingVertical: 6 }}
            onPress={() => {
              invalidateTasksCache();
              navigation.goBack();
            }}
          >
            <Text style={{ color: '#3B72EE', fontSize: 15, fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Title block (dev_1 style) ── */}
        <View style={s.titleBlock}>
          <View style={[s.titleCheckbox, isDone && { backgroundColor: T.cGreen, borderColor: T.cGreen }]}>
            {isDone && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
          </View>
          <Text style={[s.titleText, { color: txt }, isDone && { textDecorationLine: 'line-through', opacity: 0.55 }]}>
            {task.heading || task.title || 'Untitled'}
          </Text>
        </View>

        {/* ── Meta grid (dev_1 style) ── */}
        <Card style={{ marginTop: 16, padding: 0 }}>
          {/* Status — tappable */}
          <MetaRow label="Status">
            <TouchableOpacity
              style={[s.statusPill, { backgroundColor: statusBg }]}
              onPress={() => { setShowStatusPicker(v => !v); setShowPriorityPicker(false); }}
              activeOpacity={0.7}
              disabled={updatingStatus}
            >
              {updatingStatus
                ? <ActivityIndicator size="small" color={statusColor} />
                : <>
                    <Text style={[s.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                    <Text style={[{ color: statusColor, fontSize: 10 }]}>▾</Text>
                  </>
              }
            </TouchableOpacity>
          </MetaRow>

          {/* Status picker dropdown */}
          {showStatusPicker && (
            <View style={[s.statusDropdown, { backgroundColor: card, borderColor: bdr }]}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.statusDropdownItem, { borderBottomColor: bdr }, task.status === key && { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                  onPress={() => updateStatus(key)}
                >
                  <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[key] }]} />
                  <Text style={[s.statusDropdownText, { color: task.status === key ? STATUS_COLORS[key] : txt }]}>{label}</Text>
                  {task.status === key && <Text style={{ color: STATUS_COLORS[key], fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Priority — tappable dropdown */}
          <MetaRow label="Priority">
            <TouchableOpacity
              style={[s.statusPill, { backgroundColor: priorityColor + '20' }]}
              onPress={() => { setShowPriorityPicker(v => !v); setShowStatusPicker(false); }}
              disabled={updatingPriority}
            >
              {updatingPriority
                ? <ActivityIndicator size="small" color={priorityColor} />
                : <>
                    <View style={[s.priorityDot, { backgroundColor: priorityColor }]} />
                    <Text style={[s.statusPillText, { color: priorityColor }]}>
                      {priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1)}
                    </Text>
                    <Text style={{ color: priorityColor, fontSize: 10 }}>▾</Text>
                  </>
              }
            </TouchableOpacity>
          </MetaRow>

          {/* Priority picker dropdown */}
          {showPriorityPicker && (
            <View style={[s.statusDropdown, { backgroundColor: card, borderColor: bdr }]}>
              {[
                { key: 'low',    label: 'Low',    color: '#22C55E' },
                { key: 'medium', label: 'Medium', color: '#3B82F6' },
                { key: 'high',   label: 'High',   color: '#F97316' },
                { key: 'urgent', label: 'Urgent', color: '#EF4444' },
              ].map(({ key, label, color }) => (
                <TouchableOpacity
                  key={key}
                  style={[s.statusDropdownItem, { borderBottomColor: bdr }, task.priority === key && { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                  onPress={() => updatePriority(key)}
                >
                  <View style={[s.statusDot, { backgroundColor: color }]} />
                  <Text style={[s.statusDropdownText, { color: task.priority === key ? color : txt }]}>{label}</Text>
                  {task.priority === key && <Text style={{ color, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Due date */}
          <MetaRow label="Due Date">
            <TouchableOpacity onPress={() => { setDatePickerValue(task.end_date ? new Date(task.end_date) : new Date()); setDatePicker('end_date'); }} activeOpacity={0.6}>
              <Text style={[s.metaValueText, { color: task.end_date ? txt : sub }]}>
                {task.end_date ? fmtDate(task.end_date) : '—'}
              </Text>
            </TouchableOpacity>
          </MetaRow>

          {/* Start date */}
          <MetaRow label="Start Date">
            <TouchableOpacity onPress={() => { setDatePickerValue(task.start_date ? new Date(task.start_date) : new Date()); setDatePicker('start_date'); }} activeOpacity={0.6}>
              <Text style={[s.metaValueText, { color: task.start_date ? txt : sub }]}>
                {task.start_date ? fmtDate(task.start_date) : '—'}
              </Text>
            </TouchableOpacity>
          </MetaRow>

          {/* Duration */}
          <MetaRow label="Duration">
            <Text style={[s.metaValueText, { color: task.start_date && task.end_date ? txt : sub }]}>
              {task.start_date && task.end_date
                ? (() => {
                    const d = Math.round((new Date(task.end_date) - new Date(task.start_date)) / (1000 * 60 * 60 * 24));
                    return d > 0 ? `${d}d` : 'N/A';
                  })()
                : '—'}
            </Text>
          </MetaRow>

          {/* Project */}
          <MetaRow label="Project">
            <View style={[s.projectChip, { backgroundColor: isDark ? '#252530' : T.surfaceCool }]}>
              <Text style={[s.projectChipText, { color: txt }]}>{projectName}</Text>
            </View>
          </MetaRow>

          {/* Assignees */}
          <MetaRow label="Assignee" isLast>
            {assignees.length === 0 ? (
              <Text style={[s.metaValueText, { color: sub }]}>Unassigned</Text>
            ) : (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setShowAllAssignees(v => !v)}
                activeOpacity={0.7}
              >
                {/* Stacked avatars — up to 4 */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {assignees.slice(0, 4).map((u, idx) => {
                    const ACOLS = ['#3B82F6','#8B5CF6','#22A06B','#F59E0B','#E5484D','#0EA5E9'];
                    const first = (u.first_name || u.full_name || u.username || 'U').trim();
                    const last  = (u.last_name || '').trim();
                    const initials = last
                      ? (first.charAt(0) + last.charAt(0)).toUpperCase()
                      : first.slice(0, 2).toUpperCase();
                    return (
                      <View key={u.id || idx} style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: ACOLS[u.id % ACOLS.length],
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 2, borderColor: card,
                        marginLeft: idx === 0 ? 0 : -8, zIndex: 4 - idx,
                      }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{initials}</Text>
                      </View>
                    );
                  })}
                  {assignees.length > 4 && (
                    <View style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: isDark ? '#252530' : T.hairlineSoft,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 2, borderColor: card, marginLeft: -8,
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: sub }}>+{assignees.length - 4}</Text>
                    </View>
                  )}
                </View>
                {/* First name + overflow hint */}
                <Text style={[s.metaValueText, { color: txt }]}>
                  {assignees[0].first_name || assignees[0].username || 'User'}
                  {assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
                </Text>
              </TouchableOpacity>
            )}
          </MetaRow>
        </Card>

        {/* All assignees expanded list */}
        {showAllAssignees && assignees.length > 0 && (
          <View style={{ marginTop: 6, backgroundColor: card, borderRadius: T.rMd, borderWidth: 1, borderColor: bdr, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: bdr }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: txt }}>Assignees ({assignees.length})</Text>
              <TouchableOpacity onPress={() => setShowAllAssignees(false)}>
                <Text style={{ fontSize: 13, color: sub }}>Close</Text>
              </TouchableOpacity>
            </View>
            {assignees.map((u, i) => {
              const ACOLS = ['#3B82F6','#8B5CF6','#22A06B','#F59E0B','#E5484D','#0EA5E9'];
              const first = (u.first_name || u.full_name || u.username || 'U').trim();
              const last  = (u.last_name || '').trim();
              const initials = last ? (first.charAt(0) + last.charAt(0)).toUpperCase() : first.slice(0,2).toUpperCase();
              const name = last ? `${first} ${last}` : first;
              return (
                <View key={u.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i < assignees.length - 1 ? 1 : 0, borderBottomColor: bdr }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ACOLS[u.id % ACOLS.length], alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: txt }}>{name}</Text>
                    <Text style={{ fontSize: 11, color: sub }}>@{u.username || '—'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Description — always visible, editable ── */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader right={
            editingDesc ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditingDesc(false)}>
                  <Text style={{ fontSize: 13, color: sub, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveDescription}>
                  <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setDescDraft(task.description || task.desc || ''); setEditingDesc(true); }}>
                <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '600' }}>✎ Edit</Text>
              </TouchableOpacity>
            )
          }>Description</SectionHeader>
          <Card style={{ marginTop: 8 }}>
            {editingDesc ? (
              <TextInput
                style={[s.descText, { color: txt, minHeight: 80 }]}
                value={descDraft}
                onChangeText={setDescDraft}
                multiline
                autoFocus
                placeholder="Add a description…"
                placeholderTextColor={sub}
              />
            ) : (
              <TouchableOpacity onPress={() => { setDescDraft(task.description || task.desc || ''); setEditingDesc(true); }} activeOpacity={0.7}>
                <Text style={[s.descText, { color: (task.description || task.desc) ? (isDark ? '#CCCCDD' : T.ink2) : sub }]}>
                  {task.description
                    ? task.description.replace(/<[^>]*>/g, '').trim() || 'No description'
                    : task.desc || 'Tap to add description…'}
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {/* ── Links ── */}
        {task.uploaded_links ? (
          <View style={{ marginTop: 22 }}>
            <SectionHeader>Links</SectionHeader>
            <Card style={{ marginTop: 8 }}>
              <Text style={[s.descText, { color: '#3B72EE' }]}>{task.uploaded_links}</Text>
            </Card>
          </View>
        ) : null}

        {/* ── Creator info + Assign ── */}
        {creatorName && (
          <View style={{ marginTop: 22 }}>
            <SectionHeader right={
              <TouchableOpacity
                onPress={() => { fetchUsers(); setShowAssigneePicker(true); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                {assigningUser
                  ? <ActivityIndicator size="small" color={'#3B72EE'} />
                  : <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '600' }}>+ Assign</Text>
                }
              </TouchableOpacity>
            }>Created by</SectionHeader>
            <Card style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[s.assigneeAvatar, { marginLeft: 0, borderColor: card }]}>
                <Text style={s.assigneeInitial}>{getInitial(creatorName)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>{creatorName}</Text>
                {task.created_at && (
                  <Text style={{ fontSize: 12, color: sub, marginTop: 2 }}>{fmtDate(task.created_at)}</Text>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* ── Assignee Picker Modal ── */}
        {showAssigneePicker && (
          <View style={{ marginTop: 10, backgroundColor: card, borderRadius: T.rMd, borderWidth: 1, borderColor: bdr, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: bdr }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: txt }}>Assign Members</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity onPress={() => setShowAssigneePicker(false)}>
                  <Text style={{ fontSize: 13, color: sub, fontWeight: '600' }}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAssigneePicker(false)}>
                  <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            {users.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={'#3B72EE'} />
              </View>
            ) : users.map((u, i) => {
              const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
              const initials = name.split(' ').slice(0,2).map(w => w.charAt(0).toUpperCase()).join('');
              const ACOLS = ['#3B82F6','#8B5CF6','#22A06B','#F59E0B','#E5484D','#0EA5E9'];
              const isAssigned = (task.assigned_to || []).includes(u.id);
              return (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => assignUser(u.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i < users.length - 1 ? 1 : 0, borderBottomColor: bdr, backgroundColor: isAssigned ? (isDark ? '#1E2535' : '#EFF6FF') : 'transparent' }}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: ACOLS[u.id % ACOLS.length], alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: txt }}>{name}</Text>
                    <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>{u.role} · @{u.username}</Text>
                  </View>
                  {isAssigned && (
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#3B72EE', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Links ── */}
        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Text style={{ fontSize: 16 }}>🔗</Text>
            <Text style={s.sectionHeaderText}>Links</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: bdr, backgroundColor: card, paddingHorizontal: 14, height: 46 }}>
            <TextInput
              value={linkInput}
              onChangeText={setLinkInput}
              placeholder="Paste URL here..."
              placeholderTextColor={sub}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                const l = linkInput.trim();
                if (!l) return;
                const url = l.startsWith('http') ? l : `https://${l}`;
                setTaskLinks(prev => { const updated = [...prev, url]; saveLinks(updated); return updated; });
                setLinkInput('');
              }}
              style={{ flex: 1, fontSize: 14, color: txt, height: 46 }}
            />
            <TouchableOpacity
              onPress={() => {
                const l = linkInput.trim();
                if (!l) return;
                const url = l.startsWith('http') ? l : `https://${l}`;
                setTaskLinks(prev => { const updated = [...prev, url]; saveLinks(updated); return updated; });
                setLinkInput('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: txt, fontSize: 28, fontWeight: '300', lineHeight: 32 }}>+</Text>
            </TouchableOpacity>
          </View>
          {taskLinks.length > 0 && (
            <View style={{ marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: bdr, backgroundColor: card, overflow: 'hidden' }}>
              {taskLinks.map((l, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < taskLinks.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: bdr }}
                >
                  <Text style={{ fontSize: 13 }}>🔗</Text>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(l).catch(() => {})}>
                    <Text style={{ fontSize: 13, color: '#3B72EE' }} numberOfLines={1}>{l}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const updated = taskLinks.filter((_, idx) => idx !== i);
                      setTaskLinks(updated);
                      saveLinks(updated);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={{ color: sub, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* DateTimePicker */}
        {datePicker && DateTimePicker && (
          Platform.OS === 'android' ? (
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              display="default"
              minimumDate={datePicker === 'end_date' && task.start_date ? new Date(task.start_date) : undefined}
              maximumDate={datePicker === 'start_date' && task.end_date ? new Date(task.end_date) : undefined}
              onChange={(event, selectedDate) => {
                setDatePicker(null);
                if (event.type === 'set' && selectedDate) updateDate(datePicker, selectedDate);
              }}
            />
          ) : (
            <Modal transparent visible animationType="fade" onRequestClose={() => setDatePicker(null)}>
              <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setDatePicker(null)}>
                <Pressable style={{ backgroundColor: card, borderRadius: 16, padding: 20, width: 320 }} onPress={() => {}}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: txt, marginBottom: 16, textAlign: 'center' }}>
                    {datePicker === 'start_date' ? 'Start Date' : 'Due Date'}
                  </Text>
                  <DateTimePicker
                    value={datePickerValue}
                    mode="date"
                    display="spinner"
                    minimumDate={datePicker === 'end_date' && task.start_date ? new Date(task.start_date) : undefined}
                    maximumDate={datePicker === 'start_date' && task.end_date ? new Date(task.end_date) : undefined}
                    onChange={(event, selectedDate) => { if (selectedDate) setDatePickerValue(selectedDate); }}
                    style={{ width: '100%' }}
                  />
                  <TouchableOpacity onPress={() => { updateDate(datePicker, datePickerValue); setDatePicker(null); }}
                    style={{ marginTop: 12, backgroundColor: '#3B72EE', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
            </Modal>
          )
        )}
        <View style={{ marginTop: 22 }}>
          <SectionHeader right={
            <TouchableOpacity onPress={uploadAttachment} disabled={uploading}>
              {uploading
                ? <ActivityIndicator size="small" color={'#3B72EE'} />
                : <Text style={{ fontSize: 14, fontWeight: '600', color: '#3B72EE' }}>+ Attach</Text>
              }
            </TouchableOpacity>
          }>Attachments</SectionHeader>
          {attachments.length === 0 ? (
            <TouchableOpacity
              onPress={uploadAttachment}
              style={{ marginTop: 8, borderRadius: 10, borderWidth: 1.5, borderColor: bdr, borderStyle: 'dashed', paddingVertical: 20, alignItems: 'center', gap: 6 }}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator size="small" color={'#3B72EE'} />
                : <>
                    <Text style={{ fontSize: 24, opacity: 0.4 }}>📎</Text>
                    <Text style={{ fontSize: 13, color: sub }}>Tap to attach a file</Text>
                  </>
              }
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              {attachments.map((att, i) => {
                const name  = att.file_name || att.name || `File ${i+1}`;
                const ext   = name.split('.').pop().toLowerCase();
                const DCOLS = { pdf: '#EF4444', doc: '#3B82F6', docx: '#3B82F6', xls: '#22A06B', xlsx: '#22A06B', ppt: '#F59E0B', pptx: '#F59E0B', ts: '#3B82F6', csv: '#22A06B' };
                const color = DCOLS[ext] || '#888';
                const when  = att.uploaded_at ? fmtRelative(att.uploaded_at) : '';
                return (
                  <TouchableOpacity
                    key={att.id || i}
                    style={{ width: '47%', backgroundColor: isDark ? '#1A1A20' : T.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: bdr, padding: 10 }}
                    activeOpacity={0.7}
                    onPress={() => { setSelectedAtt(att); setAttWebView(false); }}
                  >
                    <View style={{ backgroundColor: color + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color, letterSpacing: 0.3 }}>{ext.toUpperCase().slice(0,4)}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: txt }} numberOfLines={2}>{name}</Text>
                    {when ? <Text style={{ fontSize: 11, color: sub, marginTop: 3 }}>{when}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        <View style={{ marginTop: 22 }}>
          <SectionHeader>Activity</SectionHeader>
          <View style={{ gap: 16, marginTop: 10 }}>
            {comments.length === 0 ? (
              <Text style={{ fontSize: 13, color: sub, textAlign: 'center', paddingVertical: 16 }}>No activity yet</Text>
            ) : comments.map((c, i) => {
              const ACOLS = ['#3B82F6','#8B5CF6','#22A06B','#F59E0B','#E5484D'];
              const commenter = c.user || {};
              const commenterName = commenter.full_name ||
                `${commenter.first_name || ''} ${commenter.last_name || ''}`.trim() ||
                commenter.username || 'User';
              const initials = commenterName.split(' ').slice(0,2).map(w => w.charAt(0).toUpperCase()).join('');
              return (
                <View key={c.id || i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: ACOLS[i % ACOLS.length], alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: txt }}>{commenterName}</Text>
                      <Text style={{ fontSize: 11, color: sub }}>{fmtRelative(c.created_at)}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: isDark ? '#CCCCDD' : T.ink2, lineHeight: 19 }}>
                      {c.content || c.text || ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom composer ── */}
      <View style={[s.composer, { backgroundColor: card, borderTopColor: bdr, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={{ padding: 4 }}>
          <Text style={{ fontSize: 20, color: sub }}>📎</Text>
        </TouchableOpacity>
        <View style={[s.composerInputWrap, { backgroundColor: isDark ? '#252530' : T.surfaceAlt, borderColor: bdr }]}>
          <TextInput
            style={[s.composerInput, { color: txt }]}
            placeholder="Add a comment…"
            placeholderTextColor={sub}
            value={comment}
            onChangeText={setComment}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={sendComment}
          />
        </View>
        <TouchableOpacity
          style={[s.composerSend, { backgroundColor: '#3B72EE' }]}
          onPress={sendComment}
          disabled={sendingComment}
          activeOpacity={0.75}
        >
          {sendingComment
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>›</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Attachment Preview Modal ── */}
      {selectedAtt && (
        <Modal visible transparent={false} animationType="slide" onRequestClose={() => { setSelectedAtt(null); setAttWebView(false); }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0D0D14' : '#F7F8FB' }} edges={['top','left','right','bottom']}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: isDark ? '#1A1A28' : '#fff', borderBottomWidth: 1, borderBottomColor: isDark ? '#303048' : '#E8E8EF' }}>
              <TouchableOpacity onPress={() => { setSelectedAtt(null); setAttWebView(false); }} style={{ padding: 4 }}>
                <Text style={{ color: '#3B72EE', fontSize: 26, fontWeight: '300' }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#F0F0F8' : '#0E1726', flex: 1, textAlign: 'center', marginHorizontal: 8 }} numberOfLines={1}>
                {selectedAtt.file_name || selectedAtt.name || 'Document'}
              </Text>
              <TouchableOpacity style={{ padding: 4 }} onPress={() => {
                const url = selectedAtt.file_url || selectedAtt.url;
                if (url) Linking.openURL(url).catch(() => {});
              }}>
                <Text style={{ color: '#3B72EE', fontSize: 13, fontWeight: '600' }}>Open ↗</Text>
              </TouchableOpacity>
            </View>

            {attWebView ? (
              (() => {
                const url = selectedAtt.file_url || selectedAtt.url || '';
                const ext = getAttExt(selectedAtt.file_name || '');
                const isImage = ['png','jpg','jpeg','gif','webp','heic','bmp','svg'].includes(ext);
                const isPdf   = ext === 'pdf';
                const isOffice = ['doc','docx','ppt','pptx','xls','xlsx'].includes(ext);
                if (isImage) return (
                  <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                );
                const viewUrl = (isPdf || isOffice) ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` : null;
                if (viewUrl) return (
                  <WebView source={{ uri: viewUrl }} style={{ flex: 1 }} startInLoadingState
                    renderLoading={() => <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#3B72EE" /></View>}
                  />
                );
                return (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 32 }}>
                    <Text style={{ fontSize: 48, opacity: 0.3 }}>📄</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#F0F0F8' : '#0E1726' }}>Preview not available</Text>
                    <TouchableOpacity style={{ backgroundColor: '#3B72EE', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
                      onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Open in Browser</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* File card */}
                <View style={{ backgroundColor: isDark ? '#1A1A28' : '#fff', borderRadius: 16, borderWidth: 1, borderColor: isDark ? '#303048' : '#E8E8EF', overflow: 'hidden', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
                    {(() => {
                      const ext  = getAttExt(selectedAtt.file_name || '');
                      const meta = TYPE_META_ATT[ext] || FALLBACK_META_ATT;
                      return (
                        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: meta.bg, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: meta.color, letterSpacing: 0.3 }}>{meta.label}</Text>
                        </View>
                      );
                    })()}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#F0F0F8' : '#0E1726', marginBottom: 3 }} numberOfLines={2}>
                        {selectedAtt.file_name || selectedAtt.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDark ? '#8080A0' : '#888899' }}>
                        {selectedAtt.uploaded_at ? new Date(selectedAtt.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </Text>
                    </View>
                  </View>
                  {[
                    { label: 'Type',   value: getAttExt(selectedAtt.file_name || '').toUpperCase() || 'FILE' },
                    { label: 'Status', value: selectedAtt.preview_status ? selectedAtt.preview_status.replace('_',' ').toUpperCase() : '—' },
                    { label: 'Task',   value: task?.heading || '—' },
                    { label: 'Project', value: task?.project_details?.name || '—' },
                  ].map(({ label, value }, i) => (
                    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? '#303048' : '#E8E8EF' }}>
                      <Text style={{ fontSize: 13, color: isDark ? '#8080A0' : '#888899', fontWeight: '500', width: 80 }}>{label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F0F0F8' : '#0E1726', flex: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>
                {/* Action buttons */}
                <TouchableOpacity
                  style={{ backgroundColor: '#3B72EE', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 }}
                  onPress={() => setAttWebView(true)}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Open Document</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: isDark ? '#303048' : '#E8E8EF', backgroundColor: isDark ? '#1A1A28' : '#fff' }}
                  onPress={() => {
                    const url = selectedAtt.file_url || selectedAtt.url;
                    if (url) Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open URL.'));
                  }}
                >
                  <Text style={{ color: isDark ? '#8080A0' : '#888899', fontSize: 14, fontWeight: '600' }}>🌐  Open in Browser</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      )}

    </SafeAreaView>
  );
}


// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Navbar
  navbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, gap: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  moreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Title block
  titleBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCheckbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: T.hairline, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  titleText: { flex: 1, fontSize: 21, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3 },

  // Meta grid
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, minHeight: 50 },
  metaLabel: { fontSize: 13, fontWeight: '500', color: T.ink3, flex: 1 },
  metaRight: { flexShrink: 1, alignItems: 'flex-end' },
  metaValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaValueText: { fontSize: 13, fontWeight: '600' },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },

  // Status pill
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  // Status dropdown
  statusDropdown: { marginHorizontal: 14, marginBottom: 8, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  statusDropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDropdownText: { flex: 1, fontSize: 13, fontWeight: '500' },

  // Project chip
  projectChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  projectChipText: { fontSize: 12, fontWeight: '600' },

  // Assignees
  assigneeRow: { flexDirection: 'row', alignItems: 'center' },
  assigneeAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E9D5FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  assigneeInitial: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', color: T.ink3, letterSpacing: 0.3, textTransform: 'uppercase' },

  // Description
  descText: { fontSize: 14, lineHeight: 22, letterSpacing: -0.05 },

  // Comments
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E9D5FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentName: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 11 },
  commentBubble: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  commentText: { fontSize: 13, lineHeight: 19 },

  // Bottom composer
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1 },
  composerInputWrap: { flex: 1, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 14 },
  composerInput: { fontSize: 14 },
  composerSend: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
