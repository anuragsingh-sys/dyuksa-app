import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/tokens';
import { TASKS, TEAMMATES } from '../constants/data';
import { Icons } from '../components/Icons';
import {
  TopBar,
  Card,
  StatusPill,
  PriorityDot,
  Avatar,
  SectionHeader,
  EmptyState,
} from '../components/SharedUI';

/* ── helpers ──────────────────────────────────────────── */

const STATUS_BORDER = {
  'In Progress': T.cBlue,
  'Completed':   T.cGreen,
  'Pending':     T.cYellow,
  'Overdue':     T.cRed,
};

const findTeammate = (name) =>
  TEAMMATES.find((t) => t.name === name) || TEAMMATES[0];

/* ── tab / filter constants ──────────────────────────── */

const TAB_KEYS = ['upcoming', 'overdue', 'completed'];

const TAB_LABELS = { upcoming: 'Upcoming', overdue: 'Overdue', completed: 'Completed' };

const PRIORITY_FILTERS = ['All', 'Critical', 'Medium', 'Low'];

const PRIORITY_DOT_COLOR = {
  Critical: T.pCritical,
  Medium:   T.pMed,
  Low:      T.pLow,
};

/* ── task card ────────────────────────────────────────── */

function TaskCard({ task, onPress }) {
  const done = task.status === 'Completed';
  const borderColor = STATUS_BORDER[task.status] || T.cBlue;
  const teammate = findTeammate(task.assignee);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.taskCard, { borderLeftColor: borderColor }]}
    >
      {/* top row: checkbox + title + avatar */}
      <View style={styles.taskCardTop}>
        <View
          style={[
            styles.checkbox,
            done && { backgroundColor: T.cGreen, borderColor: T.cGreen },
          ]}
        >
          {done && Icons.check({ color: '#fff', size: 12, sw: 3 })}
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.taskTitle,
              done && { textDecorationLine: 'line-through', opacity: 0.55 },
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Avatar name={teammate.name} color={teammate.color} size={26} />
        </View>
      </View>

      {/* meta row */}
      <View style={styles.taskMeta}>
        <View style={styles.projectChip}>
          <Text style={styles.projectChipText}>{task.project}</Text>
        </View>

        <View style={styles.metaItem}>
          {Icons.cal({ color: T.ink4, size: 13, sw: 1.5 })}
          <Text style={styles.metaText}>{task.date}</Text>
        </View>

        <PriorityDot priority={task.priority} />

        <View style={{ flex: 1 }} />

        <StatusPill status={task.status} />
      </View>
    </TouchableOpacity>
  );
}

/* ── main screen ──────────────────────────────────────── */

export default function TasksScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [priorityFilter, setPriorityFilter] = useState('All');

  /* counts */
  const overdueCount = TASKS.filter((t) => t.status === 'Overdue').length;
  const totalCount = TASKS.length;

  /* tab counts */
  const tabCounts = useMemo(() => {
    const upcoming = TASKS.filter(
      (t) => t.status === 'In Progress' || t.status === 'Pending'
    ).length;
    const overdue = TASKS.filter((t) => t.status === 'Overdue').length;
    const completed = TASKS.filter((t) => t.status === 'Completed').length;
    return { upcoming, overdue, completed };
  }, []);

  /* filtered tasks */
  const filtered = useMemo(() => {
    let list = TASKS;

    // tab filter
    if (activeTab === 'upcoming') {
      list = list.filter(
        (t) => t.status === 'In Progress' || t.status === 'Pending'
      );
    } else if (activeTab === 'overdue') {
      list = list.filter((t) => t.status === 'Overdue');
    } else {
      list = list.filter((t) => t.status === 'Completed');
    }

    // priority filter
    if (priorityFilter !== 'All') {
      list = list.filter((t) => t.priority === priorityFilter);
    }

    return list;
  }, [activeTab, priorityFilter]);

  return (
    <View style={styles.container}>
      {/* top bar */}
      <TopBar
        title="Tasks"
        subtitle={`${totalCount} tasks · ${overdueCount} overdue`}
        onMenu={() => {}}
        onSearch={() => navigation.navigate('Search')}
        onBell={() => {}}
      />

      {/* sticky tab bar */}
      <View style={styles.tabBar}>
        {TAB_KEYS.map((key) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveTab(key)}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {TAB_LABELS[key]}
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  active
                    ? { backgroundColor: T.brand }
                    : { backgroundColor: T.hairlineSoft },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    active ? { color: '#fff' } : { color: T.ink3 },
                  ]}
                >
                  {tabCounts[key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* priority filter chips */}
      <View style={styles.filterRow}>
        {PRIORITY_FILTERS.map((pf) => {
          const active = priorityFilter === pf;
          return (
            <TouchableOpacity
              key={pf}
              onPress={() => setPriorityFilter(pf)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              activeOpacity={0.7}
            >
              {pf !== 'All' && (
                <View
                  style={[
                    styles.filterDot,
                    { backgroundColor: PRIORITY_DOT_COLOR[pf] },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {pf}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* task list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <EmptyState
            title="No tasks found"
            subtitle={`No ${priorityFilter !== 'All' ? priorityFilter.toLowerCase() + ' priority ' : ''}${TAB_LABELS[activeTab].toLowerCase()} tasks`}
          />
        ) : (
          filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => navigation.navigate('TaskDetail', { id: task.id })}
            />
          ))
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

  /* tab bar */
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

  /* filter chips */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.hairlineSoft,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: T.surfaceCool,
  },
  filterChipActive: {
    backgroundColor: T.ink,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.ink2,
  },
  filterChipTextActive: {
    color: '#fff',
  },

  /* task card */
  taskCard: {
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  taskCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: T.hairline,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: T.ink,
    lineHeight: 20,
    letterSpacing: -0.1,
  },

  /* meta row */
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  projectChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: T.surfaceCool,
  },
  projectChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: T.ink3,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11.5,
    color: T.ink3,
  },
});
