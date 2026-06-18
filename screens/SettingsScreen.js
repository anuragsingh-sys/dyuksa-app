import React, { useContext, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';
import { getAccessToken } from '../services/ApiService';
import { API_BASE } from '../config';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';
import { useTasksCache } from '../hooks/useTasksCache';

const ACCENT = '#3B72EE';

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = ({ name, color, size = 18 }) => {
  const paths = {
    person:   <><Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={2}/></>,
    bell:     <><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={2} strokeLinecap="round"/></>,
    sliders:  <><Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" stroke={color} strokeWidth={2} strokeLinecap="round"/></>,
    folder:   <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>,
    users:    <><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={2}/><Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></>,
    link:     <><Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></>,
    credit:   <><Rect x="1" y="4" width="22" height="16" rx="2" stroke={color} strokeWidth={2}/><Path d="M1 10h22" stroke={color} strokeWidth={2}/></>,
    star:     <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>,
    palette:  <><Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2}/><Path d="M12 8v4M12 16h.01" stroke={color} strokeWidth={2} strokeLinecap="round"/></>,
    flag:     <><Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Path d="M4 22v-7" stroke={color} strokeWidth={2} strokeLinecap="round"/></>,
    globe:    <><Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2}/><Path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke={color} strokeWidth={2} strokeLinecap="round"/></>,
    help:     <><Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2}/><Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" stroke={color} strokeWidth={2} strokeLinecap="round"/></>,
    message:  <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>,
    file:     <><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Polyline points="14 2 14 8 20 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></>,
    logout:   <><Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Path d="M21 12H9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></>,
    lock:     <><Rect x="3" y="11" width="18" height="11" rx="2" stroke={color} strokeWidth={2}/><Path d="M7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth={2} strokeLinecap="round"/></>,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths[name] || paths.help}
    </Svg>
  );
};

