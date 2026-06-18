import React, { useState, useCallback, useContext, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import { BASE_URL } from '../config';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';

const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

const AVATAR_COLORS = ['#4ECDC4', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
const getAvatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name = '') => name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
const getUserName = (u) => u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'User';

export default function TeamScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const { user }   = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F7F8FB';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#0E1726';
  const sub  = isDark ? '#9898A6' : '#6B7588';
  const bdr  = isDark ? '#252530' : '#E6E9EF';

  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');

  const fetchMembers = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/auth/users/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : (data.results || data.users || []));
      }
    } catch (e) { console.warn('fetchMembers:', e.message); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m => {
      const name = getUserName(m).toLowerCase();
      return name.includes(q) || (m.username || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
    });
  }, [members, search]);

  // Group alphabetically
  const groups = useMemo(() => {
    const g = {};
    filtered.forEach(m => {
      const letter = getUserName(m).charAt(0).toUpperCase();
      if (!g[letter]) g[letter] = [];
      g[letter].push(m);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const myName = user ? getUserName(user) : 'Me';
  const myInitials = getInitials(myName);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Team" />
          <TouchableOpacity onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}>
            <View style={s.logoBox}><Text style={s.logoText}>D</Text></View>
          </TouchableOpacity>
          <Text style={[s.brandName, { color: txt }]}>Team</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[{ color: sub, fontSize: 12 }]}>{members.length} members</Text>
          <NotificationBell />
        </View>
      </View>

      {/* Search bar */}
      <View style={[s.searchWrap, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={[s.searchBar, { backgroundColor: isDark ? '#252530' : '#F7F8FB', borderColor: bdr }]}>
          <Text style={{ fontSize: 14, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={[s.searchInput, { color: txt }]}
            placeholder="Search team members…"
            placeholderTextColor={sub}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: sub, fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4ECDC4" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>

          {/* Me card */}
          {user && (
            <View style={[s.ownerCard, { backgroundColor: card, borderColor: bdr }]}>
              <View style={[s.avatar, { backgroundColor: '#1A1A2E' }]}>
                <Text style={[s.avatarText, { color: '#4ECDC4' }]}>{myInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[s.memberName, { color: txt }]}>{myName}</Text>
                  <Text style={[{ fontSize: 12, color: sub }]}>(You)</Text>
                </View>
                <Text style={[{ fontSize: 12, color: sub, marginTop: 2 }]}>{user.email || ''}</Text>
              </View>
              <View style={s.adminBadge}>
                <Text style={s.adminBadgeText}>{user.is_superuser ? 'ADMIN' : 'MEMBER'}</Text>
              </View>
            </View>
          )}

          {/* Grouped members */}
          {groups.map(([letter, mems]) => (
            <View key={letter} style={{ marginBottom: 8 }}>
              <Text style={[s.letterHeader, { color: sub }]}>{letter}</Text>
              <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                {mems.map((m, idx) => {
                  const name = getUserName(m);
                  const initials = getInitials(name);
                  const color = getAvatarColor(name);
                  const isMe = user && (m.id === user.id || m.username === user.username);
                  if (isMe) return null; // already shown above
                  return (
                    <View
                      key={m.id || idx}
                      style={[s.memberRow, idx < mems.length - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                    >
                      <View style={[s.avatar, { backgroundColor: color + '22' }]}>
                        <Text style={[s.avatarText, { color }]}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.memberName, { color: txt }]}>{name}</Text>
                        <Text style={[s.memberSub, { color: sub }]}>
                          @{m.username || '—'}{m.email ? `  ·  ${m.email}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[s.chatBtn, { backgroundColor: isDark ? '#252530' : '#F7F8FB', borderColor: bdr }]}
                        onPress={() => navigation.navigate('Chat')}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 14 }}>💬</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          {filtered.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
              <Text style={{ fontSize: 48, opacity: 0.3 }}>👥</Text>
              <Text style={[{ fontSize: 16, fontWeight: '600', color: txt }]}>No members found</Text>
              <Text style={[{ fontSize: 13, color: sub }]}>Try a different search term</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontWeight: '700', fontSize: 17 },
  searchWrap: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, height: 42, paddingHorizontal: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, height: 42 },
  ownerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  adminBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(78,205,196,0.12)' },
  adminBadgeText: { fontSize: 10, fontWeight: '700', color: '#4ECDC4', letterSpacing: 0.5 },
  letterHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 4, paddingVertical: 6 },
  groupCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 14, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberSub: { fontSize: 11, marginTop: 2 },
  chatBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
