import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
// const BASE_URL → imported from config

const authHeaders = async () => {
  const token       = await getAccessToken();
  const workspaceId = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  if (workspaceId) h['X-Workspace-ID'] = workspaceId;
  return h;
};

const TEAM_TYPE_COLORS = {
  development: { bg: '#DBEAFE', txt: '#1D4ED8', label: 'Development' },
  design:      { bg: '#EDE9FE', txt: '#6D28D9', label: 'Design' },
  marketing:   { bg: '#FCE7F3', txt: '#BE185D', label: 'Marketing' },
  qa:          { bg: '#D1FAE5', txt: '#065F46', label: 'QA' },
  management:  { bg: '#FEF3C7', txt: '#92400E', label: 'Management' },
  sales:       { bg: '#FFE4E6', txt: '#9F1239', label: 'Sales' },
};

const typeStyle = (type) => TEAM_TYPE_COLORS[type] || { bg: '#F3F4F6', txt: '#374151', label: type };

const fmtDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

// ── Avatar stack ────────────────────────────────────────────────────────────
function AvatarStack({ members, max = 4, isDark }) {
  const shown = members.slice(0, max);
  const extra = members.length - max;
  return (
    <View style={styles.avatarStack}>
      {shown.map((m, i) => (
        <View
          key={m.id}
          style={[
            styles.stackAvatar,
            { marginLeft: i === 0 ? 0 : -8, zIndex: max - i, backgroundColor: '#4ECDC4' },
          ]}
        >
          <Text style={styles.stackAvatarText}>{m.user?.initials || '?'}</Text>
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.stackAvatar, { marginLeft: -8, backgroundColor: isDark ? '#333340' : '#E5E7EB' }]}>
          <Text style={[styles.stackAvatarText, { color: isDark ? '#fff' : '#374151' }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

// ── Team Detail Modal ────────────────────────────────────────────────────────
function TeamDetail({ team, onClose, isDark, card, txt, sub, bdr }) {
  const ts = typeStyle(team.team_type);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.detailPanel, { backgroundColor: card, borderLeftColor: bdr }]}>
      {/* Header */}
      <View style={[styles.detailHeader, { borderBottomColor: bdr, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={onClose} style={styles.detailClose}>
          <Text style={{ color: '#4ECDC4', fontSize: 14, fontWeight: '600' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.detailTitle, { color: txt }]} numberOfLines={1}>{team.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Team info */}
        <View style={[styles.detailCard, { backgroundColor: isDark ? '#252530' : '#F9FAFB', borderColor: bdr }]}>
          <View style={styles.detailRow}>
            <View style={[styles.typePill, { backgroundColor: ts.bg }]}>
              <Text style={[styles.typePillTxt, { color: ts.txt }]}>{ts.label}</Text>
            </View>
            {team.is_favourite && <Text style={{ fontSize: 16 }}>⭐</Text>}
          </View>

          {!!team.description?.replace(/<[^>]*>/g, '').trim() && (
            <Text style={[styles.detailDesc, { color: sub }]}>
              {team.description.replace(/<[^>]*>/g, '')}
            </Text>
          )}

          <View style={[styles.detailMeta, { borderTopColor: bdr }]}>
            <View style={styles.detailMetaItem}>
              <Text style={[styles.detailMetaLabel, { color: sub }]}>Leader</Text>
              <Text style={[styles.detailMetaValue, { color: txt }]}>{team.leader_info?.full_name || '—'}</Text>
            </View>
            <View style={styles.detailMetaItem}>
              <Text style={[styles.detailMetaLabel, { color: sub }]}>Members</Text>
              <Text style={[styles.detailMetaValue, { color: txt }]}>{team.member_count}</Text>
            </View>
            <View style={styles.detailMetaItem}>
              <Text style={[styles.detailMetaLabel, { color: sub }]}>My Role</Text>
              <Text style={[styles.detailMetaValue, { color: '#4ECDC4' }]}>{team.my_role || '—'}</Text>
            </View>
            <View style={styles.detailMetaItem}>
              <Text style={[styles.detailMetaLabel, { color: sub }]}>Created</Text>
              <Text style={[styles.detailMetaValue, { color: txt }]}>{fmtDate(team.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Members list */}
        <Text style={[styles.sectionLabel, { color: sub }]}>MEMBERS ({team.members?.length || 0})</Text>
        <View style={[styles.membersCard, { backgroundColor: card, borderColor: bdr }]}>
          {(team.members || []).map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.memberRow,
                { borderBottomColor: bdr },
                i === team.members.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={[styles.memberAvatar, { backgroundColor: '#4ECDC4' }]}>
                <Text style={styles.memberAvatarText}>{m.user?.initials || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: txt }]}>{m.user?.full_name}</Text>
                <Text style={[styles.memberEmail, { color: sub }]}>{m.user?.email}</Text>
              </View>
              <View style={[
                styles.roleChip,
                { backgroundColor: m.role === 'owner' ? '#FEF3C7' : (isDark ? '#252530' : '#F3F4F6') },
              ]}>
                <Text style={[
                  styles.roleChipTxt,
                  { color: m.role === 'owner' ? '#92400E' : sub },
                ]}>
                  {m.role_display}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function TeamManagementScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { theme, fontScale } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const [teams,      setTeams]      = useState([]);
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [activeTab,  setActiveTab]  = useState('teams');

  // Sync tab from route params
  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // ── Add New User modal state ──
  const [showAddUser,    setShowAddUser]    = useState(false);
  const [addFirstName,   setAddFirstName]   = useState('');
  const [addLastName,    setAddLastName]    = useState('');
  const [addUsername,    setAddUsername]    = useState('');
  const [addEmail,       setAddEmail]       = useState('');
  const [addRole,        setAddRole]        = useState('viewer');
  const [addPassword,    setAddPassword]    = useState('');
  const [addConfirmPass, setAddConfirmPass] = useState('');
  const [addSaving,      setAddSaving]      = useState(false);

  const ROLES = ['admin', 'manager', 'annotator', 'viewer', 'developer'];

  const resetAddForm = () => {
    setAddFirstName(''); setAddLastName(''); setAddUsername('');
    setAddEmail(''); setAddRole('viewer'); setAddPassword(''); setAddConfirmPass('');
  };

  // ── Fetch ─────────────────────────────────────────────────────────
  const fetchTeams = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/teams/`, { method: 'GET', headers });
      if (!res.ok) { console.warn('Teams fetch failed:', res.status); return; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      // Sort: favourites first, then by name
      list.sort((a, b) => {
        if (a.is_favourite && !b.is_favourite) return -1;
        if (!a.is_favourite && b.is_favourite) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setTeams(list);
    } catch (e) {
      console.warn('fetchTeams error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchTeams(); }, [fetchTeams]));

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const headers = await authHeaders();
      let all = [];
      let page = 1;
      let hasNext = true;
      while (hasNext && page <= 10) {
        const res = await fetch(`${BASE_URL}/auth/users/?page=${page}`, { headers });
        if (!res.ok) break;
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        all = [...all, ...results];
        hasNext = !!data.next;
        page++;
      }
      // Sort by name
      all.sort((a, b) => {
        const nameA = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.username;
        const nameB = [b.first_name, b.last_name].filter(Boolean).join(' ') || b.username;
        return nameA.localeCompare(nameB);
      });
      setUsers(all);
    } catch (e) { console.warn('fetchUsers:', e.message); }
    finally { setUsersLoading(false); }
  }, []);

  // Switch to Roles tab → fetch users
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'roles' && users.length === 0) fetchUsers();
  };

  const handleAddUser = async () => {
    if (!addFirstName.trim()) { Alert.alert('Required', 'Enter first name.'); return; }
    if (!addUsername.trim())  { Alert.alert('Required', 'Enter username.'); return; }
    if (!addEmail.trim())     { Alert.alert('Required', 'Enter email.'); return; }
    if (!addPassword)         { Alert.alert('Required', 'Enter password.'); return; }
    if (addPassword !== addConfirmPass) { Alert.alert('Error', 'Passwords do not match.'); return; }
    setAddSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/auth/users/`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: addFirstName.trim(),
          last_name:  addLastName.trim(),
          username:   addUsername.trim(),
          email:      addEmail.trim(),
          role:       addRole,
          password:   addPassword,
          password2:  addConfirmPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail || data.message || Object.values(data)[0]?.[0] || 'Failed to create user.';
        Alert.alert('Error', msg); return;
      }
      Alert.alert('Success', `User ${addFirstName} created!`);
      setShowAddUser(false); resetAddForm(); fetchUsers();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setAddSaving(false); }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'roles') fetchUsers().then(() => setRefreshing(false));
    else fetchTeams();
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="TeamManagement" />
          <TouchableOpacity
            style={styles.logoBox}
            onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}
          >
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={[styles.brandName, { color: txt, fontSize: fs(15) }]}>Team Management</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity
            style={[styles.navIconBtn, { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr }]}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Sub-tabs */}
      <View style={[styles.subTabs, { backgroundColor: card, borderBottomColor: bdr }]}>
        {[
          { key: 'teams',       label: 'Teams' },
          { key: 'roles',       label: 'Roles' },
          { key: 'performance', label: 'Performance' },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.subTab, isActive && styles.subTabActive]}
              onPress={() => tab.key === 'performance'
                ? Alert.alert('Coming soon', 'Performance will be available soon.')
                : handleTabSwitch(tab.key)
              }
            >
              <Text style={[styles.subTabTxt, { color: isActive ? '#4ECDC4' : sub, fontSize: fs(13) }]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.subTabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Body */}
      {activeTab === 'roles' ? (
        <>
          {/* Roles tab — User Management */}
          <View style={[styles.rolesHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
            <View>
              <Text style={[{ fontSize: 15, fontWeight: '700', color: txt }]}>User Management</Text>
              <Text style={[{ fontSize: 11, color: sub, marginTop: 1 }]}>{users.length} members</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.rolesBtn, { backgroundColor: isDark ? '#252530' : '#F0F2F6', borderColor: bdr }]}
                onPress={() => navigation.navigate('InviteUser')}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#4ECDC4' }}>✉ Invite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rolesBtn, { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' }]}
                onPress={() => setShowAddUser(true)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>+ Add User</Text>
              </TouchableOpacity>
            </View>
          </View>

          {usersLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#4ECDC4" />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />}
            >
              {/* Header row */}
              <View style={[styles.userTableHeader, { backgroundColor: isDark ? '#252530' : '#F5F6F9', borderBottomColor: bdr }]}>
                <Text style={[styles.userTableHeaderTxt, { color: sub, flex: 1 }]}>FULL NAME</Text>
                <Text style={[styles.userTableHeaderTxt, { color: sub, width: 90 }]}>ROLE</Text>
                <Text style={[styles.userTableHeaderTxt, { color: sub, width: 100 }]}>JOINED</Text>
              </View>

              {users.map((u, i) => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
                const initial = (name[0] || '?').toUpperCase();
                const role = (u.role || 'member').toLowerCase();
                const roleColor = role === 'admin' ? '#22C55E' : role === 'manager' ? '#3B82F6' : role === 'developer' ? '#A78BFA' : '#9098A6';
                const roleBg   = role === 'admin' ? '#F0FDF4' : role === 'manager' ? '#EFF6FF' : role === 'developer' ? '#F5F3FF' : '#F3F4F6';
                const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899'];
                const avatarBg = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const joined = u.date_joined || u.created_at || '';
                return (
                  <View
                    key={u.id}
                    style={[styles.userRow, { borderBottomColor: bdr }, i === users.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: avatarBg }]}>
                      <Text style={styles.userAvatarTxt}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName2, { color: txt }]} numberOfLines={1}>{name}</Text>
                      <Text style={[styles.userEmail, { color: sub }]} numberOfLines={1}>{u.email}</Text>
                    </View>
                    <View style={{ width: 90 }}>
                      <View style={[styles.roleTag, { backgroundColor: isDark ? '#252530' : roleBg }]}>
                        <Text style={[styles.roleTagTxt, { color: roleColor }]}>{role.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={[styles.joinedTxt, { color: sub }]} numberOfLines={1}>
                      {joined ? new Date(joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </Text>
                  </View>
                );
              })}
              {users.length === 0 && !usersLoading && (
                <View style={styles.centerState}>
                  <Text style={{ fontSize: 36, opacity: 0.2 }}>👥</Text>
                  <Text style={[styles.emptyTitle, { color: txt }]}>No users found</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── Add New User Modal ── */}
          <Modal visible={showAddUser} animationType="slide" transparent onRequestClose={() => setShowAddUser(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
              <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { backgroundColor: card }]}>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: txt }]}>Add New User</Text>
                    <TouchableOpacity onPress={() => { setShowAddUser(false); resetAddForm(); }}>
                      <Text style={{ fontSize: 20, color: sub }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalLabel, { color: sub }]}>First Name</Text>
                        <TextInput value={addFirstName} onChangeText={setAddFirstName} placeholder="First Name" placeholderTextColor={sub} style={[styles.modalInput, { backgroundColor: isDark ? '#252530' : '#F5F6F9', borderColor: bdr, color: txt }]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalLabel, { color: sub }]}>Last Name</Text>
                        <TextInput value={addLastName} onChangeText={setAddLastName} placeholder="Last Name" placeholderTextColor={sub} style={[styles.modalInput, { backgroundColor: isDark ? '#252530' : '#F5F6F9', borderColor: bdr, color: txt }]} />
                      </View>
                    </View>
                    <Text style={[styles.modalLabel, { color: sub }]}>Username</Text>
                    <TextInput
                      value={addUsername}
                      onChangeText={setAddUsername}
                      placeholder="unique_username"
                      placeholderTextColor={sub}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="off"
                      textContentType="none"
                      style={[styles.modalInput, { backgroundColor: isDark ? '#252530' : '#F5F6F9', borderColor: bdr, color: txt }]}
                    />
                    <Text style={[styles.modalLabel, { color: sub }]}>Email</Text>
                    <TextInput
                      value={addEmail}
                      onChangeText={setAddEmail}
                      placeholder="user@example.com"
                      placeholderTextColor={sub}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="off"
                      textContentType="none"
                      style={[styles.modalInput, { backgroundColor: isDark ? '#252530' : '#F5F6F9', borderColor: bdr, color: txt }]}
                    />
                    <Text style={[styles.modalLabel, { color: sub }]}>Role</Text>
                    <View style={styles.rolePillRow}>
                      {ROLES.map(r => (
                        <TouchableOpacity key={r} onPress={() => setAddRole(r)}
                          style={[styles.rolePill, { backgroundColor: addRole === r ? '#1A1A2E' : (isDark ? '#252530' : '#F5F6F9'), borderColor: addRole === r ? '#1A1A2E' : bdr }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: addRole === r ? '#fff' : sub, textTransform: 'capitalize' }}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={[styles.modalLabel, { color: sub }]}>Password</Text>
                    <TextInput value={addPassword} onChangeText={setAddPassword} placeholder="••••••••" placeholderTextColor={sub} secureTextEntry style={[styles.modalInput, { backgroundColor: isDark ? '#252530' : '#F5F6F9', borderColor: bdr, color: txt }]} />
                    <Text style={[styles.modalLabel, { color: sub }]}>Confirm Password</Text>
                    <TextInput value={addConfirmPass} onChangeText={setAddConfirmPass} placeholder="••••••••" placeholderTextColor={sub} secureTextEntry style={[styles.modalInput, { backgroundColor: isDark ? '#252530' : '#F5F6F9', borderColor: bdr, color: txt }]} />
                  </ScrollView>
                  <View style={styles.modalFooter}>
                    <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: bdr }]} onPress={() => { setShowAddUser(false); resetAddForm(); }}>
                      <Text style={{ color: sub, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAddUser} disabled={addSaving}>
                      {addSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Create User</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

        </>
      ) : (
        <>
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#4ECDC4" />
              <Text style={[styles.loadingTxt, { color: sub }]}>Loading teams…</Text>
            </View>
          ) : teams.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={{ fontSize: 40, opacity: 0.2 }}>👥</Text>
              <Text style={[styles.emptyTitle, { color: txt }]}>No teams yet</Text>
              <Text style={[styles.emptySub, { color: sub }]}>Teams you belong to will appear here</Text>
            </View>
          ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />}
        >
          {/* Stats bar */}
          <View style={[styles.statsRow, { backgroundColor: card, borderColor: bdr }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: txt, fontSize: fs(20) }]}>{teams.length}</Text>
              <Text style={[styles.statLabel, { color: sub, fontSize: fs(10) }]}>TOTAL TEAMS</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: bdr }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#4ECDC4', fontSize: fs(20) }]}>
                {teams.filter(t => t.my_role === 'owner').length}
              </Text>
              <Text style={[styles.statLabel, { color: sub, fontSize: fs(10) }]}>LEADING</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: bdr }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#FBBF24', fontSize: fs(20) }]}>
                {teams.filter(t => t.is_favourite).length}
              </Text>
              <Text style={[styles.statLabel, { color: sub, fontSize: fs(10) }]}>FAVOURITES</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: bdr }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#A78BFA', fontSize: fs(20) }]}>
                {teams.reduce((s, t) => s + (t.member_count || 0), 0)}
              </Text>
              <Text style={[styles.statLabel, { color: sub, fontSize: fs(10) }]}>MEMBERS</Text>
            </View>
          </View>

          {/* Team cards */}
          {teams.map(team => {
            const ts = typeStyle(team.team_type);
            return (
              <TouchableOpacity
                key={team.id}
                style={[styles.teamCard, { backgroundColor: card, borderColor: bdr }]}
                onPress={() => setSelected(team)}
                activeOpacity={0.7}
              >
                {/* Card header */}
                <View style={styles.teamCardHeader}>
                  <View style={[styles.teamColorDot, { backgroundColor: team.color || '#4ECDC4' }]} />
                  <Text style={[styles.teamName, { color: txt, fontSize: fs(15) }]} numberOfLines={1}>
                    {team.name}
                  </Text>
                  {team.is_favourite && <Text style={{ fontSize: 14 }}>⭐</Text>}
                  {team.can_manage && (
                    <View style={[styles.manageBadge, { backgroundColor: isDark ? '#252530' : '#F0FDF4' }]}>
                      <Text style={[styles.manageBadgeTxt, { color: '#16A34A', fontSize: fs(9) }]}>Can Manage</Text>
                    </View>
                  )}
                  <Text style={{ color: sub, fontSize: 18 }}>›</Text>
                </View>

                {/* Type pill + description */}
                <View style={styles.teamCardMeta}>
                  <View style={[styles.typePill, { backgroundColor: ts.bg }]}>
                    <Text style={[styles.typePillTxt, { color: ts.txt, fontSize: fs(10) }]}>{ts.label}</Text>
                  </View>
                  {!!team.description?.replace(/<[^>]*>/g, '').trim() && (
                    <Text style={[styles.teamDesc, { color: sub, fontSize: fs(12) }]} numberOfLines={1}>
                      {team.description.replace(/<[^>]*>/g, '')}
                    </Text>
                  )}
                </View>

                {/* Footer: leader + avatars + member count */}
                <View style={[styles.teamCardFooter, { borderTopColor: bdr }]}>
                  <View style={styles.leaderRow}>
                    <View style={[styles.leaderAvatar, { backgroundColor: '#4ECDC4' }]}>
                      <Text style={styles.leaderAvatarTxt}>
                        {team.leader_info?.initials || '?'}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.leaderLabel, { color: sub, fontSize: fs(9) }]}>Leader</Text>
                      <Text style={[styles.leaderName, { color: txt, fontSize: fs(12) }]} numberOfLines={1}>
                        {team.leader_info?.full_name || '—'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.memberInfo}>
                    <AvatarStack members={team.members || []} isDark={isDark} />
                    <Text style={[styles.memberCount, { color: sub, fontSize: fs(11) }]}>
                      {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* My role chip */}
                <View style={[styles.myRoleRow, { borderTopColor: bdr }]}>
                  <Text style={[styles.myRoleLabel, { color: sub, fontSize: fs(10) }]}>My Role:</Text>
                  <View style={[
                    styles.myRoleChip,
                    { backgroundColor: team.my_role === 'owner' ? '#FEF3C7' : (isDark ? '#252530' : '#F3F4F6') },
                  ]}>
                    <Text style={[
                      styles.myRoleChipTxt,
                      { color: team.my_role === 'owner' ? '#92400E' : sub, fontSize: fs(10) },
                    ]}>
                      {team.my_role?.charAt(0).toUpperCase() + team.my_role?.slice(1) || 'Member'}
                    </Text>
                  </View>
                  <Text style={[styles.joinedDate, { color: sub, fontSize: fs(10) }]}>
                    Joined {fmtDate(team.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
          )}
        </>
      )}

      {/* Team detail panel — slides over */}
      {selected && (
        <TeamDetail
          team={selected}
          onClose={() => setSelected(null)}
          isDark={isDark}
          card={card}
          txt={txt}
          sub={sub}
          bdr={bdr}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Navbar
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  navIcon: { fontSize: 16 },

  // Sub-tabs
  subTabs: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 16 },
  subTab: { paddingVertical: 12, paddingHorizontal: 16, position: 'relative' },
  subTabActive: {},
  subTabTxt: { fontWeight: '600' },
  subTabUnderline: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, backgroundColor: '#4ECDC4', borderRadius: 1 },

  // States
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 20 },
  loadingTxt: { fontSize: 13 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center' },

  // Stats
  statsRow: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 2 },
  statNum: { fontWeight: '800' },
  statLabel: { fontWeight: '600', letterSpacing: 0.3 },
  statDivider: { width: 1 },

  // Team card
  teamCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  teamCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  teamColorDot: { width: 10, height: 10, borderRadius: 5 },
  teamName: { flex: 1, fontWeight: '700' },
  manageBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  manageBadgeTxt: { fontWeight: '700', letterSpacing: 0.3 },

  teamCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typePillTxt: { fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  teamDesc: { flex: 1 },

  teamCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leaderAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  leaderAvatarTxt: { color: '#1A1A2E', fontSize: 10, fontWeight: '700' },
  leaderLabel: { fontWeight: '500', letterSpacing: 0.3 },
  leaderName: { fontWeight: '600' },
  memberInfo: { alignItems: 'flex-end', gap: 4 },
  memberCount: { fontWeight: '500' },

  myRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  myRoleLabel: { fontWeight: '500' },
  myRoleChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  myRoleChipTxt: { fontWeight: '700', letterSpacing: 0.3 },
  joinedDate: { flex: 1, textAlign: 'right' },

  // Avatar stack
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  stackAvatarText: { color: '#1A1A2E', fontSize: 8, fontWeight: '700' },

  // Detail panel
  detailPanel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 20, shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  detailClose: { width: 60 },
  detailTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  detailCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 18 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  detailDesc: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  detailMeta: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailMetaItem: { minWidth: '40%' },
  detailMetaLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  detailMetaValue: { fontSize: 13, fontWeight: '700' },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  membersCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#1A1A2E', fontSize: 11, fontWeight: '700' },
  memberName: { fontSize: 13, fontWeight: '600' },
  memberEmail: { fontSize: 11, marginTop: 1 },
  roleChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleChipTxt: { fontSize: 10, fontWeight: '700' },

  // ── Roles tab ──
  rolesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  rolesBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  userTableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  userTableHeaderTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  userAvatar: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  userAvatarTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  userName2: { fontSize: 13, fontWeight: '600' },
  userEmail: { fontSize: 10, marginTop: 1 },
  roleTag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, alignSelf: 'flex-start' },
  roleTagTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  joinedTxt: { fontSize: 10, width: 80, textAlign: 'right' },

  // ── Modals ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  modalInput: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, height: 44, fontSize: 14, marginBottom: 2 },
  modalRow: { flexDirection: 'row', gap: 10 },
  rolePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rolePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5 },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, height: 46, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  modalConfirmBtn: { flex: 2, height: 46, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },

  // Workspace picker in invite modal
  wsPickerList: { borderRadius: 10, borderWidth: 1.5, marginTop: 4, overflow: 'hidden' },
  wsPickerItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  wsPickerItemTxt: { flex: 1, fontSize: 13 },
});
