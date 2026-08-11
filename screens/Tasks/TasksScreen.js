import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Image, Alert, Animated, ActivityIndicator,
  Keyboard, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useContext, useEffect } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NotificationsContext } from '../../context/NotificationsContext';
import { AuthContext } from '../../context/AuthContext';
import { getUsers, getProjects, getAccessToken, getWorkspaceId, refineTextAI } from '../../services/ApiService';
import { canEditItem, canCreateTask } from '../../utils/permissions';
import SidebarMenu from '../../components/SidebarMenu';
import TaskDetailModal from '../../components/TaskDetailModal';
import { ThemeContext } from '../../context/ThemeContext';
import NotificationBell from '../../components/NotificationBell';
import Svg, { Path, Circle } from 'react-native-svg';

import { API_BASE, BASE_URL, WS_BASE } from '../../config';
import { Feather } from '@expo/vector-icons';
import { useTasksCache, invalidateTasksCache } from '../../hooks/useTasksCache';
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
const STATUS_COLORS  = { pending: '#D97706', in_progress: '#3B72EE', completed: '#22C55E', backlog: '#F472B6', deployed: '#3B72EE', deferred: '#FBBF24', review: '#A78BFA' };
const STATUS_BG      = { pending: '#FEF3C7', in_progress: '#EFF6FF', completed: '#F0FDF4', backlog: '#FDF2F8', deployed: '#EFF6FF', deferred: '#FFFBEB', review: '#F5F3FF' };
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLORS  = { low: '#22C55E', medium: '#3B72EE', high: '#F97316', urgent: '#EF4444', critical: '#EF4444' };

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
        style={[dd.trigger, { backgroundColor: bg, borderColor: bdr }, open && { borderColor: '#3B72EE', backgroundColor: bgOpen }]}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={[dd.triggerText, { color: txt }, !selected && { color: sub }]} numberOfLines={1}>
          {selected || placeholder}
        </Text>
        <Text style={[dd.arrow, { color: sub }]}>{open ? '▲' : '▾'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[dd.list, { backgroundColor: bgOpen, borderColor: '#3B72EE' }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
            {options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[dd.item, { borderBottomColor: isDark ? '#2F2F3D' : '#F0F0F5' }, i === options.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[dd.itemText, { color: txt }, selected === opt.label && { color: '#3B72EE', fontWeight: '700' }]}>
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

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ item, card, txt, sub, bdr, isDark, onPress, onStatusPress, formatDate }) {
  const statusColor = STATUS_COLORS[item.status] || '#888';
  const statusBg    = STATUS_BG[item.status]    || '#F5F5F7';
  const priorityColor = PRIORITY_COLORS[item.priority] || '#888';
  const assignees = Array.isArray(item.assigned_to_user_details) ? item.assigned_to_user_details : [];
  const AVATAR_COLORS = ['#6B9FED','#9B7EF5','#4DB88A','#F0A843','#E87070','#42B3D5'];
  const isDone = ['completed', 'deployed', 'done'].includes((item.status || '').toLowerCase());
  const projName = item.project_details?.name || '';

  // Format date — just day + month + year
  const dueFmt = item.end_date ? formatDate(item.end_date) : null;

  return (
    <TouchableOpacity
      style={[styles.taskCard, { backgroundColor: card, borderColor: bdr, borderLeftColor: priorityColor, borderLeftWidth: 3 }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top row: checkbox + title + status pill */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        {/* Circle checkbox */}
        <View style={{
          width: 22, height: 22, borderRadius: 11, marginTop: 2, flexShrink: 0,
          borderWidth: 2, borderColor: isDone ? '#22C55E' : (isDark ? '#505060' : '#CDCFDA'),
          backgroundColor: isDone ? '#22C55E' : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {isDone && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
        </View>

        {/* Title */}
        <Text style={{
          flex: 1, fontSize: 15, fontWeight: '600',
          color: isDone ? sub : txt,
          textDecorationLine: isDone ? 'line-through' : 'none',
          lineHeight: 21,
        }} numberOfLines={2}>
          {item.heading}
        </Text>

        {/* Status pill — tappable */}
        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: statusBg }]}
          onPress={onStatusPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom row: project chip + date + priority dot + assignee avatar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
        {/* Project name — plain text */}
        {projName ? (
          <Text style={{ fontSize: 12, fontWeight: '600', color: sub }}>{projName}</Text>
        ) : null}

        {/* Due date */}
        {dueFmt && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="calendar" size={11} color={sub} />
            <Text style={{ fontSize: 12, color: sub }}>{dueFmt}</Text>
          </View>
        )}

        {/* Priority dot + label */}
        {item.priority && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: priorityColor }} />
            <Text style={{ fontSize: 12, color: sub, fontWeight: '500' }}>
              {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Assignee avatar — colored initials */}
        {assignees.length > 0 && (() => {
          const u = assignees[0];
          const first = (u.first_name || u.full_name || u.username || 'U').trim();
          const last  = (u.last_name || '').trim();
          const initials = last
            ? (first.charAt(0) + last.charAt(0)).toUpperCase()
            : first.slice(0, 2).toUpperCase();
          const avatarColor = AVATAR_COLORS[
            (u.id ? u.id % AVATAR_COLORS.length : 0)
          ];
          return (
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: avatarColor, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{initials}</Text>
            </View>
          );
        })()}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

// ── Reusable SVG search icon ─────────────────────────────────────────────────
const SearchIcon = ({ size = 20, color = '#3B72EE' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

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

  // Tasks from shared cache — no duplicate fetches
  const { tasks: cachedTasks, loading: tasksLoading, refresh: refreshTasks } = useTasksCache();
  // Local override for optimistic status updates (resets when cache refreshes)
  const [localTaskOverrides, setLocalTaskOverrides] = useState({});
  const tasks = cachedTasks.map(t => localTaskOverrides[t.id] ? { ...t, ...localTaskOverrides[t.id] } : t);
  const setTasks = useCallback((updater) => {
    // Support functional update form: setTasks(prev => ...)
    setLocalTaskOverrides(prev => {
      const current = cachedTasks.map(t => prev[t.id] ? { ...t, ...prev[t.id] } : t);
      const updated = typeof updater === 'function' ? updater(current) : updater;
      // Build override map from the diff
      const overrides = {};
      updated.forEach(t => { overrides[t.id] = t; });
      return overrides;
    });
  }, [cachedTasks]);
  const [projects, setProjects] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [filter,   setFilter]   = useState('upcoming');
  const [priorityFilter, setPriorityFilter] = useState('All');
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

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
    getUsers().then(setUsers).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.openCreateModal) {
        const presetId = route.params?.presetProjectId;
        navigation.navigate('CreateTask', presetId ? { projectId: String(presetId) } : {});
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

  // Pull-to-refresh: just refresh the cache, don't clear it first
  const fetchTasks = useCallback(() => {
    refreshTasks();
  }, [refreshTasks]);

  // After creating/editing a task: clear cache so fresh data loads
  const refetchAfterMutation = useCallback(() => {
    invalidateTasksCache();
    refreshTasks();
  }, [refreshTasks]);

  const openModal = (params = {}) => {
    navigation.navigate('CreateTask', {
      projectId: params?.projectId || null,
    });
  };

  const closeModal = (fromCancel) => {
    if (fromCancel && returnToProjectIdRef.current) {
      const returnId = returnToProjectIdRef.current;
      returnToProjectIdRef.current = null;
      navigation.navigate('Projects', { reopenProjectId: returnId });
      return;
    }
    const returnTo = route.params?.returnTo;
    if (returnTo && returnTo !== 'Tasks') {
      navigation.setParams({ returnTo: null });
      try { navigation.jumpTo(returnTo); } catch {}
    }
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
      const res  = await fetch(`${BASE_URL}/tasksite/?page=1`, {
        method: 'POST',
        headers: await authHeadersMultipart(),
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        addNotification({ type: 'task', icon: '📋', title: 'Task Created', body: `"${heading.trim()}" added successfully.` });
        refetchAfterMutation();
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

  const today = new Date().toISOString().slice(0, 10);
  const baseFiltered =
    filter === 'upcoming'
      // Upcoming: pending (always) + in_progress (always)
      ? tasks.filter(t => {
          const s = (t.status||'').toLowerCase();
          return s === 'pending' || s === 'in_progress';
        })
      : filter === 'overdue'
      // Overdue: any task (except completed/deployed) with a past due date
      // pending + backlog + review + deferred — all show here if past due
      ? tasks.filter(t => {
          const s = (t.status||'').toLowerCase();
          const due = t.end_date || t.due_date;
          return !['completed','deployed','done','in_progress'].includes(s) && due && due < today;
        })
      : filter === 'completed'
      ? tasks.filter(t => ['completed','done','deployed'].includes(t.status))
      : tasks;

  const priorityFiltered = priorityFilter === 'All'
    ? baseFiltered
    : baseFiltered.filter(t => (t.priority || '').toLowerCase() === priorityFilter.toLowerCase());

  const q = search.trim().toLowerCase();
  const filtered = q
    ? priorityFiltered.filter(t => {
        const heading = String(t.heading || '').toLowerCase();
        const proj    = String(t.project_details?.name || '').toLowerCase();
        return heading.includes(q) || proj.includes(q);
      })
    : priorityFiltered;

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
          <View>
            <Text style={[styles.brandName, { color: txt }]}>Tasks</Text>
            <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>
              {tasks.length} total{tasks.filter(t => {
                const s = (t.status||'').toLowerCase(); const due = t.end_date || t.due_date;
                return !['completed','deployed','done','in_progress'].includes(s) && due && due < new Date().toISOString().slice(0,10);
              }).length > 0 ? ` · ${tasks.filter(t => {
                const s = (t.status||'').toLowerCase(); const due = t.end_date || t.due_date;
                return !['completed','deployed','done','in_progress'].includes(s) && due && due < new Date().toISOString().slice(0,10);
              }).length} overdue` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ padding: 6 }}>
            <SearchIcon size={20} color='#3B72EE' />
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Sub header */}
      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={[styles.searchWrap, { backgroundColor: bg, borderColor: bdr }]}>
          <SearchIcon size={16} color='#3B72EE' />
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
        <View style={{ flexDirection: 'row', gap: 12, marginLeft: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={openGenModal}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#2D6AE3' }}>✦ AI</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openModal}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#fff' : '#1A1A2E' }}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar — Upcoming / Overdue / Completed underline style */}
      <View style={[{ backgroundColor: card, borderBottomWidth: 1, borderBottomColor: bdr, paddingHorizontal: 16 }]}>
        <View style={{ flexDirection: 'row' }}>
          {[
            { key: 'upcoming',  label: 'Upcoming',  count: tasks.filter(t => { const s = (t.status||'').toLowerCase(); return s === 'pending' || s === 'in_progress'; }).length },
            { key: 'overdue',   label: 'Overdue',   count: tasks.filter(t => { const s = (t.status||'').toLowerCase(); const due = t.end_date||t.due_date; return !['completed','deployed','done','in_progress'].includes(s) && due && due < new Date().toISOString().slice(0,10); }).length },
            { key: 'completed', label: 'Completed', count: tasks.filter(t => ['completed','done','deployed'].includes(t.status)).length },
          ].map(({ key, label, count }) => {
            const isActive = filter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setFilter(key)}
                style={{ paddingVertical: 11, paddingHorizontal: 4, marginRight: 20, borderBottomWidth: 2, borderBottomColor: isActive ? '#3B72EE' : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#3B72EE' : sub }}>{label}</Text>
                <View style={{ backgroundColor: isActive ? '#3B72EE' : (isDark ? '#252530' : '#F0F0F5'), borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? '#fff' : sub }}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Priority filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: isDark ? '#0D0D0F' : '#F5F5FA', flexGrow: 0 }} contentContainerStyle={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}>
        {[
          { key: 'All',    label: 'All',    color: null },
          { key: 'urgent', label: 'Critical', color: '#EF4444' },
          { key: 'high',   label: 'High',   color: '#F97316' },
          { key: 'medium', label: 'Medium', color: '#3B72EE' },
          { key: 'low',    label: 'Low',    color: '#22C55E' },
        ].map(({ key, label, color }) => {
          const isActive = (priorityFilter || 'All') === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setPriorityFilter(key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, height: 34,
                backgroundColor: isActive ? (isDark ? '#fff' : '#1A1A2E') : (isDark ? '#252530' : '#fff'),
                borderWidth: isActive ? 0 : 1,
                borderColor: bdr,
              }}
            >
              {color && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />}
              <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? (isDark ? '#1A1A2E' : '#fff') : (isDark ? '#9898A6' : '#555') }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Task list */}
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#3B72EE" />
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
              onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
              onStatusPress={canEditItem(user?.role, item, user?.id)
                ? () => setStatusPickerTaskId(item.id)
                : null}
              formatDate={formatDate}
            />
          )}
        />
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
            {updatingStatus && (<View style={styles.pickerLoadingOverlay}><ActivityIndicator size="small" color="#3B72EE" /></View>)}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onUpdated={(updatedTask) => { refetchAfterMutation(); if (updatedTask) setDetailTask(updatedTask); }}
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
  logoText: { color: '#3B72EE', fontSize: 15, fontWeight: '800' },
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
    borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1,
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
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#DEDEE8', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },

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
  pickerDone: { color: '#3B72EE', fontSize: 15, fontWeight: '700' },
  searchList: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#3B72EE', marginTop: -10, marginBottom: 14 },
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
