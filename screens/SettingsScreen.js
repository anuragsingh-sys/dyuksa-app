import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, StatusBar, Platform, Alert, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView,
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
  const { currentWorkspace } = useWorkspace();

  // ── Workspace Management state (admin only) ───────────────────────────────
  const isAdmin = user?.role === 'admin' || user?.is_superuser;
  const [members,       setMembers]       = useState([]);
  const [loadingMembers,setLoadingMembers]= useState(false);
  const [memberSearch,  setMemberSearch]  = useState('');
  const [addModalOpen,  setAddModalOpen]  = useState(false);
  const [userSearch,    setUserSearch]    = useState('');
  const [allUsers,      setAllUsers]      = useState([]);
  const [loadingUsers,  setLoadingUsers]  = useState(false);
  const [selectedUser,  setSelectedUser]  = useState(null);
  const [addRole,       setAddRole]       = useState('viewer');
  const [addingMember,  setAddingMember]  = useState(false);
  const [removingId,    setRemovingId]    = useState(null);
  const [roleDropOpen,  setRoleDropOpen]  = useState(false);

  const ROLES = ['admin', 'manager', 'annotator', 'viewer'];

  const fetchMembers = useCallback(async () => {
    if (!isAdmin || !currentWorkspace?.id) return;
    setLoadingMembers(true);
    try {
      const token = await getAccessToken();
      const url = `${API_BASE}/api/v1/organizations/workspaces/${currentWorkspace.id}/members/`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const text = await res.text();
      if (!res.ok) {
        console.warn(`fetchMembers ${res.status}:`, text.slice(0, 200));
        return;
      }
      try {
        const data = JSON.parse(text);
        // Response shape: { members: [{id, user_id, username, email, role, joined_at}] }
        setMembers(Array.isArray(data) ? data : (data.members || data.results || []));
      } catch {
        console.warn('fetchMembers: non-JSON response:', text.slice(0, 200));
      }
    } catch (e) {
      console.warn('fetchMembers:', e.message);
    } finally {
      setLoadingMembers(false);
    }
  }, [isAdmin, currentWorkspace?.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Fetch all users for the add member picker
  const fetchAllUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const token = await getAccessToken();
      let all = [];
      let url = `${API_BASE}/api/v1/auth/users/`;
      while (url) {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) break;
        const data = await res.json();
        all = [...all, ...(Array.isArray(data) ? data : (data.results || []))];
        url = data.next || null;
      }
      setAllUsers(all);
    } catch (e) {
      console.warn('fetchAllUsers:', e.message);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const openAddModal = () => {
    setSelectedUser(null);
    setUserSearch('');
    setAddRole('viewer');
    setRoleDropOpen(false);
    setAddModalOpen(true);
    fetchAllUsers();
  };

  const handleAddMember = async () => {
    if (!selectedUser) { Alert.alert('Required', 'Select a user to add.'); return; }
    setAddingMember(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/organizations/workspaces/${currentWorkspace.id}/members/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id, role: addRole }),
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch {}
      if (res.ok) {
        const name = `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username;
        Alert.alert('✅ Member Added', `${name} has been added to the workspace.`);
        setSelectedUser(null); setUserSearch(''); setAddRole('viewer'); setAddModalOpen(false);
        fetchMembers();
      } else {
        console.warn('addMember error:', res.status, text.slice(0, 300));
        Alert.alert('Error', data.detail || data.message || `Server error (${res.status})`);
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = (member) => {
    const name = member.username || member.email || 'this member';
    Alert.alert(
      'Remove Member',
      `Remove ${name} from the workspace?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setRemovingId(member.id);
            try {
              const token = await getAccessToken();
              const res = await fetch(`${API_BASE}/api/v1/organizations/workspaces/${currentWorkspace.id}/members/${member.id}/`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok || res.status === 204) {
                setMembers(prev => prev.filter(m => m.id !== member.id));
              } else {
                Alert.alert('Error', `Could not remove member (${res.status})`);
              }
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  const filteredMembers = members.filter(m => {
    const name = (m.username || m.email || '').toLowerCase();
    return name.includes(memberSearch.toLowerCase());
  });

  const getInitialsFromMember = (m) => {
    const name = m.username || m.email || '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899'];
  const getAvatarColor = (str = '') => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  };

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

        {/* ── WORKSPACE MANAGEMENT (admin only) ── */}
        {isAdmin && (
          <>
            <Text style={[s.groupHeader, { color: sub, fontSize: fs(11) }]}>WORKSPACE MANAGEMENT</Text>
            <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
              {/* Workspace name row */}
              <View style={[s.wsNameRow, { borderBottomColor: isDark ? '#252530' : T.hairlineSoft }]}>
                <View style={[s.wsAvatar, { backgroundColor: T.brand }]}>
                  <Text style={s.wsAvatarText}>
                    {(currentWorkspace?.name?.[0] || 'W').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.wsNameText, { color: txt }]} numberOfLines={1}>
                    {currentWorkspace?.name || 'Workspace'}
                  </Text>
                  <Text style={[s.wsMeta, { color: sub }]}>
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {/* Members header */}
              <View style={[s.membersHeader, { borderBottomColor: isDark ? '#252530' : T.hairlineSoft }]}>
                <Text style={[s.membersTitle, { color: txt }]}>
                  Members ({members.length})
                </Text>
                <TouchableOpacity
                  style={[s.addMemberBtn, { backgroundColor: '#1A1A2E' }]}
                  onPress={openAddModal}
                  activeOpacity={0.8}
                >
                  <Text style={s.addMemberBtnText}>+ Add Member</Text>
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={[s.memberSearchWrap, { backgroundColor: isDark ? '#252530' : T.surfaceAlt, borderColor: bdr }]}>
                <Text style={{ fontSize: 14, color: sub, marginRight: 6 }}>🔍</Text>
                <TextInput
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Search members..."
                  placeholderTextColor={sub}
                  style={[s.memberSearchInput, { color: txt }]}
                />
              </View>

              {/* Member list */}
              {loadingMembers ? (
                <ActivityIndicator size="small" color={T.brand} style={{ padding: 20 }} />
              ) : filteredMembers.length === 0 ? (
                <Text style={[s.emptyMembers, { color: sub }]}>
                  {memberSearch ? 'No members found' : 'No members yet'}
                </Text>
              ) : (
                filteredMembers.map((member, i) => {
                  const name    = member.username || member.email || 'Unknown';
                  const email   = member.email || '';
                  const role    = member.role || 'member';
                  const initials= getInitialsFromMember(member);
                  const avatarColor = getAvatarColor(name);
                  const isLast  = i === filteredMembers.length - 1;
                  const removing = removingId === member.id;
                  const isSelf  = member.user_id === user?.id || email === user?.email;

                  return (
                    <View
                      key={member.id || i}
                      style={[s.memberRow, !isLast && { borderBottomWidth: 1, borderBottomColor: isDark ? '#252530' : T.hairlineSoft }]}
                    >
                      {/* Avatar */}
                      <View style={[s.memberAvatar, { backgroundColor: avatarColor }]}>
                        <Text style={s.memberAvatarText}>{initials}</Text>
                      </View>

                      {/* Name + email */}
                      <View style={{ flex: 1 }}>
                        <Text style={[s.memberName, { color: txt }]} numberOfLines={1}>
                          {name}{isSelf ? ' (You)' : ''}
                        </Text>
                        <Text style={[s.memberEmail, { color: sub }]} numberOfLines={1}>{email}</Text>
                      </View>

                      {/* Role badge */}
                      <View style={[s.roleBadge, { backgroundColor: isDark ? '#252530' : '#EEF2FF' }]}>
                        <Text style={[s.roleBadgeText, { color: T.brand }]}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </Text>
                      </View>

                      {/* Remove button (can't remove yourself) */}
                      {!isSelf && (
                        <TouchableOpacity
                          onPress={() => handleRemoveMember(member)}
                          disabled={removing}
                          style={s.removeBtn}
                          activeOpacity={0.7}
                        >
                          {removing
                            ? <ActivityIndicator size="small" color={T.cRed} />
                            : <Text style={{ color: T.cRed, fontSize: 18, fontWeight: '700' }}>×</Text>
                          }
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ── Add Member Modal ── */}
        <Modal
          visible={addModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setAddModalOpen(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <TouchableOpacity
              style={s.modalOverlay}
              activeOpacity={1}
              onPress={() => setAddModalOpen(false)}
            />
            <View style={[s.addModal, { backgroundColor: card, borderColor: bdr }]}>
              {/* Modal header */}
              <View style={[s.addModalHeader, { borderBottomColor: bdr }]}>
                <Text style={[s.addModalTitle, { color: txt }]}>Add Member</Text>
                <TouchableOpacity onPress={() => setAddModalOpen(false)}>
                  <Text style={{ color: sub, fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20 }}>
                {/* User search */}
                <View style={[s.addInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#252530' : T.surfaceAlt, paddingHorizontal: 12, height: 46 }]}>
                  <Text style={{ color: sub, fontSize: 14, marginRight: 8 }}>🔍</Text>
                  <TextInput
                    value={userSearch}
                    onChangeText={setUserSearch}
                    placeholder="Search users to add..."
                    placeholderTextColor={sub}
                    autoCapitalize="none"
                    style={{ flex: 1, fontSize: 14, color: txt }}
                  />
                  {selectedUser && (
                    <TouchableOpacity onPress={() => { setSelectedUser(null); setUserSearch(''); }}>
                      <Text style={{ color: sub, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Selected user chip */}
                {selectedUser && (
                  <View style={[s.selectedUserChip, { backgroundColor: isDark ? '#1A2744' : '#EEF2FF', borderColor: T.brand }]}>
                    <View style={[s.memberAvatar, { backgroundColor: getAvatarColor(selectedUser.username), width: 28, height: 28, borderRadius: 14 }]}>
                      <Text style={[s.memberAvatarText, { fontSize: 11 }]}>
                        {(`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[{ flex: 1, fontSize: 13, fontWeight: '600', color: T.brand }]} numberOfLines={1}>
                      {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username}
                    </Text>
                    <Text style={{ fontSize: 11, color: sub }}>{selectedUser.email}</Text>
                  </View>
                )}

                {/* User list — shown when searching and no user selected */}
                {!selectedUser && (
                  <View style={[s.userDropdown, { backgroundColor: isDark ? '#1A1A28' : '#fff', borderColor: bdr }]}>
                    {loadingUsers ? (
                      <ActivityIndicator size="small" color={T.brand} style={{ padding: 16 }} />
                    ) : (() => {
                      const q = userSearch.toLowerCase();
                      // Exclude already-added members
                      const memberUserIds = new Set(members.map(m => m.user_id).filter(Boolean));
                      const filtered = allUsers.filter(u => {
                        if (memberUserIds.has(u.id)) return false;
                        const name = `${u.first_name || ''} ${u.last_name || ''} ${u.username} ${u.email}`.toLowerCase();
                        return !q || name.includes(q);
                      });
                      if (filtered.length === 0) return (
                        <Text style={[s.emptyMembers, { color: sub, paddingVertical: 14 }]}>
                          {userSearch ? 'No users found' : 'No users available to add'}
                        </Text>
                      );
                      return (
                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {filtered.map((u, i) => {
                            const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                            const avatarColor = getAvatarColor(u.username || u.email);
                            return (
                              <TouchableOpacity
                                key={u.id}
                                style={[s.userDropItem, { borderBottomColor: bdr }, i === filtered.length - 1 && { borderBottomWidth: 0 }]}
                                onPress={() => { setSelectedUser(u); setUserSearch(''); }}
                                activeOpacity={0.7}
                              >
                                <View style={[s.memberAvatar, { backgroundColor: avatarColor, width: 32, height: 32, borderRadius: 16 }]}>
                                  <Text style={[s.memberAvatarText, { fontSize: 12 }]}>{name[0]?.toUpperCase() || '?'}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[{ fontSize: 13, fontWeight: '600', color: txt }]} numberOfLines={1}>{name}</Text>
                                  <Text style={[{ fontSize: 11, color: sub }]} numberOfLines={1}>{u.email}</Text>
                                </View>
                                <Text style={[{ fontSize: 10, color: sub, textTransform: 'capitalize' }]}>{u.role}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      );
                    })()}
                  </View>
                )}

                {/* Role picker */}
                <Text style={[s.addLabel, { color: sub, marginTop: 14 }]}>ROLE</Text>
                <TouchableOpacity
                  style={[s.rolePicker, { backgroundColor: isDark ? '#252530' : T.surfaceAlt, borderColor: roleDropOpen ? T.brand : bdr }]}
                  onPress={() => setRoleDropOpen(o => !o)}
                >
                  <Text style={[{ flex: 1, fontSize: 14, color: txt }]}>
                    {addRole.charAt(0).toUpperCase() + addRole.slice(1)}
                  </Text>
                  <Text style={{ color: sub, fontSize: 11 }}>{roleDropOpen ? '▲' : '▾'}</Text>
                </TouchableOpacity>
                {roleDropOpen && (
                  <View style={[s.roleDropdown, { backgroundColor: card, borderColor: T.brand }]}>
                    {ROLES.map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[s.roleDropItem, { borderBottomColor: bdr }]}
                        onPress={() => { setAddRole(r); setRoleDropOpen(false); }}
                      >
                        <Text style={[{ fontSize: 13, color: addRole === r ? T.brand : txt, fontWeight: addRole === r ? '700' : '500' }]}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </Text>
                        {addRole === r && <Text style={{ color: T.brand }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Buttons */}
                <View style={s.addModalBtns}>
                  <TouchableOpacity
                    style={[s.addCancelBtn, { borderColor: bdr }]}
                    onPress={() => setAddModalOpen(false)}
                  >
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: sub }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.addConfirmBtn, { backgroundColor: addingMember || !selectedUser ? '#9090B0' : '#1A1A2E' }]}
                    onPress={handleAddMember}
                    disabled={addingMember || !selectedUser}
                  >
                    {addingMember
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.addConfirmText}>Add to Workspace</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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

  // ── Workspace Management ──
  wsNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  wsAvatar: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  wsAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  wsNameText: { fontSize: 14, fontWeight: '700' },
  wsMeta: { fontSize: 12, marginTop: 2 },

  membersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  membersTitle: { fontSize: 13, fontWeight: '700' },
  addMemberBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addMemberBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  memberSearchWrap: { flexDirection: 'row', alignItems: 'center', margin: 10, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40 },
  memberSearchInput: { flex: 1, fontSize: 13, height: 40 },

  emptyMembers: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  memberName: { fontSize: 13, fontWeight: '600' },
  memberEmail: { fontSize: 11, marginTop: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  removeBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },

  // Add member modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  addModal: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '80%' },
  addModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  addModalTitle: { fontSize: 17, fontWeight: '700' },
  addLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  addInput: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, height: 48, fontSize: 14, marginBottom: 16 },
  rolePicker: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, height: 48, marginBottom: 4 },
  roleDropdown: { borderRadius: 10, borderWidth: 1.5, marginBottom: 16, overflow: 'hidden' },
  roleDropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  addModalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  addCancelBtn: { flex: 1, height: 48, borderWidth: 1, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addConfirmBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // User search dropdown
  selectedUserChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 4 },
  userDropdown: { borderWidth: 1, borderRadius: 10, marginBottom: 4, overflow: 'hidden' },
  userDropItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
});
