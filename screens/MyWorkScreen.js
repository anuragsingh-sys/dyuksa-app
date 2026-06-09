import React, { useState, useCallback, useContext, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
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

const STATUS_COLORS = {
  pending: '#F59E0B', in_progress: '#3B82F6', completed: '#22C55E',
  backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA',
};
const STATUS_LABELS = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed',
  backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review',
};
const PRIORITY_COLORS = { low: '#22C55E', medium: '#F59E0B', high: '#F97316', urgent: '#EF4444' };

const PERIODS = ['Today', 'This week', 'Backlog'];

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return iso; }
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export default function MyWorkScreen() {
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

  // ── Tasks from shared cache — no duplicate fetches ───────────────
  const { tasks: allTasks, loading: tasksLoading, refresh: refreshTasks } = useTasksCache();
  const [events,    setEvents]    = useState([]);
  const [evLoading, setEvLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [period,    setPeriod]    = useState('Today');
  const lastEvFetchRef = useRef(0);
  const EV_STALE_MS = 30_000;

  const today = todayStr();
  const userName = user
    ? (user.first_name || user.name?.split(' ')[0] || user.username || 'there')
    : 'there';

  // ── Week boundaries (Mon–Sun of current week) ─────────────────────
  const getWeekBounds = () => {
    const now  = new Date();
    const day  = now.getDay(); // 0=Sun
    const mon  = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0);
    const sun  = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
    return { mon, sun };
  };

  // ── My tasks — client-side filter ────────────────────────────────
  const myId = String(user?.id || '');
  const myTasks = allTasks.filter(t => {
    if (!myId) return true;
    const ids     = Array.isArray(t.assigned_to) ? t.assigned_to.map(String) : [];
    const details = Array.isArray(t.assigned_to_user_details) ? t.assigned_to_user_details : [];
    return ids.includes(myId) || details.some(u => String(u.id) === myId);
  });

  // ── Fetch all event pages (81 events, 5 pages) ────────────────────
  const fetchEvents = useCallback(async (force = false) => {
    if (!force && Date.now() - lastEvFetchRef.current < EV_STALE_MS) return;
    setEvLoading(true);
    try {
      const token = await getAccessToken();
      const wsId  = await getWorkspaceId();
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      if (wsId) h['X-Workspace-ID'] = wsId;

      let all = [];
      let page = 1;
      let hasNext = true;
      while (hasNext && page <= 10) { // safety cap
        const res = await fetch(`${BASE_URL}/daily-updates/events/?page=${page}`, { headers: h });
        if (!res.ok) break;
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        all = [...all, ...results];
        hasNext = !!data.next;
        page++;
      }
      setEvents(all);
      lastEvFetchRef.current = Date.now();
    } catch (e) { console.warn('MyWork events:', e.message); }
    finally { setEvLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchEvents(); }, [fetchEvents]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshTasks();
    await fetchEvents(true);
    setRefreshing(false);
  }, [fetchEvents, refreshTasks]);

  const loading = tasksLoading && allTasks.length === 0;

  // ── Filter tasks by period ────────────────────────────────────────
  const filteredTasks = (() => {
    if (period === 'Backlog') return myTasks.filter(t => t.status === 'backlog');
    if (period === 'This week') {
      const { mon, sun } = getWeekBounds();
      return myTasks.filter(t => {
        const due = t.end_date || t.due_date;
        if (!due) return false;
        const d = new Date(due);
        return d >= mon && d <= sun && !['completed', 'deployed'].includes(t.status);
      });
    }
    // Today — due today OR overdue and not done
    return myTasks.filter(t => {
      const due = t.end_date || t.due_date;
      if (!due) return false;
      const dueDate = due.substring(0, 10);
      return dueDate === today && !['completed', 'deployed'].includes(t.status);
    });
  })();

  // ── Filter events: today + next 5 days always ─────────────────────
  const filteredEvents = (() => {
    if (period === 'Backlog') return [];

    const now     = new Date(); now.setHours(0, 0, 0, 0);
    const cutoff  = new Date(now); cutoff.setDate(now.getDate() + 5); cutoff.setHours(23, 59, 59, 999);

    // Only my events (organizer or attendee)
    return events
      .filter(e => {
        if (!myId) return true;
        if (String(e.organizer) === myId) return true;
        if (Array.isArray(e.attendees) && e.attendees.some(a =>
          String(a.id || a.user_id || a) === myId
        )) return true;
        return false;
      })
      .filter(e => {
        const start = e.start_time || e.eventTimestamp || e.start_date;
        if (!start) return false;
        const d = new Date(start);
        return d >= now && d <= cutoff;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  })();

  const pendingTasks   = myTasks.filter(t => ['pending', 'in_progress', 'review'].includes(t.status)).length;
  const completedToday = myTasks.filter(t => t.status === 'completed' && (t.updated_at || '').startsWith(today)).length;
  const overdueCount   = myTasks.filter(t => {
    const due = t.end_date || t.due_date;
    return due && due.substring(0, 10) < today && !['completed', 'deployed'].includes(t.status);
  }).length;

  const nowHour = new Date().getHours();
  const greeting = nowHour < 12 ? 'Good morning' : nowHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="MyWork" />
          <TouchableOpacity onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}>
            <View style={s.logoBox}><Text style={s.logoText}>D</Text></View>
          </TouchableOpacity>
          <Text style={[s.brandName, { color: txt }]}>My Work</Text>
        </View>
        <NotificationBell />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4ECDC4" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" colors={['#4ECDC4']} />}
        >
          {/* Hero greeting card */}
          <View style={[s.heroCard, { backgroundColor: '#1A1A2E' }]}>
            <View style={s.heroDeco} />
            <Text style={s.heroGreeting}>{greeting},</Text>
            <Text style={s.heroName}>{userName} 👋</Text>
            <Text style={s.heroDate}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>

            {/* Stats row */}
            <View style={s.heroStats}>
              {[
                { label: 'Pending',   value: pendingTasks,   color: '#4ECDC4' },
                { label: 'Done today', value: completedToday, color: '#4ADE80' },
                { label: 'Overdue',    value: overdueCount,   color: '#F87171' },
              ].map((stat, i) => (
                <View key={i} style={[s.heroStat, i > 0 && { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' }]}>
                  <Text style={[s.heroStatVal, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={s.heroStatLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ paddingHorizontal: 12 }}>
            {/* Period segmented control */}
            <View style={[s.segWrap, { backgroundColor: isDark ? '#252530' : '#F0F2F6' }]}>
              {PERIODS.map(p => {
                const active = p === period;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPeriod(p)}
                    style={[s.segBtn, active && { backgroundColor: card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.segText, { color: active ? txt : sub, fontWeight: active ? '700' : '500' }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tasks */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 }}>
              <Text style={[s.sectionTitle, { color: txt, marginTop: 0, marginBottom: 0 }]}>
                {period === 'Backlog' ? 'Backlog Tasks' : period === 'This week' ? 'Due This Week' : 'Due Today'}
                {' '}({filteredTasks.length})
              </Text>
              <TouchableOpacity onPress={() => { try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Main', { screen: 'Tasks' }); } }}>
                <Text style={{ color: '#4ECDC4', fontSize: 13, fontWeight: '600' }}>See all</Text>
              </TouchableOpacity>
            </View>

            {filteredTasks.length === 0 ? (
              <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr, padding: 32, alignItems: 'center' }]}>
                <Text style={{ fontSize: 36, opacity: 0.3, marginBottom: 8 }}>
                  {period === 'Backlog' ? '📦' : '🎉'}
                </Text>
                <Text style={[{ fontSize: 15, fontWeight: '600', color: txt }]}>
                  {period === 'Today' ? 'Nothing due today!' : period === 'This week' ? 'Clear for the week!' : 'No backlog tasks'}
                </Text>
                <Text style={[{ fontSize: 12, color: sub, marginTop: 4, textAlign: 'center' }]}>
                  {period === 'Today' ? 'Enjoy your free time or check "This week"'
                    : period === 'This week' ? 'All tasks are on track'
                    : 'No tasks in backlog status'}
                </Text>
              </View>
            ) : filteredTasks.map((t, i) => {
              const sc = STATUS_COLORS[t.status] || '#888';
              const sl = STATUS_LABELS[t.status] || t.status;
              const pc = PRIORITY_COLORS[(t.priority || 'medium').toLowerCase()] || '#888';
              const isDone = t.status === 'completed';
              return (
                <TouchableOpacity
                  key={t.id || i}
                  style={[s.taskCard, { backgroundColor: card, borderColor: bdr, borderLeftColor: sc }]}
                  onPress={() => navigation.navigate('TaskDetail', { taskId: t.id, task: t })}
                  activeOpacity={0.75}
                >
                  <View style={[s.taskCheck, isDone && { backgroundColor: '#22C55E', borderColor: '#22C55E' }]}>
                    {isDone && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.taskTitle, { color: txt }, isDone && { textDecorationLine: 'line-through', opacity: 0.55 }]} numberOfLines={2}>
                      {t.heading || t.title || 'Untitled'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      {t.project_details?.name && (
                        <Text style={[s.taskMeta, { color: sub }]}>🗂 {t.project_details.name}</Text>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pc }} />
                        <Text style={[s.taskMeta, { color: pc }]}>
                          {(t.priority || 'medium').charAt(0).toUpperCase() + (t.priority || 'medium').slice(1)}
                        </Text>
                      </View>
                      {(t.end_date || t.due_date) && (
                        <Text style={[s.taskMeta, { color: sub }]}>📅 {fmtDate(t.end_date || t.due_date)}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: sc + '18' }]}>
                    <Text style={[s.statusPillText, { color: sc }]}>{sl}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Events section — always visible when not Backlog */}
            {period !== 'Backlog' && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>
                  Upcoming Events
                  {filteredEvents.length > 0 ? ` (${filteredEvents.length})` : ''}
                </Text>
                {filteredEvents.length === 0 ? (
                  <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr, padding: 20, alignItems: 'center' }]}>
                    <Text style={{ fontSize: 24, opacity: 0.3, marginBottom: 6 }}>📅</Text>
                    <Text style={[{ fontSize: 13, color: sub }]}>No events in the next 5 days</Text>
                  </View>
                ) : (
                  <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                    {filteredEvents.slice(0, 8).map((ev, i) => {
                      const title = ev.title || ev.name || 'Event';
                      const startTime = ev.start_time || ev.eventTimestamp || ev.start_date;
                      const timeStr = startTime
                        ? new Date(startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : '';
                      const dateStr = startTime
                        ? new Date(startTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                        : '';
                      const type = ev.event_type || ev.type || 'Meeting';
                      const isOnline = ev.is_online_meeting;
                      return (
                        <View
                          key={ev.id || i}
                          style={[s.schedRow, i < Math.min(filteredEvents.length, 8) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                        >
                          <View style={{ width: 60 }}>
                            <Text style={[s.schedTime, { color: sub }]}>{timeStr}</Text>
                            {!!dateStr && <Text style={{ fontSize: 9, color: sub, marginTop: 1 }}>{dateStr}</Text>}
                          </View>
                          <View style={[s.schedBar, { backgroundColor: '#A78BFA' }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.schedTitle, { color: txt }]} numberOfLines={1}>{title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[s.schedType, { color: sub }]}>{type}</Text>
                              {isOnline && (
                                <View style={{ backgroundColor: '#E0F2FE', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                  <Text style={{ fontSize: 9, color: '#0284C7', fontWeight: '700' }}>Online</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* Quick actions */}
            <Text style={[s.sectionTitle, { color: txt, marginTop: 20 }]}>Quick Actions</Text>
            <View style={s.actionsRow}>
              {[
                { icon: '+ Task',    color: '#1A1A2E', onPress: () => { try { navigation.jumpTo('Tasks', { openCreateModal: true }); } catch { navigation.navigate('Main', { screen: 'Tasks', params: { openCreateModal: true } }); } } },
                { icon: '📅 Event',  color: '#7C3AED', onPress: () => { try { navigation.jumpTo('Calendar', { openCreateModal: true }); } catch { navigation.navigate('Main', { screen: 'Calendar', params: { openCreateModal: true } }); } } },
                { icon: '💬 Chat',   color: '#0284C7', onPress: () => navigation.navigate('Chat') },
              ].map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.actionBtn, { backgroundColor: a.color }]}
                  onPress={a.onPress}
                  activeOpacity={0.8}
                >
                  <Text style={s.actionBtnText}>{a.icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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

  // Hero card
  heroCard: { margin: 12, marginBottom: 0, borderRadius: 20, padding: 20, overflow: 'hidden' },
  heroDeco: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -60, right: -40, backgroundColor: 'rgba(45,106,227,0.15)' },
  heroGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  heroName: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4, letterSpacing: -0.3 },
  heroDate: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 16 },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '500', marginTop: 2 },

  // Segmented
  segWrap: { flexDirection: 'row', borderRadius: 14, padding: 4, marginTop: 12, marginBottom: 4 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segText: { fontSize: 13 },

  // Section title
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 10 },

  // Group card
  groupCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },

  // Schedule row
  schedRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  schedTime: { width: 60, fontSize: 12, fontWeight: '600', paddingTop: 2 },
  schedBar: { width: 4, minHeight: 36, borderRadius: 2 },
  schedContent: { flex: 1 },
  schedTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  schedType: { fontSize: 12 },

  // Task card
  taskCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, padding: 12, marginBottom: 8 },
  taskCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#DEDEE8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  taskTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  taskMeta: { fontSize: 11, fontWeight: '500' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 0, marginTop: 2 },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  // Quick actions
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
