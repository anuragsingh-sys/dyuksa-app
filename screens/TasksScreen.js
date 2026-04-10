import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Image, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useContext } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationsContext } from '../context/NotificationsContext';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';
const STATUS_OPTIONS = ['Todo', 'In Progress', 'Done'];
const STATUS_COLORS  = { 'Todo': '#888899', 'In Progress': '#4ECDC4', 'Done': '#4ADE80' };

export default function TasksScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const { addNotification } = useContext(NotificationsContext);
  const [tasks,  setTasks]  = useState([]);
  const [filter, setFilter] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  // Modal slides from top so keyboard doesn't hide it
  const slideAnim = useRef(new Animated.Value(-400)).current;
  const animated  = useRef(false);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(d => setTasks(d ? JSON.parse(d) : []));
  }, []));

  const openModal = () => {
    setModalVisible(true);
    animated.current = true;
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeModal = () => {
    animated.current = false;
    Animated.timing(slideAnim, { toValue: -400, duration: 250, useNativeDriver: true })
      .start(() => { setModalVisible(false); setNewTaskName(''); setNewTaskDesc(''); });
  };

  const addTask = async () => {
    if (!newTaskName.trim()) { Alert.alert('Required', 'Enter a task name.'); return; }
    const newEntry = {
      id: Date.now().toString(), type: 'task',
      name: newTaskName.trim(), description: newTaskDesc.trim(),
      eventDate: '', images: [],
      createdAt: new Date().toISOString(), status: 'Todo',
    };
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const updated  = [newEntry, ...(existing ? JSON.parse(existing) : [])];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setTasks(updated);
    addNotification({ type: 'task', icon: '📋', title: 'Task Created', body: `"${newEntry.name}" has been added to your tasks.` });
    closeModal();
  };

  const save = async (updated) => { setTasks(updated); await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); };
  const cycleStatus = id => save(tasks.map(t => t.id !== id ? t : { ...t, status: STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(t.status) + 1) % STATUS_OPTIONS.length] }));
  const deleteTask  = id => Alert.alert('Delete', 'Remove this item?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => save(tasks.filter(t => t.id !== id)) },
  ]);

  const filtered =
    filter === 'All'    ? tasks :
    filter === 'Events' ? tasks.filter(t => t.type === 'event') :
    tasks.filter(t => t.type === 'task' && t.status === filter);

  const formatDate = iso => {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0D0D0F" : "#fff"} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Tasks" />
          <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
          <Text style={[styles.brandName, { color: txt }]}>Tasks</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Sub header with + New Task button */}
      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View>
          <Text style={[styles.pageTitle, { color: txt }]}>Tasks</Text>
          <Text style={[styles.pageSub, { color: sub }]}>{tasks.filter(t => t.type === 'task').length} task{tasks.filter(t => t.type === 'task').length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={openModal}>
          <Text style={styles.newBtnText}>+ New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        {[
          { label: 'Tasks',  value: tasks.filter(t => t.type === 'task').length,  color: '#1A1A2E' },
          { label: 'Events', value: tasks.filter(t => t.type === 'event').length, color: '#A78BFA' },
          { label: 'Done',   value: tasks.filter(t => t.status === 'Done').length, color: '#4ADE80' },
          { label: 'Images', value: tasks.reduce((n, t) => n + (t.images?.length || 0), 0), color: '#4ECDC4' },
        ].map((s, i, arr) => (
          <View key={s.label} style={[styles.statItem, i < arr.length - 1 && styles.statBorder]}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersWrap} contentContainerStyle={styles.filters}>
        {['All', 'Todo', 'In Progress', 'Done', 'Events'].map(f => (
          <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, opacity: 0.3 }}>{tasks.length === 0 ? '📋' : '🔍'}</Text>
          <Text style={styles.emptyTitle}>{tasks.length === 0 ? 'No tasks yet' : `No ${filter.toLowerCase()} items`}</Text>
          <Text style={styles.emptySub}>{tasks.length === 0 ? 'Tap "+ New Task" or use the ＋ button' : 'Try a different filter'}</Text>
          {tasks.length === 0 && (
            <TouchableOpacity style={[styles.newBtn, { marginTop: 8 }]} onPress={openModal}>
              <Text style={styles.newBtnText}>+ New Task</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered} keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.taskCard}>
              <View style={styles.cardTop}>
                <View style={[styles.typeIcon, { backgroundColor: item.type === 'event' ? 'rgba(167,139,250,0.15)' : 'rgba(78,205,196,0.12)' }]}>
                  <Text style={{ fontSize: 18 }}>{item.type === 'event' ? '📅' : '📋'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskName}>{item.name}</Text>
                  <Text style={styles.taskDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusBadge, { backgroundColor: item.type === 'event' ? 'rgba(167,139,250,0.12)' : STATUS_COLORS[item.status] + '20' }]}
                  onPress={() => item.type === 'task' && cycleStatus(item.id)}
                >
                  <Text style={[styles.statusText, { color: item.type === 'event' ? '#A78BFA' : STATUS_COLORS[item.status] }]}>
                    {item.type === 'event' ? 'Event' : item.status}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTask(item.id)}>
                  <Text style={{ fontSize: 15 }}>🗑</Text>
                </TouchableOpacity>
              </View>
              {!!item.description && <Text style={styles.taskDesc}>{item.description}</Text>}
              {item.type === 'event' && !!item.eventDate && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 12 }}>🕐</Text>
                  <Text style={{ fontSize: 12, color: '#A78BFA', fontWeight: '500' }}>{item.eventDate}</Text>
                </View>
              )}
              {item.images?.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {item.images.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.thumbnail} />
                  ))}
                </ScrollView>
              )}
              <View style={styles.syncNote}>
                <Text style={{ fontSize: 10, color: '#4ECDC4', fontWeight: '500' }}>💾 Saved locally · Will sync when backend connected</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Add Task Modal — slides from top */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.topModal, { transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={styles.handle} />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Task</Text>
                  <TouchableOpacity style={styles.closeCircle} onPress={closeModal}>
                    <Text style={styles.closeCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Task Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="What needs to be done?"
                  placeholderTextColor="#AAAABC"
                  value={newTaskName}
                  onChangeText={setNewTaskName}
                  autoFocus
                />
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 72, paddingTop: 10 }]}
                  placeholder="Add details..."
                  placeholderTextColor="#AAAABC"
                  value={newTaskDesc}
                  onChangeText={setNewTaskDesc}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.newBtn} onPress={addTask}>
                    <Text style={styles.newBtnText}>Add Task</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },
  subHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  pageSub: { fontSize: 12, color: '#888899', marginTop: 2 },
  newBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  statsBar: { backgroundColor: '#fff', flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  statItem: { flex: 1, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderRightColor: '#EBEBF0' },
  statNum: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#888899', marginTop: 2 },
  filtersWrap: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  filters: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#EBEBF0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  chipText: { fontSize: 12, color: '#888899', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  emptySub: { fontSize: 13, color: '#888899', textAlign: 'center', paddingHorizontal: 40 },
  taskCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#EBEBF0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  typeIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  taskName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  taskDate: { fontSize: 11, color: '#AAAABC', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center' },
  taskDesc: { fontSize: 13, color: '#5C5C6E', lineHeight: 20, marginBottom: 8 },
  thumbnail: { width: 80, height: 80, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#EBEBF0' },
  syncNote: { backgroundColor: 'rgba(78,205,196,0.06)', borderRadius: 6, padding: 6, marginTop: 4 },
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topModal: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  modalContent: { paddingHorizontal: 20, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
});
