import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { TASKS, PROJECTS, DOCS, TEAMMATES } from '../constants/data';
import { Icons } from '../components/Icons';
import { Card, Avatar, StatusPill, FileTile } from '../components/SharedUI';

/* ── static data ─────────────────────────────────────── */

const RECENT_SEARCHES = [
  'AI Inaccuracy bug',
  'Alpha Project',
  'Q1 Financial Report',
  'Harshit S.',
];

const QUICK_FILTERS = [
  { label: 'Overdue',        color: T.cRed,    soft: T.cRedSoft    },
  { label: 'Due this week',  color: T.cYellow, soft: T.cYellowSoft },
  { label: 'My tasks',       color: T.cBlue,   soft: T.cBlueSoft   },
  { label: 'High priority',  color: T.cPurple, soft: T.cPurpleSoft },
  { label: 'Completed',      color: T.cGreen,  soft: T.cGreenSoft  },
];

/* ── search logic ────────────────────────────────────── */

function useSearchResults(query) {
  return useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();

    const tasks = TASKS.filter(t =>
      t.title.toLowerCase().includes(q) || t.project.toLowerCase().includes(q)
    );
    const projects = PROJECTS.filter(p =>
      p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
    );
    const docs = DOCS.filter(d =>
      d.name.toLowerCase().includes(q) || d.folder.toLowerCase().includes(q)
    );
    const people = TEAMMATES.filter(t =>
      t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q)
    );

    return { tasks, projects, docs, people };
  }, [query]);
}

/* ── main screen ─────────────────────────────────────── */

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const results = useSearchResults(query);

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const hasResults = results && (
    results.tasks.length > 0 ||
    results.projects.length > 0 ||
    results.docs.length > 0 ||
    results.people.length > 0
  );

  const noResults = results && !hasResults;

  return (
    <View style={styles.container}>
      {/* Custom search nav */}
      <View style={[styles.searchNav, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          {Icons.back({ color: T.ink, size: 24 })}
        </TouchableOpacity>
        <View style={styles.searchInputWrap}>
          {Icons.search({ color: T.ink4, size: 18 })}
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search tasks, projects, docs..."
            placeholderTextColor={T.ink4}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              {Icons.close({ color: T.ink4, size: 16 })}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty state: no query */}
        {!results && (
          <>
            {/* Recent searches */}
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <Card style={{ padding: 0, marginBottom: 18 }}>
              {RECENT_SEARCHES.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setQuery(s)}
                  style={[
                    styles.recentRow,
                    idx < RECENT_SEARCHES.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
                  ]}
                >
                  {Icons.search({ color: T.ink4, size: 16 })}
                  <Text style={styles.recentText}>{s}</Text>
                  {Icons.trend({ color: T.ink4, size: 14 })}
                </TouchableOpacity>
              ))}
            </Card>

            {/* Quick filters */}
            <Text style={styles.sectionTitle}>Quick Filters</Text>
            <View style={styles.quickRow}>
              {QUICK_FILTERS.map((f, idx) => (
                <TouchableOpacity key={idx} style={[styles.quickChip, { backgroundColor: f.soft }]} activeOpacity={0.7}>
                  <View style={[styles.quickDot, { backgroundColor: f.color }]} />
                  <Text style={[styles.quickLabel, { color: f.color }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Search results */}
        {hasResults && (
          <>
            {/* Tasks */}
            {results.tasks.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Tasks ({results.tasks.length})</Text>
                <Card style={{ padding: 0, marginBottom: 18 }}>
                  {results.tasks.map((task, idx) => (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => navigation.navigate('TaskDetail', { id: task.id })}
                      activeOpacity={0.7}
                      style={[
                        styles.resultRow,
                        idx < results.tasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
                      ]}
                    >
                      <View style={styles.resultIcon}>
                        {Icons.task({ color: T.cBlue, size: 18 })}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{task.title}</Text>
                        <Text style={styles.resultSub}>{task.project} · {task.date}</Text>
                      </View>
                      <StatusPill status={task.status} />
                    </TouchableOpacity>
                  ))}
                </Card>
              </>
            )}

            {/* Projects */}
            {results.projects.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Projects ({results.projects.length})</Text>
                <Card style={{ padding: 0, marginBottom: 18 }}>
                  {results.projects.map((proj, idx) => (
                    <TouchableOpacity
                      key={proj.id}
                      onPress={() => navigation.navigate('ProjectDetail', { id: proj.id })}
                      activeOpacity={0.7}
                      style={[
                        styles.resultRow,
                        idx < results.projects.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
                      ]}
                    >
                      <View style={[styles.resultIcon, { backgroundColor: proj.color + '22' }]}>
                        {Icons.folder({ color: proj.color, size: 18 })}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{proj.name}</Text>
                        <Text style={styles.resultSub}>{proj.tasks} tasks · {proj.progress}% complete</Text>
                      </View>
                      {Icons.chevR({ color: T.ink4, size: 16 })}
                    </TouchableOpacity>
                  ))}
                </Card>
              </>
            )}

            {/* Documents */}
            {results.docs.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Documents ({results.docs.length})</Text>
                <Card style={{ padding: 0, marginBottom: 18 }}>
                  {results.docs.map((doc, idx) => (
                    <TouchableOpacity
                      key={doc.id}
                      onPress={() => navigation.navigate('DocumentViewer', { id: doc.id })}
                      activeOpacity={0.7}
                      style={[
                        styles.resultRow,
                        idx < results.docs.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
                      ]}
                    >
                      <FileTile kind={doc.kind} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{doc.name}</Text>
                        <Text style={styles.resultSub}>{doc.folder} · {doc.size}</Text>
                      </View>
                      {Icons.chevR({ color: T.ink4, size: 16 })}
                    </TouchableOpacity>
                  ))}
                </Card>
              </>
            )}

            {/* People */}
            {results.people.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>People ({results.people.length})</Text>
                <Card style={{ padding: 0, marginBottom: 18 }}>
                  {results.people.map((person, idx) => (
                    <View
                      key={person.name}
                      style={[
                        styles.resultRow,
                        idx < results.people.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
                      ]}
                    >
                      <Avatar name={person.name} color={person.color} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle}>{person.name}</Text>
                        <Text style={styles.resultSub}>{person.role}</Text>
                      </View>
                      {Icons.comment({ color: T.ink4, size: 18 })}
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        {/* No results */}
        {noResults && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              {Icons.search({ color: T.ink4, size: 28 })}
            </View>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>Try a different search term</Text>
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

  /* Search nav */
  searchNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.hairlineSoft,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surfaceAlt,
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: T.ink,
    height: 40,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.hairlineSoft,
  },

  /* Scroll */
  scroll: {
    padding: 16,
  },

  /* Section title */
  sectionTitle: {
    fontSize: 15,
    fontWeight: '650',
    color: T.ink,
    letterSpacing: -0.2,
    marginBottom: 8,
    marginTop: 4,
  },

  /* Recent searches */
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  recentText: {
    flex: 1,
    fontSize: 14,
    color: T.ink2,
    fontWeight: '500',
  },

  /* Quick filters */
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  quickDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Result rows */
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: T.cBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: T.ink,
  },
  resultSub: {
    fontSize: 12,
    color: T.ink3,
    marginTop: 2,
  },

  /* Empty state */
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
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
