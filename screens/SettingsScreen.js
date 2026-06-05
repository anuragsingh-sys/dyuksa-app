import React, { useContext } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';

// ── Token colours (inline — no dev_1 dep) ────────────────────────────────────
const T = {
  brand: '#2D6AE3', brandSoft: '#EAF1FE',
  ink: '#0E1726', ink2: '#3B4658', ink3: '#6B7588', ink4: '#9AA3B2',
  hairline: '#E6E9EF', hairlineSoft: '#F0F2F6',
  surface: '#FFFFFF', surfaceAlt: '#F7F8FB', surfaceCool: '#F2F4F8',
  cBlue: '#2D6AE3', cBlueSoft: '#E6EEFC',
  cGreen: '#22A06B', cGreenSoft: '#E2F5EC',
  cYellow: '#E5A60E', cYellowSoft: '#FEF3CE',
  cPurple: '#7A5AF8', cPurpleSoft: '#EEEAFE',
  cRed: '#E5484D', cRedSoft: '#FBE3E3',
  r: 10, rMd: 14, rLg: 20,
};

// ── Segment control (from main) ───────────────────────────────────────────────
const SegmentControl = ({ options, value, onChange, isDark }) => (
  <View style={[s.segment, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}>
    {options.map(opt => (
      <TouchableOpacity
        key={opt}
        style={[s.segmentBtn, value === opt && s.segmentBtnActive]}
        onPress={() => onChange(opt)}
      >
        <Text style={[s.segmentText, value === opt && s.segmentTextActive]}>{opt}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ── Settings row (dev_1 style with colored icon) ──────────────────────────────
function SettingsRow({ icon, label, detail, color, soft, right, onPress, isLast, isDark, bdr, txt, sub }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.settingsRow, !isLast && { borderBottomWidth: 1, borderBottomColor: isDark ? '#252530' : T.hairlineSoft }]}
    >
      <View style={[s.rowIcon, { backgroundColor: isDark ? (color + '22') : soft }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: txt }]}>{label}</Text>
        {detail ? <Text style={[s.rowDetail, { color: sub }]}>{detail}</Text> : null}
      </View>
      {right ? right : onPress ? <Text style={[s.chevron, { color: isDark ? '#3A3A48' : T.hairline }]}>›</Text> : null}
    </Wrap>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const ctx        = useContext(ThemeContext);
  const { logout, user } = useContext(AuthContext);

  const {
    theme, fontSize, fontScale, setSetting,
    dataMode, projectView, collapseSidebar,
    desktopNotif, emailNotif, chatMention,
    taskAssign, notifSound, sessionAlerts,
  } = ctx;

  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : T.surfaceAlt;
  const card = isDark ? '#1A1A20' : T.surface;
  const txt  = isDark ? '#FFFFFF' : T.ink;
  const sub  = isDark ? '#9898A6' : T.ink3;
  const bdr  = isDark ? '#252530' : T.hairline;
  const fs   = sz => sz * fontScale;

  const sw = (key, val) => (
    <Switch
      value={val}
      onValueChange={v => setSetting(key, v)}
      trackColor={{ false: bdr, true: '#1A1A2E' }}
      thumbColor="#fff"
    />
  );

  // Profile stats from real user data
  const userName  = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username || 'User';
  const userEmail = user?.email || '';
  const userRole  = user?.role || user?.is_superuser ? 'Admin' : 'Member';
  const initials  = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Settings" />
          <TouchableOpacity
            style={s.logoBox}
            onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}
          >
            <Text style={s.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={[s.brandName, { color: txt }]}>Settings</Text>
        </View>
        <View style={s.navRight}>
          <NotificationBell />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        style={{ backgroundColor: bg }}
      >
        {/* ── Profile card (dev_1 UI) ── */}
        <View style={[s.profileCard, { backgroundColor: card, borderColor: bdr }]}>
          {/* Avatar + info */}
          <View style={s.profileTop}>
            <View style={s.avatarWrap}>
              <View style={[s.avatar, { backgroundColor: T.brand }]}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
              <TouchableOpacity
                style={s.editOverlay}
                onPress={() => navigation.navigate('EditProfile')}
              >
                <Text style={{ fontSize: 10, color: '#fff' }}>✎</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.profileName, { color: txt, fontSize: fs(17) }]}>{userName}</Text>
              <Text style={[s.profileEmail, { color: sub, fontSize: fs(13) }]}>{userEmail}</Text>
              <View style={s.adminBadge}>
                <Text style={s.adminBadgeText}>{userRole.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View style={[s.statsRow, { backgroundColor: isDark ? '#252530' : T.surfaceAlt }]}>
            {[
              { label: 'Theme',    value: theme },
              { label: 'FontSize', value: fontSize },
              { label: 'DataMode', value: dataMode || 'Cloud' },
            ].map((stat, i, arr) => (
              <View key={i} style={[s.statItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: bdr }]}>
                <Text style={[s.statValue, { color: txt, fontSize: fs(13) }]}>{stat.value}</Text>
                <Text style={[s.statLabel, { color: sub, fontSize: fs(11) }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── APPEARANCE ── */}
        <Text style={[s.groupHeader, { color: sub, fontSize: fs(11) }]}>APPEARANCE</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
          <SettingsRow
            icon="🎨" label="Theme" detail={`${theme} mode`}
            color={T.cBlue} soft={T.cBlueSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            right={<SegmentControl options={['Light','Dark']} value={theme} onChange={v => setSetting('theme', v)} isDark={isDark} />}
          />
          <SettingsRow
            icon="Aa" label="Font Size" detail={fontSize}
            color={T.cPurple} soft={T.cPurpleSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            right={<SegmentControl options={['Small','Medium','Large']} value={fontSize} onChange={v => setSetting('fontSize', v)} isDark={isDark} />}
          />
          <SettingsRow
            icon="☰" label="Collapse Sidebar" detail="Start minimized"
            color={T.cGreen} soft={T.cGreenSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            right={sw('collapseSidebar', collapseSidebar)} isLast
          />
        </View>

        {/* ── CONFIGURATION ── */}
        <Text style={[s.groupHeader, { color: sub, fontSize: fs(11) }]}>CONFIGURATION</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
          <SettingsRow
            icon="💾" label="Data Mode" detail="Where data is stored"
            color={T.cYellow} soft={T.cYellowSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            right={<SegmentControl options={['Local','Cloud']} value={dataMode || 'Cloud'} onChange={v => setSetting('dataMode', v)} isDark={isDark} />}
          />
          <SettingsRow
            icon="⊞" label="Project View" detail="How projects display"
            color={T.cBlue} soft={T.cBlueSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            right={<SegmentControl options={['Grid','Table']} value={projectView || 'Grid'} onChange={v => setSetting('projectView', v)} isDark={isDark} />}
            isLast
          />
        </View>

        {/* ── NOTIFICATIONS ── */}
        <Text style={[s.groupHeader, { color: sub, fontSize: fs(11) }]}>NOTIFICATIONS</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
          <SettingsRow icon="🖥"  label="Desktop Notifications"  detail="Push alerts in browser"           color={T.cBlue}   soft={T.cBlueSoft}   isDark={isDark} bdr={bdr} txt={txt} sub={sub} right={sw('desktopNotif', desktopNotif)} />
          <SettingsRow icon="✉️"  label="Email Notifications"    detail="Updates to your inbox"            color={T.cGreen}  soft={T.cGreenSoft}  isDark={isDark} bdr={bdr} txt={txt} sub={sub} right={sw('emailNotif', emailNotif)} />
          <SettingsRow icon="💬"  label="Chat Mentions"          detail="When someone @mentions you"       color={T.cPurple} soft={T.cPurpleSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub} right={sw('chatMention', chatMention)} />
          <SettingsRow icon="📋"  label="Task Assignments"       detail="When a task is assigned to you"  color={T.cYellow} soft={T.cYellowSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub} right={sw('taskAssign', taskAssign)} />
          <SettingsRow icon="🔊"  label="Notification Sound"     detail="Play sound for notifications"    color={T.cBlue}   soft={T.cBlueSoft}   isDark={isDark} bdr={bdr} txt={txt} sub={sub} right={sw('notifSound', notifSound)} isLast />
        </View>

        {/* ── SECURITY ── */}
        <Text style={[s.groupHeader, { color: sub, fontSize: fs(11) }]}>SECURITY</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
          <SettingsRow
            icon="⏱" label="Auto-logout" detail="Sign out after inactivity"
            color={T.cRed} soft={T.cRedSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            right={
              <View style={[s.dropdownBox, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
                <Text style={[{ fontSize: 12, fontWeight: '500', color: txt }]}>30 min</Text>
                <Text style={{ color: sub, fontSize: 10 }}>▾</Text>
              </View>
            }
          />
          <SettingsRow
            icon="🔔" label="Session Alerts" detail="Notify on new device login"
            color={T.cYellow} soft={T.cYellowSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            right={sw('sessionAlerts', sessionAlerts)} isLast
          />
        </View>

        {/* ── ACCOUNT ── */}
        <Text style={[s.groupHeader, { color: sub, fontSize: fs(11) }]}>ACCOUNT</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
          <SettingsRow
            icon="👤" label="Edit Profile" detail="Update name and avatar"
            color={T.cBlue} soft={T.cBlueSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsRow
            icon="🔒" label="Change Password" detail="Update your password"
            color={T.cPurple} soft={T.cPurpleSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub}
            onPress={() => navigation.navigate('ChangePassword')}
            isLast
          />
        </View>

        {/* ── SUPPORT ── */}
        <Text style={[s.groupHeader, { color: sub, fontSize: fs(11) }]}>SUPPORT</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
          <SettingsRow icon="❓" label="Help Center"     detail="Guides & FAQ"      color={T.cBlue}   soft={T.cBlueSoft}   isDark={isDark} bdr={bdr} txt={txt} sub={sub} onPress={() => {}} />
          <SettingsRow icon="💬" label="Contact Support" detail="Chat or email"     color={T.cPurple} soft={T.cPurpleSoft} isDark={isDark} bdr={bdr} txt={txt} sub={sub} onPress={() => {}} />
          <SettingsRow icon="📄" label="Terms & Privacy" detail="Legal documents"   color={T.cGreen}  soft={T.cGreenSoft}  isDark={isDark} bdr={bdr} txt={txt} sub={sub} onPress={() => {}} isLast />
        </View>

        {/* ── Logout button ── */}
        <TouchableOpacity
          style={[s.logoutBtn, { backgroundColor: card, borderColor: bdr }]}
          onPress={async () => { await logout(); }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18 }}>🚪</Text>
          <Text style={[s.logoutText, { fontSize: fs(15) }]}>Log out</Text>
        </TouchableOpacity>

        <Text style={[s.version, { color: sub, fontSize: fs(12) }]}>DYUKSA v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Navbar
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontWeight: '700', fontSize: 15 },

  // Profile card
  profileCard: { borderRadius: T.rMd, borderWidth: 1, padding: 16, marginBottom: 22 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  editOverlay: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  profileName: { fontWeight: '700' },
  profileEmail: { marginTop: 2 },
  adminBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: T.brandSoft, marginTop: 6 },
  adminBadgeText: { fontSize: 10, fontWeight: '700', color: T.brand, letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', borderRadius: 12, paddingVertical: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontWeight: '700' },
  statLabel: { fontWeight: '500', marginTop: 2 },

  // Group header
  groupHeader: { fontWeight: '700', marginBottom: 8, marginTop: 4, letterSpacing: 0.6, paddingHorizontal: 4 },

  // Card
  card: { borderRadius: T.rMd, borderWidth: 1, marginBottom: 18, overflow: 'hidden' },

  // Settings row
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowDetail: { fontSize: 12, marginTop: 1 },
  chevron: { fontSize: 20, marginLeft: 4 },

  // Segment control
  segment: { flexDirection: 'row', borderRadius: 8, padding: 3 },
  segmentBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  segmentBtnActive: { backgroundColor: '#1A1A2E' },
  segmentText: { fontSize: 11, color: '#888899', fontWeight: '600' },
  segmentTextActive: { color: '#fff' },

  // Dropdown
  dropdownBox: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },

  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: T.rMd, borderWidth: 1, marginBottom: 16 },
  logoutText: { fontWeight: '650', color: T.cRed },

  version: { textAlign: 'center', paddingBottom: 8 },
});
