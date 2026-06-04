import React, { useState, useContext } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../context/NotificationsContext';
import { ThemeContext } from '../context/ThemeContext';

// ── Notification type config ──────────────────────────────────────────────────
const TYPE_CONFIG = {
  task_assigned:       { icon: '📋', color: '#4ECDC4',  label: 'Task' },
  task_completed:      { icon: '✅', color: '#4ADE80',  label: 'Task' },
  task_status_updated: { icon: '🔄', color: '#60A5FA',  label: 'Task' },
  document_shared:     { icon: '📄', color: '#A78BFA',  label: 'Document' },
  event_created:       { icon: '📅', color: '#FBBF24',  label: 'Event' },
  new_message:         { icon: '💬', color: '#F472B6',  label: 'Message' },
  system:              { icon: '🔔', color: '#9898A6',  label: 'System' },
  reminder:            { icon: '⏰', color: '#F59E0B',  label: 'Reminder' },
};

const cfgFor = (type) => TYPE_CONFIG[type] || { icon: '🔔', color: '#9898A6', label: 'Notification' };

const priorityColor = (p) => {
  if (p === 'high')   return '#EF4444';
  if (p === 'medium') return '#FBBF24';
  return '#9898A6';
};

// ── Navigate based on notification type + metadata ────────────────────────────
const navigateForNotification = (navigation, n, closePanel) => {
  const meta = n.metadata || {};
  closePanel();

  try {
    switch (n.type) {
      case 'task_assigned':
      case 'task_completed':
      case 'task_status_updated':
        if (meta.task_id) {
          navigation.navigate('Main', { screen: 'Tasks', params: { openTaskId: meta.task_id } });
        } else {
          navigation.navigate('Main', { screen: 'Tasks' });
        }
        break;

      case 'document_shared':
        if (meta.document_id) {
          navigation.navigate('Main', { screen: 'Docs', params: { openDocId: meta.document_id } });
        } else {
          navigation.navigate('Main', { screen: 'Docs' });
        }
        break;

      case 'event_created':
        navigation.navigate('Main', { screen: 'Calendar' });
        break;

      case 'new_message':
        if (meta.room_id) {
          navigation.navigate('Chat', { roomId: meta.room_id, roomName: meta.room_name });
        } else {
          navigation.navigate('Chat');
        }
        break;

      default:
        // System / reminder — stay on current screen
        break;
    }
  } catch (e) {
    console.warn('Navigation error:', e.message);
  }
};

// ── Group by date label ───────────────────────────────────────────────────────
const groupNotifications = (list) => {
  const groups = {};
  list.forEach(n => {
    const ts = n.time_since || '';
    let group = 'Earlier';
    if (ts.includes('ago') || ts.includes('m ago') || ts.includes('h ago')) group = 'Today';
    else if (ts === 'just now') group = 'Today';
    else if (ts.includes('d ago') && parseInt(ts) <= 1) group = 'Yesterday';
    if (!groups[group]) groups[group] = [];
    groups[group].push(n);
  });
  // Preserve order: Today → Yesterday → Earlier
  const ordered = {};
  ['Today', 'Yesterday', 'Earlier'].forEach(k => { if (groups[k]) ordered[k] = groups[k]; });
  // Any other keys
  Object.keys(groups).forEach(k => { if (!ordered[k]) ordered[k] = groups[k]; });
  return ordered;
};

