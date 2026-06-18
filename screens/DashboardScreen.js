import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, StatusBar, Alert,
} from 'react-native';
import { Svg, Circle, G, Polyline, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';
import { BASE_URL } from '../config';
import { Feather } from '@expo/vector-icons';
import { useTasksCache } from '../hooks/useTasksCache';

// ── Token colours (inline — no dep on dev_1 constants folder) ────────────────
const T = {
  brand:        '#2D6AE3',
  brandDark:    '#1F4FB5',
  ink:          '#0E1726',
  ink2:         '#3B4658',
  ink3:         '#6B7588',
  ink4:         '#9AA3B2',
  hairline:     '#E6E9EF',
  hairlineSoft: '#F0F2F6',
  surface:      '#FFFFFF',
  surfaceAlt:   '#F7F8FB',
  cBlue:   '#2D6AE3', cBlueSoft:   '#E6EEFC',
  cGreen:  '#22A06B', cGreenSoft:  '#E2F5EC',
  cYellow: '#E5A60E', cYellowSoft: '#FEF3CE',
  cPurple: '#7A5AF8', cPurpleSoft: '#EEEAFE',
  cRed:    '#E5484D', cRedSoft:    '#FBE3E3',
  r: 10, rMd: 14, rLg: 20,
};

// ── Auth headers ──────────────────────────────────────────────────────────────
const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, '').trim();

const fmtRelative = (iso) => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7)   return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

const PRIORITY_COLOR = {
  critical: T.cRed, high: T.cRed, medium: T.cYellow, low: T.cBlue,
};
const STATUS_COLOR = {
  in_progress: T.cBlue, completed: T.cGreen, pending: T.cYellow,
  overdue: T.cRed, todo: T.cYellow,
};
const DOC_KIND_COLOR = {
  pdf: T.cRed, doc: T.cBlue, docx: T.cBlue,
  xls: T.cGreen, xlsx: T.cGreen,
  ppt: T.cYellow, pptx: T.cYellow,
  img: T.cPurple, png: T.cPurple, jpg: T.cPurple,
};
const DOC_KIND_LABEL = {
  pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS',
  ppt: 'PPT', pptx: 'PPT', png: 'IMG', jpg: 'IMG',
};

// ── Mini reusable UI pieces (no external dep) ─────────────────────────────────

function Card({ children, style, padding = 16, isDark }) {
  return (
    <View style={[{
      backgroundColor: isDark ? '#1A1A20' : T.surface, 
      borderRadius: T.rMd,
      borderWidth: 1, 
      borderColor: isDark ? '#252530' : T.hairline, 
      padding,
    }, style]}>
      {children}
    </View>
  );
}

function SectionHeader({ children, right, style, isDark }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#9AA3B2' : T.ink2, letterSpacing: 0.3 }}>{children}</Text>
      {right}
    </View>
  );
}

function TextLink({ children, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: T.brand }}>{children}</Text>
    </TouchableOpacity>
  );
}

function Progress({ value = 0, color = T.brand, h = 6, trackColor }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View style={{ height: h, backgroundColor: trackColor || T.hairlineSoft, borderRadius: h }}>
      <View style={{ height: h, width: `${pct}%`, backgroundColor: color, borderRadius: h }} />
    </View>
  );
}