// ── Settings Row ──────────────────────────────────────────────────────────────
function Row({ iconName, iconBg, iconColor, label, value, onPress, isLast, isDark, bdr, txt, sub }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: isDark ? '#252530' : '#F0F2F6' }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Icon name={iconName} color={iconColor} size={17} />
      </View>
      <Text style={[styles.rowLabel, { color: txt }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {value ? <Text style={[styles.rowValue, { color: sub }]}>{value}</Text> : null}
        {onPress ? <Text style={{ color: isDark ? '#3A3A48' : '#C8CDD8', fontSize: 20 }}>›</Text> : null}
      </View>
    </Wrap>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function Section({ title, sub }) {
  return <Text style={[styles.sectionTitle, { color: sub }]}>{title}</Text>;
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const navigation        = useNavigation();
  const insets            = useSafeAreaInsets();
  const { theme, setTheme } = useContext(ThemeContext);
  const { logout, user }  = useContext(AuthContext);
  const { currentWorkspace } = useWorkspace();
  const { tasks }         = useTasksCache();
  const isDark = theme === 'Dark';

  const bg   = isDark ? '#0D0D0F' : '#F7F8FB';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#0E1726';
  const sub  = isDark ? '#9898A6' : '#6B7588';
  const bdr  = isDark ? '#252530' : '#E6E9EF';

  // User info
  const userName  = user ? (`${user.first_name || ''} ${user.last_name || ''}`).trim() || user.username || 'User' : 'User';
  const userEmail = user?.email || '';
  const userRole  = user?.role || 'member';
  const initials  = userName.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  // Stats
  const myTasks    = tasks.filter(t => user?.id && Array.isArray(t.assigned_to) && t.assigned_to.some(id => String(id) === String(user.id)));
  const taskCount  = myTasks.length;
  const projIds    = [...new Set(myTasks.map(t => t.project_details?.id || t.project).filter(Boolean))];
  const projCount  = projIds.length;

  // Members count
  const [memberCount, setMemberCount] = useState(null);
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    getAccessToken().then(token => {
      fetch(`${API_BASE}/api/v1/organizations/workspaces/${currentWorkspace.id}/members/`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : null).then(d => {
        if (d) setMemberCount(Array.isArray(d) ? d.length : (d.members?.length || d.count || null));
      }).catch(() => {});
    });
  }, [currentWorkspace?.id]);

  const wsName = currentWorkspace?.name || 'Workspace';

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  // Icon tint helper
  const tint = (hex) => ({ bg: hex + '18', color: hex });
  const blue   = tint(ACCENT);
  const green  = tint('#22A06B');
  const yellow = tint('#E5A60E');
  const purple = tint('#7A5AF8');
  const red    = tint('#E5484D');
  const orange = tint('#F97316');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Settings" />
          <Text style={[styles.navTitle, { color: txt }]}>Settings</Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
      >
        {/* ── Profile card ── */}
        <View style={[styles.profileCard, { backgroundColor: card, borderColor: bdr }]}>
          {/* Avatar + info */}
          <View style={styles.profileTop}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: ACCENT }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <TouchableOpacity style={styles.editDot} onPress={() => navigation.navigate('EditProfile')}>
                <Text style={{ color: '#fff', fontSize: 10 }}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: txt }]}>{userName}</Text>
              <Text style={[styles.profileEmail, { color: sub }]}>{userEmail}</Text>
              <View style={[styles.roleBadge, { backgroundColor: ACCENT + '15' }]}>
                <Text style={[styles.roleBadgeText, { color: ACCENT }]}>{userRole.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderTopColor: bdr }]}>
            {[
              { value: taskCount, label: 'Tasks' },
              { value: projCount, label: 'Projects' },
              { value: '—',       label: 'Streak' },
            ].map((stat, i, arr) => (
              <View key={i} style={[styles.statItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: bdr }]}>
                <Text style={[styles.statValue, { color: txt }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: sub }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── ACCOUNT ── */}
        <Section title="ACCOUNT" sub={sub} />
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <Row iconName="person"  iconBg={blue.bg}   iconColor={blue.color}   label="Personal info"  onPress={() => navigation.navigate('EditProfile')}    isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="bell"    iconBg={yellow.bg}  iconColor={yellow.color} label="Notifications"  value="On"                                           onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="sliders" iconBg={purple.bg}  iconColor={purple.color} label="Preferences"    onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="lock"    iconBg={red.bg}     iconColor={red.color}    label="Change Password" onPress={() => navigation.navigate('ChangePassword')} isDark={isDark} bdr={bdr} txt={txt} sub={sub} isLast />
        </View>

        {/* ── WORKSPACE ── */}
        <Section title="WORKSPACE" sub={sub} />
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <Row iconName="folder"  iconBg={blue.bg}    iconColor={blue.color}   label="Workspace"     value={wsName}                                          onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="users"   iconBg={purple.bg}  iconColor={purple.color} label="Members"       value={memberCount != null ? String(memberCount) : '—'} onPress={() => navigation.navigate('TeamManagement')} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="link"    iconBg={green.bg}   iconColor={green.color}  label="Integrations"  value="—"                                               onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="credit"  iconBg={yellow.bg}  iconColor={yellow.color} label="Billing"       value="Pro plan"                                        onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} isLast />
        </View>

        {/* ── APPEARANCE ── */}
        <Section title="APPEARANCE" sub={sub} />
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <Row iconName="star"    iconBg={purple.bg}  iconColor={purple.color} label="Theme"         value={theme}    onPress={() => setTheme(isDark ? 'Light' : 'Dark')} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="palette" iconBg={blue.bg}    iconColor={blue.color}   label="Accent color"  value="Blue"     onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="globe"   iconBg={green.bg}   iconColor={green.color}  label="Language"      value="English"  onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} isLast />
        </View>

        {/* ── SUPPORT ── */}
        <Section title="SUPPORT" sub={sub} />
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <Row iconName="help"    iconBg={blue.bg}    iconColor={blue.color}   label="Help center"     onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="message" iconBg={green.bg}   iconColor={green.color}  label="Contact support" onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} />
          <Row iconName="file"    iconBg={orange.bg}  iconColor={orange.color} label="Terms & Privacy" onPress={() => {}} isDark={isDark} bdr={bdr} txt={txt} sub={sub} isLast />
        </View>

        {/* ── Log out ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: card, borderColor: bdr }]}
          onPress={handleLogout}
          activeOpacity={0.75}
        >
          <Icon name="logout" color="#E5484D" size={18} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: sub }]}>Dyuksa for iOS · v2.6.1</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1 },
  navbar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navTitle:{ fontSize: 17, fontWeight: '700' },

  // Profile
  profileCard: { borderRadius: 16, borderWidth: 1, marginBottom: 22, overflow: 'hidden' },
  profileTop:  { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatarWrap:  { position: 'relative' },
  avatar:      { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: '#fff', fontSize: 22, fontWeight: '700' },
  editDot:     { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  profileName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  profileEmail:{ fontSize: 13, marginBottom: 6 },
  roleBadge:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleBadgeText:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  statsRow:  { flexDirection: 'row', borderTopWidth: 1, paddingVertical: 12 },
  statItem:  { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '500' },

  // Section
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 4, paddingHorizontal: 4 },

  // Card
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },

  // Row
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  rowIcon:  { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 14 },

  // Logout
  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#E5484D' },

  version: { textAlign: 'center', fontSize: 12, paddingBottom: 4 },
});
