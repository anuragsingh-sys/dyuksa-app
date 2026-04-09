import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Platform, Image, Alert, ScrollView,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';

const STATUS_COLORS = {
  'Todo':        { bg: '#F0F0F5',                    text: '#888899' },
  'In Progress': { bg: 'rgba(78,205,196,0.12)',       text: '#4ECDC4' },
  'Done':        { bg: 'rgba(74,222,128,0.12)',        text: '#4ADE80' },
};
const STATUS_OPTIONS = ['Todo', 'In Progress', 'Done'];

export default function TasksScreen() {
  const navigation = useNavigation();
  const [tasks,  setTasks]  = useState([]);
  const [filter, setFilter] = useState('All');

  // Reload every time the tab is focused (picks up new quick tasks)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(STORAGE_KEY).then(data =>
        setTasks(data ? JSON.parse(data) : [])
      );
    }, [])
  );

  const save = async (updated) => {
    setTasks(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const cycleStatus = (id) => {
    const updated = tasks.map(t => {
      if (t.id !== id) return t;
      const next = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(t.status) + 1) % STATUS_OPTIONS.length];
      return { ...t, status: next };
    });
    save(updated);
  };

  const deleteTask = (id) => {
    Alert.alert('Delete', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => save(tasks.filter(t => t.id !== id)) },
    ]);
  };

  const clearAll = () => {
    Alert.alert('Clear All', 'Delete everything?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => save([]) },
    ]);
  };

  const filtered =
    filter === 'All'    ? tasks :
    filter === 'Events' ? tasks.filter(t => t.type === 'event') :
    tasks.filter(t => t.type === 'task' && t.status === filter);

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* Navbar */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <TouchableOpacity
            style={styles.logoBox}
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.75}
          >
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={styles.brandName}>Tasks</Text>
        </View>
        <View style={styles.navRight}>
          {tasks.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.navIconBtn}><Text style={styles.navIcon}>💬</Text></TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn}><Text style={styles.navIcon}>🔔</Text></TouchableOpacity>
        </View>
      </View>

      {/* Stats bar */}
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

      {/* Filter chips */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filtersWrap}
        contentContainerStyle={styles.filters}
      >
        {['All', 'Todo', 'In Progress', 'Done', 'Events'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{tasks.length === 0 ? '📋' : '🔍'}</Text>
          <Text style={styles.emptyTitle}>
            {tasks.length === 0 ? 'No tasks yet' : `No ${filter.toLowerCase()} items`}
          </Text>
          <Text style={styles.emptySubtitle}>
            {tasks.length === 0
              ? 'Tap the ＋ button to add your first task'
              : 'Try a different filter'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={[
                  styles.typeIcon,
                  { backgroundColor: item.type === 'event' ? 'rgba(167,139,250,0.15)' : 'rgba(78,205,196,0.12)' }
                ]}>
                  <Text style={styles.typeIconText}>{item.type === 'event' ? '📅' : '📋'}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                </View>

                {/* Status — tap to cycle (tasks only) */}
                <TouchableOpacity
                  style={[
                    styles.statusBadge,
                    { backgroundColor: item.type === 'event'
                        ? 'rgba(167,139,250,0.12)'
                        : STATUS_COLORS[item.status]?.bg }
                  ]}
                  onPress={() => item.type === 'task' && cycleStatus(item.id)}
                  activeOpacity={item.type === 'task' ? 0.7 : 1}
                >
                  <Text style={[
                    styles.statusText,
                    { color: item.type === 'event' ? '#A78BFA' : STATUS_COLORS[item.status]?.text }
                  ]}>
                    {item.type === 'event' ? 'Event' : item.status}
                  </Text>
                </TouchableOpacity>

                {/* Delete */}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTask(item.id)}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              {!!item.description && (
                <Text style={styles.cardDesc}>{item.description}</Text>
              )}

              {/* Event date */}
              {item.type === 'event' && !!item.eventDate && (
                <View style={styles.eventDateRow}>
                  <Text style={styles.eventDateIcon}>🕐</Text>
                  <Text style={styles.eventDateText}>{item.eventDate}</Text>
                </View>
              )}

              {/* Images */}
              {item.images?.length > 0 && (
                <View style={styles.imageSection}>
                  <Text style={styles.imageSectionLabel}>
                    📎 {item.images.length} image{item.images.length > 1 ? 's' : ''}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {item.images.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={styles.thumbnail} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Sync note */}
              <View style={styles.syncNote}>
                <Text style={styles.syncNoteText}>
                  💾 Saved locally · Will sync to server when backend is connected
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: '#F5F5F7',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  navbar: {
    backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#EBEBF0', elevation: 2,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#F87171' },
  clearBtnText: { color: '#F87171', fontSize: 12, fontWeight: '600' },

  statsBar: { backgroundColor: '#fff', flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
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

  list: { padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#EBEBF0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  typeIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  typeIconText: { fontSize: 18 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  cardDate: { fontSize: 11, color: '#AAAABC', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 15 },
  cardDesc: { fontSize: 13, color: '#5C5C6E', lineHeight: 20, marginBottom: 8 },
  eventDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  eventDateIcon: { fontSize: 13 },
  eventDateText: { fontSize: 12, color: '#A78BFA', fontWeight: '500' },
  imageSection: { marginBottom: 10 },
  imageSectionLabel: { fontSize: 12, color: '#888899', fontWeight: '500', marginBottom: 8 },
  thumbnail: { width: 80, height: 80, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#EBEBF0' },
  syncNote: { backgroundColor: 'rgba(78,205,196,0.06)', borderRadius: 6, padding: 6, marginTop: 4 },
  syncNoteText: { fontSize: 10, color: '#4ECDC4', fontWeight: '500' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 60 },
  emptyIcon: { fontSize: 52, opacity: 0.3 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  emptySubtitle: { fontSize: 13, color: '#888899', textAlign: 'center', paddingHorizontal: 40 },
});
