import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Animated, Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useContext, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { NotificationsContext } from '../context/NotificationsContext';
import { AuthContext } from '../context/AuthContext';
import { getUsers, getProjects, createProject } from '../services/ApiService';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

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

// ── Inline dropdown (no nested Modal — works inside Modal on iOS) ────────────
function InlineDropdown({ options, selected, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={[pk.trigger, open && pk.triggerOpen]}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={[pk.triggerText, !selected && { color: '#AAAABC' }]} numberOfLines={1}>
          {selected || placeholder}
        </Text>
        <Text style={pk.arrow}>{open ? '▲' : '▾'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={pk.list}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[pk.item, i === options.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[pk.itemText, selected === opt.label && { color: '#4ECDC4', fontWeight: '700' }]}>
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

  const fetchUsers = async () => {
    try {
      const list = await getUsers();
      console.log('Users loaded:', list.length);
      setUsers(list);
    } catch (e) {
      console.error('fetchUsers error:', e.message);
    }
  };

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
          <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.navigate('Chat')}>
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
            <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
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
            </View>
          )}
        />
      )}

      {/* ── Create Project Modal ── */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.topModal, { transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={styles.handle} />
              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Create Project</Text>
                  <TouchableOpacity style={styles.closeCircle} onPress={closeModal}>
                    <Text style={styles.closeCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Project Name */}
                <Text style={styles.fieldLabel}>Project Name *</Text>
                <TextInput
                  placeholder="Enter project name..."
                  placeholderTextColor="#AAAABC"
                  style={styles.input}
                  value={projectName}
                  onChangeText={setProjectName}
                  autoFocus
                />

                {/* Assigned To */}
                <Text style={styles.fieldLabel}>Assigned To</Text>
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
                        <TouchableOpacity style={styles.removeRowBtn} onPress={() => removeMemberRow(i)}>
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
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Task Type *</Text>
                <View style={{ marginBottom: 14, zIndex: 100 }}>
                  <InlineDropdown
                    placeholder="Select Task Type..."
                    options={typeOptions}
                    selected={taskType ? TASK_TYPE_LABELS[taskType] : null}
                    onSelect={t => setTaskType(t.value)}
                  />
                </View>

                {/* Attach Images */}
                <Text style={styles.fieldLabel}>Attach Images</Text>
                <View style={styles.attachRow}>
                  <TouchableOpacity style={styles.attachBtn} onPress={openCamera} activeOpacity={0.8}>
                    <View style={styles.attachIconWrap}><Text style={{ fontSize: 22 }}>📷</Text></View>
                    <Text style={styles.attachLabel}>Camera</Text>
                    <Text style={styles.attachSub}>Take a photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachBtn} onPress={openGallery} activeOpacity={0.8}>
                    <View style={styles.attachIconWrap}><Text style={{ fontSize: 22 }}>🖼️</Text></View>
                    <Text style={styles.attachLabel}>Gallery</Text>
                    <Text style={styles.attachSub}>Pick from photos</Text>
                  </TouchableOpacity>
                </View>

                {projectImages.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>
                      {projectImages.length} image{projectImages.length > 1 ? 's' : ''} attached
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {projectImages.map((uri, i) => (
                        <View key={i} style={{ position: 'relative', marginRight: 10 }}>
                          <Image source={{ uri }} style={styles.previewImg} />
                          <TouchableOpacity style={styles.removeImg} onPress={() => setProjectImages(p => p.filter((_, idx) => idx !== i))}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Buttons */}
                <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.newBtn, saving && { opacity: 0.7 }]} onPress={addProject} disabled={saving}>
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.newBtnText}>Create Project</Text>
                    }
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
});
