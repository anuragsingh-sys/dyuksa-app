import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Image, Alert, Animated, ActivityIndicator,
  Keyboard, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useContext, useEffect } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NotificationsContext } from '../context/NotificationsContext';
import { AuthContext } from '../context/AuthContext';
import { getUsers, getProjects, getAccessToken, getWorkspaceId, refineTextAI } from '../services/ApiService';
import { canEditItem, canCreateTask } from '../utils/permissions';
import SidebarMenu from '../components/SidebarMenu';
import TaskDetailModal from '../components/TaskDetailModal';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
// const BASE_URL → imported from config

// Always includes X-Workspace-ID so every request is workspace-aware
const authHeaders = async () => {
  const token       = await getAccessToken();
  const workspaceId = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  if (workspaceId) h['X-Workspace-ID'] = workspaceId;
  return h;
};

const authHeadersMultipart = async () => {
  const token       = await getAccessToken();
  const workspaceId = await getWorkspaceId();
  const h = { 'Authorization': `Bearer ${token}` };
  if (workspaceId) h['X-Workspace-ID'] = workspaceId;
  return h;
};

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'backlog', 'deployed', 'deferred', 'review'];
const STATUS_LABELS  = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review' };
const STATUS_COLORS  = { pending: '#F59E0B', in_progress: '#3B82F6', completed: '#22C55E', backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA' };
const STATUS_BG      = { pending: '#FEF3C7', in_progress: '#EFF6FF', completed: '#F0FDF4', backlog: '#FDF2F8', deployed: '#EFF6FF', deferred: '#FFFBEB', review: '#F5F3FF' };
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLORS  = { low: '#22C55E', medium: '#F59E0B', high: '#F97316', urgent: '#EF4444' };

// ── Inline Dropdown ──────────────────────────────────────────────────────────
function InlineDropdown({ options, selected, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg    = isDark ? '#252530' : '#F5F5F7';
  const bgOpen= isDark ? '#1A1A20' : '#FFFFFF';
  const bdr   = isDark ? '#2F2F3D' : '#EBEBF0';
  const txt   = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub   = isDark ? '#9898A6' : '#888899';
  return (
    <View>
      <TouchableOpacity
        style={[dd.trigger, { backgroundColor: bg, borderColor: bdr }, open && { borderColor: '#4ECDC4', backgroundColor: bgOpen }]}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={[dd.triggerText, { color: txt }, !selected && { color: sub }]} numberOfLines={1}>
          {selected || placeholder}
        </Text>
        <Text style={[dd.arrow, { color: sub }]}>{open ? '▲' : '▾'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[dd.list, { backgroundColor: bgOpen, borderColor: '#4ECDC4' }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
            {options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[dd.item, { borderBottomColor: isDark ? '#2F2F3D' : '#F0F0F5' }, i === options.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[dd.itemText, { color: txt }, selected === opt.label && { color: '#4ECDC4', fontWeight: '700' }]}>
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

const dd = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, height: 46 },
  triggerText: { fontSize: 13, flex: 1 },
  arrow: { fontSize: 11, marginLeft: 4 },
  list: { borderRadius: 10, borderWidth: 1.5, marginTop: 4 },
  item: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  itemText: { fontSize: 13 },
});

// ── Task Card (dev_1 UI + real API data) ─────────────────────────────────────
function TaskCard({ item, card, txt, sub, bdr, isDark, onPress, onStatusPress, formatDate }) {
  const statusColor = STATUS_COLORS[item.status] || '#888';
  const statusBg    = STATUS_BG[item.status]    || '#F5F5F7';

  // Creator name
  const createdBy = item.assigned_by_user_details || item.created_by || null;
  const creatorName = createdBy
    ? ([createdBy.first_name, createdBy.last_name].filter(Boolean).join(' ') || createdBy.full_name || createdBy.username || null)
    : null;

  // Assignees
  const assignees = Array.isArray(item.assigned_to_user_details) ? item.assigned_to_user_details : [];
  const MAX_VISIBLE = 3;
  const visibleAssignees = assignees.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, assignees.length - MAX_VISIBLE);

  const initialOf = (u) => {
    const raw = u.first_name || u.full_name || u.username || '';
    return raw ? raw.trim().charAt(0).toUpperCase() : 'U';
  };

  // Duration
  const getDuration = () => {
    if (!item.start_date || !item.end_date) return null;
    try {
      const diff = new Date(item.end_date) - new Date(item.start_date);
      const days = Math.round(diff / (1000 * 60 * 60 * 24));
      if (days <= 0) return null;
      return `${days}d`;
    } catch { return null; }
  };
  const duration = getDuration();
  const isDone = (item.status || '').toLowerCase() === 'completed';

  return (
    <TouchableOpacity
      style={[styles.taskCard, { backgroundColor: card, borderColor: bdr, borderLeftColor: statusColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Row 1: Checkbox + Title + Status badge */}
      <View style={styles.cardRow1}>
        <View style={[styles.checkbox, isDone && { backgroundColor: STATUS_COLORS.completed, borderColor: STATUS_COLORS.completed }]}>
          {isDone && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.taskName, { color: txt }]} numberOfLines={2}>
            {item.heading}
          </Text>
          {item.project_details?.name && (
            <Text style={[styles.taskProject, { color: sub }]} numberOfLines={1}>
              🗂 {item.project_details.name}
            </Text>
          )}
        </View>
        {/* Tappable status badge */}
        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: statusBg }]}
          onPress={onStatusPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
          <Text style={[styles.statusCaret, { color: statusColor }]}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Row 2: Meta — project chip + due date + priority + duration + assignees */}
      <View style={styles.cardRow3}>
        <View style={styles.cardRow3Left}>
          {/* Priority dot + label */}
          {item.priority && (
            <View style={styles.priorityPill}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] || '#888' }]} />
              <Text style={[styles.priorityText, { color: sub }]}>
                {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
              </Text>
            </View>
          )}
          {/* Due date */}
          {item.end_date && (
            <View style={styles.metaDatePill}>
              <Text style={[styles.metaDateText, { color: sub }]}>📅 {formatDate(item.end_date)}</Text>
            </View>
          )}
          {/* Duration */}
          {duration && (
            <View style={[styles.durationPill, { backgroundColor: isDark ? '#252530' : '#F0F0F5', borderColor: bdr }]}>
              <Text style={{ fontSize: 10, color: sub, fontWeight: '600' }}>⏱ {duration}</Text>
            </View>
          )}
        </View>

        {/* Assignee avatar stack */}
        {assignees.length > 0 && (
          <View style={styles.avatarStack}>
            {visibleAssignees.map((u, idx) => (
              <View
                key={u.id ?? idx}
                style={[styles.miniAvatar, { borderColor: card, marginLeft: idx === 0 ? 0 : -7 }]}
              >
                <Text style={styles.miniAvatarText}>{initialOf(u)}</Text>
              </View>
            ))}
            {overflow > 0 && (
              <View style={[styles.miniAvatar, styles.miniAvatarOverflow, { borderColor: card, marginLeft: -7 }]}>
                <Text style={[styles.miniAvatarText, { color: sub }]}>+{overflow}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function TasksScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
  const { user } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';

  const [tasks,    setTasks]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('All');
  const flatListRef = useRef(null);
  const [search,   setSearch]   = useState('');

  const [statusPickerTaskId, setStatusPickerTaskId] = useState(null);
  const [updatingStatus,     setUpdatingStatus]     = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  const isTaskMine = useCallback((task) => {
    if (!user || !task) return false;
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

  const [modalVisible,   setModalVisible]   = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [detailTask,     setDetailTask]     = useState(null);
  const slideAnim = useRef(new Animated.Value(-700)).current;

  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setKbHeight(e?.endCoordinates?.height || 0);
    const onHide = () => setKbHeight(0);
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => { s.remove(); h.remove(); };
  }, []);

  const returnToProjectIdRef = useRef(null);

  const [heading,       setHeading]       = useState('');
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const [description,   setDescription]   = useState('');
  const [project,       setProject]       = useState(null);
  const [status,        setStatus]        = useState('backlog');
  const [priority,      setPriority]      = useState('medium');
  const [startDate,     setStartDate]     = useState(todayISO());
  const [endDate,       setEndDate]       = useState('');
  const [startTime,     setStartTime]     = useState('');
  const [endTime,       setEndTime]       = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker,   setShowEndDatePicker]   = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker,   setShowEndTimePicker]   = useState(false);
  const [assignedTo,    setAssignedTo]    = useState([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [links,         setLinks]         = useState('');
  const [images,        setImages]        = useState([]);
  const [projectSearch, setProjectSearch] = useState('');

  useFocusEffect(useCallback(() => { fetchTasks(); }, []));

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
    getUsers().then(setUsers).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.openCreateModal) {
        openModal();
        const presetId = route.params?.presetProjectId;
        if (presetId) {
          returnToProjectIdRef.current = presetId;
          const found = projects.find(p => String(p.id) === String(presetId));
          if (found) {
            setProject(found);
          } else {
            setTimeout(() => {
              setProjects(current => {
                const p = current.find(p => String(p.id) === String(presetId));
                if (p) setProject(p);
                return current;
              });
            }, 600);
          }
        }
        navigation.setParams({ openCreateModal: false, presetProjectId: null });
      }
      if (route.params?.openCreateModalAI) {
        openGenModal();
        navigation.setParams({ openCreateModalAI: false });
      }
      if (route.params?.presetFilter) {
        setFilter(route.params.presetFilter);
        navigation.setParams({ presetFilter: null });
      }
    }, [route.params?.openCreateModal, route.params?.openCreateModalAI, route.params?.presetProjectId, route.params?.presetFilter, projects])
  );

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/tasksite/`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(data.results || (Array.isArray(data) ? data : []));
      }
    } catch (e) {
      console.error('fetchTasks error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setModalVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeModal = (fromCancel) => {
    const returnId = fromCancel ? returnToProjectIdRef.current : null;
    if (fromCancel) returnToProjectIdRef.current = null;
    Animated.timing(slideAnim, { toValue: -700, duration: 250, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      setHeading(''); setDescription(''); setProject(null); setStatus('backlog');
      setPriority('medium'); setStartDate(todayISO()); setEndDate('');
      setStartTime(''); setEndTime('');
      setAssignedTo([]); setLinks(''); setImages([]); setProjectSearch('');
      if (returnId) {
        navigation.navigate('Projects', { reopenProjectId: returnId });
        return;
      }
      const returnTo = route.params?.returnTo;
      if (returnTo && returnTo !== 'Tasks') {
        navigation.setParams({ returnTo: null });
        try { navigation.jumpTo(returnTo); } catch {}
      }
    });
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera access is needed.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) setImages(p => [...p, result.assets[0].uri]);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Gallery access is needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled && result.assets?.length) setImages(p => [...p, ...result.assets.map(a => a.uri)]);
  };

  const createTask = async () => {
    if (!heading.trim()) { Alert.alert('Required', 'Enter a task title.'); return; }
    if (!project)        { Alert.alert('Required', 'Select a project.'); return; }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('heading', heading.trim());
      formData.append('project', String(project.id));
      if (description) formData.append('description', description);
      if (status)      formData.append('status',      status);
      if (priority)    formData.append('priority',    priority);
      if (startDate)   formData.append('start_date',  startDate);
      if (endDate)     formData.append('end_date',    endDate);
      if (startTime)   formData.append('start_time',  startTime);
      if (endTime)     formData.append('end_time',    endTime);
      if (links.trim()) formData.append('uploaded_links', links.trim());
      assignedTo.forEach(uid => formData.append('assigned_to', String(uid)));
      images.forEach((uri, i) => {
        formData.append('uploaded_files', { uri, name: `image_${i}.jpg`, type: 'image/jpeg' });
      });
      const res  = await fetch(`${BASE_URL}/tasksite/`, {
        method: 'POST',
        headers: await authHeadersMultipart(),
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        addNotification({ type: 'task', icon: '📋', title: 'Task Created', body: `"${heading.trim()}" added successfully.` });
        await fetchTasks();
        closeModal();
        const returnId = returnToProjectIdRef.current;
        if (returnId) {
          returnToProjectIdRef.current = null;
          setTimeout(() => {
            navigation.navigate('Projects', { reopenProjectId: returnId });
          }, 300);
        }
      } else {
        Alert.alert('Error', data.message || data.detail || JSON.stringify(data));
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setSaving(false);
    }
  };

  const [enhancingTitle, setEnhancingTitle] = useState(false);
  const [enhancingDesc,  setEnhancingDesc]  = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  const enhanceTitle = async () => {
    if (!heading.trim()) { Alert.alert('Empty', 'Enter a task title first.'); return; }
    setEnhancingTitle(true);
    try {
      const result = await refineTextAI(heading, 'optimize_title');
      if (result) setHeading(result);
      else Alert.alert('Error', 'Could not enhance title.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setEnhancingTitle(false); }
  };

  const generateDescription = async () => {
    if (!heading.trim()) { Alert.alert('Empty', 'Enter a task title first to generate description.'); return; }
    setGeneratingDesc(true);
    try {
      const result = await refineTextAI(heading, 'generate_description');
      if (result) setDescription(result);
      else Alert.alert('Error', 'Could not generate description.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setGeneratingDesc(false); }
  };

  const refineDescription = async () => {
    if (!description.trim()) { Alert.alert('Empty', 'Enter a description first.'); return; }
    setEnhancingDesc(true);
    try {
      const result = await refineTextAI(description, 'refine_description');
      if (result) setDescription(result);
      else Alert.alert('Error', 'Could not refine description.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setEnhancingDesc(false); }
  };

  // ── Generate Task by AI ──
  const [genModalVisible, setGenModalVisible] = useState(false);
  const [aiActiveTab,     setAiActiveTab]     = useState('task');
  const [genProject,      setGenProject]      = useState(null);
  const [genProjectSearch,setGenProjectSearch]= useState('');
  const [genDescription,  setGenDescription]  = useState('');
  const [generating,      setGenerating]      = useState(false);
  const genSlideAnim = useRef(new Animated.Value(-700)).current;

  const [eventPrompt,    setEventPrompt]    = useState('');
  const [eventAILoading, setEventAILoading] = useState(false);
  const [eventSuggestion,setEventSuggestion]= useState(null);
  const [selectedSlot,   setSelectedSlot]   = useState(null);
  const [eventSaving,    setEventSaving]    = useState(false);

  const openGenModal = () => {
    setAiActiveTab('task');
    setGenModalVisible(true);
    Animated.spring(genSlideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeGenModal = () => {
    Animated.timing(genSlideAnim, { toValue: -700, duration: 250, useNativeDriver: true }).start(() => {
      setGenModalVisible(false);
      setGenProject(null); setGenProjectSearch(''); setGenDescription('');
      setEventPrompt(''); setEventSuggestion(null); setSelectedSlot(null);
      setEventAILoading(false); setEventSaving(false);
      const returnTo = route.params?.returnTo;
      if (returnTo && returnTo !== 'Tasks') {
        navigation.setParams({ returnTo: null });
        try { navigation.jumpTo(returnTo); } catch {}
      }
    });
  };

  const generateTaskByAI = async () => {
    if (!genProject) { Alert.alert('Required', 'Select a project first.'); return; }
    if (!genDescription.trim()) { Alert.alert('Required', 'Enter a description.'); return; }
    setGenerating(true);
    try {
      const res   = await fetch(`${BASE_URL}/task-ai/suggest-task/`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ project_id: genProject.id, description: genDescription.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert('Error', data.message || data.detail || 'AI generation failed.'); return; }
      setHeading(data.heading || '');
      setDescription(data.description || '');
      setStatus(data.status || null);
      setPriority(data.priority || 'medium');
      setStartDate(data.start_date ? data.start_date.split('T')[0] : '');
      setEndDate(data.end_date ? data.end_date.split('T')[0] : '');
      setAssignedTo(Array.isArray(data.assigned_to) ? data.assigned_to : []);
      setProject(genProject);
      closeGenModal();
      setTimeout(() => openModal(), 400);
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setGenerating(false);
    }
  };

  const askDyuksaForEvent = async () => {
    if (!eventPrompt.trim()) { Alert.alert('Required', 'Enter what event you want to create.'); return; }
    setEventAILoading(true);
    try {
      const res = await fetch(`${BASE_URL}/task-ai/chat/agent/`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ message: eventPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert('Error', data.detail || data.message || 'AI request failed.'); return; }
      if (data.action !== 'create_event' || !data.data) {
        Alert.alert('Dyuksa says', data.reply || 'Could not generate an event. Try being more specific.');
        return;
      }
      const slots = Array.isArray(data.data.available_slots) ? data.data.available_slots : [];
      if (slots.length === 0) {
        Alert.alert('No slots', 'No free slots were found. Try a different date or duration.');
        return;
      }
      setEventSuggestion(data.data);
      setSelectedSlot(slots[0]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setEventAILoading(false);
    }
  };

  const createEventFromAI = async () => {
    if (!eventSuggestion || !selectedSlot) return;
    setEventSaving(true);
    try {
      const token = await getAccessToken();
      const startD = new Date(selectedSlot);
      const endD   = new Date(startD.getTime() + (eventSuggestion.duration_minutes || 30) * 60 * 1000);
      const body = {
        title:             eventSuggestion.title || 'New meeting',
        event_type:        eventSuggestion.event_type || 'Meeting',
        start_time:        startD.toISOString(),
        end_time:          endD.toISOString(),
        is_online_meeting: true,
        is_recurring:      false,
        attendee_ids:      Array.isArray(eventSuggestion.attendee_ids) ? eventSuggestion.attendee_ids : [],
      };
      const res = await fetch(`${BASE_URL}/daily-updates/events/`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert('Error', data.detail || data.message || `Error ${res.status}`); return; }
      closeGenModal();
      setTimeout(() => {
        setSuccessToast({ title: '✦ Event created', body: data.message || 'Your event has been added to the calendar.' });
        setTimeout(() => setSuccessToast(null), 2500);
      }, 350);
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setEventSaving(false);
    }
  };

  const formatSlotTime = (iso) => {
    try { return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return iso; }
  };

  const formatTargetDate = (s) => {
    if (!s) return '';
    try { return new Date(s + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return s; }
  };

  const genFilteredProjects = projects.filter(p =>
    p.name?.toLowerCase().includes(genProjectSearch.toLowerCase())
  );

  const toggleAssignee = (uid) => {
    setAssignedTo(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const filteredProjects = projects.filter(p =>
    p.name?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const myTaskCount = tasks.filter(isTaskMine).length;
  const baseFiltered =
    filter === 'All' ? tasks :
                       tasks.filter(t => t.status === filter);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? baseFiltered.filter(t => {
        const heading = String(t.heading || '').toLowerCase();
        const proj    = String(t.project_details?.name || '').toLowerCase();
        return heading.includes(q) || proj.includes(q);
      })
    : baseFiltered;

  const formatDate = iso => {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
    catch { return iso || ''; }
  };

  const updateTaskStatus = async (task, newStatus) => {
    if (!task?.id || !newStatus || newStatus === task.status) {
      setStatusPickerTaskId(null);
      return;
    }
    const previousStatus = task.status;
    setUpdatingStatus(true);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try { const e = await res.json(); detail = e.detail || JSON.stringify(e); } catch {}
        throw new Error(detail);
      }
      try {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updated } : t));
      } catch {}
      addNotification?.({ type: 'task', icon: '✅', title: 'Status updated', body: `"${task.heading}" → ${STATUS_LABELS[newStatus] || newStatus}` });
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: previousStatus } : t));
      Alert.alert('Could not update status', e?.message || 'Try again later.');
    } finally {
      setUpdatingStatus(false);
      setStatusPickerTaskId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D0D0F' : '#fff'} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Tasks" />
          <TouchableOpacity
            style={styles.logoBox}
            onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}
            activeOpacity={0.7}
          >
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={[styles.brandName, { color: txt }]}>Task Board</Text>
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
        <View style={[styles.searchWrap, { backgroundColor: bg, borderColor: bdr }]}>
          <Text style={{ fontSize: 14 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: txt }]}
            placeholder="Search tasks…"
            placeholderTextColor={isDark ? '#5C5C6E' : '#AAAABC'}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.searchClear, { color: sub }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.taskCount, { color: sub }]}>
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
          <TouchableOpacity style={styles.aiBtn} onPress={openGenModal}>
            <Text style={styles.aiBtnText}>✦ AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={openModal}>
            <Text style={styles.newBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filtersWrap, { backgroundColor: card, borderBottomColor: bdr }]} contentContainerStyle={[styles.filters, { paddingRight: 12 }]}>
        {[
          { key: 'All',         label: 'All' },
          { key: 'pending',     label: 'Pending' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'completed',   label: 'Completed' },
          { key: 'backlog',     label: 'Backlog' },
        ].map(({ key, label }) => {
          const isActive = filter === key;
          const showCount = key === 'All' && tasks.length > 0;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.chip,
                { backgroundColor: card, borderColor: bdr },
                isActive && { backgroundColor: isDark ? '#4ECDC4' : '#1A1A2E', borderColor: isDark ? '#4ECDC4' : '#1A1A2E' },
              ]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.chipText, { color: sub }, isActive && { color: isDark ? '#0D0D0F' : '#fff', fontWeight: '700' }]}>
                {label}
              </Text>
              {showCount && (
                <View style={[styles.chipBadge, isActive ? { backgroundColor: isDark ? '#1A1A2E' : '#fff' } : { backgroundColor: '#4ECDC4' }]}>
                  <Text style={[styles.chipBadgeText, { color: isActive ? (isDark ? '#4ECDC4' : '#1A1A2E') : '#fff' }]}>
                    {tasks.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Task list */}
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={[styles.emptySub, { color: sub }]}>Loading tasks...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, opacity: 0.3 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: txt }]}>
            {q ? 'No matches' : (filter !== 'All' ? `No ${filter.replace('_', ' ')} tasks` : 'No tasks yet')}
          </Text>
          <Text style={[styles.emptySub, { color: sub }]}>
            {q ? 'Try a different search term.' : 'Tap + Create to add one.'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filtered}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 110 }}
          onRefresh={fetchTasks}
          refreshing={loading}
          renderItem={({ item }) => (
            <TaskCard
              item={item}
              card={card}
              txt={txt}
              sub={sub}
              bdr={bdr}
              isDark={isDark}
              onPress={() => setDetailTask(item)}
              onStatusPress={canEditItem(user?.role, item, user?.id)
                ? () => setStatusPickerTaskId(item.id)
                : null}
              formatDate={formatDate}
            />
          )}
        />
      )}

      {/* ── Create Task Modal ── */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => closeModal(true)} />
          <Animated.View
            style={[
              styles.topModal,
              { backgroundColor: card, transform: [{ translateY: slideAnim }], maxHeight: Dimensions.get('window').height - kbHeight },
            ]}
          >
            <SafeAreaView style={{ flexShrink: 1 }}>
              <View style={[styles.handle, { backgroundColor: isDark ? '#3A3A48' : '#DEDEE8' }]} />
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={{ paddingBottom: kbHeight > 0 ? 24 : 40 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: txt }]}>Create Task</Text>
                  <TouchableOpacity style={[styles.closeCircle, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]} onPress={() => closeModal(true)}>
                    <Text style={[styles.closeCircleText, { color: sub }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Project */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Project *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt }, project && { borderColor: '#4ECDC4', backgroundColor: card }]}
                  placeholder="Search project..."
                  placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  value={project ? project.name : projectSearch}
                  onChangeText={t => { setProjectSearch(t); setProject(null); }}
                />
                {!project && projectSearch.length > 0 && filteredProjects.length > 0 && (
                  <View style={[styles.searchList, { backgroundColor: card }]}>
                    {filteredProjects.slice(0, 5).map((p, i) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.searchItem, { borderBottomColor: bdr }, i === Math.min(filteredProjects.length, 5) - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => { setProject(p); setProjectSearch(''); }}
                      >
                        <Text style={[styles.searchItemText, { color: txt }]}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Task Title */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Task Title *</Text>
                <View style={styles.enhanceWrap}>
                  <TextInput
                    style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt, flex: 1, marginBottom: 0 }]}
                    placeholder="Enter a concise task title"
                    placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                    value={heading}
                    onChangeText={setHeading}
                  />
                  <TouchableOpacity style={styles.enhanceBtn} onPress={enhanceTitle} disabled={enhancingTitle}>
                    {enhancingTitle ? <ActivityIndicator size="small" color="#A78BFA" /> : <Text style={styles.enhanceIcon}>✨</Text>}
                  </TouchableOpacity>
                </View>
                <Text style={styles.enhanceHint}>✨ Optimize title with Nova AI</Text>

                {/* Description */}
                <Text style={[styles.fieldLabel, { marginTop: 10, color: sub }]}>Description</Text>
                <View style={styles.enhanceWrap}>
                  <TextInput
                    style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt, flex: 1, height: 90, paddingTop: 12, marginBottom: 0 }]}
                    placeholder="Add task details..."
                    placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity style={styles.enhanceBtn} onPress={refineDescription} disabled={enhancingDesc}>
                      {enhancingDesc ? <ActivityIndicator size="small" color="#A78BFA" /> : <Text style={styles.enhanceIcon}>✨</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.enhanceBtn, { backgroundColor: 'rgba(78,205,196,0.1)', borderColor: 'rgba(78,205,196,0.3)' }]} onPress={generateDescription} disabled={generatingDesc}>
                      {generatingDesc ? <ActivityIndicator size="small" color="#4ECDC4" /> : <Text style={styles.enhanceIcon}>⚡</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.enhanceHint}>✨ Refine · ⚡ Generate from title</Text>

                {/* Status + Priority */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>Status</Text>
                    <InlineDropdown
                      placeholder="Select status"
                      options={STATUS_OPTIONS.map(s => ({ label: STATUS_LABELS[s], value: s }))}
                      selected={status ? STATUS_LABELS[status] : null}
                      onSelect={o => setStatus(o.value)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>Priority</Text>
                    <InlineDropdown
                      placeholder="Priority"
                      options={PRIORITY_OPTIONS.map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }))}
                      selected={priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : null}
                      onSelect={o => setPriority(o.value)}
                    />
                  </View>
                </View>

                {/* Start + End Date */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>Start Date</Text>
                    <TouchableOpacity
                      style={[styles.input, styles.dateBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                      onPress={() => { const next = !showStartDatePicker; setShowEndDatePicker(false); setShowStartTimePicker(false); setShowEndTimePicker(false); setShowStartDatePicker(next); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: startDate ? txt : (isDark ? '#6C6C80' : '#AAAABC'), fontSize: 14 }}>{startDate || 'Select date'}</Text>
                      <Text style={{ color: sub, fontSize: 12 }}>📅</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>Due Date</Text>
                    <TouchableOpacity
                      style={[styles.input, styles.dateBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                      onPress={() => { const next = !showEndDatePicker; setShowStartDatePicker(false); setShowStartTimePicker(false); setShowEndTimePicker(false); setShowEndDatePicker(next); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: endDate ? txt : (isDark ? '#6C6C80' : '#AAAABC'), fontSize: 14 }}>{endDate || 'Select date'}</Text>
                      <Text style={{ color: sub, fontSize: 12 }}>📅</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Start + End Time */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>Start Time</Text>
                    <TouchableOpacity
                      style={[styles.input, styles.dateBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                      onPress={() => { const next = !showStartTimePicker; setShowStartDatePicker(false); setShowEndDatePicker(false); setShowEndTimePicker(false); setShowStartTimePicker(next); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: startTime ? txt : (isDark ? '#6C6C80' : '#AAAABC'), fontSize: 14 }}>{startTime || 'Select time'}</Text>
                      <Text style={{ color: sub, fontSize: 12 }}>🕐</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>End Time</Text>
                    <TouchableOpacity
                      style={[styles.input, styles.dateBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                      onPress={() => { const next = !showEndTimePicker; setShowStartDatePicker(false); setShowEndDatePicker(false); setShowStartTimePicker(false); setShowEndTimePicker(next); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: endTime ? txt : (isDark ? '#6C6C80' : '#AAAABC'), fontSize: 14 }}>{endTime || 'Select time'}</Text>
                      <Text style={{ color: sub, fontSize: 12 }}>🕐</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Date/Time pickers */}
                {showStartDatePicker && (
                  <View>
                    {Platform.OS === 'ios' && (<View style={[styles.pickerToolbar, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}><TouchableOpacity onPress={() => setShowStartDatePicker(false)}><Text style={styles.pickerDone}>Done</Text></TouchableOpacity></View>)}
                    <DateTimePicker value={startDate ? new Date(startDate + 'T00:00:00') : new Date()} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(event, selected) => { if (Platform.OS !== 'ios') setShowStartDatePicker(false); if (event.type === 'set' && selected) { const yyyy = selected.getFullYear(); const mm = String(selected.getMonth()+1).padStart(2,'0'); const dd = String(selected.getDate()).padStart(2,'0'); setStartDate(`${yyyy}-${mm}-${dd}`); } }} />
                  </View>
                )}
                {showEndDatePicker && (
                  <View>
                    {Platform.OS === 'ios' && (<View style={[styles.pickerToolbar, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}><TouchableOpacity onPress={() => setShowEndDatePicker(false)}><Text style={styles.pickerDone}>Done</Text></TouchableOpacity></View>)}
                    <DateTimePicker value={endDate ? new Date(endDate + 'T00:00:00') : (startDate ? new Date(startDate + 'T00:00:00') : new Date())} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} minimumDate={startDate ? new Date(startDate + 'T00:00:00') : undefined} onChange={(event, selected) => { if (Platform.OS !== 'ios') setShowEndDatePicker(false); if (event.type === 'set' && selected) { const yyyy = selected.getFullYear(); const mm = String(selected.getMonth()+1).padStart(2,'0'); const dd = String(selected.getDate()).padStart(2,'0'); setEndDate(`${yyyy}-${mm}-${dd}`); } }} />
                  </View>
                )}
                {showStartTimePicker && (
                  <View>
                    {Platform.OS === 'ios' && (<View style={[styles.pickerToolbar, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}><TouchableOpacity onPress={() => setShowStartTimePicker(false)}><Text style={styles.pickerDone}>Done</Text></TouchableOpacity></View>)}
                    <DateTimePicker value={startTime ? new Date(`1970-01-01T${startTime}:00`) : new Date()} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, selected) => { if (Platform.OS !== 'ios') setShowStartTimePicker(false); if (event.type === 'set' && selected) { const hh = String(selected.getHours()).padStart(2,'0'); const mm = String(selected.getMinutes()).padStart(2,'0'); setStartTime(`${hh}:${mm}`); } }} />
                  </View>
                )}
                {showEndTimePicker && (
                  <View>
                    {Platform.OS === 'ios' && (<View style={[styles.pickerToolbar, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}><TouchableOpacity onPress={() => setShowEndTimePicker(false)}><Text style={styles.pickerDone}>Done</Text></TouchableOpacity></View>)}
                    <DateTimePicker value={endTime ? new Date(`1970-01-01T${endTime}:00`) : new Date()} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, selected) => { if (Platform.OS !== 'ios') setShowEndTimePicker(false); if (event.type === 'set' && selected) { const hh = String(selected.getHours()).padStart(2,'0'); const mm = String(selected.getMinutes()).padStart(2,'0'); setEndTime(`${hh}:${mm}`); } }} />
                  </View>
                )}

                {/* Assignees */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Assignees</Text>
                <View style={[styles.assigneePickerBox, { backgroundColor: card, borderColor: assigneeDropdownOpen ? '#4ECDC4' : bdr }]}>
                  <TouchableOpacity activeOpacity={1} onPress={() => setAssigneeDropdownOpen(true)} style={styles.assigneePickerInner}>
                    {assignedTo.map(uid => {
                      const u = users.find(x => x.id === uid);
                      if (!u) return null;
                      const name = u.first_name || u.username || 'User';
                      return (
                        <View key={uid} style={styles.pickerChip}>
                          <Text style={styles.pickerChipText}>{name}</Text>
                          <TouchableOpacity onPress={() => toggleAssignee(uid)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                            <Text style={styles.pickerChipX}>×</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    <TextInput
                      style={[styles.pickerInput, { color: txt, minWidth: assignedTo.length === 0 ? 180 : 80 }]}
                      placeholder={assignedTo.length === 0 ? 'Search and select assignees…' : 'Add more…'}
                      placeholderTextColor={sub}
                      value={assigneeSearch}
                      onChangeText={t => { setAssigneeSearch(t); setAssigneeDropdownOpen(true); }}
                      onFocus={() => setAssigneeDropdownOpen(true)}
                      autoCapitalize="none"
                    />
                  </TouchableOpacity>
                  {assigneeDropdownOpen && (
                    <TouchableOpacity style={styles.pickerCloseBtn} onPress={() => { setAssigneeDropdownOpen(false); setAssigneeSearch(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={[styles.pickerCloseBtnText, { color: sub }]}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {assigneeDropdownOpen && (() => {
                  const aq = assigneeSearch.trim().toLowerCase();
                  const matches = users.filter(u => !assignedTo.includes(u.id)).filter(u => {
                    if (!aq) return true;
                    const name = `${u.first_name || ''} ${u.last_name || ''} ${u.username || ''} ${u.email || ''}`.toLowerCase();
                    return name.includes(aq);
                  });
                  return (
                    <View style={[styles.pickerDropdown, { backgroundColor: card, borderColor: bdr }]}>
                      {matches.length === 0 ? (
                        <Text style={[styles.pickerDropdownEmpty, { color: sub }]}>{assignedTo.length === users.length ? 'All users added' : 'No matches'}</Text>
                      ) : (
                        <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                          {matches.map(u => {
                            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'User';
                            const initial = (name || 'U').charAt(0).toUpperCase();
                            return (
                              <TouchableOpacity key={u.id} style={[styles.pickerDropdownItem, { borderBottomColor: bdr }]} onPress={() => { toggleAssignee(u.id); setAssigneeSearch(''); }}>
                                <View style={styles.pickerAvatar}><Text style={styles.pickerAvatarText}>{initial}</Text></View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.pickerDropdownName, { color: txt }]}>{name}</Text>
                                  {!!u.email && <Text style={[styles.pickerDropdownEmail, { color: sub }]} numberOfLines={1}>{u.email}</Text>}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}
                      <TouchableOpacity style={[styles.pickerDropdownClose, { borderTopColor: bdr }]} onPress={() => { setAssigneeDropdownOpen(false); setAssigneeSearch(''); }}>
                        <Text style={[styles.pickerDropdownCloseText, { color: '#4ECDC4' }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {/* Links */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Links</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt, marginBottom: 14 }]}
                  placeholder="Paste URL here..."
                  placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  value={links}
                  onChangeText={setLinks}
                  autoCapitalize="none"
                />

                {/* Attachments */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Attachments</Text>
                <View style={styles.attachRow}>
                  <TouchableOpacity style={[styles.attachBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]} onPress={openCamera}>
                    <View style={[styles.attachIconWrap, { backgroundColor: card, borderColor: bdr }]}><Text style={{ fontSize: 22 }}>📷</Text></View>
                    <Text style={[styles.attachLabel, { color: txt }]}>Camera</Text>
                    <Text style={[styles.attachSub, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>Take a photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]} onPress={openGallery}>
                    <View style={[styles.attachIconWrap, { backgroundColor: card, borderColor: bdr }]}><Text style={{ fontSize: 22 }}>🖼️</Text></View>
                    <Text style={[styles.attachLabel, { color: txt }]}>Gallery</Text>
                    <Text style={[styles.attachSub, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>Pick from photos</Text>
                  </TouchableOpacity>
                </View>
                {images.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, { color: sub, marginBottom: 8 }]}>{images.length} image{images.length > 1 ? 's' : ''} attached</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {images.map((uri, i) => (
                        <View key={i} style={{ position: 'relative', marginRight: 10 }}>
                          <Image source={{ uri }} style={[styles.previewImg, { borderColor: bdr }]} />
                          <TouchableOpacity style={styles.removeImg} onPress={() => setImages(p => p.filter((_, idx) => idx !== i))}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: bdr, backgroundColor: card }]} onPress={() => closeModal(true)} disabled={saving}>
                    <Text style={[styles.cancelBtnText, { color: sub }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.7 }]} onPress={createTask} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Create Task</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}

      {/* ── Generate Task by AI Modal ── */}
      {genModalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeGenModal}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeGenModal} />
          <Animated.View style={[styles.topModal, { transform: [{ translateY: genSlideAnim }], maxHeight: Dimensions.get('window').height - kbHeight }]}>
            <SafeAreaView style={{ flexShrink: 1 }}>
              <View style={styles.handle} />
              <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: kbHeight > 0 ? 24 : 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>✦ Generate {aiActiveTab === 'task' ? 'Task' : 'Event'} by AI</Text>
                    <Text style={{ fontSize: 12, color: '#A78BFA', marginTop: 2 }}>Let Nova AI create a comprehensive {aiActiveTab === 'task' ? 'task' : 'event'}</Text>
                  </View>
                  <TouchableOpacity style={styles.closeCircle} onPress={closeGenModal}>
                    <Text style={styles.closeCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.aiTabRow}>
                  {['task', 'event'].map(tab => (
                    <TouchableOpacity key={tab} style={[styles.aiTab, aiActiveTab === tab && styles.aiTabActive]} onPress={() => setAiActiveTab(tab)} activeOpacity={0.7}>
                      <Text style={[styles.aiTabText, aiActiveTab === tab && styles.aiTabTextActive]}>{tab === 'task' ? '📋  Task' : '📅  Event'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {aiActiveTab === 'task' ? (
                  <>
                    <Text style={styles.fieldLabel}>Project *</Text>
                    <TextInput style={[styles.input, genProject && { borderColor: '#A78BFA', backgroundColor: '#fff' }]} placeholder="Search project..." placeholderTextColor="#AAAABC" value={genProject ? genProject.name : genProjectSearch} onChangeText={t => { setGenProjectSearch(t); setGenProject(null); }} />
                    {!genProject && genProjectSearch.length > 0 && genFilteredProjects.length > 0 && (
                      <View style={styles.searchList}>
                        {genFilteredProjects.slice(0, 5).map((p, i) => (
                          <TouchableOpacity key={p.id} style={[styles.searchItem, i === Math.min(genFilteredProjects.length, 5) - 1 && { borderBottomWidth: 0 }]} onPress={() => { setGenProject(p); setGenProjectSearch(''); }}>
                            <Text style={styles.searchItemText}>{p.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <Text style={styles.fieldLabel}>Description *</Text>
                    <TextInput style={[styles.input, { height: 120, paddingTop: 12 }]} placeholder="Describe what you want AI to generate..." placeholderTextColor="#AAAABC" value={genDescription} onChangeText={setGenDescription} multiline textAlignVertical="top" />
                    <View style={{ backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                      <Text style={{ fontSize: 12, color: '#A78BFA', lineHeight: 18 }}>✦ Nova AI will automatically set the title, description, priority, dates and assign team members based on your project.</Text>
                    </View>
                    <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={closeGenModal} disabled={generating}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.aiGenerateBtn, generating && { opacity: 0.7 }]} onPress={generateTaskByAI} disabled={generating}>
                        {generating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.newBtnText}>✦ Generate Task</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : !eventSuggestion ? (
                  <>
                    <Text style={styles.fieldLabel}>What event do you want to create? *</Text>
                    <TextInput style={[styles.input, { height: 100, paddingTop: 12 }]} placeholder="e.g. dyuksa find 30 mins with Shifali and Ravi tomorrow" placeholderTextColor="#AAAABC" value={eventPrompt} onChangeText={setEventPrompt} multiline textAlignVertical="top" editable={!eventAILoading} />
                    <View style={{ backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                      <Text style={{ fontSize: 12, color: '#A78BFA', lineHeight: 18 }}>✦ Dyuksa will parse your request, check everyone's calendar, and show you available time slots.</Text>
                    </View>
                    <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={closeGenModal} disabled={eventAILoading}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.aiGenerateBtn, eventAILoading && { opacity: 0.7 }]} onPress={askDyuksaForEvent} disabled={eventAILoading}>
                        {eventAILoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.newBtnText}>✦ Ask Dyuksa</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>Event</Text>
                    <View style={[styles.input, { justifyContent: 'center' }]}><Text style={{ fontSize: 15, fontWeight: '600', color: '#1A1A2E' }} numberOfLines={2}>{eventSuggestion.title}</Text></View>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                      <View style={styles.aiInfoPill}><Text style={styles.aiInfoPillText}>👥 {eventSuggestion.event_type}</Text></View>
                      <View style={styles.aiInfoPill}><Text style={styles.aiInfoPillText}>⏱ {eventSuggestion.duration_minutes} min</Text></View>
                      <View style={styles.aiInfoPill}><Text style={styles.aiInfoPillText}>📅 {formatTargetDate(eventSuggestion.target_date)}</Text></View>
                    </View>
                    {Array.isArray(eventSuggestion.attendee_names) && eventSuggestion.attendee_names.length > 0 && (
                      <>
                        <Text style={styles.fieldLabel}>Participants</Text>
                        <View style={styles.aiAttendeeRow}>
                          {eventSuggestion.attendee_names.map((n, i) => (
                            <View key={`${n}_${i}`} style={styles.aiAttendee}>
                              <View style={styles.aiAttendeeAvatar}><Text style={styles.aiAttendeeAvatarText}>{String(n).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</Text></View>
                              <Text style={styles.aiAttendeeName} numberOfLines={1}>{n}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                    <Text style={styles.fieldLabel}>Available slots ({eventSuggestion.available_slots?.length || 0}) · tap to select</Text>
                    <View style={styles.aiSlotGrid}>
                      {(eventSuggestion.available_slots || []).map(slot => {
                        const active = slot === selectedSlot;
                        return (
                          <TouchableOpacity key={slot} style={[styles.aiSlotChip, active && styles.aiSlotChipActive]} onPress={() => setSelectedSlot(slot)} activeOpacity={0.7} disabled={eventSaving}>
                            <Text style={[styles.aiSlotChipText, active && styles.aiSlotChipTextActive]}>{formatSlotTime(slot)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={{ backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 10, padding: 12, marginTop: 14, marginBottom: 16 }}>
                      <Text style={{ fontSize: 12, color: '#A78BFA', lineHeight: 18 }}>✦ Event will be created as an online meeting with all participants invited.</Text>
                    </View>
                    <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEventSuggestion(null); setSelectedSlot(null); }} disabled={eventSaving}><Text style={styles.cancelBtnText}>← Back</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.aiGenerateBtn, eventSaving && { opacity: 0.7 }]} onPress={createEventFromAI} disabled={eventSaving || !selectedSlot}>
                        {eventSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.newBtnText}>✦ Create Event</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}

      {/* Inline Status Picker */}
      <Modal visible={!!statusPickerTaskId} transparent animationType="fade" onRequestClose={() => !updatingStatus && setStatusPickerTaskId(null)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => !updatingStatus && setStatusPickerTaskId(null)}>
          <View style={[styles.pickerCard, { backgroundColor: card, borderColor: bdr }]}>
            <Text style={[styles.pickerTitle, { color: txt }]}>Change Status</Text>
            <Text style={[styles.pickerSub, { color: sub }]}>{(() => { const t = tasks.find(x => x.id === statusPickerTaskId); return t?.heading || ''; })()}</Text>
            <View style={{ height: 8 }} />
            {STATUS_OPTIONS.map(opt => {
              const t = tasks.find(x => x.id === statusPickerTaskId);
              const active = t?.status === opt;
              const color = STATUS_COLORS[opt] || '#888';
              return (
                <TouchableOpacity key={opt} style={[styles.pickerOption, { borderColor: bdr }, active && { backgroundColor: color + '15', borderColor: color }]} onPress={() => updateTaskStatus(t, opt)} disabled={updatingStatus} activeOpacity={0.7}>
                  <View style={[styles.pickerDot, { backgroundColor: color }]} />
                  <Text style={[styles.pickerOptionText, { color: txt }, active && { color, fontWeight: '700' }]}>{STATUS_LABELS[opt]}</Text>
                  {active && <Text style={[styles.pickerCheck, { color }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            {updatingStatus && (<View style={styles.pickerLoadingOverlay}><ActivityIndicator size="small" color="#4ECDC4" /></View>)}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onUpdated={(updatedTask) => { fetchTasks(); if (updatedTask) setDetailTask(updatedTask); }}
      />

      {/* Success toast */}
      {successToast && (
        <Modal transparent visible animationType="fade">
          <View pointerEvents="none" style={styles.toastOverlay}>
            <View style={[styles.toastCard, { backgroundColor: card, borderColor: bdr }]}>
              <Text style={[styles.toastTitle, { color: txt }]}>{successToast.title}</Text>
              <Text style={[styles.toastBody, { color: sub }]}>{successToast.body}</Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  navIcon: { fontSize: 16 },

  subHeader: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 10, paddingHorizontal: 10, gap: 6, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 13 },
  searchClear: { fontSize: 14, paddingHorizontal: 4 },
  taskCount: { fontSize: 11, fontWeight: '600', minWidth: 48, textAlign: 'right' },

  newBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  aiBtn: { backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' },
  aiBtnText: { color: '#A78BFA', fontSize: 12, fontWeight: '700' },
  aiGenerateBtn: { flex: 1, backgroundColor: '#7C3AED', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },

  filtersWrap: { borderBottomWidth: 1, maxHeight: 50 },
  filters: { paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', flexDirection: 'row' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, height: 32, flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '500' },
  chipBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  chipBadgeText: { fontSize: 10, fontWeight: '700' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center' },

  // ── Task Card ──
  taskCard: {
    borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderLeftWidth: 4,
  },
  cardRow1: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8,
  },
  typeIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  taskName: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  taskProject: { fontSize: 11, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    flexShrink: 0,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusCaret: { fontSize: 9 },

  cardRow2: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  createdBy: { fontSize: 12, flex: 1 },
  dueDate: { fontSize: 11, fontWeight: '500' },

  cardRow3: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardRow3Left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  durationPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },
  miniAvatarText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  miniAvatarOverflow: { backgroundColor: '#F5F5F7' },

  // Status picker
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  pickerCard: { width: '100%', maxWidth: 360, borderRadius: 14, borderWidth: 1, padding: 16 },
  pickerTitle: { fontSize: 15, fontWeight: '700' },
  pickerSub: { fontSize: 12, marginTop: 2 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  pickerDot: { width: 10, height: 10, borderRadius: 5 },
  pickerOptionText: { flex: 1, fontSize: 13, fontWeight: '500' },
  pickerCheck: { fontSize: 14, fontWeight: '700' },
  pickerLoadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  // Dev_1 tab bar
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabBadgeText: { fontSize: 11, fontWeight: '700' },

  // Dev_1 task card — checkbox + left border
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#DEDEE8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },

  // Due date meta pill
  metaDatePill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaDateText: { fontSize: 11, fontWeight: '500' },

  // Toast
  toastOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  toastCard: { minWidth: 240, maxWidth: 320, borderRadius: 14, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  toastTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  toastBody: { fontSize: 12, textAlign: 'center', lineHeight: 17 },

  // Modal
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topModal: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxHeight: '95%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 16, marginBottom: 8 },
  modalScroll: { paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 14, height: 46, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  pickerToolbar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginTop: 6 },
  pickerDone: { color: '#4ECDC4', fontSize: 15, fontWeight: '700' },
  searchList: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', marginTop: -10, marginBottom: 14 },
  searchItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  searchItemText: { fontSize: 13, color: '#1A1A2E' },
  attachRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  attachBtn: { flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', gap: 3 },
  attachIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 2, borderWidth: 1 },
  attachLabel: { fontSize: 12, fontWeight: '700' },
  attachSub: { fontSize: 10 },
  previewImg: { width: 80, height: 80, borderRadius: 10, borderWidth: 1 },
  removeImg: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F87171', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
  submitBtn: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Assignee picker
  assigneePickerBox: { minHeight: 48, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  assigneePickerInner: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  pickerCloseBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  pickerCloseBtnText: { fontSize: 16, fontWeight: '700' },
  pickerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(78,205,196,0.12)', borderRadius: 16, paddingLeft: 10, paddingRight: 6, paddingVertical: 5 },
  pickerChipText: { fontSize: 12, color: '#0F766E', fontWeight: '600' },
  pickerChipX: { fontSize: 16, color: '#0F766E', fontWeight: '700', paddingHorizontal: 2, lineHeight: 18 },
  pickerInput: { flex: 1, fontSize: 13, paddingVertical: 4, paddingHorizontal: 4 },
  pickerDropdown: { borderWidth: 1, borderRadius: 10, marginTop: 6, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, maxHeight: 280 },
  pickerDropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  pickerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center' },
  pickerAvatarText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  pickerDropdownName: { fontSize: 13, fontWeight: '600' },
  pickerDropdownEmail: { fontSize: 11, marginTop: 1 },
  pickerDropdownEmpty: { fontSize: 12, fontStyle: 'italic', paddingHorizontal: 12, paddingVertical: 14, textAlign: 'center' },
  pickerDropdownClose: { borderTopWidth: 1, paddingVertical: 10, alignItems: 'center' },
  pickerDropdownCloseText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  enhanceWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  enhanceBtn: { width: 38, height: 46, borderRadius: 10, backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.3)', justifyContent: 'center', alignItems: 'center' },
  enhanceIcon: { fontSize: 18 },
  enhanceHint: { fontSize: 10, color: '#A78BFA', marginBottom: 12, marginLeft: 2 },

  aiTabRow: { flexDirection: 'row', backgroundColor: '#F5F5F7', borderRadius: 12, padding: 4, marginBottom: 18, gap: 4 },
  aiTab: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 9 },
  aiTabActive: { backgroundColor: '#1A1A2E', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  aiTabText: { fontSize: 14, fontWeight: '600', color: '#888899' },
  aiTabTextActive: { color: '#FFFFFF' },

  aiInfoPill: { backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  aiInfoPillText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
  aiAttendeeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  aiAttendee: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F5F7', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20 },
  aiAttendeeAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center' },
  aiAttendeeAvatarText: { fontSize: 9, fontWeight: '700', color: '#7C3AED' },
  aiAttendeeName: { fontSize: 12, color: '#1A1A2E', fontWeight: '500', maxWidth: 120 },
  aiSlotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  aiSlotChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', minWidth: 76, alignItems: 'center' },
  aiSlotChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  aiSlotChipText: { fontSize: 13, fontWeight: '600', color: '#15803D' },
  aiSlotChipTextActive: { color: '#FFFFFF' },
});
