import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../constants/tokens';
import { TASKS, TEAMMATES } from '../constants/data';
import { Icons } from '../components/Icons';
import {
  TopBar,
  Card,
  SectionHeader,
  TextLink,
  AvatarStack,
  StatusPill,
  EmptyState,
} from '../components/SharedUI';

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const PERIODS = ['Today', 'This week', 'Backlog'];

const SCHEDULE = [
  {
    time: '9:00 AM',
    title: 'Daily standup',
    type: 'Meeting',
    duration: '15m',
    color: T.cPurple,
    kind: 'meeting',
    members: TEAMMATES.slice(0, 4),
  },
  {
    time: '10:00 AM',
    title: 'AI Inaccuracy bug investigation',
    type: 'Task',
    duration: '2h',
    color: T.cBlue,
    kind: 'task',
    taskId: 1,
  },
  {
    time: '1:00 PM',
    title: 'Design review with Aanya',
    type: 'Meeting',
    duration: '45m',
    color: T.cPurple,
    kind: 'meeting',
    members: [TEAMMATES[1], TEAMMATES[0]],
  },
  {
    time: '2:30 PM',
    title: 'Fix mobile alignment',
    type: 'Task',
    duration: '1h 30m',
    color: T.cYellow,
    kind: 'task',
    taskId: 5,
  },
  {
    time: '4:30 PM',
    title: 'Sync with Kabir on auth v2',
    type: 'Meeting',
    duration: '30m',
    color: T.cPurple,
    kind: 'meeting',
    members: [TEAMMATES[2], TEAMMATES[0]],
  },
];

const ASSIGNED_TASKS = TASKS.slice(0, 4);

/* ------------------------------------------------------------------ */
/*  Segmented Control                                                  */
/* ------------------------------------------------------------------ */

