import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useContext, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState(null); // team detail

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

  const onRefresh = () => { setRefreshing(true); fetchTeams(); };

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
          { key: 'teams', label: 'Teams', active: true },
          { key: 'roles', label: 'Roles', active: false },
          { key: 'performance', label: 'Performance', active: false },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.subTab, tab.active && styles.subTabActive]}
            onPress={() => !tab.active && Alert.alert('Coming soon', `${tab.label} will be available soon.`)}
          >
            <Text style={[styles.subTabTxt, { color: tab.active ? '#4ECDC4' : sub, fontSize: fs(13) }]}>
              {tab.label}
            </Text>
            {tab.active && <View style={styles.subTabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Body */}
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
});
