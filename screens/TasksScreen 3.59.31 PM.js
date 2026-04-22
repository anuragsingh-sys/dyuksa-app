import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Image, Alert, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useContext, useEffect } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { NotificationsContext } from '../context/NotificationsContext';
import { getUsers, getProjects, getAccessToken, refineTextAI } from '../services/ApiService';
import SidebarMenu from '../components/SidebarMenu';
import TaskDetailModal from '../components/TaskDetailModal';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

const BASE_URL = 'http://192.168.1.164:8000/api/v1';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'backlog', 'deployed', 'deferred', 'review'];
const STATUS_LABELS  = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review' };
const STATUS_COLORS  = { pending: '#888899', in_progress: '#4ECDC4', completed: '#4ADE80', backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA' };
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLORS  = { low: '#4ADE80', medium: '#FBBF24', high: '#F97316', urgent: '#EF4444' };

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
  const placeholderColor = isDark ? '#6C6C80' : '#AAAABC';
  const itemBorder = isDark ? '#2F2F3D' : '#F0F0F5';
  return (
    <View>
      <TouchableOpacity
        style={[dd.trigger, { backgroundColor: bg, borderColor: bdr }, open && { borderColor: '#4ECDC4', backgroundColor: bgOpen }]}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={[dd.triggerText, { color: txt }, !selected && { color: placeholderColor }]} numberOfLines={1}>
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
                style={[dd.item, { borderBottomColor: itemBorder }, i === options.length - 1 && { borderBottomWidth: 0 }]}
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
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 12, height: 46 },
  triggerOpen: { borderColor: '#4ECDC4', backgroundColor: '#fff' },
  triggerText: { fontSize: 13, color: '#1A1A2E', flex: 1 },
  arrow: { fontSize: 11, color: '#888899', marginLeft: 4 },
  list: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', marginTop: 4 },
  item: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  itemText: { fontSize: 13, color: '#1A1A2E' },
});

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function TasksScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
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

  const [modalVisible,   setModalVisible]   = useState(false);
  const [saving,         setSaving]         = useState(false);
  // Task detail modal
  const [detailTask,     setDetailTask]     = useState(null);
  const slideAnim = useRef(new Animated.Value(-700)).current;

  // Track which project to return to after a task is successfully created
  // (set when Create Task was triggered from inside a Project Details screen)
  const returnToProjectIdRef = useRef(null);

  const [heading,       setHeading]       = useState('');
  const [description,   setDescription]   = useState('');
  const [project,       setProject]       = useState(null);
  const [status,        setStatus]        = useState(null);
  const [priority,      setPriority]      = useState('medium');
  const [startDate,     setStartDate]     = useState('');
  const [endDate,       setEndDate]       = useState('');
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

  // Auto-open Create Task modal when center "+" FAB triggers us
  // Also pre-select project if presetProjectId is passed (from Project Details screen)
  useFocusEffect(
    useCallback(() => {
      if (route.params?.openCreateModal) {
        openModal();

        // If project preset is passed, try to select it immediately
        const presetId = route.params?.presetProjectId;
        if (presetId) {
          // Remember where to return after successful task creation
          returnToProjectIdRef.current = presetId;

          // Try to find project in already-loaded list
          const found = projects.find(p => String(p.id) === String(presetId));
          if (found) {
            setProject(found);
          } else {
            // Projects not loaded yet — retry after a short delay
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
    }, [route.params?.openCreateModal, route.params?.presetProjectId, projects])
  );

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${BASE_URL}/tasksite/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        // API returns { count, next, previous, results: [...] }
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
    // If user is cancelling AND they came from a project, grab the return id
    // BEFORE the animation starts — then navigate back after the animation.
    const returnId = fromCancel ? returnToProjectIdRef.current : null;
    if (fromCancel) returnToProjectIdRef.current = null;

    Animated.timing(slideAnim, { toValue: -700, duration: 250, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      setHeading(''); setDescription(''); setProject(null); setStatus(null);
      setPriority('medium'); setStartDate(''); setEndDate('');
      setAssignedTo([]); setLinks(''); setImages([]); setProjectSearch('');

      // After the close animation, take the user back to the project they came from
      if (returnId) {
        navigation.navigate('Projects', { reopenProjectId: returnId });
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
      const token    = await getAccessToken();
      const formData = new FormData();
      formData.append('heading', heading.trim());
      formData.append('project', String(project.id));
      if (description) formData.append('description', description);
      if (status)      formData.append('status',      status);
      if (priority)    formData.append('priority',    priority);
      if (startDate)   formData.append('start_date',  startDate);
      if (endDate)     formData.append('end_date',    endDate);
      if (links.trim()) formData.append('uploaded_links', links.trim());
      assignedTo.forEach(uid => formData.append('assigned_to', String(uid)));
      images.forEach((uri, i) => {
        formData.append('uploaded_files', { uri, name: `image_${i}.jpg`, type: 'image/jpeg' });
      });

      const res  = await fetch(`${BASE_URL}/tasksite/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        addNotification({ type: 'task', icon: '📋', title: 'Task Created', body: `"${heading.trim()}" added successfully.` });
        await fetchTasks();
        closeModal();

        // If Create Task was triggered from inside a Project Details screen,
        // bring the user back to that project so they stay in context.
        const returnId = returnToProjectIdRef.current;
        if (returnId) {
          returnToProjectIdRef.current = null;
          setTimeout(() => {
            navigation.navigate('Projects', { reopenProjectId: returnId });
          }, 300); // wait for close animation
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
  const [genProject,      setGenProject]      = useState(null);
  const [genProjectSearch,setGenProjectSearch]= useState('');
  const [genDescription,  setGenDescription]  = useState('');
  const [generating,      setGenerating]      = useState(false);
  const genSlideAnim = useRef(new Animated.Value(-700)).current;

  const openGenModal = () => {
    setGenModalVisible(true);
    Animated.spring(genSlideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeGenModal = () => {
    Animated.timing(genSlideAnim, { toValue: -700, duration: 250, useNativeDriver: true }).start(() => {
      setGenModalVisible(false);
      setGenProject(null); setGenProjectSearch(''); setGenDescription('');
    });
  };

  const generateTaskByAI = async () => {
    if (!genProject) { Alert.alert('Required', 'Select a project first.'); return; }
    if (!genDescription.trim()) { Alert.alert('Required', 'Enter a description.'); return; }
    setGenerating(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${BASE_URL}/task-ai/suggest-task/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ project_id: genProject.id, description: genDescription.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert('Error', data.message || data.detail || 'AI generation failed.'); return; }

      // Pre-fill the create task modal with AI response
      setHeading(data.heading || '');
      setDescription(data.description || '');
      setStatus(data.status || null);
      setPriority(data.priority || 'medium');
      setStartDate(data.start_date ? data.start_date.split('T')[0] : '');
      setEndDate(data.end_date ? data.end_date.split('T')[0] : '');
      setAssignedTo(Array.isArray(data.assigned_to) ? data.assigned_to : []);
      setProject(genProject);

      // Close gen modal and open create modal
      closeGenModal();
      setTimeout(() => openModal(), 400);
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setGenerating(false);
    }
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

  const filtered = filter === 'All' ? tasks : tasks.filter(t => t.status === filter);

  const formatDate = iso => {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
    catch { return iso || ''; }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D0D0F' : '#fff'} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Tasks" />
          <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
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
        <View>
          <Text style={[styles.pageTitle, { color: txt }]}>My Tasks</Text>
          <Text style={[styles.pageSub, { color: sub }]}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.aiBtn} onPress={openGenModal}>
            <Text style={styles.aiBtnText}>✦ AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={openModal}>
            <Text style={styles.newBtnText}>+ Create Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filtersWrap, { backgroundColor: card, borderBottomColor: bdr }]} contentContainerStyle={styles.filters}>
        {[
          { key: 'All',         label: 'All' },
          { key: 'pending',     label: 'Pending' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'completed',   label: 'Completed' },
          { key: 'backlog',     label: 'Backlog' },
          { key: 'deployed',    label: 'Deployed' },
          { key: 'deferred',    label: 'Deferred' },
          { key: 'review',      label: 'Review' },
        ].map(({ key, label }) => {
          const isActive = filter === key;
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
              <Text
                style={[
                  styles.chipText,
                  { color: sub },
                  isActive && { color: isDark ? '#0D0D0F' : '#fff', fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
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
          <Text style={[styles.emptyTitle, { color: txt }]}>No tasks yet</Text>
          <Text style={[styles.emptySub, { color: sub }]}>Tap + Create Task to add one</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 12 }}
          onRefresh={fetchTasks}
          refreshing={loading}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.taskCard, { backgroundColor: card, borderColor: bdr }]}
              onPress={() => setDetailTask(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={[styles.typeIcon, { backgroundColor: (STATUS_COLORS[item.status] || '#888') + '20' }]}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskName, { color: txt }]} numberOfLines={1}>{item.heading}</Text>
                  {item.project_details?.name && (
                    <Text style={[styles.taskProject, { color: sub }]}>📁 {item.project_details.name}</Text>
                  )}
                  {(item.start_date || item.created_at) && (
                    <Text style={[styles.taskDate, { color: sub }]}>{formatDate(item.start_date || item.created_at)}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || '#888') + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || '#888' }]}>
                      {STATUS_LABELS[item.status] || item.status}
                    </Text>
                  </View>
                  {item.end_date && (
                    <Text style={[styles.dueDateText, { color: sub }]}>
                      {formatDate(item.end_date)}
                    </Text>
                  )}
                </View>
              </View>
              {!!item.description && (() => {
                // Strip HTML tags like <p></p> from description
                const clean = item.description.replace(/<[^>]*>/g, '').trim();
                if (!clean) return null;
                return <Text style={[styles.taskDesc, { color: sub }]} numberOfLines={2}>{clean}</Text>;
              })()}
              {item.priority && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] || '#888' }]} />
                  <Text style={{ fontSize: 11, color: sub, fontWeight: '500' }}>{item.priority?.toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Create Task Modal ── */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => closeModal(true)} />
          <Animated.View style={[styles.topModal, { backgroundColor: card, transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={[styles.handle, { backgroundColor: isDark ? '#3A3A48' : '#DEDEE8' }]} />
              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: txt }]}>Create Task</Text>
                  <TouchableOpacity
                    style={[styles.closeCircle, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                    onPress={() => closeModal(true)}
                  >
                    <Text style={[styles.closeCircleText, { color: sub }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Project search */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Project *</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt },
                    project && { borderColor: '#4ECDC4', backgroundColor: card },
                  ]}
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
                    style={[
                      styles.input,
                      { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt, flex: 1, marginBottom: 0 },
                    ]}
                    placeholder="Enter a concise task title"
                    placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                    value={heading}
                    onChangeText={setHeading}
                  />
                  <TouchableOpacity style={styles.enhanceBtn} onPress={enhanceTitle} disabled={enhancingTitle}>
                    {enhancingTitle
                      ? <ActivityIndicator size="small" color="#A78BFA" />
                      : <Text style={styles.enhanceIcon}>✨</Text>
                    }
                  </TouchableOpacity>
                </View>
                <Text style={styles.enhanceHint}>✨ Optimize title with Nova AI</Text>

                {/* Description */}
                <Text style={[styles.fieldLabel, { marginTop: 10, color: sub }]}>Description</Text>
                <View style={styles.enhanceWrap}>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt, flex: 1, height: 90, paddingTop: 12, marginBottom: 0 },
                    ]}
                    placeholder="Add task details..."
                    placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity style={styles.enhanceBtn} onPress={refineDescription} disabled={enhancingDesc}>
                      {enhancingDesc
                        ? <ActivityIndicator size="small" color="#A78BFA" />
                        : <Text style={styles.enhanceIcon}>✨</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.enhanceBtn, { backgroundColor: 'rgba(78,205,196,0.1)', borderColor: 'rgba(78,205,196,0.3)' }]} onPress={generateDescription} disabled={generatingDesc}>
                      {generatingDesc
                        ? <ActivityIndicator size="small" color="#4ECDC4" />
                        : <Text style={styles.enhanceIcon}>⚡</Text>
                      }
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
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                      value={startDate}
                      onChangeText={setStartDate}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>Due Date</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                      value={endDate}
                      onChangeText={setEndDate}
                    />
                  </View>
                </View>

                {/* Assignees — web-style picker with search + chips */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Assignees</Text>
                <View
                  style={[
                    styles.assigneePickerBox,
                    { backgroundColor: card, borderColor: assigneeDropdownOpen ? '#4ECDC4' : bdr },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setAssigneeDropdownOpen(true)}
                    style={styles.assigneePickerInner}
                  >
                    {/* Selected user chips */}
                    {assignedTo.map(uid => {
                      const u = users.find(x => x.id === uid);
                      if (!u) return null;
                      const name = u.first_name || u.username || 'User';
                      return (
                        <View key={uid} style={styles.pickerChip}>
                          <Text style={styles.pickerChipText}>{name}</Text>
                          <TouchableOpacity
                            onPress={() => toggleAssignee(uid)}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          >
                            <Text style={styles.pickerChipX}>×</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    {/* Search input */}
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
                  {/* Close X button — visible only when dropdown is open */}
                  {assigneeDropdownOpen && (
                    <TouchableOpacity
                      style={styles.pickerCloseBtn}
                      onPress={() => { setAssigneeDropdownOpen(false); setAssigneeSearch(''); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.pickerCloseBtnText, { color: sub }]}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dropdown of matching users (scrollable, fixed max height) */}
                {assigneeDropdownOpen && (() => {
                  const q = assigneeSearch.trim().toLowerCase();
                  const matches = users
                    .filter(u => !assignedTo.includes(u.id))
                    .filter(u => {
                      if (!q) return true;
                      const name = `${u.first_name || ''} ${u.last_name || ''} ${u.username || ''} ${u.email || ''}`.toLowerCase();
                      return name.includes(q);
                    });

                  return (
                    <View style={[styles.pickerDropdown, { backgroundColor: card, borderColor: bdr }]}>
                      {matches.length === 0 ? (
                        <Text style={[styles.pickerDropdownEmpty, { color: sub }]}>
                          {assignedTo.length === users.length ? 'All users added' : 'No matches'}
                        </Text>
                      ) : (
                        <ScrollView
                          style={{ maxHeight: 220 }}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator
                        >
                          {matches.map(u => {
                            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'User';
                            const initial = (name || 'U').charAt(0).toUpperCase();
                            return (
                              <TouchableOpacity
                                key={u.id}
                                style={[styles.pickerDropdownItem, { borderBottomColor: bdr }]}
                                onPress={() => {
                                  toggleAssignee(u.id);
                                  setAssigneeSearch('');
                                }}
                              >
                                <View style={styles.pickerAvatar}>
                                  <Text style={styles.pickerAvatarText}>{initial}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.pickerDropdownName, { color: txt }]}>{name}</Text>
                                  {!!u.email && (
                                    <Text style={[styles.pickerDropdownEmail, { color: sub }]} numberOfLines={1}>{u.email}</Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}
                      <TouchableOpacity
                        style={[styles.pickerDropdownClose, { borderTopColor: bdr }]}
                        onPress={() => { setAssigneeDropdownOpen(false); setAssigneeSearch(''); }}
                      >
                        <Text style={[styles.pickerDropdownCloseText, { color: '#4ECDC4' }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {/* Links */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Links</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt, marginBottom: 14 },
                  ]}
                  placeholder="Paste URL here..."
                  placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  value={links}
                  onChangeText={setLinks}
                  autoCapitalize="none"
                />

                {/* Attachments */}
                <Text style={[styles.fieldLabel, { color: sub }]}>Attachments</Text>
                <View style={styles.attachRow}>
                  <TouchableOpacity
                    style={[styles.attachBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                    onPress={openCamera}
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
                  >
                    <View style={[styles.attachIconWrap, { backgroundColor: card, borderColor: bdr }]}>
                      <Text style={{ fontSize: 22 }}>🖼️</Text>
                    </View>
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

                {/* Buttons */}
                <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: bdr, backgroundColor: card }]}
                    onPress={() => closeModal(true)}
                    disabled={saving}
                  >
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
          <Animated.View style={[styles.topModal, { transform: [{ translateY: genSlideAnim }] }]}>
            <SafeAreaView>
              <View style={styles.handle} />
              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>✦ Generate Task by AI</Text>
                    <Text style={{ fontSize: 12, color: '#A78BFA', marginTop: 2 }}>Let Nova AI create a comprehensive task</Text>
                  </View>
                  <TouchableOpacity style={styles.closeCircle} onPress={closeGenModal}>
                    <Text style={styles.closeCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Project *</Text>
                <TextInput
                  style={[styles.input, genProject && { borderColor: '#A78BFA', backgroundColor: '#fff' }]}
                  placeholder="Search project..."
                  placeholderTextColor="#AAAABC"
                  value={genProject ? genProject.name : genProjectSearch}
                  onChangeText={t => { setGenProjectSearch(t); setGenProject(null); }}
                />
                {!genProject && genProjectSearch.length > 0 && genFilteredProjects.length > 0 && (
                  <View style={styles.searchList}>
                    {genFilteredProjects.slice(0, 5).map((p, i) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.searchItem, i === Math.min(genFilteredProjects.length, 5) - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => { setGenProject(p); setGenProjectSearch(''); }}
                      >
                        <Text style={styles.searchItemText}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={styles.fieldLabel}>Description *</Text>
                <TextInput
                  style={[styles.input, { height: 120, paddingTop: 12 }]}
                  placeholder="Describe what you want AI to generate. Be specific about requirements and deliverables..."
                  placeholderTextColor="#AAAABC"
                  value={genDescription}
                  onChangeText={setGenDescription}
                  multiline
                  textAlignVertical="top"
                />

                <View style={{ backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: '#A78BFA', lineHeight: 18 }}>
                    ✦ Nova AI will automatically set the title, description, priority, dates and assign team members based on your project.
                  </Text>
                </View>

                <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeGenModal} disabled={generating}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.aiGenerateBtn, generating && { opacity: 0.7 }]} onPress={generateTaskByAI} disabled={generating}>
                    {generating
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.newBtnText}>✦ Generate Task</Text>
                    }
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}

      {/* Task Detail Modal (full-screen slide-in from right) */}
      <TaskDetailModal
        visible={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onUpdated={(updatedTask) => {
          // Refresh task list and update the currently-open task with server response
          fetchTasks();
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
  aiBtn: { backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' },
  aiBtnText: { color: '#A78BFA', fontSize: 13, fontWeight: '700' },
  aiGenerateBtn: { flex: 1, backgroundColor: '#7C3AED', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  filtersWrap: { borderBottomWidth: 1, maxHeight: 50 },
  filters: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center', flexDirection: 'row' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: '#fff', height: 32, justifyContent: 'center', alignItems: 'center' },
  chipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  chipText: { fontSize: 12, color: '#888899', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  taskCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  typeIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  taskName: { fontSize: 14, fontWeight: '600' },
  taskProject: { fontSize: 11, marginTop: 2 },
  taskDate: { fontSize: 11, marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  dueDateText: { fontSize: 10, fontWeight: '600' },
  taskDesc: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
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
  searchList: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', marginTop: -10, marginBottom: 14 },
  searchItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  searchItemText: { fontSize: 13, color: '#1A1A2E' },
  assigneeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  assigneeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#EBEBF0', backgroundColor: '#F5F5F7' },
  assigneeChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  assigneeText: { fontSize: 12, color: '#1A1A2E', fontWeight: '500' },
  attachRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  attachBtn: { flex: 1, backgroundColor: '#F5F5F7', borderRadius: 12, borderWidth: 1.5, borderColor: '#EBEBF0', paddingVertical: 12, alignItems: 'center', gap: 3 },
  attachIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 2, borderWidth: 1, borderColor: '#EBEBF0' },
  attachLabel: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  attachSub: { fontSize: 10, color: '#AAAABC' },
  previewImg: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0' },
  removeImg: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F87171', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  submitBtn: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  // Assignee picker (web-style)
  assigneePickerBox: {
    minHeight: 48, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6,
    marginBottom: 4, flexDirection: 'row', alignItems: 'center',
  },
  assigneePickerInner: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  pickerCloseBtn: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 4,
  },
  pickerCloseBtnText: { fontSize: 16, fontWeight: '700' },
  pickerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(78,205,196,0.12)', borderRadius: 16,
    paddingLeft: 10, paddingRight: 6, paddingVertical: 5,
  },
  pickerChipText: { fontSize: 12, color: '#0F766E', fontWeight: '600' },
  pickerChipX: { fontSize: 16, color: '#0F766E', fontWeight: '700', paddingHorizontal: 2, lineHeight: 18 },
  pickerInput: { flex: 1, fontSize: 13, paddingVertical: 4, paddingHorizontal: 4 },
  pickerDropdown: {
    borderWidth: 1, borderRadius: 10, marginTop: 6, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    maxHeight: 280,
  },
  pickerDropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  pickerAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center',
  },
  pickerAvatarText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  pickerDropdownName: { fontSize: 13, fontWeight: '600' },
  pickerDropdownEmail: { fontSize: 11, marginTop: 1 },
  pickerDropdownEmpty: { fontSize: 12, fontStyle: 'italic', paddingHorizontal: 12, paddingVertical: 14, textAlign: 'center' },
  pickerDropdownClose: {
    borderTopWidth: 1, paddingVertical: 10, alignItems: 'center',
  },
  pickerDropdownCloseText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  enhanceWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  enhanceBtn: { width: 38, height: 46, borderRadius: 10, backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.3)', justifyContent: 'center', alignItems: 'center' },
  enhanceIcon: { fontSize: 18 },
  enhanceHint: { fontSize: 10, color: '#A78BFA', marginBottom: 12, marginLeft: 2 },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
});
