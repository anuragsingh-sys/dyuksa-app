import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../constants/tokens';
import { USER, PROJECTS, TASKS, ACTIVITY, TEAMMATES } from '../constants/data';
import { Icons } from '../components/Icons';
import {
  TopBar, Card, Progress, SectionHeader, TextLink, DropdownChip,
  StatusPill, Sparkline, Donut, MultiLine, TaskRow, Tabs,
  AvatarStack, FileTile,
} from '../components/SharedUI';

/* ------------------------------------------------------------------ */
/*  Static data for charts                                             */
/* ------------------------------------------------------------------ */

const OVERVIEW = [
  { label: 'Total Projects',  value: 24,  delta: '+12%', trendUp: true,  color: T.cBlue,   soft: T.cBlueSoft,   icon: Icons.folder, data: [8,9,12,11,14,13,16,18,17,19,22,24] },
  { label: 'Total Documents', value: 128, delta: '+8%',  trendUp: true,  color: T.cGreen,  soft: T.cGreenSoft,  icon: Icons.doc,    data: [60,72,78,80,90,95,100,110,115,120,124,128] },
  { label: 'Total Tasks',     value: 128, delta: '+16%', trendUp: true,  color: T.cYellow, soft: T.cYellowSoft, icon: Icons.task,   data: [40,55,60,68,75,82,88,98,108,118,124,128] },
  { label: 'Completed',       value: 48,  delta: '+20%', trendUp: true,  color: T.cPurple, soft: T.cPurpleSoft, icon: Icons.check,  data: [10,14,18,20,24,28,32,36,40,42,46,48] },
  { label: 'Overdue Tasks',   value: 12,  delta: '-4%',  trendUp: false, color: T.cRed,    soft: T.cRedSoft,    icon: Icons.flag,   data: [18,17,17,16,16,15,15,14,14,13,12,12] },
];

const DONUT_DATA = [
  { label: 'In Progress', value: 24, color: T.cBlue },
  { label: 'Pending',     value: 44, color: T.cYellow },
  { label: 'Completed',   value: 48, color: T.cGreen },
  { label: 'Overdue',     value: 12, color: T.cRed },
];

const MULTI_SERIES = [
  { label: 'In Progress', color: T.cBlue,  data: [5, 8, 12, 10, 16, 14, 20, 18, 22, 20, 24, 24] },
  { label: 'Completed',   color: T.cGreen, data: [3, 6, 10, 14, 18, 22, 26, 30, 34, 38, 44, 48] },
  { label: 'Overdue',     color: T.cRed,   data: [2, 4, 5, 6, 7, 7, 8, 9, 10, 10, 11, 12] },
];

const MULTI_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const QUICK_ACTIONS = [
  { label: 'New Project', icon: Icons.folder, color: T.cBlue,   soft: T.cBlueSoft   },
  { label: 'Upload Doc',  icon: Icons.upload, color: T.cGreen,  soft: T.cGreenSoft  },
  { label: 'New Task',    icon: Icons.task,   color: T.cYellow, soft: T.cYellowSoft },
  { label: 'Calendar',    icon: Icons.cal,    color: T.cPurple, soft: T.cPurpleSoft },
  { label: 'Reports',     icon: Icons.chart,  color: T.cRed,    soft: T.cRedSoft    },
  { label: 'Invite',      icon: Icons.team,   color: T.cBlue,   soft: T.cBlueSoft   },
];

