import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../context/NotificationsContext';
import { useWorkspace } from '../context/WorkspaceContext';
import Svg, { Path } from 'react-native-svg';

const ACCENT = '#3B72EE';

const TYPE_COLOR = {
  task:     ACCENT,
  project:  '#22C55E',
  event:    '#F59E0B',
  reminder: '#F97316',
  default:  '#9898A6',
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// SVG Bell icon
const BellIcon = ({ size = 20, color = '#1A1A2E' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M10.268 21a2 2 0 003.464 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M3.262 15.326A1 1 0 004 17h16a1 1 0 00.74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 006 8c0 4.499-1.411 5.956-2.738 7.326" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

export default function NotificationBell() {
  const navigation = useNavigation();
  const { notifications, unreadCount, totalUnread, otherWorkspaces,
          markAllRead, clearAll, fetchNotifications } = useNotifications();
  const { workspaces, handleSwitch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const handleOpen = () => {
    setOpen(true);
    setActiveTab('all');
    fetchNotifications(true);
  };

  const handleClose = () => setOpen(false);

  const unreadList   = notifications.filter(n => !n.read);
  const visibleList  = activeTab === 'unread' ? unreadList : notifications;

  return (
    <>
      {/* ── Bell button ── */}
      <TouchableOpacity style={styles.bellBtn} onPress={handleOpen} activeOpacity={0.7}>
        <BellIcon size={20} color='#3B72EE' />
        {totalUnread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Notification sheet ── */}
      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
        <SafeAreaView style={styles.panel} edges={['bottom']}>

          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifications</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllRead} style={[styles.actionBtn, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30' }]}>
                  <Text style={[styles.actionBtnText, { color: ACCENT }]}>Mark all read</Text>
                </TouchableOpacity>
              )}
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAll} style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>Clear all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {['all', 'unread'].map(tab => {
              const isActive = activeTab === tab;
              const count    = tab === 'all' ? notifications.length : totalUnread;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tabBtn, isActive && { borderBottomColor: ACCENT }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, isActive && { color: ACCENT, fontWeight: '700' }]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabBadge, { backgroundColor: tab === 'unread' && count > 0 ? '#EF4444' : ACCENT + '20' }]}>
                      <Text style={[styles.tabBadgeText, { color: tab === 'unread' && count > 0 ? '#fff' : ACCENT }]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
            {visibleList.length === 0 ? (
              <View style={styles.empty}>
                <BellIcon size={40} color="#D0D5E8" />
                <Text style={styles.emptyText}>
                  {activeTab === 'unread' ? 'All caught up!' : 'No notifications yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === 'unread'
                    ? 'You have no unread notifications.'
                    : "You'll see task, project and event alerts here"}
                </Text>
              </View>
            ) : (
              visibleList.map(n => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.notifCard, !n.read && { backgroundColor: ACCENT + '08', borderColor: ACCENT + '25' }]}
                  activeOpacity={0.7}
                  onPress={() => { handleClose(); }}
                >
                  <View style={[styles.notifDot, { backgroundColor: TYPE_COLOR[n.type] || TYPE_COLOR.default }]} />
                  <View style={[styles.notifIcon, { backgroundColor: (TYPE_COLOR[n.type] || TYPE_COLOR.default) + '18' }]}>
                    <Text style={{ fontSize: 17 }}>{n.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                      {!n.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                    <Text style={styles.notifTime}>{timeAgo(n.time)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Other Workspaces */}
            {activeTab === 'all' && otherWorkspaces?.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionLabel}>OTHER WORKSPACES</Text>
                {otherWorkspaces.map(ws => (
                  <View key={ws.workspace_id} style={styles.wsCard}>
                    <View style={styles.wsAvatar}>
                      <Text style={styles.wsAvatarText}>{(ws.workspace_name?.[0] || 'W').toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wsName} numberOfLines={1}>{ws.workspace_name}</Text>
                      <Text style={styles.wsMsg} numberOfLines={1}>{ws.message}</Text>
                    </View>
                    {ws.unread_count > 0 && (
                      <View style={styles.wsBadge}>
                        <Text style={styles.wsBadgeText}>{ws.unread_count}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.switchBtn}
                      onPress={() => {
                        const target = workspaces?.find(w => String(w.id) === String(ws.workspace_id));
                        if (target) { handleSwitch(target).catch(() => {}); handleClose(); }
                      }}
                    >
                      <Text style={styles.switchBtnText}>Switch</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Bell button
  bellBtn: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444', borderRadius: 10,
    minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Panel
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 9998 },
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 9999 },
  handle: { width: 40, height: 4, backgroundColor: '#E0E0E8', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  // Header
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  panelTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F5F5F7', borderWidth: 1, borderColor: '#EBEBF0' },
  actionBtnText: { fontSize: 11, color: '#888899', fontWeight: '700' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 12, color: '#888899', fontWeight: '700' },

  // Tabs
  tabsRow: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, color: '#888899', fontWeight: '500' },
  tabBadge: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  tabBadgeText: { fontSize: 10, fontWeight: '700' },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginTop: 8 },
  emptySub: { fontSize: 12, color: '#AAAABC', textAlign: 'center', paddingHorizontal: 20 },

  // Notification card
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F5' },
  notifDot: { width: 3, borderRadius: 2, alignSelf: 'stretch', minHeight: 36 },
  notifIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
  notifBody: { fontSize: 12, color: '#5C5C6E', lineHeight: 17 },
  notifTime: { fontSize: 11, color: '#AAAABC', marginTop: 4 },

  // Other workspaces
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#AAAABC', marginBottom: 10 },
  wsCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F5F7', borderRadius: 12, padding: 12, marginBottom: 8 },
  wsAvatar: { width: 34, height: 34, borderRadius: 10, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  wsAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  wsName: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  wsMsg: { fontSize: 11, color: '#888899', marginTop: 1 },
  wsBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  wsBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  switchBtn: { borderWidth: 1, borderColor: ACCENT, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  switchBtnText: { color: ACCENT, fontSize: 11, fontWeight: '700' },
});
