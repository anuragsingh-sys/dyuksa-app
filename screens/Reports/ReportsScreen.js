import React, { useState, useCallback, useContext, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { getAccessToken, getWorkspaceId, getUsers } from '../../services/ApiService';
import { BASE_URL } from '../../config';
import SidebarMenu from '../../components/SidebarMenu';
import NotificationBell from '../../components/NotificationBell';
import { useTasksCache } from '../../hooks/useTasksCache';
import Svg, { Path, Circle } from 'react-native-svg';

const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

const PERIODS = ['7 days', '30 days', '90 days', 'YTD'];
const ACCENT  = '#3B72EE';

const STATUS_COLORS = {
  in_progress: ACCENT, pending: '#F59E0B', completed: '#22C55E',
  backlog: '#EF4444', deployed: '#22C55E', deferred: '#F97316', review: '#8B5CF6',
};
const STATUS_LABELS = {
  in_progress: 'In Progress', pending: 'Pending', completed: 'Completed',
  backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review',
};
const PROJECT_COLORS = [ACCENT, '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];
const AVATAR_COLORS  = [ACCENT, '#EC4899', '#22C55E', '#F59E0B', '#8B5CF6', '#06B6D4', '#F97316'];

// ── Weekly bar chart ──────────────────────────────────────────────────────────
function WeeklyBarChart({ data, color, sub, txt }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const BAR_H  = 90;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: BAR_H + 40, paddingHorizontal: 8 }}>
      {data.map((item, i) => {
        const h = Math.max(6, (item.value / maxVal) * BAR_H);
        const isLast = i === data.length - 1;
        return (
          <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
            <Text style={{ fontSize: 11, color: sub, fontWeight: '600', marginBottom: 2 }}>{item.value > 0 ? item.value : ''}</Text>
            <View style={{ width: 38, height: h, backgroundColor: color, borderRadius: 8, opacity: isLast ? 0.6 : 1 }} />
            <Text style={{ fontSize: 11, color: sub, marginTop: 4 }}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Donut chart — same as Dashboard ──────────────────────────────────────────
function DonutChart({ segments, total, txt, isDark }) {
  const SIZE   = 110;
  const RADIUS = 40;
  const STROKE = 16;
  const CIRCUM = 2 * Math.PI * RADIUS;
  const cx     = SIZE / 2;
  const cy     = SIZE / 2;

  const segs = segments.filter(s => s.count > 0);
  const tot  = segs.reduce((a, s) => a + s.count, 0) || 1;
  let offset = CIRCUM * 0.25; // start from top

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE}>
        {/* Track — only show if no segments */}
        {segs.length === 0 && (
          <Circle
            cx={cx} cy={cy} r={RADIUS}
            fill="none"
            stroke={isDark ? '#252530' : '#EBEBF0'}
            strokeWidth={STROKE}
          />
        )}
        {/* Segments */}
        {segs.map((seg, i) => {
          const dash = (seg.count / tot) * CIRCUM;
          const gap  = CIRCUM - dash;
          const co   = offset;
          offset    -= dash;
          return (
            <Circle
              key={i}
              cx={cx} cy={cy} r={RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={co}
              strokeLinecap="butt"
            />
          );
        })}
      </Svg>
      {/* Center label */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: txt }}>{total}</Text>
        <Text style={{ fontSize: 9, color: '#9AA3B2' }}>Total Tasks</Text>
      </View>
    </View>
  );
}

// ── Search icon ───────────────────────────────────────────────────────────────
const SearchIcon = ({ size = 20, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

export default function ReportsScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const { user }   = useContext(AuthContext);
  const isDark     = theme === 'Dark';

  const bg   = isDark ? '#0D0D0F' : '#F7F8FB';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#0E1726';
  const sub  = isDark ? '#9898A6' : '#6B7588';
  const bdr  = isDark ? '#252530' : '#E6E9EF';
  const inputBg = isDark ? '#252538' : '#F5F6FA';

  const [period,     setPeriod]    = useState('30 days');
  const [projects,   setProjects]  = useState([]);
  const [users,      setUsersData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chartFilter, setChartFilter] = useState('Completed');
  const lastFetch = useRef(0);

  const { tasks: allTasks, loading: tasksLoading, refresh: refreshTasks } = useTasksCache();

  const fetchData = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < 30_000) return;
    try {
      const headers = await authHeaders();
      const [projRes] = await Promise.all([
        fetch(`${BASE_URL}/projects/`, { headers }),
      ]);
      if (projRes.ok) {
        const d = await projRes.json();
        setProjects(Array.isArray(d) ? d : (d.results || []));
      }
      getUsers().then(setUsersData).catch(() => {});
      lastFetch.current = Date.now();
    } catch (e) { console.warn('ReportsScreen:', e.message); }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshTasks();
    await fetchData(true);
    setRefreshing(false);
  }, [fetchData, refreshTasks]);

  const loading = tasksLoading && allTasks.length === 0;

  // ── Period filter ─────────────────────────────────────────────────
  const filteredTasks = (() => {
    if (period === 'YTD') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      return allTasks.filter(t => (t.created_at || t.updated_at || '').slice(0, 10) >= startOfYear);
    }
    const days = period === '7 days' ? 7 : period === '30 days' ? 30 : 90;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return allTasks.filter(t => (t.created_at || t.updated_at || '').slice(0, 10) >= cutoffStr);
  })();

  const tasks     = filteredTasks;
  const total     = tasks.length;
  const completed = tasks.filter(t => ['completed', 'deployed'].includes(t.status)).length;
  const inProg    = tasks.filter(t => t.status === 'in_progress').length;
  const pending   = tasks.filter(t => t.status === 'pending').length;
  const today     = new Date().toISOString().slice(0, 10);
  const overdue   = tasks.filter(t => {
    const due = t.end_date || t.due_date;
    return due && due < today && !['completed', 'deployed'].includes(t.status);
  }).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ── Weekly throughput (last 5 weeks) ─────────────────────────────
  const weeklyData = (() => {
    const weeks = Array.from({ length: 5 }, (_, i) => {
      const end   = new Date(); end.setDate(end.getDate() - i * 7); end.setHours(23,59,59,999);
      const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0,0,0,0);
      const startStr = start.toISOString().slice(0, 10);
      const endStr   = end.toISOString().slice(0, 10);
      const count = tasks.filter(t => {
        const date = (chartFilter === 'Completed'
          ? t.completed_at || t.updated_at
          : t.created_at || t.updated_at || ''
        ).slice(0, 10);
        return date >= startStr && date <= endStr &&
          (chartFilter === 'Completed' ? ['completed','deployed'].includes(t.status) : true);
      }).length;
      return { label: `W${5 - i}`, value: count };
    }).reverse();
    return weeks;
  })();

  const maxWeekly = Math.max(...weeklyData.map(d => d.value), 1);

  // ── Status distribution ───────────────────────────────────────────
  const statusDist = (() => {
    const counts = {};
    tasks.forEach(t => {
      // treat deployed as completed
      const status = t.status === 'deployed' ? 'completed' : t.status;
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([status, count]) => ({
        status, count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
        color: STATUS_COLORS[status] || '#94A3B8',
      }))
      .sort((a, b) => b.count - a.count);
  })();

  // ── Project stats ─────────────────────────────────────────────────
  const projectStats = projects.slice(0, 6).map((p, i) => ({
    name: p.name || `Project ${p.id}`,
    initial: (p.name || 'P')[0].toUpperCase(),
    progress: p.progress || p.completion_percentage || 0,
    color: PROJECT_COLORS[i % PROJECT_COLORS.length],
    id: p.id,
    raw: p,
  }));

  // ── Top contributors ──────────────────────────────────────────────
  const contributors = (() => {
    const counts = {};
    tasks.forEach(t => {
      const ids = Array.isArray(t.assigned_to) ? t.assigned_to.map(String) : [];
      const details = Array.isArray(t.assigned_to_user_details) ? t.assigned_to_user_details : [];
      if (details.length > 0) {
        details.forEach(u => { const k = String(u.id); counts[k] = (counts[k] || { user: u, count: 0 }); counts[k].count++; });
      } else {
        ids.forEach(id => { counts[id] = counts[id] || { user: { id }, count: 0 }; counts[id].count++; });
      }
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c, i) => {
        const u = c.user;
        const name = u.full_name || (`${u.first_name || ''} ${u.last_name || ''}`).trim() || u.username || `User ${u.id}`;
        const initials = name.split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase() || '?';
        return { name, initials, count: c.count, color: AVATAR_COLORS[i % AVATAR_COLORS.length] };
      });
  })();

  const maxContrib = Math.max(...contributors.map(c => c.count), 1);

  // ── Stat cards ────────────────────────────────────────────────────
  const statCards = [
    { label: 'Tasks completed', value: completed,        trend: '+18%', up: true  },
    { label: 'Cycle time',      value: '2.4d',           trend: '-12%', up: true  },
    { label: 'Throughput',      value: `${Math.round(completed / 4)}/w`, trend: '+9%',  up: true  },
    { label: 'Overdue',         value: overdue,          trend: '+4%',  up: false },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top','left','right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Navbar ── */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Reports" />
          <View>
            <Text style={[s.navTitle, { color: txt }]}>Reports</Text>
            <Text style={{ fontSize: 11, color: sub }}>Performance & analytics</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={{ padding: 6 }} onPress={() => navigation.navigate('Search')}>
            <SearchIcon size={20} color={ACCENT} />
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        >
          {/* ── Period tabs ── */}
          <View style={[s.periodWrap, { backgroundColor: isDark ? '#252530' : '#F0F2F6' }]}>
            {PERIODS.map(p => {
              const active = p === period;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={[s.periodBtn, active && { backgroundColor: card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.periodText, { color: active ? txt : sub, fontWeight: active ? '700' : '500' }]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Stat cards 2x2 ── */}
          <View style={s.statGrid}>
            {statCards.map((k, i) => (
              <View key={i} style={[s.statCard, { backgroundColor: card, borderColor: bdr }]}>
                <Text style={[s.statLabel, { color: sub }]}>{k.label}</Text>
                <Text style={[s.statValue, { color: txt }]}>{k.value}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Text style={{ fontSize: 10 }}>{k.up ? '↗' : '↘'}</Text>
                  <Text style={[s.statTrend, { color: k.up ? '#22C55E' : '#EF4444' }]}>{k.trend}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Weekly throughput ── */}
          <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={[s.cardTitle, { color: txt }]}>Weekly throughput</Text>
              <TouchableOpacity
                style={[s.dropBtn, { backgroundColor: inputBg, borderColor: bdr }]}
                onPress={() => setChartFilter(f => f === 'Completed' ? 'Created' : 'Completed')}
              >
                <Text style={{ fontSize: 12, color: sub, fontWeight: '600' }}>{chartFilter} ▾</Text>
              </TouchableOpacity>
            </View>
            <WeeklyBarChart data={weeklyData} color={ACCENT} sub={sub} txt={txt} />
          </View>

          {/* ── Status distribution ── */}
          <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
            <Text style={[s.cardTitle, { color: txt, marginBottom: 16 }]}>Status distribution</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <DonutChart segments={statusDist} total={total} txt={txt} isDark={isDark} />
              <View style={{ flex: 1, gap: 10 }}>
                {[
                  { label: 'Pending',     status: 'pending',     color: '#F59E0B' },
                  { label: 'Backlog',     status: 'backlog',     color: '#EF4444' },
                  { label: 'In Progress', status: 'in_progress', color: ACCENT    },
                  { label: 'Completed',   status: 'completed',   color: '#22C55E' },
                  { label: 'Review',      status: 'review',      color: '#A78BFA' },
                ].map((item, i) => {
                  const count = statusDist.find(d => d.status === item.status)?.count || 0;
                  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, flexShrink: 0 }} />
                      <Text style={{ width: 78, fontSize: 11, color: sub, fontWeight: '500' }} numberOfLines={1}>{item.label}</Text>
                      <View style={{ flex: 1, height: 6, backgroundColor: isDark ? '#2A2A38' : '#EBEBF0', borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: item.color, borderRadius: 3 }} />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: txt, width: 26, textAlign: 'right' }}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── By project ── */}
          {projectStats.length > 0 && (
            <View style={[s.card, { backgroundColor: card, borderColor: bdr, paddingHorizontal: 0, paddingVertical: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: bdr }}>
                <Text style={[s.cardTitle, { color: txt }]}>By project</Text>
                <TouchableOpacity><Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT }}>All</Text></TouchableOpacity>
              </View>
              {projectStats.map((proj, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => navigation.navigate('ProjectDetail', { project: proj.raw, projectId: proj.id })}
                  activeOpacity={0.7}
                  style={[s.projectRow, i < projectStats.length - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                >
                  <View style={[s.projectAvatar, { backgroundColor: proj.color + '22' }]}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: proj.color }}>{proj.initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.projectName, { color: txt }]} numberOfLines={1}>{proj.name}</Text>
                    <View style={{ height: 5, backgroundColor: isDark ? '#252530' : '#F0F2F6', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
                      <View style={{ width: `${proj.progress}%`, height: '100%', backgroundColor: proj.color, borderRadius: 3 }} />
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: sub, marginLeft: 10 }}>{proj.progress}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Top contributors ── */}
          {contributors.length > 0 && (
            <View style={[s.card, { backgroundColor: card, borderColor: bdr, paddingHorizontal: 0, paddingVertical: 0 }]}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: bdr }}>
                <Text style={[s.cardTitle, { color: txt }]}>Top contributors</Text>
              </View>
              {contributors.map((c, i) => (
                <View key={i} style={[s.contribRow, i < contributors.length - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}>
                  <Text style={[s.contribRank, { color: sub }]}>{i + 1}</Text>
                  <View style={[s.contribAvatar, { backgroundColor: c.color }]}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{c.initials}</Text>
                  </View>
                  <Text style={[s.contribName, { color: txt }]} numberOfLines={1}>{c.name}</Text>
                  <View style={{ flex: 1, height: 5, backgroundColor: isDark ? '#252530' : '#F0F2F6', borderRadius: 3, overflow: 'hidden', marginHorizontal: 10 }}>
                    <View style={{ width: `${(c.count / maxContrib) * 100}%`, height: '100%', backgroundColor: ACCENT, borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: txt }}>{c.count}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1 },
  navbar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navTitle: { fontWeight: '700', fontSize: 17 },

  periodWrap: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 14 },
  periodBtn:  { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  periodText: { fontSize: 12 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: { width: '47%', flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 14 },
  statLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statTrend: { fontSize: 12, fontWeight: '600' },

  card:      { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },

  dropBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },

  projectRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  projectAvatar: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  projectName:   { fontSize: 13, fontWeight: '600' },

  contribRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  contribRank:   { width: 18, fontSize: 13, fontWeight: '600' },
  contribAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 10, flexShrink: 0 },
  contribName:   { fontSize: 13, fontWeight: '600', width: 90 },
});
