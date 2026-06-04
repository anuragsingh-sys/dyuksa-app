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
import { PROJECTS, TASKS, DOCS, TEAMMATES, ACTIVITY } from '../constants/data';
import { Icons } from '../components/Icons';
import {
  Card,
  Progress,
  SectionHeader,
  TextLink,
  StatusPill,
  AvatarStack,
  Avatar,
  TaskRow,
  FileTile,
} from '../components/SharedUI';

const TABS = ['Overview', 'Tasks', 'Docs', 'Team'];
const TAGS = ['Engineering', 'Design', 'Product'];

function HeroSection({ project, insets, onBack, onStar, onMore }) {
  const doneCount = Math.round((project.progress / 100) * project.tasks);
  return (
    <View style={[styles.hero, { backgroundColor: project.color, paddingTop: insets.top + 10 }]}>
      {/* Top actions */}
      <View style={styles.heroActions}>
        <TouchableOpacity onPress={onBack} style={styles.heroBtn}>
          {Icons.back({ color: '#fff', size: 22 })}
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onStar} style={styles.heroBtn}>
          {Icons.star({ color: '#fff', size: 20 })}
        </TouchableOpacity>
        <TouchableOpacity onPress={onMore} style={styles.heroBtn}>
          {Icons.more({ color: '#fff', size: 20 })}
        </TouchableOpacity>
      </View>

      {/* Project icon + info */}
      <View style={styles.heroInfo}>
        <View style={styles.heroIcon}>
          {Icons.folder({ color: '#fff', size: 26 })}
        </View>
        <Text style={styles.heroName}>{project.name}</Text>
        <Text style={styles.heroDesc}>{project.desc}</Text>
      </View>

      {/* Glass progress card */}
      <View style={styles.glassCard}>
        <View style={styles.glassProgressRow}>
          <Text style={styles.glassLabel}>Progress</Text>
          <Text style={styles.glassPercent}>{project.progress}%</Text>
        </View>
        <Progress value={project.progress} color="#fff" h={6} />
        <View style={styles.statsRow}>
          <StatItem label="Tasks" value={project.tasks} />
          <StatItem label="Done" value={doneCount} />
          <StatItem label="Members" value={project.members} />
          <StatItem label="Due" value="May 27" />
        </View>
      </View>
    </View>
  );
}