export default function NotificationBell() {
  const {
    notifications, unreadCount, loading,
    markAllRead, markOneRead, clearAll, fetchNotifications,
  } = useNotifications();

  const navigation = useNavigation();
  const [open,       setOpen]       = useState(false);
  const [tab,        setTab]        = useState('unread'); // 'all' | 'unread'
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';

  const bg   = isDark ? '#1A1A20' : '#FFFFFF';
  const card = isDark ? '#252530' : '#F9FAFB';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#333340' : '#F0F0F5';

  const handleOpen = () => {
    setOpen(true);
    setTab('unread'); // always open on Unread tab
  };

  const handleClose = () => setOpen(false);

  const handleClearAll = () => {
    const count = tab === 'unread' ? unreadList.length : notifications.length;
    if (count === 0) return;
    Alert.alert(
      'Clear all notifications?',
      `This will permanently delete ${count} notification${count !== 1 ? 's' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: () => clearAll() },
      ]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleTap = (n) => {
    // Mark as read
    if (!n.read) markOneRead(n.id);
    // Navigate
    navigateForNotification(navigation, n, handleClose);
  };

  const displayed    = tab === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const unreadList   = notifications.filter(n => !n.read);
  const groups       = groupNotifications(displayed);

  return (
    <>
      {/* Bell button */}
      <TouchableOpacity
        style={[styles.bellBtn, { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: isDark ? '#252530' : '#EBEBF0' }]}
        onPress={handleOpen}
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {unreadCount > 0 && (
          <View style={[styles.badge, { borderColor: isDark ? '#1A1A20' : '#FFFFFF' }]}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Panel */}
      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
        <SafeAreaView style={[styles.panel, { backgroundColor: bg }]} edges={['bottom']}>

          {/* Header */}
          <View style={[styles.panelHeader, { borderBottomColor: bdr }]}>
            <View>
              <Text style={[styles.panelTitle, { color: txt }]}>🔔  Activity</Text>
              <Text style={[styles.panelSub, { color: sub }]}>RECENT UPDATES</Text>
            </View>
            <View style={styles.panelActions}>
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.closeBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
              >
                <Text style={[styles.closeBtnTxt, { color: sub }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* All / Unread tabs + Clear All inline */}
          <View style={[styles.tabs, { borderBottomColor: bdr }]}>
            <TouchableOpacity
              style={[styles.tab, tab === 'all' && styles.tabActive]}
              onPress={() => setTab('all')}
            >
              <Text style={[styles.tabTxt, { color: tab === 'all' ? txt : sub }]}>All</Text>
              {tab === 'all' && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'unread' && styles.tabActive]}
              onPress={() => setTab('unread')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.tabTxt, { color: tab === 'unread' ? txt : sub }]}>Unread</Text>
                {unreadList.length > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeTxt}>{unreadList.length}</Text>
                  </View>
                )}
              </View>
              {tab === 'unread' && <View style={styles.tabUnderline} />}
            </TouchableOpacity>

            {/* Spacer + Clear All floated right */}
            <View style={{ flex: 1 }} />
            {notifications.length > 0 && (
              <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
                <Text style={styles.clearAllTxt}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {loading && notifications.length === 0 ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#4ECDC4" size="large" />
            </View>
          ) : displayed.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyIcon}>🔕</Text>
              <Text style={[styles.emptyTitle, { color: txt }]}>
                {tab === 'unread' ? "You're all caught up ✨" : 'No notifications'}
              </Text>
              <Text style={[styles.emptySub, { color: sub }]}>
                {tab === 'unread' ? 'No unread notifications' : "You'll see task, event and message alerts here"}
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4ECDC4" />}
            >
              {Object.entries(groups).map(([group, items]) => (
                <View key={group}>
                  <Text style={[styles.groupLabel, { color: sub }]}>{group.toUpperCase()}</Text>
                  {items.map(n => {
                    const cfg = cfgFor(n.type);
                    return (
                      <TouchableOpacity
                        key={n.id}
                        style={[
                          styles.notifCard,
                          {
                            backgroundColor: n.read ? card : (isDark ? '#1E1E2A' : '#F0FDF4'),
                            borderColor: n.read ? bdr : cfg.color + '40',
                          },
                        ]}
                        onPress={() => handleTap(n)}
                        activeOpacity={0.7}
                      >
                        {/* Unread dot */}
                        {!n.read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}

                        {/* Icon */}
                        <View style={[styles.notifIconBox, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '30' }]}>
                          <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                        </View>

                        {/* Content */}
                        <View style={{ flex: 1 }}>
                          <View style={styles.notifTitleRow}>
                            <Text style={[styles.notifTitle, { color: txt }]} numberOfLines={1}>{n.title}</Text>
                            {n.priority && n.priority !== 'medium' && (
                              <View style={[styles.priorityDot, { backgroundColor: priorityColor(n.priority) }]} />
                            )}
                          </View>
                          <Text style={[styles.notifBody, { color: sub }]} numberOfLines={2}>{n.body}</Text>
                          <View style={styles.notifFooter}>
                            <Text style={[styles.notifTime, { color: sub }]}>{n.time_since || ''}</Text>
                            {n.actor && <Text style={[styles.notifActor, { color: sub }]}>· {n.actor}</Text>}
                            <View style={[styles.typePill, { backgroundColor: cfg.color + '18' }]}>
                              <Text style={[styles.typePillTxt, { color: cfg.color }]}>{cfg.label}</Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  bellIcon: { fontSize: 16 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1.5 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9998 },
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '82%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 9999, zIndex: 9999 },

  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  panelTitle: { fontSize: 16, fontWeight: '700' },
  panelSub: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },
  panelActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  actionBtnTxt: { fontSize: 12, fontWeight: '600' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  closeBtnTxt: { fontSize: 12, fontWeight: '700' },

  // Tabs
  tabs: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1 },
  tab: { paddingVertical: 12, paddingHorizontal: 4, marginRight: 24, position: 'relative' },
  tabActive: {},
  tabTxt: { fontSize: 14, fontWeight: '600' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#4ECDC4', borderRadius: 1 },
  tabBadge: { backgroundColor: '#4ECDC4', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  clearAllBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  clearAllTxt: { fontSize: 13, fontWeight: '600' },

  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 8, minHeight: 200 },
  emptyIcon: { fontSize: 36, opacity: 0.25 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptySub: { fontSize: 12, textAlign: 'center' },

  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },

  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, position: 'relative' },
  unreadDot: { position: 'absolute', top: 12, left: -4, width: 8, height: 8, borderRadius: 4 },
  notifIconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, flexShrink: 0 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  notifTitle: { flex: 1, fontSize: 13, fontWeight: '700' },
  priorityDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  notifBody: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  notifFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notifTime: { fontSize: 10 },
  notifActor: { fontSize: 10 },
  typePill: { marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  typePillTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
});
