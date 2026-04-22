import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef, useCallback, useState, useContext } from 'react';

const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const route = useRoute();
  const scrollRef = useRef(null);
  const quickActionsRef = useRef(null);
  const [quickNotes, setQuickNotes] = useState([]);
  const [notesExpanded, setNotesExpanded] = useState(false);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) {
        const all = JSON.parse(data);
        setQuickNotes(all.filter(e => e.type === 'task').slice(0, 5));
      } else {
        setQuickNotes([]);
      }
    });

    // If navigated here with scrollToNotes param, expand and scroll to Quick Actions
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
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0D0D0F" : "#fff"} translucent={false} />

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
          <TouchableOpacity
            style={[styles.navIconBtn, { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr }]}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Welcome Header */}
      <View style={[styles.pageHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <Text style={[styles.welcomeText, { color: txt }]}>Welcome back, Anurag!</Text>
        <Text style={[styles.subText, { color: sub }]}>Here's a quick overview of your workspace.</Text>
      </View>

      <ScrollView ref={scrollRef} style={[styles.scroll, { backgroundColor: bg }]} showsVerticalScrollIndicator={false}>

        {/* Section 1 — In Progress */}
        <View style={[styles.card, styles.fixedCard, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt }]}>In Progress ▾</Text>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🕐</Text>
            <Text style={[styles.emptyLabel, { color: sub }]}>No in-progress tasks assigned to you</Text>
            <Text style={[styles.emptySubLabel, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>No tasks are currently assigned to you</Text>
          </View>
        </View>

        {/* Section 2 — Recent Documents */}
        <View style={[styles.card, styles.fixedCard, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt }]}>Recent Documents</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Docs')}>
              <Text style={[styles.viewAll, { color: sub }]}>View All →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyLabel, { color: sub }]}>No documents yet</Text>
          </View>
        </View>

        {/* Section 3 — Favourite Projects */}
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: txt }]}>Favourite Projects</Text>
            <TouchableOpacity onPress={() => (() => { try { navigation.jumpTo('Projects'); } catch { navigation.navigate('Main', { screen: 'Projects' }); } })()}>
              <Text style={[styles.viewAll, { color: sub }]}>View All →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={[styles.emptyLabel, { color: sub }]}>No projects yet</Text>
          </View>
        </View>

        {/* Section 4 — Quick Actions (with inline Quick Notes expansion) */}
        <View ref={quickActionsRef} style={[styles.card, { marginBottom: 24, backgroundColor: card, borderColor: bdr }]}>
          <Text style={[styles.cardTitle, { color: txt }]}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => (() => { try { navigation.jumpTo('Calendar'); } catch { navigation.navigate('Main', { screen: 'Calendar' }); } })()}
            >
              <Text style={styles.quickIcon}>📅</Text>
              <Text style={[styles.quickLabel, { color: sub }]}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => (() => { try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Main', { screen: 'Tasks' }); } })()}
            >
              <Text style={styles.quickIcon}>📋</Text>
              <Text style={[styles.quickLabel, { color: sub }]}>My Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }]}
              onPress={() => navigation.navigate('Docs')}
            >
              <Text style={styles.quickIcon}>📄</Text>
              <Text style={[styles.quickLabel, { color: sub }]}>Documents</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: bdr }, notesExpanded && styles.quickBtnActive]}
              onPress={handleQuickNotesPress}
            >
              <Text style={styles.quickIcon}>⚡</Text>
              <Text style={[styles.quickLabel, { color: sub }, notesExpanded && styles.quickLabelActive]}>
                Quick{'\n'}Notes
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline Quick Notes panel — shown when expanded */}
          {notesExpanded && (
            <View style={[styles.notesPanel, { borderTopColor: bdr }]}>
              <View style={styles.notesPanelHeader}>
                <Text style={[styles.notesPanelTitle, { color: txt }]}>⚡ Quick Notes</Text>
                <TouchableOpacity onPress={() => setNotesExpanded(false)}>
                  <Text style={[styles.notesCollapse, { color: sub }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {quickNotes.length === 0 ? (
                <View style={styles.notesEmpty}>
                  <Text style={[styles.notesEmptyText, { color: sub }]}>No notes yet — tap ＋ to create one</Text>
                </View>
              ) : (
                quickNotes.map((note, index) => (
                  <View
                    key={note.id}
                    style={[
                      styles.noteCard,
                      { borderBottomColor: isDark ? '#252530' : '#F5F5F7' },
                      index === quickNotes.length - 1 && { borderBottomWidth: 0, marginBottom: 0 },
                    ]}
                  >
                    <View style={styles.noteLine} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.noteName, { color: txt }]} numberOfLines={1}>{note.name}</Text>
                      {!!note.description && (
                        <Text style={[styles.noteDesc, { color: sub }]} numberOfLines={2}>{note.description}</Text>
                      )}
                      <Text style={[styles.noteDate, { color: isDark ? '#6C6C80' : '#AAAABC' }]}>{formatDate(note.createdAt)}</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', letterSpacing: 1 },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },
  pageHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  welcomeText: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  subText: { fontSize: 12, color: '#888899', marginTop: 2 },
  scroll: { flex: 1, padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EBEBF0' },
  fixedCard: { minHeight: 160 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 10 },
  viewAll: { fontSize: 12, color: '#888899' },
  emptyState: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  emptyIcon: { fontSize: 28, opacity: 0.3 },
  emptyLabel: { fontSize: 13, color: '#888899', textAlign: 'center', fontWeight: '500' },
  emptySubLabel: { fontSize: 11, color: '#AAAABC', textAlign: 'center' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: { width: '48%', alignItems: 'center', paddingVertical: 18, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0', gap: 8 },
  quickBtnActive: { borderColor: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.06)' },
  quickIcon: { fontSize: 26 },
  quickLabel: { fontSize: 10, color: '#888899', textAlign: 'center', fontWeight: '500', lineHeight: 14 },
  quickLabelActive: { color: '#4ECDC4', fontWeight: '700' },
  // Inline notes panel inside Quick Actions card
  notesPanel: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F5', paddingTop: 12 },
  notesPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  notesPanelTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  notesCollapse: { fontSize: 13, color: '#AAAABC', fontWeight: '600', paddingHorizontal: 4 },
  notesEmpty: { paddingVertical: 14, alignItems: 'center' },
  notesEmptyText: { fontSize: 12, color: '#AAAABC' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F7', marginBottom: 2 },
  noteLine: { width: 3, height: 40, backgroundColor: '#4ECDC4', borderRadius: 2, marginTop: 2 },
  noteName: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  noteDesc: { fontSize: 12, color: '#888899', marginTop: 2, lineHeight: 17 },
  noteDate: { fontSize: 11, color: '#AAAABC', marginTop: 4 },
  noteBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  noteBadgeText: { fontSize: 10, fontWeight: '600' },
});