function FileTile({ ext, size = 36 }) {
  const key  = (ext || '').toLowerCase();
  const color = DOC_KIND_COLOR[key] || T.ink3;
  const label = DOC_KIND_LABEL[key] || (key.toUpperCase().slice(0, 3) || 'DOC');
  return (
    <View style={{
      width: size, height: size, borderRadius: 8,
      backgroundColor: color + '22',
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ fontSize: 9, fontWeight: '800', color, letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

// Simple tab bar
function Tabs({ tabs, activeTab, onTab }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: T.hairline, marginBottom: 8 }}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t.id}
          onPress={() => onTab(t.id)}
          style={{ paddingVertical: 8, paddingHorizontal: 10, marginRight: 4, position: 'relative' }}
        >
          <Text style={{ fontSize: 12, fontWeight: activeTab === t.id ? '700' : '500', color: activeTab === t.id ? T.brand : T.ink3 }}>
            {t.label}
          </Text>
          {activeTab === t.id && (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: T.brand, borderRadius: 1 }} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const navigation = useNavigation();
  const { theme }  = useContext(ThemeContext);
  const { user }   = useContext(AuthContext);
  const isDark     = theme === 'Dark';

  // ── State ──────────────────────────────────────────────────────────────────
  // Tasks come from the shared cache — no duplicate fetches across screens
  const { tasks } = useTasksCache();
  const [projects,      setProjects]      = useState([]);
  const [recentDocs,    setRecentDocs]    = useState([]);
  const [totalDocs,     setTotalDocs]     = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeTaskTab, setActiveTaskTab] = useState('upcoming');

  // ── Fetch projects + docs only (tasks come from shared cache) ─────────────
  const lastFetchRef  = useRef(0);
  const STALE_MS_DASH = 30_000; // 30s — skip refetch on rapid tab switches

  const fetchAll = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetchRef.current < STALE_MS_DASH) return;
    try {
      const headers = await authHeaders();

      const [projectsRes, docsRes] = await Promise.all([
        fetch(`${BASE_URL}/projects/?page_size=20`, { headers }),
        fetch(`${BASE_URL}/documents/?page_size=10`, { headers }),
      ]);

      if (projectsRes.ok) {
        const d = await projectsRes.json();
        setProjects(Array.isArray(d) ? d : (d.results || []));
      }
      if (docsRes.ok) {
        const d = await docsRes.json();
        setTotalDocs(d.count ?? (Array.isArray(d) ? d.length : (d.results?.length || 0)));
        setRecentDocs((Array.isArray(d) ? d : (d.results || [])).slice(0, 5));
      }
      lastFetchRef.current = Date.now();
    } catch (e) {
      console.warn('DashboardScreen fetchAll:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // Small delay on first mount ensures token/workspace are fully saved to
    // AsyncStorage after login before we start fetching
    if (lastFetchRef.current === 0) {
      const t = setTimeout(() => fetchAll(), 100);
      return () => clearTimeout(t);
    }
    fetchAll();
  }, [fetchAll]));

  // ── Derived counts ─────────────────────────────────────────────────────────
  const totalTasks     = tasks.length;
  const completedTasks = tasks.filter(t => ['completed', 'done'].includes((t.status || '').toLowerCase())).length;
  const overdueTasks   = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    const due = t.end_date || t.due_date;
    const today = new Date().toISOString().slice(0,10);
    return (s !== 'completed' && s !== 'deployed' && due && due < today);
  }).length;
  const inProgressTasks= tasks.filter(t => (t.status || '').toLowerCase() === 'in_progress').length;
  const pendingTasks   = tasks.filter(t => (t.status || '').toLowerCase() === 'pending').length;
  const backlogTasks   = tasks.filter(t => (t.status || '').toLowerCase() === 'backlog').length;
  const reviewTasks    = tasks.filter(t => (t.status || '').toLowerCase() === 'review').length;
  const deployedTasks  = tasks.filter(t => (t.status || '').toLowerCase() === 'deployed').length;

  const upcomingTasks  = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s === 'pending' || s === 'todo';
  }).slice(0, 8);
  const overdueTasksList   = tasks.filter(t => {
    const s   = (t.status || '').toLowerCase();
    const due = t.end_date || t.due_date;
    const now = new Date().toISOString().slice(0,10);
    return (s !== 'completed' && s !== 'deployed' && due && due < now);
  }).slice(0, 8);
  const completedTasksList = tasks.filter(t => ['completed','done'].includes((t.status||'').toLowerCase())).slice(0, 8);

  const tasksByTab = (tab) => {
    if (tab === 'upcoming')  return upcomingTasks;
    if (tab === 'overdue')   return overdueTasksList;
    if (tab === 'completed') return completedTasksList;
    return [];
  };

  const TABS = [
    { id: 'upcoming',  label: `Upcoming (${upcomingTasks.length})` },
    { id: 'overdue',   label: `Overdue (${overdueTasksList.length})` },
    { id: 'completed', label: `Completed (${completedTasksList.length})` },
  ];

  // ── Overview stat cards — real values ──────────────────────────────────────
  // Sparkline data: cumulative task counts over last 8 months
  const sparkFor = (filterFn) => {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (7 - i));
      const yr = d.getFullYear(); const mo = d.getMonth();
      return tasks.filter(t => {
        const ds = (t.created_at || t.updated_at || '').slice(0, 7);
        return ds === `${yr}-${String(mo + 1).padStart(2, '0')}` && filterFn(t);
      }).length;
    });
  };

  // ── Overview stat cards ────────────────────────────────────────────────────
  const OVERVIEW = [
    { label: 'Total Projects',  value: projects.length, color: T.cBlue,   soft: T.cBlueSoft,   icon: 'folder',       pct: `${projects.length} total`,
      spark: [2,3,4,5,6,7,8, projects.length || 1],
      onPress: () => { try { navigation.jumpTo('Projects'); } catch { navigation.navigate('Projects'); } } },
    { label: 'Total Documents', value: totalDocs,       color: T.cGreen,  soft: T.cGreenSoft,  icon: 'file-text',    pct: `${totalDocs} total`,
      spark: [10,15,20,30,35,40,50, totalDocs || 1],
      onPress: () => navigation.navigate('Docs') },
    { label: 'Total Tasks',     value: totalTasks,      color: T.cYellow, soft: T.cYellowSoft, icon: 'check-square', pct: `${pendingTasks} pending`,
      spark: sparkFor(() => true),
      onPress: () => { try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Tasks'); } } },
    { label: 'Completed',       value: completedTasks,  color: T.cPurple, soft: T.cPurpleSoft, icon: 'check-circle', pct: `${totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0}% done`,
      spark: sparkFor(t => ['completed','deployed'].includes(t.status)),
      onPress: () => { try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Tasks'); } } },
    { label: 'Overdue Tasks',   value: overdueTasks,    color: T.cRed,    soft: T.cRedSoft,    icon: 'alert-circle', pct: `${totalTasks > 0 ? Math.round((overdueTasks/totalTasks)*100) : 0}% of total`,
      spark: sparkFor(t => { const due = t.end_date||t.due_date; return due && due < new Date().toISOString().slice(0,10) && !['completed','deployed'].includes(t.status); }),
      onPress: () => { try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Tasks'); } } },
  ];

  // ── Tasks Over Time — real data from tasks (same as web) ──────────────────
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const chartData = (() => {
    const { year, month } = selectedMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // 8 evenly spaced sample points across the month
    const points = Array.from({ length: 8 }, (_, i) =>
      Math.round(1 + (i / 7) * (daysInMonth - 1))
    );

    const countByDay = (day, filterFn, useDueDate = false) =>
      tasks.filter(t => {
        const dateStr = useDueDate
          ? (t.end_date || t.due_date)
          : (t.created_at || t.updated_at || t.start_date || '');
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() <= day && filterFn(t);
      }).length;

    return {
      points,
      labels: points.map(d => {
        const mn = new Date(year, month, d).toLocaleString('en-US', { month: 'short' });
        return `${mn} ${d}`;
      }),
      series: [
        { label: 'In Progress', color: '#3B72EE', data: points.map(d => countByDay(d, t => t.status === 'in_progress')) },
        { label: 'Completed',   color: '#22C55E', data: points.map(d => countByDay(d, t => t.status === 'completed' || t.status === 'deployed', true)) },
        { label: 'Overdue',     color: '#EF4444', data: points.map(d => {
          const cutoff = new Date(year, month, d);
          return tasks.filter(t => {
            const due = t.end_date || t.due_date;
            return due && new Date(due) < cutoff && !['completed','deployed'].includes(t.status);
          }).length;
        })},
        { label: 'Pending', color: '#F59E0B', data: points.map(d => countByDay(d, t => t.status === 'pending' || t.status === 'backlog')) },
      ],
    };
  })();

  // Tab screens use jumpTo; Stack screens use navigate
  const QUICK_ACTIONS = [
    { label: 'New Project', icon: 'folder-plus',  color: T.cBlue,   soft: T.cBlueSoft,
      onPress: () => navigation.navigate('CreateProject') },
    { label: 'Upload Doc',  icon: 'upload',       color: T.cGreen,  soft: T.cGreenSoft,
      onPress: () => navigation.navigate('Docs') },
    { label: 'New Task',    icon: 'check-square', color: T.cYellow, soft: T.cYellowSoft,
      onPress: () => navigation.navigate('CreateTask') },
    { label: 'Calendar',    icon: 'calendar',     color: T.cPurple, soft: T.cPurpleSoft,
      onPress: () => { try { navigation.jumpTo('Calendar'); } catch { navigation.navigate('Calendar'); } } },
    { label: 'Reports',     icon: 'bar-chart-2',  color: T.cBlue,   soft: T.cBlueSoft,
      onPress: () => { try { navigation.jumpTo('Reports'); } catch { navigation.navigate('Reports'); } } },
    { label: 'Invite',      icon: 'user-plus',    color: T.cRed,    soft: T.cRedSoft,
      onPress: () => navigation.navigate('InviteUser') },
  ];

  const userName = user?.first_name || user?.username || 'there';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: isDark ? '#0D0D0F' : T.surfaceAlt }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: isDark ? '#1A1A20' : T.surface, borderBottomColor: isDark ? '#252530' : T.hairline }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="Dashboard" />
          <View>
            <Text style={[s.brandName, { color: isDark ? '#fff' : T.ink }]}>Dashboard</Text>
            <Text style={{ fontSize: 11, color: isDark ? '#9AA3B2' : T.ink3, marginTop: 1 }}>Welcome back, {userName}</Text>
          </View>
        </View>
        <View style={s.navRight}>
          <TouchableOpacity
            style={{ padding: 4 }}
            onPress={() => navigation.navigate('Search')}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              <Path d="M21 21L16.65 16.65" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(true); }} tintColor={T.brand} />}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator color={T.brand} size="large" />
            <Text style={{ color: T.ink3, marginTop: 12, fontSize: 13 }}>Loading dashboard…</Text>
          </View>
        ) : (
          <>
            {/* 1. Greeting card — blue gradient matching screenshot */}
            <LinearGradient
              colors={['#3B72EE', '#5B8FF5']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.greetCard}
            >
              <View style={[s.decoCircle, { width: 160, height: 160, top: -40, right: -30, opacity: 0.07 }]} />
              <View style={[s.decoCircle, { width: 90, height: 90, bottom: -20, left: 30, opacity: 0.05 }]} />
              <Text style={s.greetDate}>{today()}</Text>
              <Text style={s.greetMsg}>Here's what's happening with your workspace.</Text>
              <View style={s.greetStats}>
                <View style={s.greetStat}>
                  <Text style={s.greetStatVal}>{upcomingTasks.length}</Text>
                  <Text style={s.greetStatLbl}>Tasks today</Text>
                </View>
                <View style={s.greetDivider} />
                <View style={s.greetStat}>
                  <Text style={s.greetStatVal}>{inProgressTasks}</Text>
                  <Text style={s.greetStatLbl}>Meetings</Text>
                </View>
                <View style={s.greetDivider} />
                <View style={s.greetStat}>
                  <Text style={s.greetStatVal}>{overdueTasks}</Text>
                  <Text style={s.greetStatLbl}>Overdue</Text>
                </View>
              </View>
            </LinearGradient>

            {/* 2. Overview stat cards — 2-col grid with Feather icons + % badge + sparkline */}
            <SectionHeader isDark={isDark}>Overview</SectionHeader>
            <View style={s.overviewGrid}>
              {OVERVIEW.map((item, idx) => {
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={item.onPress}
                    activeOpacity={0.75}
                    style={[s.statCard, idx === OVERVIEW.length - 1 && OVERVIEW.length % 2 !== 0 && { flex: 0, width: '48%' }]}
                  >
                    <Card isDark={isDark} padding={12}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <View style={[s.statIcon, { backgroundColor: isDark ? '#252530' : item.soft }]}>
                          <Feather name={item.icon} size={14} color={item.color} />
                        </View>
                        <Text style={[s.statLabel, { color: isDark ? '#9AA3B2' : T.ink3 }]} numberOfLines={1}>{item.label}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                        <Text style={[s.statValue, { color: isDark ? '#fff' : T.ink }]}>{item.value}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: item.color }}>{item.pct}</Text>
                      </View>
                      {/* Mini sparkline — real data */}
                      <View style={{ height: 28, marginTop: 8, overflow: 'hidden' }}>
                        {(() => {
                          const spark = item.spark || [0,0,0,0,0,0,0,item.value||1];
                          const maxV  = Math.max(...spark, 1);
                          const W = 80; const H = 28;
                          const pts = spark.map((v, i) => {
                            const x = (i / (spark.length - 1)) * W;
                            const y = H - (v / maxV) * (H - 4) - 2;
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          }).join(' ');
                          return (
                            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                              <Polyline points={pts} fill="none" stroke={item.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                          );
                        })()}
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 14, backgroundColor: item.color + '18', borderRadius: 4 }} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Tasks by Status */}
            <SectionHeader isDark={isDark} style={{ marginTop: 4 }}>
              Tasks by Status
            </SectionHeader>
            <Card isDark={isDark} style={{ marginBottom: 22 }} padding={16}>
              {/* Tasks by Status — SVG donut chart */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {/* SVG Donut */}
                {(() => {
                  const SIZE   = 88;
                  const RADIUS = 32;
                  const STROKE = 13;
                  const CIRCUM = 2 * Math.PI * RADIUS;
                  const cx     = SIZE / 2;
                  const cy     = SIZE / 2;

                  const segs = [
                    { count: pendingTasks,    color: '#F59E0B' },
                    { count: backlogTasks,    color: '#EF4444' },
                    { count: inProgressTasks, color: '#3B82F6' },
                    { count: completedTasks,  color: '#22C55E' },
                    { count: reviewTasks,     color: '#A78BFA' },
                  ].filter(s => s.count > 0);

                  const total = segs.reduce((a, s) => a + s.count, 0) || 1;
                  let offset  = CIRCUM * 0.25; // start from top (rotate -90°)

                  return (
                    <View style={{ width: SIZE, height: SIZE }}>
                      <Svg width={SIZE} height={SIZE}>
                        {/* Track */}
                        <Circle
                          cx={cx} cy={cy} r={RADIUS}
                          fill="none"
                          stroke={isDark ? '#252530' : '#EBEBF0'}
                          strokeWidth={STROKE}
                        />
                        {/* Segments */}
                        {segs.map((seg, i) => {
                          const dash   = (seg.count / total) * CIRCUM;
                          const gap    = CIRCUM - dash;
                          const co     = offset;
                          offset      -= dash;
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
                      <View style={{
                        position: 'absolute', top: 0, left: 0,
                        width: SIZE, height: SIZE,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#fff' : T.ink }}>{totalTasks}</Text>
                        <Text style={{ fontSize: 8, color: T.ink3 }}>Total</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Legend */}
                <View style={{ flex: 1, gap: 8 }}>
                  {[
                    { label: 'Pending',     count: pendingTasks,    color: '#F59E0B' },
                    { label: 'Backlog',     count: backlogTasks,    color: '#EF4444' },
                    { label: 'In Progress', count: inProgressTasks, color: '#3B82F6' },
                    { label: 'Completed',   count: completedTasks,  color: '#22C55E' },
                    { label: 'Review',      count: reviewTasks,     color: '#A78BFA' },
                  ].map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, flexShrink: 0 }} />
                      <Text style={{ width: 78, fontSize: 11, color: isDark ? '#9AA3B2' : T.ink2, fontWeight: '500' }} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {/* Progress bar */}
                      <View style={{ flex: 1, height: 6, backgroundColor: isDark ? '#2A2A38' : '#EBEBF0', borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ width: `${totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0}%`, height: '100%', backgroundColor: item.color, borderRadius: 3 }} />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#fff' : T.ink, width: 26, textAlign: 'right' }}>
                        {item.count}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            {/* Tasks Over Time — real data */}
            <SectionHeader isDark={isDark} right={
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? '#252530' : T.hairlineSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
                onPress={() => setShowMonthPicker(v => !v)}
              >
                <Text style={{ fontSize: 11, color: isDark ? '#9AA3B2' : T.ink3, fontWeight: '600' }}>
                  {new Date(selectedMonth.year, selectedMonth.month).toLocaleString('en-US', { month: 'short', year: 'numeric' })}
                </Text>
                <Text style={{ fontSize: 9, color: T.ink4 }}>▾</Text>
              </TouchableOpacity>
            }>
              Tasks Over Time
            </SectionHeader>
            {showMonthPicker && (
              <Card isDark={isDark} padding={8} style={{ marginBottom: 8 }}>
                {Array.from({ length: 6 }, (_, i) => {
                  const d = new Date(); d.setMonth(d.getMonth() - i);
                  const yr = d.getFullYear(); const mo = d.getMonth();
                  const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                  const isSelected = selectedMonth.year === yr && selectedMonth.month === mo;
                  return (
                    <TouchableOpacity
                      key={`${yr}-${mo}`}
                      onPress={() => { setSelectedMonth({ year: yr, month: mo }); setShowMonthPicker(false); }}
                      style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: isSelected ? '#3B72EE18' : 'transparent' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#3B72EE' : (isDark ? '#fff' : T.ink) }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Card>
            )}
            <Card isDark={isDark} style={{ marginBottom: 22 }} padding={14}>
              {(() => {
                const { series, labels } = chartData;
                const W = 280; const H = 110;
                const allMax = Math.max(...series.flatMap(s => s.data), 1);
                const toPoints = (data) => data.map((v, i) => {
                  const x = ((i / (data.length - 1)) * W).toFixed(1);
                  const y = (H - (v / allMax) * (H - 16) - 8).toFixed(1);
                  return `${x},${y}`;
                }).join(' ');
                // Show 4 evenly spaced labels
                const shownLabels = [labels[0], labels[2], labels[4], labels[7]];
                return (
                  <View>
                    {/* Legend */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                      {series.map((s, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <View style={{ width: 20, height: 2.5, backgroundColor: s.color, borderRadius: 2 }} />
                          <Text style={{ fontSize: 10, color: isDark ? '#9AA3B2' : T.ink3, fontWeight: '500' }}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                    <Svg width={W} height={H}>
                      {/* Gridlines */}
                      {[0, 0.33, 0.66, 1].map((g, i) => (
                        <Path key={i} d={`M0,${(H - g * (H - 16) - 8).toFixed(1)} L${W},${(H - g * (H - 16) - 8).toFixed(1)}`} stroke={isDark ? '#2A2A38' : '#EBEBF0'} strokeWidth={1} />
                      ))}
                      {/* Lines */}
                      {series.map((s, i) => (
                        <Polyline key={i} points={toPoints(s.data)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                    </Svg>
                    {/* Date axis */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 }}>
                      {shownLabels.map((l, i) => (
                        <Text key={i} style={{ fontSize: 9, color: isDark ? '#555' : T.ink4 }}>{l}</Text>
                      ))}
                    </View>
                  </View>
                );
              })()}
            </Card>

            {/* My Tasks */}
            <SectionHeader
              isDark={isDark}
              right={<TextLink onPress={() => { try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Tasks'); } }}>View all</TextLink>}
              style={{ marginTop: 4 }}
            >
              My Tasks
            </SectionHeader>
            <Card isDark={isDark} style={{ marginBottom: 22 }} padding={12}>
              <Tabs tabs={TABS} activeTab={activeTaskTab} onTab={setActiveTaskTab} />
              {tasksByTab(activeTaskTab).length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: T.ink4 }}>No tasks here</Text>
                </View>
              ) : (
                tasksByTab(activeTaskTab).map((task, idx) => {
                  const status = (task.status || '').toLowerCase();
                  const priority = (task.priority || '').toLowerCase();
                  const statusColor = STATUS_COLOR[status] || T.ink3;
                  const priorityColor = PRIORITY_COLOR[priority] || T.ink3;
                  return (
                    <TouchableOpacity
                      key={task.id}
                      style={[s.taskRow, { borderColor: isDark ? '#252530' : T.hairline, backgroundColor: isDark ? '#1A1A20' : T.surface }]}
                      onPress={() => navigation.navigate('Tasks')}
                      activeOpacity={0.7}
                    >
                      {/* Circle checkbox */}
                      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: isDark ? '#404055' : '#CDCFDA', flexShrink: 0 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.taskHeading, { color: isDark ? '#fff' : T.ink }]} numberOfLines={1}>
                          {task.heading || task.title || 'Untitled'}
                        </Text>
                        <View style={s.taskMeta}>
                          <Text style={[s.taskMetaText, { color: isDark ? '#9AA3B2' : T.ink3 }]} numberOfLines={1}>
                            {task.project_name || task.project || 'DYUKSA'}
                          </Text>
                          {task.due_date && (
                            <>
                              <Text style={[s.taskMetaDot, { color: T.ink4 }]}>·</Text>
                              <Text style={[s.taskMetaText, { color: isDark ? '#9AA3B2' : T.ink3 }]}>{task.due_date}</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <View style={[s.statusPill, { backgroundColor: statusColor + '18' }]}>
                        <Text style={[s.statusPillText, { color: statusColor }]}>
                          {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </Card>

            {/* Projects Overview */}
            <SectionHeader isDark={isDark} right={<TextLink onPress={() => navigation.navigate('Projects')}>View All</TextLink>}>
              Projects Overview
            </SectionHeader>
            <Card isDark={isDark} style={{ marginBottom: 22, padding: 0 }}>
              {projects.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: T.ink4 }}>No projects yet</Text>
                </View>
              ) : (
                projects.slice(0, 5).map((proj, idx) => {
                  const colors = [T.cBlue, T.cPurple, T.cGreen, T.cYellow, T.cRed];
                  const color = colors[idx % colors.length];
                  const taskCount = proj.task_count || proj.tasks_count || proj.total_tasks || 0;
                  const progress = proj.progress || proj.completion_percentage || 0;
                  const memberCount = (proj.members || proj.assigned_members || []).length || proj.member_count || 0;
                  return (
                    <TouchableOpacity
                      key={proj.id}
                      onPress={() => navigation.navigate('Projects')}
                      activeOpacity={0.7}
                      style={[
                        s.projectRow,
                        idx < Math.min(projects.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? '#252530' : T.hairlineSoft },
                      ]}
                    >
                      <View style={[s.projectBar, { backgroundColor: color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '650', color: isDark ? '#fff' : T.ink }} numberOfLines={1}>
                          {proj.name || 'Untitled'}
                        </Text>
                        <Text style={{ fontSize: 11, color: isDark ? '#9AA3B2' : T.ink3, marginTop: 2 }}>
                          {taskCount} task{taskCount !== 1 ? 's' : ''}
                          {memberCount > 0 ? ` · ${memberCount} member${memberCount !== 1 ? 's' : ''}` : ''}
                        </Text>
                      </View>
                      <View style={{ width: 80, marginRight: 10 }}>
                        <Progress value={progress} color={color} h={5} trackColor={isDark ? '#2A2A38' : T.hairlineSoft} />
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '650', color: isDark ? '#9AA3B2' : T.ink2, minWidth: 34, textAlign: 'right' }}>
                        {progress}%
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </Card>

            {/* Recent Activity */}
            <SectionHeader isDark={isDark} right={<TextLink onPress={() => navigation.navigate('Docs')}>View All</TextLink>}>
              Recent Activity
            </SectionHeader>
            <Card isDark={isDark} style={{ marginBottom: 22, padding: 0 }}>
              {recentDocs.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: T.ink4 }}>No recent activity</Text>
                </View>
              ) : (
                recentDocs.map((doc, idx) => {
                  const ext = (doc.name || doc.file_name || '').split('.').pop()?.toLowerCase() || 'doc';
                  const projectName = doc.project_name || doc.project?.name || doc.project_details?.name || '';
                  const folderName  = doc.folder_name || doc.category || '';
                  const path = [projectName, folderName].filter(Boolean).join(' / ');
                  const when = fmtRelative(doc.created_at || doc.updated_at);
                  return (
                    <View
                      key={doc.id}
                      style={[
                        s.activityRow,
                        idx < recentDocs.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? '#252530' : T.hairlineSoft },
                      ]}
                    >
                      <FileTile ext={ext} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#fff' : T.ink }} numberOfLines={1}>
                          {doc.name || doc.file_name || 'Untitled'}
                        </Text>
                        <Text style={{ fontSize: 11, color: isDark ? '#9AA3B2' : T.ink3, marginTop: 2 }} numberOfLines={1}>
                          {path ? `Uploaded in ${path}` : 'Uploaded'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: T.ink4, flexShrink: 0 }}>{when}</Text>
                    </View>
                  );
                })
              )}
            </Card>

            {/* Quick Actions */}
            <SectionHeader isDark={isDark}>Quick Actions</SectionHeader>
            <View style={s.quickGrid}>
              {QUICK_ACTIONS.map((action, idx) => (
                <TouchableOpacity key={idx} style={[s.quickBtn, { backgroundColor: isDark ? '#1A1A20' : T.surface, borderColor: isDark ? '#252530' : T.hairline }]} onPress={action.onPress} activeOpacity={0.7}>
                  <View style={[s.quickIcon, { backgroundColor: isDark ? action.color + '22' : action.soft }]}>
                    <Feather name={action.icon} size={20} color={action.color} />
                  </View>
                  <Text style={[s.quickLabel, { color: isDark ? '#ccc' : T.ink2 }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Navbar
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  navIcon: { fontSize: 16 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontWeight: '700', fontSize: 17 },

  // Greeting card
  greetCard: { borderRadius: T.rLg, padding: 20, marginBottom: 22, overflow: 'hidden' },
  decoCircle: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  greetDate: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  greetMsg: { fontSize: 15, fontWeight: '500', color: '#fff', lineHeight: 21, marginBottom: 18 },
  greetStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6 },
  greetStat: { flex: 1, alignItems: 'center' },
  greetStatVal: { fontSize: 18, fontWeight: '700', color: '#fff' },
  greetStatLbl: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  greetDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Overview grid
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  statCard: { width: '48%', flexGrow: 1 },
  statIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11.5, fontWeight: '500', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },

  // Task rows
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, overflow: 'hidden', marginBottom: 6 },
  priorityBar: { width: 3, height: 36, borderRadius: 2 },
  taskHeading: { fontSize: 13, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  taskMetaText: { fontSize: 11, flexShrink: 1 },
  taskMetaDot: { fontSize: 11 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  // Projects
  projectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  projectBar: { width: 8, height: 36, borderRadius: 4 },

  // Activity / docs
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },

  // Quick Actions
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  quickBtn: { width: '31%', flexGrow: 1, borderRadius: T.rMd, borderWidth: 1, paddingVertical: 16, alignItems: 'center', gap: 8 },
  quickIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11.5, fontWeight: '600' },
});