const TAB_DEFS = [
  { id: 'upcoming',  label: 'Upcoming (5)' },
  { id: 'overdue',   label: 'Overdue (3)' },
  { id: 'completed', label: 'Completed (2)' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function tasksByTab(tabId) {
  const statusMap = { upcoming: 'In Progress', overdue: 'Overdue', completed: 'Completed' };
  const pending = TASKS.filter(t => t.status === 'Pending');
  const inProgress = TASKS.filter(t => t.status === 'In Progress');
  if (tabId === 'upcoming')  return [...inProgress, ...pending].slice(0, 5);
  if (tabId === 'overdue')   return TASKS.filter(t => t.status === 'Overdue').slice(0, 3);
  if (tabId === 'completed') return TASKS.filter(t => t.status === 'Completed').slice(0, 2);
  return [];
}

/* ------------------------------------------------------------------ */
/*  Dashboard Screen                                                   */
/* ------------------------------------------------------------------ */

export default function DashboardScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.surfaceAlt }}>

      {/* 1. Top Bar */}
      <TopBar
        title="Dashboard"
        subtitle="Welcome back, Rohit"
        onMenu={() => navigation.openDrawer()}
        onSearch={() => navigation.navigate('Search')}
        onBell={() => navigation.navigate('Notifications')}
        unread={3}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >

        {/* 2. Greeting card */}
        <LinearGradient
          colors={[T.brand, '#4D86F0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.greetCard}
        >
          {/* decorative circles */}
          <View style={[s.decoCircle, { width: 140, height: 140, top: -30, right: -20, opacity: 0.08 }]} />
          <View style={[s.decoCircle, { width: 80, height: 80, bottom: -20, left: 40, opacity: 0.06 }]} />
          <View style={[s.decoCircle, { width: 50, height: 50, top: 10, right: 70, opacity: 0.1 }]} />

          <Text style={s.greetDate}>Tuesday, May 12</Text>
          <Text style={s.greetMsg}>Here's what's happening with your workspace.</Text>

          <View style={s.greetStats}>
            <View style={s.greetStat}>
              <Text style={s.greetStatVal}>5</Text>
              <Text style={s.greetStatLbl}>Tasks today</Text>
            </View>
            <View style={s.greetDivider} />
            <View style={s.greetStat}>
              <Text style={s.greetStatVal}>3</Text>
              <Text style={s.greetStatLbl}>Meetings</Text>
            </View>
            <View style={s.greetDivider} />
            <View style={s.greetStat}>
              <Text style={s.greetStatVal}>12</Text>
              <Text style={s.greetStatLbl}>Overdue</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 3. Overview stat cards */}
        <SectionHeader right={<TextLink onPress={() => navigation.navigate('Tasks')}>See all</TextLink>}>
          Overview
        </SectionHeader>

        <View style={s.overviewGrid}>
          {OVERVIEW.map((item, idx) => (
            <Card key={idx} style={[s.statCard, idx === OVERVIEW.length - 1 && OVERVIEW.length % 2 !== 0 && { flex: 0, width: '48%' }]} padding={12}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={[s.statIcon, { backgroundColor: item.soft }]}>
                  {item.icon({ color: item.color, size: 16 })}
                </View>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View>
                  <Text style={s.statValue}>{item.value}</Text>
                  <Text style={[s.statDelta, { color: item.trendUp ? T.cGreen : T.cRed }]}>{item.delta}</Text>
                </View>
                <Sparkline color={item.color} data={item.data} w={80} h={28} />
              </View>
            </Card>
          ))}
        </View>

        {/* 4. Tasks by Status - Donut */}
        <SectionHeader>Tasks by Status</SectionHeader>
        <Card style={{ marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Donut data={DONUT_DATA} size={120} thick={18} />
            <View style={{ flex: 1, marginLeft: 20, gap: 10 }}>
              {DONUT_DATA.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
                  <Text style={{ flex: 1, fontSize: 12, color: T.ink2, fontWeight: '500' }}>{d.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '650', color: T.ink }}>{d.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* 5. Tasks Over Time - MultiLine */}
        <SectionHeader>Tasks Over Time</SectionHeader>
        <Card style={{ marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', gap: 14, marginBottom: 12 }}>
            {MULTI_SERIES.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                <Text style={{ fontSize: 11, color: T.ink3, fontWeight: '500' }}>{s.label}</Text>
              </View>
            ))}
          </View>
          <MultiLine series={MULTI_SERIES} labels={MULTI_LABELS} w={310} h={140} />
        </Card>

        {/* 6. My Tasks with tabs */}
        <SectionHeader right={<TextLink onPress={() => navigation.navigate('Tasks')}>View all</TextLink>}>
          My Tasks
        </SectionHeader>
        <Tabs tabs={TAB_DEFS}>
          {(activeTab) => (
            <>
              {tasksByTab(activeTab).map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onPress={() => navigation.navigate('TaskDetail', { id: task.id })}
                />
              ))}
              {tasksByTab(activeTab).length === 0 && (
                <Text style={{ padding: 20, textAlign: 'center', fontSize: 13, color: T.ink4 }}>No tasks</Text>
              )}
            </>
          )}
        </Tabs>

        {/* 7. Recent Activity */}
        <SectionHeader>Recent Activity</SectionHeader>
        <Card style={{ marginBottom: 22, padding: 0 }}>
          {ACTIVITY.map((item, idx) => (
            <View
              key={idx}
              style={[
                s.activityRow,
                idx < ACTIVITY.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
              ]}
            >
              <FileTile kind={item.kind} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: T.ink }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>{item.sub}</Text>
              </View>
              <Text style={{ fontSize: 10.5, color: T.ink4 }}>{item.when}</Text>
            </View>
          ))}
        </Card>

        {/* 8. Projects Overview */}
        <SectionHeader right={<TextLink onPress={() => navigation.navigate('Projects')}>See all</TextLink>}>
          Projects Overview
        </SectionHeader>
        <Card style={{ marginBottom: 22, padding: 0 }}>
          {PROJECTS.map((proj, idx) => (
            <TouchableOpacity
              key={proj.id}
              onPress={() => navigation.navigate('ProjectDetail', { id: proj.id })}
              activeOpacity={0.7}
              style={[
                s.projectRow,
                idx < PROJECTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
              ]}
            >
              <View style={[s.projectBar, { backgroundColor: proj.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '650', color: T.ink }} numberOfLines={1}>{proj.name}</Text>
                <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>{proj.tasks} tasks</Text>
              </View>
              <View style={{ width: 80, marginRight: 10 }}>
                <Progress value={proj.progress} color={proj.color} h={5} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '650', color: T.ink2, minWidth: 34, textAlign: 'right' }}>{proj.progress}%</Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* 9. Quick Actions */}
        <SectionHeader>Quick Actions</SectionHeader>
        <View style={s.quickGrid}>
          {QUICK_ACTIONS.map((action, idx) => (
            <TouchableOpacity key={idx} style={s.quickBtn} activeOpacity={0.7}>
              <View style={[s.quickIcon, { backgroundColor: action.soft }]}>
                {action.icon({ color: action.color, size: 20 })}
              </View>
              <Text style={s.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  /* Greeting card */
  greetCard: {
    borderRadius: T.rLg,
    padding: 20,
    marginBottom: 22,
    overflow: 'hidden',
  },
  decoCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  greetDate: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  greetMsg: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 21,
    marginBottom: 18,
  },
  greetStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  greetStat: {
    flex: 1,
    alignItems: 'center',
  },
  greetStatVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  greetStatLbl: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  greetDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  /* Overview grid */
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: T.ink3,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.4,
  },
  statDelta: {
    fontSize: 11,
    fontWeight: '650',
    marginTop: 2,
  },

  /* Activity */
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },

  /* Projects */
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  projectBar: {
    width: 8,
    height: 36,
    borderRadius: 4,
  },

  /* Quick Actions */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  quickBtn: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: T.ink2,
  },
});
