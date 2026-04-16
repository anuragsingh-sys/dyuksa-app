import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform,
  Modal, TextInput, Alert, Animated, Image, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef, useCallback, useState, useContext, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';

const STORAGE_KEY     = 'DYUKSA_QUICK_TASKS';
const TASKS_STORAGE   = 'DYUKSA_DASHBOARD_TASKS';   // in-progress tasks live here

// ─── Add Task Modal ──────────────────────────────────────────────────────────
function AddTaskModal({ visible, onClose, onSaved }) {
  const [taskName,  setTaskName]  = useState('');
  const [taskDesc,  setTaskDesc]  = useState('');
  const [images,    setImages]    = useState([]);
  const slideAnim = useRef(new Animated.Value(-700)).current;
  const animated  = useRef(false);

  useEffect(() => {
    if (visible && !animated.current) {
      animated.current = true;
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    }
  }, [visible]);

  const closeModal = (cb) => {
    animated.current = false;
    Animated.timing(slideAnim, { toValue: -700, duration: 250, useNativeDriver: true })
      .start(() => { setTaskName(''); setTaskDesc(''); setImages([]); onClose(); cb && cb(); });
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

  const handleSave = async () => {
    if (!taskName.trim()) { Alert.alert('Required', 'Enter a task name.'); return; }
    const newTask = {
      id: Date.now().toString(),
      name: taskName.trim(),
      description: taskDesc.trim(),
      images,
      createdAt: new Date().toISOString(),
      status: 'In Progress',
    };
    try {
      const existing = await AsyncStorage.getItem(TASKS_STORAGE);
      const updated  = [newTask, ...(existing ? JSON.parse(existing) : [])];
      await AsyncStorage.setItem(TASKS_STORAGE, JSON.stringify(updated));
      closeModal(() => onSaved && onSaved(updated));
    } catch { Alert.alert('Error', 'Could not save task.'); }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeModal()}>
      <TouchableOpacity style={mStyles.overlay} activeOpacity={1} onPress={() => closeModal()} />
      <Animated.View style={[mStyles.topPanel, { transform: [{ translateY: slideAnim }] }]}>
        <SafeAreaView>
          <View style={mStyles.handle} />
          <ScrollView style={mStyles.panelScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={mStyles.panelHeader}>
              <Text style={mStyles.panelTitle}>Add Task</Text>
              <TouchableOpacity style={mStyles.closeCircle} onPress={() => closeModal()}>
                <Text style={mStyles.closeCircleText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Task Name */}
            <Text style={mStyles.label}>Task Name *</Text>
            <TextInput
              style={mStyles.input}
              placeholder="What needs to be done?"
              placeholderTextColor="#AAAABC"
              value={taskName}
              onChangeText={setTaskName}
            />

            {/* Description */}
            <Text style={mStyles.label}>Description</Text>
            <TextInput
              style={[mStyles.input, mStyles.inputMulti]}
              placeholder="Add details..."
              placeholderTextColor="#AAAABC"
              value={taskDesc}
              onChangeText={setTaskDesc}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Attach Images */}
            <Text style={mStyles.label}>Attach Images</Text>
            <View style={mStyles.attachRow}>
              <TouchableOpacity style={mStyles.attachBtn} onPress={openCamera} activeOpacity={0.8}>
                <View style={mStyles.attachIconWrap}>
                  <Text style={mStyles.attachIcon}>📷</Text>
                </View>
                <Text style={mStyles.attachLabel}>Camera</Text>
                <Text style={mStyles.attachSub}>Take a photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={mStyles.attachBtn} onPress={openGallery} activeOpacity={0.8}>
                <View style={mStyles.attachIconWrap}>
                  <Text style={mStyles.attachIcon}>🖼️</Text>
                </View>
                <Text style={mStyles.attachLabel}>Gallery</Text>
                <Text style={mStyles.attachSub}>Pick from photos</Text>
              </TouchableOpacity>
            </View>

            {/* Image previews */}
            {images.length > 0 && (
              <View style={mStyles.previewSection}>
                <Text style={mStyles.previewCount}>{images.length} image{images.length > 1 ? 's' : ''} attached</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {images.map((uri, i) => (
                    <View key={i} style={mStyles.previewWrap}>
                      <Image source={{ uri }} style={mStyles.previewImg} />
                      <TouchableOpacity style={mStyles.removeImg} onPress={() => setImages(p => p.filter((_, idx) => idx !== i))}>
                        <Text style={mStyles.removeImgText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Info note */}
            <View style={mStyles.infoBox}>
              <Text style={mStyles.infoText}>
                💡 Task saved locally on your device.{'\n'}
                Will sync to the DYUKSA server once backend is connected.
              </Text>
            </View>

            {/* Actions */}
            <View style={mStyles.actionRow}>
              <TouchableOpacity style={mStyles.cancelBtn} onPress={() => closeModal()}>
                <Text style={mStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={mStyles.saveBtn} onPress={handleSave}>
                <Text style={mStyles.saveText}>Save Task</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// ─── Dashboard Screen ────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';

  const route = useRoute();
  const scrollRef        = useRef(null);
  const quickActionsRef  = useRef(null);

  const [quickNotes,    setQuickNotes]    = useState([]);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [inProgressTasks, setInProgressTasks] = useState([]);
  const [addTaskVisible,  setAddTaskVisible]  = useState(false);

  // Load quick notes & in-progress tasks on focus
  useFocusEffect(useCallback(() => {
    // Quick notes
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) setQuickNotes(JSON.parse(data).filter(e => e.type === 'task').slice(0, 5));
      else setQuickNotes([]);
    });

    // In-progress tasks
    AsyncStorage.getItem(TASKS_STORAGE).then(data => {
      if (data) setInProgressTasks(JSON.parse(data));
      else setInProgressTasks([]);
    });

    // Scroll-to-notes param
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
  }, [route.params?.scrollToNotes]));

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
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
    catch { return ''; }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#0D0D0F' : '#fff'}
        translucent={false}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        visible={addTaskVisible}
        onClose={() => setAddTaskVisible(false)}
        onSaved={(updated) => setInProgressTasks(updated)}
      />

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
          <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn}>
            <Text style={styles.navIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Welcome Header */}
      <View style={[styles.pageHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <Text style={[styles.welcomeText, { color: txt }]}>Welcome back, Anurag!</Text>
        <Text style={[styles.subText, { color: sub }]}>Here's a quick overview of your workspace.</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Section 1 — In Progress ── */}
        <View style={[styles.card, styles.fixedCard, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt }]}>In Progress ▾</Text>
            {/* ＋ Add Task button */}
            <TouchableOpacity style={styles.addTaskBtn} onPress={() => setAddTaskVisible(true)}>
              <Text style={styles.addTaskIcon}>＋</Text>
              <Text style={styles.addTaskLabel}>Add Task</Text>
            </TouchableOpacity>
          </View>

          {inProgressTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🕐</Text>
              <Text style={[styles.emptyLabel, { color: sub }]}>No in-progress tasks assigned to you</Text>
              <Text style={[styles.emptySubLabel, { color: sub }]}>Tap ＋ Add Task to create one</Text>
            </View>
          ) : (
            inProgressTasks.map((task, index) => (
              <View
                key={task.id}
                style={[
                  styles.taskRow,
                  { borderBottomColor: bdr },
                  index === inProgressTasks.length - 1 && { borderBottomWidth: 0, marginBottom: 0 },
                ]}
              >
                <View style={styles.taskDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskName, { color: txt }]} numberOfLines={1}>{task.name}</Text>
                  {!!task.description && (
                    <Text style={[styles.taskDesc, { color: sub }]} numberOfLines={2}>{task.description}</Text>
                  )}
                  <Text style={[styles.taskDate, { color: sub }]}>{formatDate(task.createdAt)}</Text>
                </View>
                {/* Show image count badge if images attached */}
                {task.images?.length > 0 && (
                  <View style={styles.imgBadge}>
                    <Text style={styles.imgBadgeText}>📎 {task.images.length}</Text>
                  </View>
                )}
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>In Progress</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Section 2 — Recent Documents ── */}
        <View style={[styles.card, styles.fixedCard, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt }]}>Recent Documents</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Docs')}>
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyLabel, { color: sub }]}>No documents yet</Text>
          </View>
        </View>

        {/* ── Section 3 — Favourite Projects ── */}
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt }]}>Favourite Projects</Text>
            <TouchableOpacity onPress={() => {
              try { navigation.jumpTo('Projects'); } catch { navigation.navigate('Main', { screen: 'Projects' }); }
            }}>
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={[styles.emptyLabel, { color: sub }]}>No projects yet</Text>
          </View>
        </View>

        {/* ── Section 4 — Quick Actions ── */}
        <View ref={quickActionsRef} style={[styles.card, { marginBottom: 24, backgroundColor: card, borderColor: bdr }]}>
          <Text style={[styles.cardTitle, { color: txt }]}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => {
                try { navigation.jumpTo('Calendar'); } catch { navigation.navigate('Main', { screen: 'Calendar' }); }
              }}
            >
              <Text style={styles.quickIcon}>📅</Text>
              <Text style={styles.quickLabel}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => {
                try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Main', { screen: 'Tasks' }); }
              }}
            >
              <Text style={styles.quickIcon}>📋</Text>
              <Text style={styles.quickLabel}>My Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => navigation.navigate('Docs')}
            >
              <Text style={styles.quickIcon}>📄</Text>
              <Text style={styles.quickLabel}>Documents</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }, notesExpanded && styles.quickBtnActive]}
              onPress={handleQuickNotesPress}
            >
              <Text style={styles.quickIcon}>⚡</Text>
              <Text style={[styles.quickLabel, notesExpanded && styles.quickLabelActive]}>
                Quick{'\n'}Notes
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline Quick Notes panel */}
          {notesExpanded && (
            <View style={styles.notesPanel}>
              <View style={styles.notesPanelHeader}>
                <Text style={[styles.notesPanelTitle, { color: txt }]}>⚡ Quick Notes</Text>
                <TouchableOpacity onPress={() => setNotesExpanded(false)}>
                  <Text style={styles.notesCollapse}>✕</Text>
                </TouchableOpacity>
              </View>
              {quickNotes.length === 0 ? (
                <View style={styles.notesEmpty}>
                  <Text style={styles.notesEmptyText}>No notes yet — tap ＋ to create one</Text>
                </View>
              ) : (
                quickNotes.map((note, index) => (
                  <View
                    key={note.id}
                    style={[
                      styles.noteCard,
                      { borderBottomColor: bdr },
                      index === quickNotes.length - 1 && { borderBottomWidth: 0, marginBottom: 0 },
                    ]}
                  >
                    <View style={styles.noteLine} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.noteName, { color: txt }]} numberOfLines={1}>{note.name}</Text>
                      {!!note.description && (
                        <Text style={[styles.noteDesc, { color: sub }]} numberOfLines={2}>{note.description}</Text>
                      )}
                      <Text style={[styles.noteDate, { color: sub }]}>{formatDate(note.createdAt)}</Text>
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

// ─── Modal Styles ────────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topPanel: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  panelScroll: { paddingHorizontal: 20 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 4 },
  panelTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  inputMulti: { height: 80, paddingTop: 12 },
  attachRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  attachBtn: { flex: 1, backgroundColor: '#F5F5F7', borderRadius: 12, borderWidth: 1.5, borderColor: '#EBEBF0', paddingVertical: 14, alignItems: 'center', gap: 4 },
  attachIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderWidth: 1, borderColor: '#EBEBF0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  attachIcon: { fontSize: 24 },
  attachLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  attachSub: { fontSize: 11, color: '#AAAABC' },
  previewSection: { marginBottom: 14 },
  previewCount: { fontSize: 12, color: '#888899', fontWeight: '500', marginBottom: 8 },
  previewWrap: { position: 'relative', marginRight: 10 },
  previewImg: { width: 88, height: 88, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0' },
  removeImg: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#F87171', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  removeImgText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  infoBox: { backgroundColor: 'rgba(78,205,196,0.08)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.25)', borderRadius: 10, padding: 12, marginBottom: 16 },
  infoText: { fontSize: 12, color: '#4ECDC4', lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: '#888899', fontSize: 15, fontWeight: '500' },
  saveBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Screen Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },
  pageHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  welcomeText: { fontSize: 18, fontWeight: '700' },
  subText: { fontSize: 12, marginTop: 2 },
  scroll: { flex: 1, padding: 12 },
  card: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  fixedCard: { minHeight: 160 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  viewAll: { fontSize: 12, color: '#888899' },
  emptyState: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  emptyIcon: { fontSize: 28, opacity: 0.3 },
  emptyLabel: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
  emptySubLabel: { fontSize: 11, textAlign: 'center' },

  // ＋ Add Task button in In Progress header
  addTaskBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  addTaskIcon: { color: '#4ECDC4', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  addTaskLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // In-progress task rows
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, marginBottom: 2 },
  taskDot: { width: 3, height: 40, backgroundColor: '#4ECDC4', borderRadius: 2, marginTop: 2 },
  taskName: { fontSize: 13, fontWeight: '600' },
  taskDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  taskDate: { fontSize: 11, marginTop: 4 },
  imgBadge: { backgroundColor: 'rgba(78,205,196,0.1)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
  imgBadgeText: { fontSize: 10, color: '#4ECDC4', fontWeight: '600' },
  statusBadge: { backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  statusBadgeText: { fontSize: 10, color: '#FBBF24', fontWeight: '600' },

  // Quick Actions
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: { width: '48%', alignItems: 'center', paddingVertical: 18, borderRadius: 10, borderWidth: 1, gap: 8 },
  quickBtnActive: { borderColor: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.06)' },
  quickIcon: { fontSize: 26 },
  quickLabel: { fontSize: 10, color: '#888899', textAlign: 'center', fontWeight: '500', lineHeight: 14 },
  quickLabelActive: { color: '#4ECDC4', fontWeight: '700' },

  // Inline Quick Notes panel
  notesPanel: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F5', paddingTop: 12 },
  notesPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  notesPanelTitle: { fontSize: 13, fontWeight: '700' },
  notesCollapse: { fontSize: 13, color: '#AAAABC', fontWeight: '600', paddingHorizontal: 4 },
  notesEmpty: { paddingVertical: 14, alignItems: 'center' },
  notesEmptyText: { fontSize: 12, color: '#AAAABC' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, marginBottom: 2 },
  noteLine: { width: 3, height: 40, backgroundColor: '#4ECDC4', borderRadius: 2, marginTop: 2 },
  noteName: { fontSize: 13, fontWeight: '600' },
  noteDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  noteDate: { fontSize: 11, marginTop: 4 },
  noteBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  noteBadgeText: { fontSize: 10, fontWeight: '600' },
});
