import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/tokens';
import { PROJECTS, TEAMMATES } from '../constants/data';
import { Icons } from '../components/Icons';
import {
  TopBar,
  Card,
  Progress,
  SectionHeader,
  TextLink,
  StatusPill,
  AvatarStack,
} from '../components/SharedUI';

const FILTERS = ['All', 'In Progress', 'Completed', 'Starred'];

const PINNED = PROJECTS.slice(0, 3);

function SummaryTile({ label, count, dotColor }) {
  return (
    <View style={styles.summaryTile}>
      <View style={styles.summaryRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={styles.summaryCount}>{count}</Text>
    </View>
  );
}

function PinnedCard({ project, onPress }) {
  const memberSlice = TEAMMATES.slice(0, project.members);
  return (
    <Card onPress={onPress} style={styles.pinnedCard} padding={0}>
      <View style={[styles.pinnedColorBar, { backgroundColor: project.color }]} />
      <View style={styles.pinnedBody}>
        <View style={styles.pinnedHeader}>
          <View style={[styles.projectIcon, { backgroundColor: project.color + '22', width: 32, height: 32, borderRadius: 10 }]}>
            {Icons.folder({ color: project.color, size: 16 })}
          </View>
          <View style={styles.pinIcon}>
            {Icons.pin({ color: T.ink4, size: 14 })}
          </View>
        </View>
        <Text style={styles.pinnedName} numberOfLines={1}>{project.name}</Text>
        <Text style={styles.pinnedDesc} numberOfLines={2}>{project.desc}</Text>
        <View style={{ marginTop: 10 }}>
          <Progress value={project.progress} color={project.color} h={5} />
        </View>
        <View style={styles.pinnedFooter}>
          <AvatarStack members={memberSlice} max={3} size={22} />
          <Text style={styles.pinnedPercent}>{project.progress}%</Text>
        </View>
      </View>
    </Card>
  );
}

function ProjectListItem({ project, onPress }) {
  const memberSlice = TEAMMATES.slice(0, project.members);
  return (
    <Card onPress={onPress} style={styles.listCard}>
      <View style={styles.listTop}>
        <View style={[styles.projectIcon, { backgroundColor: project.color + '22', width: 40, height: 40, borderRadius: 12 }]}>
          {Icons.folder({ color: project.color, size: 20 })}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listName}>{project.name}</Text>
          <Text style={styles.listDesc} numberOfLines={1}>{project.desc}</Text>
        </View>
        <StatusPill status={project.status} />
      </View>
      <View style={{ marginTop: 10 }}>
        <Progress value={project.progress} color={project.color} h={5} />
        <View style={styles.listFooter}>
          <AvatarStack members={memberSlice} max={4} size={24} />
          <Text style={styles.listPercent}>{project.progress}%</Text>
          <View style={styles.taskBadge}>
            {Icons.task({ color: T.ink3, size: 13 })}
            <Text style={styles.taskCount}>{project.tasks}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function ProjectsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = useMemo(() => {
    let list = PROJECTS;
    if (activeFilter === 'In Progress') list = list.filter(p => p.status === 'In Progress');
    else if (activeFilter === 'Completed') list = list.filter(p => p.status === 'Completed');
    else if (activeFilter === 'Starred') list = list.filter(p => ['alpha', 'gamma'].includes(p.id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
    }
    return list;
  }, [activeFilter, search]);

  return (
    <View style={styles.container}>
      <TopBar
        title="Projects"
        subtitle="5 workspaces"
        onMenu={() => navigation.openDrawer()}
        onSearch={() => navigation.navigate('Search')}
        onBell={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary tiles */}
        <View style={styles.summaryRow3}>
          <SummaryTile label="Active" count={4} dotColor={T.cBlue} />
          <SummaryTile label="On track" count={3} dotColor={T.cGreen} />
          <SummaryTile label="At risk" count={1} dotColor={T.cYellow} />
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <View style={styles.searchIcon}>
            {Icons.search({ color: T.ink4, size: 18 })}
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects"
            placeholderTextColor={T.ink4}
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity style={styles.filterBtn}>
            {Icons.filter({ color: T.ink3, size: 18 })}
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTERS.map(f => {
            const active = f === activeFilter;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Pinned section */}
        <SectionHeader right={<TextLink>See all</TextLink>}>
          Pinned
        </SectionHeader>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pinnedRow}
        >
          {PINNED.map(p => (
            <PinnedCard
              key={p.id}
              project={p}
              onPress={() => navigation.navigate('ProjectDetail', { id: p.id })}
            />
          ))}
        </ScrollView>

        {/* All projects */}
        <SectionHeader right={<TextLink>Sort</TextLink>}>
          All Projects
        </SectionHeader>
        {filtered.map(p => (
          <ProjectListItem
            key={p.id}
            project={p}
            onPress={() => navigation.navigate('ProjectDetail', { id: p.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },

  /* Summary tiles */
  summaryRow3: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: T.ink3,
    fontWeight: '500',
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.4,
  },

  /* Search bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surfaceAlt,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: {
    width: 22,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: T.ink,
    height: 44,
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Filter chips */
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.hairline,
  },
  chipActive: {
    backgroundColor: T.ink,
    borderColor: T.ink,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.ink2,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  /* Pinned cards */
  pinnedRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 4,
  },
  pinnedCard: {
    width: 200,
    overflow: 'hidden',
  },
  pinnedColorBar: {
    height: 4,
  },
  pinnedBody: {
    padding: 12,
  },
  pinnedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pinIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedName: {
    fontSize: 14,
    fontWeight: '650',
    color: T.ink,
    marginBottom: 3,
  },
  pinnedDesc: {
    fontSize: 12,
    color: T.ink3,
    lineHeight: 17,
  },
  pinnedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  pinnedPercent: {
    fontSize: 12,
    fontWeight: '650',
    color: T.ink2,
  },

  /* List cards */
  listCard: {
    marginBottom: 2,
  },
  listTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  projectIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listName: {
    fontSize: 14,
    fontWeight: '650',
    color: T.ink,
    marginBottom: 2,
  },
  listDesc: {
    fontSize: 12,
    color: T.ink3,
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 12,
  },
  listPercent: {
    fontSize: 12,
    fontWeight: '650',
    color: T.ink2,
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  taskCount: {
    fontSize: 12,
    color: T.ink3,
    fontWeight: '600',
  },
});
