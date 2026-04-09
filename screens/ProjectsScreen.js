import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';

const STATUS_COLORS = { 'In Progress': '#4ECDC4', 'Completed': '#4ADE80', 'On Hold': '#FBBF24' };

export default function ProjectsScreen() {
  const navigation = useNavigation();
  const [projects, setProjects] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [projectName, setProjectName] = useState('');

  const addProject = () => {
    if (!projectName.trim()) return;
    setProjects([{ id: Date.now().toString(), name: projectName.trim(), status: 'In Progress', tasks: 0 }, ...projects]);
    setProjectName(''); setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <TouchableOpacity style={styles.logoBox} onPress={() => navigation.navigate('Dashboard')} activeOpacity={0.75}>
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={styles.brandName}>Projects</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn}><Text style={styles.navIcon}>💬</Text></TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn}><Text style={styles.navIcon}>🔔</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.subHeader}>
        <View>
          <Text style={styles.headerTitle}>Projects</Text>
          <Text style={styles.headerSub}>{projects.length} project{projects.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.createBtnText}>+ New Project</Text>
        </TouchableOpacity>
      </View>
      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No projects yet</Text>
          <Text style={styles.emptySubtitle}>Create your first project</Text>
          <TouchableOpacity style={[styles.createBtn, { marginTop: 8 }]} onPress={() => setModalVisible(true)}>
            <Text style={styles.createBtnText}>+ Create Project</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList data={projects} keyExtractor={i => i.id} contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.projectIcon}><Text style={styles.projectIconText}>{item.name.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.projectName}>{item.name}</Text>
                  <Text style={styles.projectMeta}>{item.tasks} tasks</Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[item.status] }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.progressBg}><View style={[styles.progressFill, { width: '0%' }]} /></View>
            </View>
          )}
        />
      )}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create New Project</Text>
            <TextInput placeholder="Project name..." placeholderTextColor="#5C5C6E" style={styles.modalInput} value={projectName} onChangeText={setProjectName} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); setProjectName(''); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={addProject}>
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  headerSub: { fontSize: 12, color: '#888899', marginTop: 2 },
  createBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  list: { padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#EBEBF0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  projectIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  projectIconText: { color: '#4ECDC4', fontSize: 16, fontWeight: '700' },
  projectName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  projectMeta: { fontSize: 12, color: '#888899', marginTop: 2 },
  statusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  progressBg: { height: 4, backgroundColor: '#F0F0F5', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#4ECDC4', borderRadius: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 48, opacity: 0.3 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  emptySubtitle: { fontSize: 13, color: '#888899' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  modalInput: { backgroundColor: '#F0F0F5', borderRadius: 10, paddingHorizontal: 14, height: 50, fontSize: 15, color: '#1A1A2E', marginBottom: 20, borderWidth: 1.5, borderColor: '#4ECDC4' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
});