function SegmentedControl({ items, active, onChange }) {
  return (
    <View style={s.segWrap}>
      {items.map((item) => {
        const isActive = item === active;
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onChange(item)}
            style={[s.segBtn, isActive && s.segBtnActive]}
          >
            <Text style={[s.segText, isActive && s.segTextActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Focus Block Hero                                                   */
/* ------------------------------------------------------------------ */

function FocusBlockHero({ navigation }) {
  return (
    <LinearGradient
      colors={['#0E1726', '#21304A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.focusCard}
    >
      {/* Decorative radial gradient circle */}
      <View style={s.focusDeco} />

      <Text style={s.focusLabel}>FOCUS BLOCK</Text>
      <Text style={s.focusTitle}>AI Inaccuracy bug</Text>
      <Text style={s.focusMeta}>10:00 AM — 12:00 PM &middot; 2 hours</Text>

      {/* Progress bar */}
      <View style={s.focusProgressWrap}>
        <View style={s.focusProgressTrack}>
          <View style={[s.focusProgressFill, { width: '38%' }]} />
        </View>
        <Text style={s.focusProgressText}>38%</Text>
      </View>

      {/* Buttons */}
      <View style={s.focusBtnRow}>
        <TouchableOpacity
          style={s.focusBtnResume}
          onPress={() => navigation.navigate('TaskDetail', { id: 1 })}
        >
          <Text style={s.focusBtnResumeText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.focusBtnSkip}>
          <Text style={s.focusBtnSkipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ */
/*  Schedule Card                                                      */
/* ------------------------------------------------------------------ */

function ScheduleCard({ navigation }) {
  return (
    <Card style={{ marginBottom: 22, padding: 0 }}>
      {SCHEDULE.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          activeOpacity={0.7}
          onPress={() =>
            item.taskId
              ? navigation.navigate('TaskDetail', { id: item.taskId })
              : null
          }
          style={[
            s.schedRow,
            idx < SCHEDULE.length - 1 && {
              borderBottomWidth: 1,
              borderBottomColor: T.hairlineSoft,
            },
          ]}
        >
          {/* Time */}
          <Text style={s.schedTime}>{item.time}</Text>

          {/* Color bar */}
          <View style={[s.schedBar, { backgroundColor: item.color }]} />

          {/* Content */}
          <View style={s.schedContent}>
            <Text style={s.schedTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={s.schedMeta}>
              <Text style={s.schedType}>
                {item.type} &middot; {item.duration}
              </Text>
            </View>
            {item.kind === 'meeting' && item.members && (
              <View style={{ marginTop: 6 }}>
                <AvatarStack members={item.members} max={3} size={20} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Task Card (Assigned to me)                                         */
/* ------------------------------------------------------------------ */

function TaskCard({ task, onPress }) {
  const done = task.status === 'Completed';
  return (
    <Card onPress={onPress} style={s.taskCard} padding={12}>
      <View style={s.taskTop}>
        <View
          style={[
            s.taskCheck,
            done && { backgroundColor: T.cGreen, borderColor: T.cGreen },
          ]}
        >
          {done && Icons.check({ color: '#fff', size: 11, sw: 3 })}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              s.taskTitle,
              done && { textDecorationLine: 'line-through', opacity: 0.55 },
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          <View style={s.taskMetaRow}>
            <Text style={s.taskProject}>{task.project}</Text>
            <View style={s.taskDot} />
            <Text style={s.taskDate}>{task.date}</Text>
          </View>
        </View>
        <StatusPill status={task.status} />
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  MyWork Screen                                                      */
/* ------------------------------------------------------------------ */

export default function MyWorkScreen({ navigation }) {
  const [period, setPeriod] = useState('Today');

  return (
    <View style={s.container}>
      <TopBar
        title="My Work"
        subtitle="Today, May 12"
        onMenu={() => navigation.openDrawer()}
        onSearch={() => navigation.navigate('Search')}
        onBell={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Period segmented */}
        <SegmentedControl
          items={PERIODS}
          active={period}
          onChange={setPeriod}
        />

        {/* Focus Block Hero */}
        <FocusBlockHero navigation={navigation} />

        {/* Schedule */}
        <SectionHeader
          right={
            <TextLink onPress={() => navigation.navigate('Tasks')}>
              See all
            </TextLink>
          }
        >
          Schedule
        </SectionHeader>
        <ScheduleCard navigation={navigation} />

        {/* Assigned to me */}
        <SectionHeader
          right={
            <TextLink onPress={() => navigation.navigate('Tasks')}>
              View all
            </TextLink>
          }
        >
          Assigned to me
        </SectionHeader>
        {ASSIGNED_TASKS.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onPress={() => navigation.navigate('TaskDetail', { id: task.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
  },
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 100,
  },

  /* Segmented control */
  segWrap: {
    flexDirection: 'row',
    backgroundColor: T.surfaceCool,
    borderRadius: T.rMd,
    padding: 4,
    marginBottom: 16,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: T.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink3,
  },
  segTextActive: {
    color: T.ink,
    fontWeight: '700',
  },

  /* Focus block hero */
  focusCard: {
    borderRadius: T.rLg,
    padding: 20,
    marginBottom: 22,
    overflow: 'hidden',
  },
  focusDeco: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -40,
    right: -30,
    backgroundColor: 'rgba(45,106,227,0.15)',
  },
  focusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  focusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  focusMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
  },
  focusProgressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  focusProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  focusProgressFill: {
    height: '100%',
    backgroundColor: T.cBlue,
    borderRadius: 3,
  },
  focusProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  focusBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  focusBtnResume: {
    flex: 1,
    backgroundColor: T.cBlue,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  focusBtnResumeText: {
    fontSize: 14,
    fontWeight: '650',
    color: '#fff',
  },
  focusBtnSkip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  focusBtnSkipText: {
    fontSize: 14,
    fontWeight: '650',
    color: 'rgba(255,255,255,0.7)',
  },

  /* Schedule */
  schedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  schedTime: {
    width: 64,
    fontSize: 12,
    fontWeight: '600',
    color: T.ink3,
    paddingTop: 2,
  },
  schedBar: {
    width: 4,
    height: '100%',
    minHeight: 36,
    borderRadius: 2,
  },
  schedContent: {
    flex: 1,
  },
  schedTitle: {
    fontSize: 14,
    fontWeight: '650',
    color: T.ink,
    marginBottom: 2,
  },
  schedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  schedType: {
    fontSize: 12,
    color: T.ink3,
    fontWeight: '500',
  },

  /* Task cards */
  taskCard: {
    marginBottom: 8,
  },
  taskTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  taskCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: T.hairline,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink,
    marginBottom: 4,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskProject: {
    fontSize: 11,
    color: T.ink3,
  },
  taskDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: T.ink4,
  },
  taskDate: {
    fontSize: 11,
    color: T.ink3,
  },
});
