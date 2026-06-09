import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '../context/NotificationsContext';
import { useWorkspace } from '../context/WorkspaceContext';

const TYPE_COLOR = {
  task:     '#4ECDC4',
  project:  '#3B82F6',
  event:    '#A78BFA',
  reminder: '#F59E0B',
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

export default function NotificationBell() {
  const { notifications, unreadCount, totalUnread, otherWorkspaces,
          markAllRead, clearAll, fetchNotifications } = useNotifications();
  const { workspaces, handleSwitch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const handleOpen = () => {
    setOpen(true);
    setActiveTab('all');
    // Force fresh fetch so unread counts are accurate from server
    fetchNotifications(true);
  };

  const handleClose = () => setOpen(false);

  const unreadList = notifications.filter(n => !n.read);
  const visibleList = activeTab === 'unread' ? unreadList : notifications;

  return (
    <>
      <TouchableOpacity style={styles.bellBtn} onPress={handleOpen}>
        <Text style={styles.bellIcon}>🔔</Text>
        {totalUnread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
        <SafeAreaView style={styles.panel}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>🔔  Notifications</Text>
            <View style={styles.panelActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllRead} style={styles.markReadBtn}>
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs: All / Unread */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
              onPress={() => setActiveTab('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                All
              </Text>
              <View style={[styles.tabCount, activeTab === 'all' && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, activeTab === 'all' && styles.tabCountTextActive]}>
                  {notifications.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'unread' && styles.tabBtnActive]}
              onPress={() => setActiveTab('unread')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
                Unread
              </Text>
              <View style={[
                styles.tabCount,
                activeTab === 'unread' && styles.tabCountActive,
                totalUnread > 0 && { backgroundColor: '#EF4444' },
                totalUnread > 0 && activeTab === 'unread' && { backgroundColor: '#EF4444' },
              ]}>
                <Text style={[
                  styles.tabCountText,
                  activeTab === 'unread' && styles.tabCountTextActive,
                  totalUnread > 0 && { color: '#fff' },
                ]}>
                  {totalUnread}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
            {visibleList.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>{activeTab === 'unread' ? '✅' : '🔕'}</Text>
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
                <View
                  key={n.id}
                  style={[
                    styles.notifCard,
                    !n.read && styles.notifCardUnread,
                  ]}
                >
                  <View style={[styles.notifDot, { backgroundColor: TYPE_COLOR[n.type] || '#888899' }]} />
                  <View style={styles.notifIcon}>
                    <Text style={{ fontSize: 18 }}>{n.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifTitleRow}>
                      <Text style={styles.notifTitle}>{n.title}</Text>
                      {!n.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifBody}>{n.body}</Text>
                    <Text style={styles.notifTime}>{timeAgo(n.time)}</Text>
                  </View>
                </View>
              ))
            )}

            {/* ── Other Workspaces (All tab only) ── */}
            {activeTab === 'all' && otherWorkspaces?.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionLabel}>OTHER WORKSPACES</Text>
                {otherWorkspaces.map(ws => (
                  <View key={ws.workspace_id} style={styles.wsCard}>
                    <View style={styles.wsAvatar}>
                      <Text style={styles.wsAvatarText}>
                        {(ws.workspace_name?.[0] || 'W').toUpperCase()}
                      </Text>
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
  bellBtn: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 1, borderColor: '#EBEBF0',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FAFAFA', position: 'relative',
  },
  bellIcon: { fontSize: 16 },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444', borderRadius: 10,
    minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 9998,
  },
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '78%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 9999,
    zIndex: 9999,
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  panelTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  panelActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markReadBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6, backgroundColor: 'rgba(78,205,196,0.12)',
    borderWidth: 1, borderColor: 'rgba(78,205,196,0.3)',
  },
  markReadText: { fontSize: 11, color: '#4ECDC4', fontWeight: '700' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F5F5F7' },
  clearText: { fontSize: 12, color: '#888899', fontWeight: '600' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 12, color: '#888899', fontWeight: '700' },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
    gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F7',
    borderWidth: 1, borderColor: '#EBEBF0',
  },
  tabBtnActive: {
    backgroundColor: '#1A1A2E',
    borderColor: '#1A1A2E',
  },
  tabText: { fontSize: 13, color: '#888899', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  tabCount: {
    minWidth: 22, paddingHorizontal: 6, height: 20,
    borderRadius: 10,
    backgroundColor: '#EBEBF0',
    justifyContent: 'center', alignItems: 'center',
  },
  tabCountActive: {
    backgroundColor: 'rgba(78,205,196,0.25)',
  },
  tabCountText: { fontSize: 10, color: '#888899', fontWeight: '700' },
  tabCountTextActive: { color: '#4ECDC4' },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon: { fontSize: 36, opacity: 0.3 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  emptySub: { fontSize: 12, color: '#AAAABC', textAlign: 'center', paddingHorizontal: 20 },

  // Notification card
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F5',
  },
  notifCardUnread: {
    backgroundColor: 'rgba(78,205,196,0.05)',
    borderColor: 'rgba(78,205,196,0.2)',
  },
  notifDot: { width: 3, borderRadius: 2, alignSelf: 'stretch', minHeight: 36 },
  notifIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EBEBF0',
  },
  notifTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 2,
  },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  unreadDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  notifBody:  { fontSize: 12, color: '#5C5C6E', lineHeight: 17 },
  notifTime:  { fontSize: 11, color: '#AAAABC', marginTop: 4 },

  // Other workspaces
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#AAAABC', marginBottom: 10 },
  wsCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F5F7', borderRadius: 12, padding: 12, marginBottom: 8 },
  wsAvatar: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  wsAvatarText: { color: '#4ECDC4', fontSize: 13, fontWeight: '800' },
  wsName: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  wsMsg:  { fontSize: 11, color: '#888899', marginTop: 1 },
  wsBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  wsBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  switchBtn: { borderWidth: 1, borderColor: '#4ECDC4', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  switchBtnText: { color: '#4ECDC4', fontSize: 11, fontWeight: '700' },
});
