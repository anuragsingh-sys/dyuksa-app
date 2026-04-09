import React, { useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, SafeAreaView, StatusBar, Platform, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NavBar from '../components/NavBar';
import { ThemeContext } from '../context/ThemeContext';

export const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';
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

  const [tasks,  setTasks]  = useState([]);
  const [filter, setFilter] = useState('All');

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(d => setTasks(d ? JSON.parse(d) : []));
  }, []));

  const save = async (updated) => { setTasks(updated); await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); };
  const cycleStatus = id => save(tasks.map(t => t.id !== id ? t : { ...t, status: STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(t.status) + 1) % STATUS_OPTIONS.length] }));
  const deleteTask  = id => save(tasks.filter(t => t.id !== id));

  const filtered = filter === 'All' ? tasks : filter === 'Events' ? tasks.filter(t => t.type === 'event') : tasks.filter(t => t.type === 'task' && t.status === filter);

  const formatDate = iso => { try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <NavBar title="Tasks" activeScreen="Tasks" />

      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View>
          <Text style={[styles.headerTitle, { color: txt, fontSize: fs(16) }]}>Tasks</Text>
          <Text style={[styles.headerSub, { color: sub, fontSize: fs(12) }]}>{tasks.length} item{tasks.length !== 1 ? 's' : ''}</Text>
        </View>
        {tasks.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => save([])}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={[styles.statsBar, { backgroundColor: card, borderBottomColor: bdr }]}>
        {[
          { label: 'Tasks',  value: tasks.filter(t => t.type === 'task').length,  color: txt },
          { label: 'Events', value: tasks.filter(t => t.type === 'event').length, color: '#A78BFA' },
          { label: 'Done',   value: tasks.filter(t => t.status === 'Done').length, color: '#4ADE80' },
          { label: 'Images', value: tasks.reduce((n, t) => n + (t.images?.length || 0), 0), color: '#4ECDC4' },
        ].map((s, i, arr) => (
          <View key={s.label} style={[styles.statItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: bdr }]}>
            <Text style={[styles.statNum, { color: s.color, fontSize: fs(20) }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: sub, fontSize: fs(11) }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filtersWrap, { backgroundColor: card, borderBottomColor: bdr }]} contentContainerStyle={styles.filters}>
        {['All', 'Todo', 'In Progress', 'Done', 'Events'].map(f => (
          <TouchableOpacity key={f} style={[styles.chip, { borderColor: bdr }, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipText, { color: sub }, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, opacity: 0.3 }}>{tasks.length === 0 ? '📋' : '🔍'}</Text>
          <Text style={[styles.emptyTitle, { color: txt, fontSize: fs(16) }]}>{tasks.length === 0 ? 'No tasks yet' : `No ${filter.toLowerCase()} items`}</Text>
          <Text style={[styles.emptySub, { color: sub, fontSize: fs(13) }]}>{tasks.length === 0 ? 'Tap the ＋ button to add your first task' : 'Try a different filter'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered} keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.taskCard, { backgroundColor: card, borderColor: bdr }]}>
              <View style={styles.cardTop}>
                <View style={[styles.typeIcon, { backgroundColor: item.type === 'event' ? 'rgba(167,139,250,0.15)' : 'rgba(78,205,196,0.12)' }]}>
                  <Text style={{ fontSize: 18 }}>{item.type === 'event' ? '📅' : '📋'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskName, { color: txt, fontSize: fs(14) }]}>{item.name}</Text>
                  <Text style={[styles.taskDate, { color: sub, fontSize: fs(11) }]}>{formatDate(item.createdAt)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusBadge, { backgroundColor: item.type === 'event' ? 'rgba(167,139,250,0.12)' : STATUS_COLORS[item.status] + '20' }]}
                  onPress={() => item.type === 'task' && cycleStatus(item.id)}
                >
                  <Text style={[styles.statusText, { color: item.type === 'event' ? '#A78BFA' : STATUS_COLORS[item.status], fontSize: fs(11) }]}>
                    {item.type === 'event' ? 'Event' : item.status}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTask(item.id)}>
                  <Text style={{ fontSize: 15 }}>🗑</Text>
                </TouchableOpacity>
              </View>
              {!!item.description && <Text style={[styles.taskDesc, { color: sub, fontSize: fs(13) }]}>{item.description}</Text>}
              {item.type === 'event' && !!item.eventDate && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 13 }}>🕐</Text>
                  <Text style={{ fontSize: fs(12), color: '#A78BFA', fontWeight: '500' }}>{item.eventDate}</Text>
                </View>
              )}
              <View style={[styles.syncNote, { backgroundColor: isDark ? 'rgba(78,205,196,0.06)' : 'rgba(78,205,196,0.06)' }]}>
                <Text style={{ fontSize: fs(10), color: '#4ECDC4', fontWeight: '500' }}>💾 Saved locally · Will sync when backend connected</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  subHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontWeight: '700' },
  headerSub: { marginTop: 2 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#F87171' },
  clearBtnText: { color: '#F87171', fontSize: 12, fontWeight: '600' },
  statsBar: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontWeight: '700' },
  statLabel: { marginTop: 2 },
  filtersWrap: { maxHeight: 52, borderBottomWidth: 1 },
  filters: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  chipText: { fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  list: { padding: 12 },
  taskCard: { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  typeIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  taskName: { fontWeight: '600' },
  taskDate: { marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontWeight: '600' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center' },
  taskDesc: { lineHeight: 20, marginBottom: 8 },
  syncNote: { borderRadius: 6, padding: 6, marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontWeight: '600' },
  emptySub: { textAlign: 'center', paddingHorizontal: 40 },
});
