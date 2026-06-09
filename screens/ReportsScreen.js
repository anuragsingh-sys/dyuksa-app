import React, { useState, useCallback, useContext, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import { BASE_URL } from '../config';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';
import { useTasksCache } from '../hooks/useTasksCache';

const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

const PERIODS = ['7 days', '30 days', '90 days', 'All'];

const STATUS_COLORS = {
  pending: '#F59E0B', in_progress: '#3B82F6', completed: '#22C55E',
  backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA',
};
const PRIORITY_COLORS = { low: '#22C55E', medium: '#F59E0B', high: '#F97316', urgent: '#EF4444' };

const PROJECT_COLORS = ['#3B82F6', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

// Mini bar chart component
function BarChart({ data, maxVal, color, isDark, sub }) {
  const BAR_H = 100;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: BAR_H + 28, paddingHorizontal: 4 }}>
      {data.map((item, i) => {
        const h = maxVal > 0 ? Math.max(4, (item.value / maxVal) * BAR_H) : 4;
        return (
          <View key={i} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 10, color: sub, fontWeight: '600' }}>{item.value}</Text>
            <View style={{ width: 28, height: h, backgroundColor: color, borderRadius: 6, opacity: i === data.length - 1 ? 1 : 0.6 }} />
            <Text style={{ fontSize: 10, color: sub }}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Mini donut chart (pure RN, no SVG)
function StatusDonut({ data, total, isDark, txt }) {
  const COLORS = { completed: '#22C55E', in_progress: '#3B82F6', pending: '#F59E0B', backlog: '#F472B6', review: '#A78BFA', deferred: '#FBBF24', deployed: '#3B82F6' };
  return (
    <View style={{ gap: 8 }}>
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        const color = COLORS[d.status] || '#888';
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
            <Text style={{ flex: 1, fontSize: 12, color: txt, fontWeight: '500', textTransform: 'capitalize' }}>
              {(d.status || '').replace('_', ' ')}
            </Text>
            <View style={{ width: 80, height: 6, backgroundColor: isDark ? '#252530' : '#F0F2F6', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: txt, width: 28, textAlign: 'right' }}>{d.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ReportsScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F7F8FB';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#0E1726';
  const sub  = isDark ? '#9898A6' : '#6B7588';
  const bdr  = isDark ? '#252530' : '#E6E9EF';

  const [period,    setPeriod]   = useState('30 days');
  const [projects,  setProjects] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const lastProjFetch = useRef(0);

  // Tasks from shared cache
  const { tasks: allTasks, loading: tasksLoading, refresh: refreshTasks } = useTasksCache();

  // Fetch projects with stale check
  const fetchProjects = useCallback(async (force = false) => {
    if (!force && Date.now() - lastProjFetch.current < 30_000) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/projects/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : (data.results || []));
        lastProjFetch.current = Date.now();
      }
    } catch (e) { console.warn('ReportsScreen projects:', e.message); }
  }, []);

  useFocusEffect(useCallback(() => { fetchProjects(); }, [fetchProjects]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshTasks();
    await fetchProjects(true);
    setRefreshing(false);
  }, [fetchProjects, refreshTasks]);

  const loading = tasksLoading && allTasks.length === 0;

  // ── Period filter ──────────────────────────────────────────────────
  const filteredTasks = (() => {
    if (period === 'All') return allTasks;
    const days = period === '7 days' ? 7 : period === '30 days' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return allTasks.filter(t => {
      const date = (t.created_at || t.updated_at || '').slice(0, 10);
      return date >= cutoffStr;
    });
  })();

  // ── Derived stats ──
  const tasks = filteredTasks;
  const total     = tasks.length;
  const completed = tasks.filter(t => ['completed', 'deployed'].includes(t.status)).length;
  const inProg    = tasks.filter(t => t.status === 'in_progress').length;
  const pending   = tasks.filter(t => t.status === 'pending').length;
  const overdue   = tasks.filter(t => {
    const due = t.end_date || t.due_date;
    const today = new Date().toISOString().slice(0, 10);
    return due && due < today && !['completed', 'deployed'].includes(t.status);
  }).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Status distribution
  const statusDist = (() => {
    const counts = {};
    tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
  })();

  // Priority distribution
  const priorityDist = (() => {
    const counts = { urgent: 0, high: 0, medium: 0, low: 0 };
    tasks.forEach(t => { if (t.priority && counts[t.priority] !== undefined) counts[t.priority]++; });
    return Object.entries(counts).map(([p, c]) => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: c }));
  })();

  const maxPriority = Math.max(...priorityDist.map(d => d.value), 1);

  // Project stats
  const projectStats = projects.slice(0, 6).map((p, i) => ({
    name: p.name || `Project ${p.id}`,
    progress: p.progress || p.completion_percentage || 0,
    color: PROJECT_COLORS[i % PROJECT_COLORS.length],
    tasks: tasks.filter(t => String(t.project) === String(p.id) || String(t.project_details?.id) === String(p.id)).length,
  }));

  const kpis = [
    { label: 'Total Tasks', value: total,     color: '#4ECDC4', bg: isDark ? 'rgba(78,205,196,0.1)' : '#F0FDFA', icon: '🗂️' },
    { label: 'Completed',   value: completed,  color: '#22C55E', bg: isDark ? 'rgba(34,197,94,0.1)'  : '#F0FDF4', icon: '✅' },
    { label: 'In Progress', value: inProg,     color: '#3B82F6', bg: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF', icon: '⚡' },
    { label: 'Overdue',     value: overdue,    color: '#EF4444', bg: isDark ? 'rgba(239,68,68,0.1)'  : '#FEF2F2', icon: '⏰' },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Reports" />
          <TouchableOpacity onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}>
            <View style={s.logoBox}><Text style={s.logoText}>D</Text></View>
          </TouchableOpacity>
          <Text style={[s.brandName, { color: txt }]}>Reports</Text>
        </View>
        <NotificationBell />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4ECDC4" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" colors={['#4ECDC4']} />}
        >
          {/* Period selector */}
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

          {/* KPI grid */}
          <View style={s.kpiGrid}>
            {kpis.map((k, i) => (
              <View key={i} style={[s.kpiCard, { backgroundColor: k.bg, borderColor: bdr }]}>
                <Text style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</Text>
                <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
                <Text style={[s.kpiLabel, { color: sub }]}>{k.label}</Text>
              </View>
            ))}
          </View>

          {/* Completion rate */}
          <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[s.cardTitle, { color: txt }]}>Overall Completion</Text>
              <Text style={[{ fontSize: 22, fontWeight: '800', color: '#22C55E' }]}>{completionRate}%</Text>
            </View>
            <View style={{ height: 10, backgroundColor: isDark ? '#252530' : '#F0F2F6', borderRadius: 5, overflow: 'hidden' }}>
              <View style={{ width: `${completionRate}%`, height: '100%', backgroundColor: '#22C55E', borderRadius: 5 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={[{ fontSize: 11, color: sub }]}>{completed} of {total} tasks completed</Text>
              <Text style={[{ fontSize: 11, color: '#EF4444', fontWeight: '600' }]}>{overdue} overdue</Text>
            </View>
          </View>

          {/* Priority distribution */}
          <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
            <Text style={[s.cardTitle, { color: txt, marginBottom: 16 }]}>By Priority</Text>
            <BarChart data={priorityDist} maxVal={maxPriority} color="#4ECDC4" isDark={isDark} sub={sub} />
          </View>

          {/* Status distribution */}
          <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
            <Text style={[s.cardTitle, { color: txt, marginBottom: 16 }]}>Status Breakdown</Text>
            <StatusDonut data={statusDist} total={total} isDark={isDark} txt={txt} />
          </View>

          {/* By project */}
          {projectStats.length > 0 && (
            <View style={[s.card, { backgroundColor: card, borderColor: bdr, padding: 0 }]}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: bdr }}>
                <Text style={[s.cardTitle, { color: txt }]}>By Project</Text>
              </View>
              {projectStats.map((proj, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => navigation.navigate('ProjectDetail', { project: projects[i] })}
                  activeOpacity={0.7}
                  style={[s.projectRow, i < projectStats.length - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                >
                  <View style={[s.projectBar, { backgroundColor: proj.color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={[s.projectName, { color: txt }]} numberOfLines={1}>{proj.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[{ fontSize: 12, fontWeight: '700', color: proj.color }]}>{proj.progress}%</Text>
                        <Text style={{ color: sub, fontSize: 14 }}>›</Text>
                      </View>
                    </View>
                    <View style={{ height: 5, backgroundColor: isDark ? '#252530' : '#F0F2F6', borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ width: `${proj.progress}%`, height: '100%', backgroundColor: proj.color, borderRadius: 3 }} />
                    </View>
                    <Text style={[{ fontSize: 11, color: sub, marginTop: 4 }]}>{proj.tasks} task{proj.tasks !== 1 ? 's' : ''}</Text>
                  </View>
                </TouchableOpacity>
              ))}
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
  brandName: { fontWeight: '700', fontSize: 15 },
  periodWrap: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 14 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  periodText: { fontSize: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  kpiCard: { width: '47%', flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
  kpiValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  kpiLabel: { fontSize: 12, fontWeight: '500' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  projectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  projectBar: { width: 4, height: 40, borderRadius: 2, flexShrink: 0 },
  projectName: { fontSize: 13, fontWeight: '600', flex: 1 },
});