function StatItem({ label, value }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabBar({ activeTab, onChangeTab }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map(tab => {
        const active = tab === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChangeTab(tab)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ────────── Tab content ────────── */

function OverviewTab({ project }) {
  const doneCount = Math.round((project.progress / 100) * project.tasks);
  const inProgressCount = Math.round(project.tasks * 0.4);
  const pendingCount = project.tasks - doneCount - inProgressCount;

  const breakdownData = [
    { label: 'Completed', value: doneCount, total: project.tasks, color: T.cGreen },
    { label: 'In Progress', value: inProgressCount, total: project.tasks, color: T.cBlue },
    { label: 'Pending', value: Math.max(0, pendingCount), total: project.tasks, color: T.cYellow },
  ];

  return (
    <View style={styles.tabContent}>
      {/* About */}
      <Card>
        <Text style={styles.aboutTitle}>About</Text>
        <Text style={styles.aboutDesc}>{project.desc}</Text>
        <View style={styles.tagRow}>
          {TAGS.map(tag => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Task breakdown */}
      <Card>
        <SectionHeader>Task Breakdown</SectionHeader>
        {breakdownData.map(item => (
          <View key={item.label} style={styles.breakdownRow}>
            <View style={styles.breakdownLabel}>
              <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
              <Text style={styles.breakdownText}>{item.label}</Text>
            </View>
            <View style={styles.breakdownBar}>
              <Progress value={(item.value / item.total) * 100} color={item.color} h={6} />
            </View>
            <Text style={styles.breakdownCount}>{item.value}</Text>
          </View>
        ))}
      </Card>

      {/* Activity */}
      <Card>
        <SectionHeader right={<TextLink>See all</TextLink>}>
          Recent Activity
        </SectionHeader>
        {ACTIVITY.slice(0, 4).map((a, i) => (
          <View key={i} style={styles.activityRow}>
            <FileTile kind={a.kind} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activityTitle} numberOfLines={1}>{a.title}</Text>
              <Text style={styles.activitySub}>{a.sub}</Text>
            </View>
            <Text style={styles.activityWhen}>{a.when}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

function TasksTab({ tasks, onTaskPress }) {
  return (
    <View style={styles.tabContent}>
      <Card padding={0}>
        {tasks.map((task, i) => (
          <View key={task.id}>
            {i > 0 && <View style={styles.divider} />}
            <TaskRow task={task} onPress={() => onTaskPress(task.id)} />
          </View>
        ))}
        {tasks.length === 0 && (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyText}>No tasks yet</Text>
          </View>
        )}
      </Card>
    </View>
  );
}

function DocsTab({ docs, onDocPress }) {
  return (
    <View style={styles.tabContent}>
      {docs.map(doc => (
        <Card key={doc.id} onPress={() => onDocPress(doc.id)} style={styles.docCard}>
          <View style={styles.docRow}>
            <FileTile kind={doc.kind} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
              <Text style={styles.docMeta}>{doc.folder}  ·  {doc.size}</Text>
            </View>
            <Text style={styles.docTime}>{doc.modified}</Text>
          </View>
        </Card>
      ))}
      {docs.length === 0 && (
        <Card>
          <View style={styles.emptyTab}>
            <Text style={styles.emptyText}>No documents yet</Text>
          </View>
        </Card>
      )}
    </View>
  );
}

function TeamTab({ members }) {
  return (
    <View style={styles.tabContent}>
      <Card padding={0}>
        {members.map((m, i) => (
          <View key={i}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.memberRow}>
              <Avatar name={m.name} color={m.color} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>{m.role}</Text>
              </View>
              {Icons.chevR({ color: T.ink4, size: 16 })}
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

/* ────────── Main screen ────────── */

export default function ProjectDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const projectId = route?.params?.id;
  const project = useMemo(
    () => PROJECTS.find(p => p.id === projectId) || PROJECTS[0],
    [projectId],
  );

  const [activeTab, setActiveTab] = useState('Overview');

  const projectTasks = useMemo(
    () => TASKS.filter(t => t.project === project.name.replace(' Project', '')),
    [project],
  );

  const projectDocs = useMemo(
    () => DOCS.filter(d => d.folder.toLowerCase().includes(project.name.split(' ')[0].toLowerCase())),
    [project],
  );

  const projectMembers = useMemo(
    () => TEAMMATES.slice(0, project.members),
    [project],
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'Overview':
        return <OverviewTab project={project} />;
      case 'Tasks':
        return (
          <TasksTab
            tasks={projectTasks}
            onTaskPress={id => navigation.navigate('TaskDetail', { id })}
          />
        );
      case 'Docs':
        return (
          <DocsTab
            docs={projectDocs}
            onDocPress={id => navigation.navigate('DocumentViewer', { id })}
          />
        );
      case 'Team':
        return <TeamTab members={projectMembers} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <HeroSection
          project={project}
          insets={insets}
          onBack={() => navigation.goBack()}
          onStar={() => {}}
          onMore={() => {}}
        />

        <View style={styles.body}>
          <TabBar activeTab={activeTab} onChangeTab={setActiveTab} />
          {renderTab()}
        </View>
      </ScrollView>

      {/* FAB for creating tasks */}
      {activeTab === 'Tasks' && (
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateTask')}
          style={styles.fab}
        >
          <Text style={styles.fabPlus}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
  },

  /* Hero */
  hero: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  heroBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    alignItems: 'center',
    marginBottom: 18,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },

  /* Glass card */
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: T.rLg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  glassProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  glassLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  glassPercent: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  /* Body / tabs */
  body: {
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: T.r || 10,
  },
  tabActive: {
    backgroundColor: T.ink,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '650',
    color: T.ink3,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    gap: 14,
  },

  /* Overview - About */
  aboutTitle: {
    fontSize: 14,
    fontWeight: '650',
    color: T.ink,
    marginBottom: 6,
  },
  aboutDesc: {
    fontSize: 13,
    color: T.ink2,
    lineHeight: 20,
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: T.surfaceCool,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: T.ink2,
  },

  /* Overview - Breakdown */
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 100,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownText: {
    fontSize: 12,
    color: T.ink2,
    fontWeight: '500',
  },
  breakdownBar: {
    flex: 1,
  },
  breakdownCount: {
    fontSize: 12,
    fontWeight: '650',
    color: T.ink,
    width: 28,
    textAlign: 'right',
  },

  /* Overview - Activity */
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink,
  },
  activitySub: {
    fontSize: 11,
    color: T.ink3,
    marginTop: 2,
  },
  activityWhen: {
    fontSize: 11,
    color: T.ink4,
  },

  /* Tasks tab */
  divider: {
    height: 1,
    backgroundColor: T.hairlineSoft,
    marginHorizontal: 12,
  },
  emptyTab: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: T.ink3,
  },

  /* Docs tab */
  docCard: {
    marginBottom: 2,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  docName: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink,
    marginBottom: 2,
  },
  docMeta: {
    fontSize: 11,
    color: T.ink3,
  },
  docTime: {
    fontSize: 11,
    color: T.ink4,
  },

  /* Team tab */
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: T.ink,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: T.ink3,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 36,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.brand,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 30,
  },
  fabPlus: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '400',
    marginTop: -2,
  },
});
