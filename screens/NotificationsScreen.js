import React, { useState, useContext, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import SidebarMenu from '../components/SidebarMenu';

const TYPE_CONFIG = {
  task_assigned:       { icon: '📋', color: '#4ECDC4' },
  task_completed:      { icon: '✅', color: '#4ADE80' },
  task_status_updated: { icon: '🔄', color: '#60A5FA' },
  document_shared:     { icon: '📄', color: '#A78BFA' },
  event_created:       { icon: '📅', color: '#FBBF24' },
  new_message:         { icon: '💬', color: '#F472B6' },
  system:              { icon: '🔔', color: '#9898A6' },
  reminder:            { icon: '⏰', color: '#F59E0B' },
};
const cfgFor = (type) => TYPE_CONFIG[type] || { icon: '🔔', color: '#9898A6' };

const navigateFor = (navigation, n) => {
  const meta = n.metadata || {};
  try {
    switch (n.type) {
      case 'task_assigned':
      case 'task_completed':
      case 'task_status_updated':
        if (meta.task_id) navigation.navigate('TaskDetail', { taskId: meta.task_id });
        else try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Main', { screen: 'Tasks' }); }
        break;
      case 'document_shared':
        try { navigation.jumpTo('Docs'); } catch { navigation.navigate('Main', { screen: 'Docs' }); }
        break;
      case 'event_created':
        try { navigation.jumpTo('Calendar'); } catch { navigation.navigate('Main', { screen: 'Calendar' }); }
        break;
      case 'new_message':
        navigation.navigate('Chat', meta.room_id ? { roomId: meta.room_id } : {});
        break;
      default: break;
    }
  } catch (e) { console.warn('Nav error:', e.message); }
};

const groupNotifications = (list) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const groups = {};
  list.forEach(n => {
    let label = 'Earlier';
    try {
      const d = new Date(n.time || n.created_at || 0); d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime())     label = 'Today';
      else if (d.getTime() === yesterday.getTime()) label = 'Yesterday';
    } catch {}
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  });
  return ['Today', 'Yesterday', 'Earlier'].filter(l => groups[l]).map(l => ({ label: l, items: groups[l] }));
};

function NotifItem({ notif, isLast, isDark, txt, sub, bdr, onPress }) {
  const cfg = cfgFor(notif.type);
  const isUnread = !notif.read;
  const timeStr = notif.time_since || (() => {
    try {
      const diff = Date.now() - new Date(notif.time || 0).getTime();
      const m = Math.floor(diff / 60000);
      if (m < 1) return 'just now';
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
    } catch { return ''; }
  })();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        s.notifRow,
        isUnread && { backgroundColor: isDark ? 'rgba(78,205,196,0.05)' : '#F0FDFA' },
        !isLast && { borderBottomWidth: 1, borderBottomColor: bdr },
      ]}
    >
      <View style={[s.iconTile, { backgroundColor: cfg.color + '18' }]}>
        <Text style={{ fontSize: 18 }}>{cfg.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {notif.actor && <Text style={[s.notifActor, { color: txt }]} numberOfLines={1}>{notif.actor}</Text>}
        <Text style={[s.notifBody, { color: notif.actor ? sub : txt }]} numberOfLines={3}>
          {notif.title || notif.body || 'New notification'}
        </Text>
        {notif.body && notif.title && (
          <Text style={[s.notifSub, { color: sub }]} numberOfLines={2}>{notif.body}</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Text style={[s.notifTime, { color: sub }]}>{timeStr}</Text>
          {notif.priority === 'high' && (
            <View style={[s.priorityPill, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
              <Text style={[s.priorityPillText, { color: '#EF4444' }]}>High priority</Text>
            </View>
          )}
        </View>
      </View>
      {isUnread && <View style={[s.unreadDot, { backgroundColor: '#4ECDC4' }]} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F7F8FB';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#0E1726';
  const sub  = isDark ? '#9898A6' : '#6B7588';
  const bdr  = isDark ? '#252530' : '#E6E9EF';

  const { notifications, unreadCount, loading, fetchNotifications, markAllRead, markOneRead, clearAll } = useNotifications();
  const [activeTab,  setActiveTab]  = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [fetchNotifications]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const displayed = useMemo(() =>
    activeTab === 'unread' ? notifications.filter(n => !n.read) : notifications,
    [activeTab, notifications]
  );
  const groups = useMemo(() => groupNotifications(displayed), [displayed]);

  const handlePress = (notif) => {
    if (!notif.read) markOneRead(notif.id);
    navigateFor(navigation, notif);
  };

  const TABS = [
    { id: 'all',    label: 'All',    count: notifications.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Notifications" />
          <TouchableOpacity onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }} activeOpacity={0.7}>
            <View style={s.logoBox}><Text style={s.logoText}>D</Text></View>
          </TouchableOpacity>
          <Text style={[s.brandName, { color: txt }]}>Notifications</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
              <Text style={[s.actionText, { color: '#4ECDC4' }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={clearAll} activeOpacity={0.7}>
              <Text style={[s.actionText, { color: '#EF4444' }]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[s.tabBar, { backgroundColor: card, borderBottomColor: bdr }]}>
        {TABS.map(tab => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[s.tab, active && { backgroundColor: isDark ? 'rgba(78,205,196,0.12)' : '#F0FDFA' }]}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, { color: active ? '#4ECDC4' : sub }]}>{tab.label}</Text>
              <View style={[s.tabBadge, { backgroundColor: active ? '#4ECDC4' : (isDark ? '#252530' : '#F0F2F6') }]}>
                <Text style={[s.tabBadgeText, { color: active ? '#fff' : sub }]}>{tab.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={[{ color: sub, marginTop: 12, fontSize: 13 }]}>Loading…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" colors={['#4ECDC4']} />}
        >
          {groups.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
              <Text style={{ fontSize: 52, opacity: 0.25 }}>🔔</Text>
              <Text style={[{ fontSize: 17, fontWeight: '700', color: txt }]}>
                {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
              </Text>
              <Text style={[{ fontSize: 13, color: sub, textAlign: 'center', paddingHorizontal: 32 }]}>
                {activeTab === 'unread'
                  ? 'No unread notifications right now'
                  : 'Notifications from tasks, events and messages appear here'}
              </Text>
            </View>
          ) : groups.map((group, gi) => (
            <View key={gi}>
              <Text style={[s.groupLabel, { color: sub }]}>{group.label.toUpperCase()}</Text>
              <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                {group.items.map((notif, idx) => (
                  <NotifItem
                    key={notif.id || idx}
                    notif={notif}
                    isLast={idx === group.items.length - 1}
                    isDark={isDark} txt={txt} sub={sub} bdr={bdr}
                    onPress={() => handlePress(notif)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontWeight: '700', fontSize: 15 },
  actionText: { fontSize: 12, fontWeight: '700' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabBadgeText: { fontSize: 11, fontWeight: '700' },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  groupCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginHorizontal: 12, marginBottom: 4 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  iconTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifActor: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  notifBody: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  notifSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  notifTime: { fontSize: 11 },
  priorityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  priorityPillText: { fontSize: 10, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
});
