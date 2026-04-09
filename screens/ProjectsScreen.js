import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, SafeAreaView, StatusBar, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NavBar from '../components/NavBar';
import { ThemeContext } from '../context/ThemeContext';

const FILTERS = ['Client', 'Internal', 'Content Creation', 'Ideas'];
const FILTER_COLORS = { Client: '#3B82F6', Internal: '#4ADE80', 'Content Creation': '#F472B6', Ideas: '#FBBF24' };
const STATUS_COLORS = { 'In Progress': '#4ECDC4', Completed: '#4ADE80', 'On Hold': '#FBBF24' };

export default function ProjectsScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub = isDark ? '#9898A6' : '#888899';
  const bdr = isDark ? '#252530' : '#EBEBF0';
  const fs = s => s * fontScale;

  const [projects, setProjects] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('Internal');
  const [viewMode, setViewMode] = useState('list');
  const [activeFilter, setActiveFilter] = useState(null);

  const addProject = () => {
    if (!projectName.trim()) return;
    setProjects([{ id: Date.now().toString(), name: projectName.trim(), type: projectType, status: 'In Progress', documents: 0, members: 1, updatedAt: 'Just now', favourite: false }, ...projects]);
    setProjectName(''); setProjectType('Internal'); setModalVisible(false);
  };

  const filtered = activeFilter ? projects.filter(p => p.type === activeFilter) : projects;

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: card, borderColor: bdr, ...(viewMode === 'grid' ? { flex: 1, margin: 6 } : { marginBottom: 8 }) }]}>
      <View style={styles.cardTop}>
        <View style={styles.projectIcon}><Text style={styles.projectIconText}>{item.name.charAt(0)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.projectName, { color: txt, fontSize: fs(14) }]}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <View style={[styles.dot, { backgroundColor: FILTER_COLORS[item.type] }]} />
            <Text style={[{ fontSize: fs(11), color: sub }]}>{item.type}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setProjects(projects.map(p => p.id === item.id ? { ...p, favourite: !p.favourite } : p))}>
          <Text style={{ fontSize: 18 }}>{item.favourite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.progressBg, { backgroundColor: bdr }]}><View style={[styles.progressFill, { width: '0%' }]} /></View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <NavBar title="Projects" activeScreen="Projects" />
      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View>
          <Text style={[styles.pageTitle, { color: txt, fontSize: fs(18) }]}>Projects</Text>
          <Text style={[{ fontSize: fs(12), color: sub, marginTop: 2 }]}>Manage Your Projects</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity style={[styles.toggleBtn, { borderColor: bdr, backgroundColor: viewMode === 'list' ? '#1A1A2E' : bg }]} onPress={() => setViewMode('list')}>
            <Text style={{ fontSize: 16, color: viewMode === 'list' ? '#fff' : sub }}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, { borderColor: bdr, backgroundColor: viewMode === 'grid' ? '#1A1A2E' : bg }]} onPress={() => setViewMode('grid')}>
            <Text style={{ fontSize: 16, color: viewMode === 'grid' ? '#fff' : sub }}>⊞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.filterBar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <Text style={[{ fontSize: fs(13), color: sub, fontWeight: '500' }]}>Filter:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 10 }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} style={[styles.filterChip, { borderColor: bdr }, activeFilter === f && { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' }]} onPress={() => setActiveFilter(activeFilter === f ? null : f)}>
              <View style={[styles.dot, { backgroundColor: FILTER_COLORS[f] }]} />
              <Text style={[{ fontSize: fs(12), fontWeight: '500' }, activeFilter === f ? { color: '#fff' } : { color: sub }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, opacity: 0.3 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: txt, fontSize: fs(16) }]}>{projects.length === 0 ? 'No projects yet' : 'No matches'}</Text>
          <Text style={[{ fontSize: fs(13), color: sub, marginBottom: 8 }]}>{projects.length === 0 ? 'Create your first project' : 'Try a different filter'}</Text>
          {projects.length === 0 && <TouchableOpacity style={styles.newBtn} onPress={() => setModalVisible(true)}><Text style={styles.newBtnText}>+ Create Project</Text></TouchableOpacity>}
        </View>
      ) : (
        <FlatList data={filtered} keyExtractor={i => i.id} numColumns={viewMode === 'grid' ? 2 : 1} key={viewMode} contentContainerStyle={{ padding: 12 }} renderItem={renderItem} />
      )}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: card }]}>
            <Text style={[styles.modalTitle, { color: txt, fontSize: fs(18) }]}>New Project</Text>
            <TextInput placeholder="Project name..." placeholderTextColor="#5C5C6E" style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F0F0F5', color: txt, borderColor: '#4ECDC4' }]} value={projectName} onChangeText={setProjectName} autoFocus />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {FILTERS.map(f => (
                <TouchableOpacity key={f} style={[styles.typeChip, { borderColor: bdr }, projectType === f && { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' }]} onPress={() => setProjectType(f)}>
                  <View style={[styles.dot, { backgroundColor: FILTER_COLORS[f] }]} />
                  <Text style={[{ fontSize: fs(12), fontWeight: '500' }, projectType === f ? { color: '#fff' } : { color: sub }]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: bdr }]} onPress={() => { setModalVisible(false); setProjectName(''); }}>
                <Text style={{ color: sub, fontSize: fs(14), fontWeight: '500' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.newBtn} onPress={addProject}>
                <Text style={styles.newBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  subHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontWeight: '700' },
  filterBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  toggleBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  newBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 14, padding: 14, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  projectIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  projectIconText: { color: '#4ECDC4', fontSize: 16, fontWeight: '700' },
  projectName: { fontWeight: '600' },
  progressBg: { height: 4, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#4ECDC4', borderRadius: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontWeight: '700', marginBottom: 16 },
  input: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, height: 50, fontSize: 15, marginBottom: 16 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
});
