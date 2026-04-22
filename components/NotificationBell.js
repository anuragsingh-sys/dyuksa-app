import React, { useState, useContext } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '../context/NotificationsContext';
import { ThemeContext } from '../context/ThemeContext';

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
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';

  // Theme-aware bell button colors (matches calendar navbar buttons)
  const btnBg     = isDark ? '#252530' : '#FAFAFA';
  const btnBorder = isDark ? '#252530' : '#EBEBF0';
  const badgeBorder = isDark ? '#1A1A20' : '#FFFFFF';

  const handleOpen = () => {
    setOpen(true);
    markAllRead();
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.bellBtn, { backgroundColor: btnBg, borderColor: btnBorder }]}
        onPress={handleOpen}
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {unreadCount > 0 && (
          <View style={[styles.badge, { borderColor: badgeBorder }]}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <SafeAreaView style={styles.panel}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>🔔  Notifications</Text>
            <View style={styles.panelActions}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
            {notifications.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🔕</Text>
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySub}>You'll see task, project and event alerts here</Text>
              </View>
            ) : (
              notifications.map(n => (
                <View key={n.id} style={styles.notifCard}>
                  <View style={[styles.notifDot, { backgroundColor: TYPE_COLOR[n.type] || '#888899' }]} />
                  <View style={styles.notifIcon}>
                    <Text style={{ fontSize: 18 }}>{n.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifBody}>{n.body}</Text>
                    <Text style={styles.notifTime}>{timeAgo(n.time)}</Text>
                  </View>
                </View>
              ))
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
    maxHeight: '75%',
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
  panelActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F5F5F7' },
  clearText: { fontSize: 12, color: '#888899', fontWeight: '600' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 12, color: '#888899', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon: { fontSize: 36, opacity: 0.3 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  emptySub: { fontSize: 12, color: '#AAAABC', textAlign: 'center', paddingHorizontal: 20 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F5',
  },
  notifDot: { width: 3, borderRadius: 2, alignSelf: 'stretch', minHeight: 36 },
  notifIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EBEBF0',
  },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  notifBody:  { fontSize: 12, color: '#5C5C6E', lineHeight: 17 },
  notifTime:  { fontSize: 11, color: '#AAAABC', marginTop: 4 },
});
