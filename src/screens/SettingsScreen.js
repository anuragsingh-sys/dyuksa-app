import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/tokens';
import { USER } from '../constants/data';
import { Icons } from '../components/Icons';
import { TopBar, Card, Avatar } from '../components/SharedUI';

/* ── settings groups ─────────────────────────────────── */

const SETTINGS_GROUPS = [
  {
    header: 'ACCOUNT',
    rows: [
      { label: 'Personal info',  detail: 'Name, email, photo', icon: Icons.user,     color: T.cBlue,   soft: T.cBlueSoft   },
      { label: 'Notifications',  detail: 'Push, email, in-app', icon: Icons.bell,     color: T.cPurple, soft: T.cPurpleSoft },
      { label: 'Preferences',    detail: 'Defaults & behavior', icon: Icons.settings, color: T.cGreen,  soft: T.cGreenSoft  },
    ],
  },
  {
    header: 'WORKSPACE',
    rows: [
      { label: 'Workspace',    detail: 'Dyuksa HQ',         icon: Icons.work,   color: T.cBlue,   soft: T.cBlueSoft   },
      { label: 'Members',      detail: '7 members',         icon: Icons.team,   color: T.cGreen,  soft: T.cGreenSoft  },
      { label: 'Integrations', detail: '3 connected',       icon: Icons.link,   color: T.cPurple, soft: T.cPurpleSoft },
      { label: 'Billing',      detail: 'Pro plan',          icon: Icons.doc,    color: T.cYellow, soft: T.cYellowSoft },
    ],
  },
  {
    header: 'APPEARANCE',
    rows: [
      { label: 'Theme',        detail: 'Light',             icon: Icons.star,   color: T.cYellow, soft: T.cYellowSoft },
      { label: 'Accent color', detail: 'Blue',              icon: Icons.flag,   color: T.cBlue,   soft: T.cBlueSoft   },
      { label: 'Language',     detail: 'English',           icon: Icons.doc,    color: T.cGreen,  soft: T.cGreenSoft  },
    ],
  },
  {
    header: 'SUPPORT',
    rows: [
      { label: 'Help center',       detail: 'Guides & FAQ',       icon: Icons.comment, color: T.cBlue,   soft: T.cBlueSoft   },
      { label: 'Contact support',   detail: 'Chat or email',      icon: Icons.comment, color: T.cPurple, soft: T.cPurpleSoft },
      { label: 'Terms & Privacy',   detail: 'Legal documents',    icon: Icons.doc,     color: T.cGreen,  soft: T.cGreenSoft  },
    ],
  },
];

const PROFILE_STATS = [
  { label: 'Tasks', value: '38'  },
  { label: 'Projects', value: '5' },
  { label: 'Streak', value: '12d' },
];

/* ── settings row ────────────────────────────────────── */

function SettingsRow({ row, isLast }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.settingsRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: row.soft }]}>
        {row.icon({ color: row.color, size: 17 })}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        <Text style={styles.rowDetail}>{row.detail}</Text>
      </View>
      {Icons.chevR({ color: T.ink4, size: 16 })}
    </TouchableOpacity>
  );
}

/* ── main screen ─────────────────────────────────────── */

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TopBar
        title="Settings"
        onMenu={() => navigation.openDrawer()}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarWrap}>
              <Avatar name={USER.name} color={T.brand} size={64} />
              <TouchableOpacity style={styles.editOverlay}>
                {Icons.doc({ color: '#fff', size: 12, sw: 2 })}
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{USER.name}</Text>
              <Text style={styles.profileEmail}>{USER.email}</Text>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            {PROFILE_STATS.map((stat, i) => (
              <View key={i} style={[styles.statItem, i < PROFILE_STATS.length - 1 && styles.statDivider]}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Settings groups */}
        {SETTINGS_GROUPS.map((group, gi) => (
          <View key={gi} style={{ marginBottom: 18 }}>
            <Text style={styles.groupHeader}>{group.header}</Text>
            <Card style={{ padding: 0 }}>
              {group.rows.map((row, ri) => (
                <SettingsRow key={ri} row={row} isLast={ri === group.rows.length - 1} />
              ))}
            </Card>
          </View>
        ))}

        {/* Log out */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7}>
          {Icons.logout({ color: T.cRed, size: 20 })}
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Dyuksa for iOS · v2.6.1</Text>
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
  },

  /* Profile card */
  profileCard: {
    marginBottom: 22,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatarWrap: {
    position: 'relative',
  },
  editOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: T.ink,
  },
  profileEmail: {
    fontSize: 13,
    color: T.ink3,
    marginTop: 2,
  },
  adminBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: T.brandSoft,
    marginTop: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: T.brand,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: T.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    borderRightWidth: 1,
    borderRightColor: T.hairline,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: T.ink,
  },
  statLabel: {
    fontSize: 11,
    color: T.ink3,
    fontWeight: '500',
    marginTop: 2,
  },

  /* Group header */
  groupHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: T.ink4,
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },

  /* Settings row */
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: T.ink,
  },
  rowDetail: {
    fontSize: 12,
    color: T.ink3,
    marginTop: 1,
  },

  /* Log out */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '650',
    color: T.cRed,
  },

  /* Version */
  versionText: {
    fontSize: 12,
    color: T.ink4,
    textAlign: 'center',
    marginBottom: 8,
  },
});
