import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, StatusBar, Platform,
  ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NotificationsContext } from '../context/NotificationsContext';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

const FILTERS = ['Client', 'Internal', 'Content Creation', 'Ideas'];
const FILTER_COLORS = { Client: '#3B82F6', Internal: '#4ADE80', 'Content Creation': '#F472B6', Ideas: '#FBBF24' };
const STATUS_COLORS = { 'In Progress': '#4ECDC4', Completed: '#4ADE80', 'On Hold': '#FBBF24' };

export default function ProjectsScreen() {
  const navigation = useNavigation();
  const { theme, fontScale, projectView } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const { addNotification } = useContext(NotificationsContext);
  const [projects,     setProjects]     = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [projectName,  setProjectName]  = useState('');
  const [projectType,  setProjectType]  = useState('Internal');
  const [activeFilter, setActiveFilter] = useState(null);

  // Modal slides from TOP — keyboard won't hide it
  const slideAnim = useRef(new Animated.Value(-500)).current;
  const animated  = useRef(false);

  const openModal = () => {
    setModalVisible(true);
    animated.current = true;
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeModal = () => {
    animated.current = false;
    Animated.timing(slideAnim, { toValue: -500, duration: 250, useNativeDriver: true })
      .start(() => { setModalVisible(false); setProjectName(''); setProjectType('Internal'); });
  };

  const addProject = () => {
    if (!projectName.trim()) return;
    const name = projectName.trim();
    setProjects([{
      id: Date.now().toString(), name,
      type: projectType, status: 'In Progress',
      documents: 0, members: 1, updatedAt: 'Just now', favourite: false,
    }, ...projects]);
    addNotification({ type: 'project', icon: '🗂️', title: 'Project Created', body: `"${name}" project was created successfully.` });
    closeModal();
  };

  const filtered = activeFilter ? projects.filter(p => p.type === activeFilter) : projects;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0D0D0F" : "#fff"} translucent={false} />

      {/* Navbar with shared hamburger */}
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
          <TouchableOpacity style={styles.navIconBtn}>
            <Text style={styles.navIcon}>🔔</Text>
          </TouchableOpacity>
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
      <View style={styles.filterBar}>
        <Text style={styles.filterLabel}>Filter:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(activeFilter === f ? null : f)}
            >
              <View style={[styles.dot, { backgroundColor: FILTER_COLORS[f] }]} />
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, opacity: 0.3 }}>📋</Text>
          <Text style={styles.emptyTitle}>{projects.length === 0 ? 'No projects yet' : 'No matches'}</Text>
          <Text style={styles.emptySub}>{projects.length === 0 ? 'Tap + New Project to create one' : 'Try a different filter'}</Text>
          {projects.length === 0 && (
            <TouchableOpacity style={styles.newBtn} onPress={openModal}>
              <Text style={styles.newBtnText}>+ Create Project</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={projectView === 'Table' ? (
            <View style={[styles.tableHeader, { borderBottomColor: bdr, backgroundColor: card }]}>
              <View style={{ width: 28 }} />
              <Text style={[styles.tableHeaderCell, { flex: 2, color: sub }]}>Name</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, color: sub }]}>Type</Text>
              <Text style={[styles.tableHeaderCell, { color: sub, width: 64 }]}>Status</Text>
              <View style={{ width: 24 }} />
            </View>
          ) : null}
          renderItem={({ item }) =>
            projectView === 'Table' ? (
              // Table row view
              <View style={[styles.tableRow, { borderBottomColor: bdr }]}>
                <View style={[styles.projectIconSm, { backgroundColor: bg }]}>
                  <Text style={{ color: txt, fontSize: 13, fontWeight: '700' }}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.tableCell, { flex: 2, color: txt, fontWeight: '600' }]} numberOfLines={1}>{item.name}</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[styles.dot, { backgroundColor: FILTER_COLORS[item.type] }]} />
                  <Text style={[styles.tableCell, { color: sub, fontSize: 11 }]} numberOfLines={1}>{item.type}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: 'rgba(78,205,196,0.12)' }]}>
                  <Text style={{ fontSize: 10, color: '#4ECDC4', fontWeight: '600' }}>{item.status}</Text>
                </View>
                <TouchableOpacity onPress={() => setProjects(projects.map(p => p.id === item.id ? { ...p, favourite: !p.favourite } : p))}>
                  <Text style={{ fontSize: 16 }}>{item.favourite ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Grid card view
              <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
                <View style={styles.cardTop}>
                  <View style={styles.projectIcon}>
                    <Text style={styles.projectIconText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.projectName, { color: txt }]}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <View style={[styles.dot, { backgroundColor: FILTER_COLORS[item.type] }]} />
                      <Text style={[styles.projectMeta, { color: sub }]}>{item.type}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setProjects(projects.map(p => p.id === item.id ? { ...p, favourite: !p.favourite } : p))}>
                    <Text style={{ fontSize: 18 }}>{item.favourite ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.progressBg, { backgroundColor: bdr }]}>
                  <View style={[styles.progressFill, { width: '0%' }]} />
                </View>
              </View>
            )
          }
        />
      )}

      {/* Modal slides from TOP — safe from keyboard */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.topModal, { transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={styles.handle} />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Project</Text>
                  <TouchableOpacity style={styles.closeCircle} onPress={closeModal}>
                    <Text style={styles.closeCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Project Name *</Text>
                <TextInput
                  placeholder="Enter project name..."
                  placeholderTextColor="#AAAABC"
                  style={styles.input}
                  value={projectName}
                  onChangeText={setProjectName}
                  autoFocus
                />

                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.typeRow}>
                  {FILTERS.map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.typeChip, projectType === f && styles.typeChipActive]}
                      onPress={() => setProjectType(f)}
                    >
                      <View style={[styles.dot, { backgroundColor: FILTER_COLORS[f] }]} />
                      <Text style={[styles.typeChipText, projectType === f && styles.typeChipTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.newBtn} onPress={addProject}>
                    <Text style={styles.newBtnText}>Create</Text>
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

  filterBar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', gap: 8 },
  filterLabel: { fontSize: 13, color: '#888899', fontWeight: '500' },
  filterChips: { flexDirection: 'row', gap: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#EBEBF0' },
  filterChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterChipText: { fontSize: 12, color: '#888899', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  emptySub: { fontSize: 13, color: '#888899', marginBottom: 8 },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EBEBF0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  projectIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  projectIconText: { color: '#4ECDC4', fontSize: 16, fontWeight: '700' },
  projectName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  projectMeta: { fontSize: 11, color: '#888899' },
  progressBg: { height: 4, backgroundColor: '#F0F0F5', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#4ECDC4', borderRadius: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  tableHeaderCell: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  tableCell: { fontSize: 13 },
  projectIconSm: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  statusChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },

  // Top modal styles
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topModal: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  modalContent: { paddingHorizontal: 20, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 16 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#EBEBF0' },
  typeChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  typeChipText: { fontSize: 12, color: '#888899', fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
});
