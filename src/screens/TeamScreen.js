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
import { USER, TEAMMATES } from '../constants/data';
import { Icons } from '../components/Icons';
import { TopBar, Card, Avatar } from '../components/SharedUI';

/* ── static data ─────────────────────────────────────── */

const DEPT_FILTERS = ['All', 'Engineering', 'Design', 'Product', 'Marketing', 'Operations'];

/* ── helpers ──────────────────────────────────────────── */

function groupAlphabetically(members) {
  const groups = {};
  members.forEach(m => {
    const letter = m.name[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(m);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

/* ── member row ──────────────────────────────────────── */

function MemberRow({ member, isLast }) {
  return (
    <View
      style={[
        styles.memberRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
      ]}
    >
      <Avatar name={member.name} color={member.color} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRole}>{member.role}</Text>
      </View>
      <TouchableOpacity style={styles.memberAction}>
        {Icons.comment({ color: T.ink4, size: 18 })}
      </TouchableOpacity>
      <TouchableOpacity style={styles.memberAction}>
        {Icons.more({ color: T.ink4, size: 18 })}
      </TouchableOpacity>
    </View>
  );
}

/* ── main screen ─────────────────────────────────────── */

export default function TeamScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeDept, setActiveDept] = useState('All');

  const filtered = useMemo(() => {
    let list = TEAMMATES;
    if (activeDept !== 'All') {
      list = list.filter(m => m.role === activeDept);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeDept, search]);

  const groups = useMemo(() => groupAlphabetically(filtered), [filtered]);

  return (
    <View style={styles.container}>
      <TopBar
        title="Team"
        subtitle={`${TEAMMATES.length + 1} members`}
        onMenu={() => navigation.openDrawer()}
        right={
          <TouchableOpacity style={styles.iconBtn}>
            {Icons.plus({ color: T.brand, size: 22 })}
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View style={styles.searchBar}>
          <View style={styles.searchIconWrap}>
            {Icons.search({ color: T.ink4, size: 18 })}
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search team members"
            placeholderTextColor={T.ink4}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Department filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {DEPT_FILTERS.map(f => {
            const active = f === activeDept;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveDept(f)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Owner card */}
        <Card style={styles.ownerCard}>
          <View style={styles.ownerRow}>
            <Avatar name={USER.name} color={T.brand} size={48} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.ownerName}>{USER.name}</Text>
                <Text style={styles.ownerYou}>(You)</Text>
              </View>
              <Text style={styles.ownerEmail}>{USER.email}</Text>
            </View>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          </View>
        </Card>

        {/* Grouped alphabetical list */}
        {groups.map(([letter, members]) => (
          <View key={letter} style={{ marginBottom: 6 }}>
            <Text style={styles.letterHeader}>{letter}</Text>
            <Card style={{ padding: 0 }}>
              {members.map((m, idx) => (
                <MemberRow
                  key={m.name}
                  member={m}
                  isLast={idx === members.length - 1}
                />
              ))}
            </Card>
          </View>
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No members found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filter</Text>
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
  scroll: {
    padding: 16,
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  searchIconWrap: {
    width: 22,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: T.ink,
    height: 44,
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

  /* Owner card */
  ownerCard: {
    marginBottom: 4,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: '650',
    color: T.ink,
  },
  ownerYou: {
    fontSize: 12,
    color: T.ink3,
    fontWeight: '500',
  },
  ownerEmail: {
    fontSize: 12,
    color: T.ink3,
    marginTop: 2,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: T.brandSoft,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: T.brand,
    letterSpacing: 0.5,
  },

  /* Letter header */
  letterHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: T.ink4,
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginTop: 4,
  },

  /* Member row */
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: T.ink,
  },
  memberRole: {
    fontSize: 12,
    color: T.ink3,
    marginTop: 2,
  },
  memberAction: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Empty state */
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 6,
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
