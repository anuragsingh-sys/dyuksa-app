import React, { useState, useContext, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import { useWorkspace } from '../context/WorkspaceContext';
import SidebarMenu from '../components/SidebarMenu';
import Svg, { Path, Circle } from 'react-native-svg';

const ACCENT = '#3B72EE';

const TYPE_CONFIG = {
  task_assigned:       { color: ACCENT,     bg: ACCENT + '18'    },
  task_completed:      { color: '#22C55E',  bg: '#22C55E18'      },
  task_status_updated: { color: ACCENT,     bg: ACCENT + '18'    },
  document_shared:     { color: '#F59E0B',  bg: '#F59E0B18'      },
  event_created:       { color: '#F59E0B',  bg: '#F59E0B18'      },
  new_message:         { color: '#9370DB',  bg: '#9370DB18'      },
  system:              { color: '#6B7588',  bg: '#6B758818'      },
  reminder:            { color: '#F97316',  bg: '#F9731618'      },
};
const cfgFor = (type) => TYPE_CONFIG[type] || { color: '#6B7588', bg: '#6B758818' };

// SVG icons per type
const TypeIcon = ({ type, color, size = 20 }) => {
  switch (type) {
    case 'task_assigned':
    case 'task_completed':
    case 'task_status_updated':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M9 11l3 3L22 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
    case 'document_shared':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
    case 'event_created':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
    case 'new_message':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M10.268 21a2 2 0 003.464 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <Path d="M3.262 15.326A1 1 0 004 17h16a1 1 0 00.74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 006 8c0 4.499-1.411 5.956-2.738 7.326" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
  }
};

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
        try { navigation.jumpTo('Docs'); } catch { navigation.navigate('Docs'); }
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
  const today     = new Date(); today.setHours(0, 0, 0, 0);
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

const timeAgo = (iso) => {
  try {
    const diff = Date.now() - new Date(iso || 0).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Yesterday';
    return `${d} days ago`;
  } catch { return ''; }
};

function NotifRow({ notif, isLast, bdr, onPress }) {
  const cfg     = cfgFor(notif.type);
  const isUnread = !notif.read;
  const time    = notif.time_since || timeAgo(notif.time || notif.created_at);
  const actor   = notif.actor || '';
  const message = notif.title || notif.body || 'New notification';
  const body    = notif.body && notif.title ? notif.body : '';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.notifRow, !isLast && { borderBottomWidth: 1, borderBottomColor: bdr }]}
    >
      {/* Icon tile */}
      <View style={[s.iconTile, { backgroundColor: cfg.bg }]}>
        <TypeIcon type={notif.type} color={cfg.color} size={20} />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={s.notifText} numberOfLines={3}>
          {actor ? <Text style={s.notifActor}>{actor} </Text> : null}
          {message}
        </Text>
        {!!body && <Text style={s.notifSub} numberOfLines={2}>{body}</Text>}
        <Text style={s.notifTime}>{time}</Text>
      </View>

      {/* Unread dot */}
      {isUnread && <View style={s.unreadDot} />}
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

  const { notifications, unreadCount, totalUnread, otherWorkspaces,
          loading, fetchNotifications, markAllRead, markOneRead, clearAll } = useNotifications();
  const { workspaces, switchWorkspace } = useWorkspace();
  const [activeTab,  setActiveTab]  = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [fetchNotifications]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(true);
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

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Navbar ── */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Text style={{ color: txt, fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: txt }]}>Notifications</Text>
        {unreadCount > 0
          ? <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT }}>Mark all read</Text>
            </TouchableOpacity>
          : <View style={{ width: 80 }} />
        }
      </View>

      {/* ── Tabs ── */}
      <View style={[s.tabsRow, { backgroundColor: card, borderBottomColor: bdr }]}>
        {[
          { id: 'all',    label: 'All',    count: notifications.length },
          { id: 'unread', label: 'Unread', count: totalUnread },
        ].map(tab => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[s.tabBtn, active && { borderBottomColor: ACCENT }]}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, { color: active ? ACCENT : sub, fontWeight: active ? '700' : '500' }]}>
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <Text style={[s.tabCount, { color: active ? ACCENT : sub }]}>{tab.count}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Content ── */}
      {loading && notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
        >
          {groups.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 80, gap: 8 }}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Path d="M10.268 21a2 2 0 003.464 0" stroke={isDark ? '#3A3A50' : '#D0D5E8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M3.262 15.326A1 1 0 004 17h16a1 1 0 00.74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 006 8c0 4.499-1.411 5.956-2.738 7.326" stroke={isDark ? '#3A3A50' : '#D0D5E8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
              <Text style={{ fontSize: 17, fontWeight: '700', color: txt, marginTop: 8 }}>
                {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
              </Text>
              <Text style={{ fontSize: 13, color: sub, textAlign: 'center', paddingHorizontal: 32 }}>
                {activeTab === 'unread'
                  ? 'No unread notifications right now'
                  : 'Notifications from tasks, events and messages appear here'}
              </Text>
            </View>
          ) : groups.map((group, gi) => (
            <View key={gi} style={{ marginBottom: 8 }}>
              <Text style={[s.groupLabel, { color: sub }]}>{group.label.toUpperCase()}</Text>
              <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                {group.items.map((notif, idx) => (
                  <NotifRow
                    key={notif.id || idx}
                    notif={notif}
                    isLast={idx === group.items.length - 1}
                    bdr={bdr}
                    onPress={() => handlePress(notif)}
                  />
                ))}
              </View>
            </View>
          ))}

          {/* Other Workspaces */}
          {otherWorkspaces?.length > 0 && activeTab === 'all' && (
            <View style={{ marginBottom: 8 }}>
              <Text style={[s.groupLabel, { color: sub }]}>OTHER WORKSPACES</Text>
              <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                {otherWorkspaces.map((ws, idx) => (
                  <View
                    key={ws.workspace_id}
                    style={[s.wsRow, idx < otherWorkspaces.length - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                  >
                    <View style={[s.wsAvatar, { backgroundColor: ACCENT }]}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{(ws.workspace_name?.[0] || 'W').toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: txt }} numberOfLines={1}>{ws.workspace_name}</Text>
                      <Text style={{ fontSize: 12, color: sub, marginTop: 2 }} numberOfLines={1}>{ws.message}</Text>
                    </View>
                    {ws.unread_count > 0 && (
                      <View style={s.wsBadge}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{ws.unread_count}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[s.switchBtn]}
                      onPress={() => {
                        const target = workspaces?.find(w => String(w.id) === String(ws.workspace_id));
                        if (target) switchWorkspace(target);
                      }}
                    >
                      <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>Switch</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1 },
  navbar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  navTitle:   { fontSize: 17, fontWeight: '700' },

  tabsRow:    { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1 },
  tabBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:    { fontSize: 14 },
  tabCount:   { fontSize: 14 },

  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#9AA3B2', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  groupCard:  { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginHorizontal: 12 },

  notifRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  iconTile:   { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifText:  { fontSize: 13, lineHeight: 19, color: '#0E1726', marginBottom: 3 },
  notifActor: { fontWeight: '700', color: '#0E1726' },
  notifSub:   { fontSize: 12, color: '#6B7588', lineHeight: 17, marginBottom: 3 },
  notifTime:  { fontSize: 11, color: '#9AA3B2' },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT, flexShrink: 0, marginTop: 5 },

  wsRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  wsAvatar: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  wsBadge:  { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  switchBtn:{ borderWidth: 1, borderColor: ACCENT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
});
