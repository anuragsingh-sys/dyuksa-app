import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/tokens';
import { NOTIFS } from '../constants/data';
import { Icons } from '../components/Icons';
import { NavBar } from '../components/SharedUI';

/* ── icon + color mapping ────────────────────────────── */

const KIND_MAP = {
  mention:  { icon: Icons.comment, color: T.cBlue,   soft: T.cBlueSoft   },
  assign:   { icon: Icons.task,    color: T.cPurple, soft: T.cPurpleSoft },
  comment:  { icon: Icons.comment, color: T.cGreen,  soft: T.cGreenSoft  },
  due:      { icon: Icons.flag,    color: T.cYellow, soft: T.cYellowSoft },
  upload:   { icon: Icons.upload,  color: T.cGreen,  soft: T.cGreenSoft  },
  project:  { icon: Icons.folder,  color: T.cRed,    soft: T.cRedSoft    },
};

/* ── group notifications by time ─────────────────────── */

function groupByTime(notifs) {
  const today = [];
  const yesterday = [];
  const earlier = [];

  notifs.forEach(n => {
    const w = n.when.toLowerCase();
    if (w.includes('m ago') || w.includes('h ago')) {
      today.push(n);
    } else if (w.includes('yesterday')) {
      yesterday.push(n);
    } else {
      earlier.push(n);
    }
  });

  const groups = [];
  if (today.length)     groups.push({ label: 'Today',     items: today     });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (earlier.length)   groups.push({ label: 'Earlier',   items: earlier   });
  return groups;
}

/* ── notification item ───────────────────────────────── */

function NotifItem({ notif, isLast }) {
  const km = KIND_MAP[notif.kind] || KIND_MAP.mention;
  return (
    <View
      style={[
        styles.notifRow,
        notif.unread && { backgroundColor: T.brandSoft },
        !isLast && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
      ]}
    >
      {/* Icon tile */}
      <View style={[styles.iconTile, { backgroundColor: km.soft }]}>
        {km.icon({ color: km.color, size: 18 })}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={styles.notifText} numberOfLines={2}>
          <Text style={styles.notifWho}>{notif.who}</Text>
          {' '}{notif.msg}
        </Text>
        <Text style={styles.notifTime}>{notif.when}</Text>
      </View>

      {/* Unread dot */}
      {notif.unread && <View style={styles.unreadDot} />}
    </View>
  );
}

/* ── main screen ─────────────────────────────────────── */

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('all');

  const unreadCount = NOTIFS.filter(n => n.unread).length;
  const totalCount = NOTIFS.length;

  const items = useMemo(() => {
    if (activeTab === 'unread') return NOTIFS.filter(n => n.unread);
    return NOTIFS;
  }, [activeTab]);

  const groups = useMemo(() => groupByTime(items), [items]);

  const TABS = [
    { id: 'all',    label: 'All',    count: totalCount  },
    { id: 'unread', label: 'Unread', count: unreadCount },
  ];

  return (
    <View style={styles.container}>
      <NavBar
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        }
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              <View style={[styles.tabBadge, active ? { backgroundColor: T.brand } : { backgroundColor: T.hairlineSoft }]}>
                <Text style={[styles.tabBadgeText, active ? { color: '#fff' } : { color: T.ink3 }]}>{tab.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notification list */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group, gi) => (
          <View key={gi}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <View style={styles.groupCard}>
              {group.items.map((notif, idx) => (
                <NotifItem
                  key={notif.id}
                  notif={notif}
                  isLast={idx === group.items.length - 1}
                />
              ))}
            </View>
          </View>
        ))}

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              {Icons.bell({ color: T.ink4, size: 28 })}
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No unread notifications</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── styles ───────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
  },
  markAllRead: {
    fontSize: 13,
    fontWeight: '600',
    color: T.brand,
  },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.hairlineSoft,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.surface,
  },
  tabActive: {
    backgroundColor: T.brandSoft,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink3,
  },
  tabTextActive: {
    color: T.brand,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Group */
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: T.ink4,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  groupCard: {
    backgroundColor: T.surface,
    marginHorizontal: 16,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    overflow: 'hidden',
  },

  /* Notification item */
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifText: {
    fontSize: 13,
    color: T.ink2,
    lineHeight: 19,
  },
  notifWho: {
    fontWeight: '650',
    color: T.ink,
  },
  notifTime: {
    fontSize: 11,
    color: T.ink4,
    marginTop: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.brand,
  },

  /* Empty state */
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: T.surfaceCool,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '650',
    color: T.ink,
  },
  emptySubtitle: {
    fontSize: 13,
    color: T.ink3,
    textAlign: 'center',
  },
});
