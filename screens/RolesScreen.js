import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, RefreshControl, Alert, Modal, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import { BASE_URL } from '../config';
import Svg, { Path } from 'react-native-svg';

const ROLE_COLORS = {
  admin:     { bg: '#FEE2E2', txt: '#991B1B', label: 'Admin' },
  manager:   { bg: '#DBEAFE', txt: '#1E40AF', label: 'Manager' },
  developer: { bg: '#D1FAE5', txt: '#065F46', label: 'Developer' },
  annotator: { bg: '#FEF3C7', txt: '#92400E', label: 'Annotator' },
  viewer:    { bg: '#F3F4F6', txt: '#374151', label: 'Viewer' },
};
const roleStyle = (r) => ROLE_COLORS[(r||'').toLowerCase()] || { bg: '#F3F4F6', txt: '#374151', label: r || 'Member' };

const getInitials = (u) => {
  const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || '?';
  const parts = name.split(' ').filter(Boolean);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
};

const AVATAR_COLORS = ['#EF4444','#F97316','#EAB308','#4ADE80','#06B6D4','#3B82F6','#8B5CF6','#EC4899'];
const avatarColor = (str='') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return '—'; }
};

const ROLES = ['admin','manager','developer','annotator','viewer'];

export default function RolesScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const { user: currentUser } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('all');
  const [editUser,    setEditUser]    = useState(null);
  const [newRole,     setNewRole]     = useState('');
  const [saving,      setSaving]      = useState(false);

  const authHeaders = async () => {
    const token = await getAccessToken();
    const wsId  = await getWorkspaceId();
    const h = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    if (wsId) h['X-Workspace-ID'] = wsId;
    return h;
  };

  const fetchUsers = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/auth/users/`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      list.sort((a, b) => {
        const roleOrder = { admin: 0, manager: 1, developer: 2, annotator: 3, viewer: 4 };
        return (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5);
      });
      setUsers(list);
    } catch (e) {
      console.warn('fetchUsers:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchUsers(); }, [fetchUsers]));

  const updateRole = async () => {
    if (!editUser || !newRole) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/auth/users/${editUser.id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || e.message || `Failed (${res.status})`);
      }
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, role: newRole } : u));
      setEditUser(null);
      Alert.alert('✅ Updated', `${editUser.first_name || editUser.username}'s role updated to ${newRole}.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not update role.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter(u => {
    const name = `${u.first_name} ${u.last_name} ${u.username} ${u.email}`.toLowerCase();
    const matchSearch = !search.trim() || name.includes(search.toLowerCase());
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: '#4ECDC4', fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: txt, fontSize: fs(16) }]}>User Management</Text>
          <Text style={[styles.headerSub, { color: sub }]}>Manage roles & access</Text>
        </View>
        <TouchableOpacity
          style={[styles.inviteBtn, { backgroundColor: '#4ECDC4' }]}
          onPress={() => navigation.navigate('InviteUser')}
        >
          <Text style={{ color: '#fff', fontSize: fs(12), fontWeight: '700' }}>+ Invite</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.statsScroll, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity
          style={[styles.statChip, roleFilter === 'all' && { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' }, { borderColor: bdr }]}
          onPress={() => setRoleFilter('all')}
        >
          <Text style={[styles.statChipTxt, { color: roleFilter === 'all' ? '#fff' : sub }]}>All ({users.length})</Text>
        </TouchableOpacity>
        {ROLES.map(role => {
          const rs = roleStyle(role);
          const count = roleCounts[role] || 0;
          if (!count) return null;
          return (
            <TouchableOpacity
              key={role}
              style={[styles.statChip, { borderColor: roleFilter === role ? rs.txt : bdr, backgroundColor: roleFilter === role ? rs.bg : 'transparent' }]}
              onPress={() => setRoleFilter(roleFilter === role ? 'all' : role)}
            >
              <Text style={[styles.statChipTxt, { color: roleFilter === role ? rs.txt : sub }]}>
                {rs.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={[styles.searchWrap, { backgroundColor: card, borderColor: bdr }]}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            <Path d="M21 21L16.65 16.65" stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
          <TextInput
            style={[styles.searchInput, { color: txt, fontSize: fs(13) }]}
            placeholder="Search users…"
            placeholderTextColor={sub}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: sub, fontSize: 14, paddingHorizontal: 6 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* User list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#4ECDC4" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={u => String(u.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} tintColor="#4ECDC4" />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ fontSize: 36, opacity: 0.2 }}>👤</Text>
              <Text style={[{ fontSize: 15, fontWeight: '600', color: txt }]}>No users found</Text>
            </View>
          }
          renderItem={({ item: u }) => {
            const rs  = roleStyle(u.role);
            const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
            const color = avatarColor(u.username);
            const isMe = u.id === currentUser?.id;
            return (
              <TouchableOpacity
                style={[styles.userCard, { backgroundColor: card, borderColor: bdr }]}
                onPress={() => { setEditUser(u); setNewRole(u.role); }}
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: color }]}>
                  <Text style={styles.avatarTxt}>{getInitials(u)}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.userName, { color: txt, fontSize: fs(14) }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {isMe && (
                      <View style={[styles.meBadge, { backgroundColor: isDark ? '#252530' : '#F0FDF4' }]}>
                        <Text style={{ fontSize: fs(9), color: '#16A34A', fontWeight: '700' }}>You</Text>
                      </View>
                    )}
                    {u.is_superuser && (
                      <Text style={{ fontSize: 12 }}>👑</Text>
                    )}
                  </View>
                  <Text style={[styles.userEmail, { color: sub, fontSize: fs(11) }]} numberOfLines={1}>{u.email}</Text>
                  <Text style={[{ fontSize: fs(10), color: sub }]}>Joined {fmtDate(u.date_joined)}</Text>
                </View>

                {/* Role badge */}
                <View>
                  <View style={[styles.roleBadge, { backgroundColor: rs.bg }]}>
                    <Text style={[styles.roleBadgeTxt, { color: rs.txt, fontSize: fs(10) }]}>{rs.label}</Text>
                  </View>
                  {!u.is_active && (
                    <Text style={{ fontSize: fs(9), color: '#EF4444', textAlign: 'center', marginTop: 3 }}>Inactive</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Edit Role Modal */}
      <Modal visible={!!editUser} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !saving && setEditUser(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !saving && setEditUser(null)} />
          <View style={[styles.modal, { backgroundColor: card, borderColor: bdr }]}>
            <View style={[styles.modalHeader, { borderBottomColor: bdr }]}>
              <Text style={[styles.modalTitle, { color: txt }]}>Change Role</Text>
              <TouchableOpacity onPress={() => !saving && setEditUser(null)}>
                <Text style={{ color: sub, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              {/* User info */}
              <View style={[styles.userPreview, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
                <View style={[styles.avatar, { backgroundColor: avatarColor(editUser?.username || '') }]}>
                  <Text style={styles.avatarTxt}>{editUser ? getInitials(editUser) : '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: txt }]}>
                    {`${editUser?.first_name || ''} ${editUser?.last_name || ''}`.trim() || editUser?.username}
                  </Text>
                  <Text style={[{ fontSize: 11, color: sub }]}>{editUser?.email}</Text>
                </View>
              </View>

              <Text style={[{ fontSize: 11, fontWeight: '600', color: sub, marginBottom: 10, marginTop: 4 }]}>SELECT ROLE</Text>

              {ROLES.map(role => {
                const rs = roleStyle(role);
                const selected = newRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleOption, { borderColor: selected ? rs.txt : bdr, backgroundColor: selected ? rs.bg : 'transparent' }]}
                    onPress={() => setNewRole(role)}
                  >
                    <View style={[styles.roleOptionDot, { borderColor: selected ? rs.txt : bdr, backgroundColor: selected ? rs.txt : 'transparent' }]} />
                    <Text style={[{ fontSize: 14, color: selected ? rs.txt : txt, fontWeight: selected ? '700' : '500', flex: 1 }]}>{rs.label}</Text>
                    {selected && <Text style={{ color: rs.txt, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                  onPress={() => setEditUser(null)}
                  disabled={saving}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: sub }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={updateRole}
                  disabled={saving || newRole === editUser?.role}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Update Role</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },
  inviteBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },

  statsScroll: { borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  statChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  statChipTxt: { fontSize: 12, fontWeight: '600' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, paddingVertical: 0 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 40, minHeight: 200 },

  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  userName: { fontWeight: '600' },
  userEmail: { marginTop: 2 },
  meBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center' },
  roleBadgeTxt: { fontWeight: '700', letterSpacing: 0.3 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modal: { width: '100%', maxWidth: 400, borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700' },

  userPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  roleOption: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  roleOptionDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },

  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 46, fontSize: 14 },
  cancelBtn: { flex: 1, height: 46, borderWidth: 1, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { flex: 1, height: 46, backgroundColor: '#1A1A2E', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
