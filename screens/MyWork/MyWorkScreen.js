import React, { useState, useCallback, useContext, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../../services/ApiService';
import { BASE_URL } from '../../config';
import Svg, { Path } from 'react-native-svg';
import SidebarMenu from '../../components/SidebarMenu';
import NotificationBell from '../../components/NotificationBell';
import { useTasksCache } from '../../hooks/useTasksCache';
import useMyWork from './hooks/useMyWork';
import { SkeletonList } from '../../components/SkeletonLoader';

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


const SearchIcon = ({ size = 20, color = '#3B72EE' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

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

  // ── Data from SWR cache — renders instantly if prefetched ───────
  const { tasks: allTasks, events, isLoading, isValidating, refreshing, onRefresh } = useMyWork();
  const [period, setPeriod] = useState('Today');

  const today = todayStr();
  const userName = user
    ? (user.first_name || user.name?.split(' ')[0] || user.username || 'there')
    : 'there';

  // ── Week boundaries (Mon–Fri of current week) ────────────────────
  const getWeekBounds = () => {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0);
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4); fri.setHours(23,59,59,999);
    return { mon, fri };
  };

  // ── Weekday names for schedule grouping ──────────────────────────
  const getWeekDays = () => {
    const { mon } = getWeekBounds();
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      return d;
    });
  };

  // ── My tasks — client-side filter ────────────────────────────────
  const myId = String(user?.id || '');
  const myTasks = allTasks.filter(t => {
    if (!myId) return true;
    const ids     = Array.isArray(t.assigned_to) ? t.assigned_to.map(String) : [];
    const details = Array.isArray(t.assigned_to_user_details) ? t.assigned_to_user_details : [];
    return ids.includes(myId) || details.some(u => String(u.id) === myId);
  });

  // Data fetching handled by useMyWork hook (SWR)
  const loading = isLoading;

  // ── Filter tasks by period ────────────────────────────────────────
  const filteredTasks = (() => {
    if (period === 'Backlog') return myTasks.filter(t => t.status === 'backlog');
    if (period === 'This week') {
      const { mon, fri } = getWeekBounds();
      return myTasks.filter(t => {
        const due = t.end_date || t.due_date;
        if (!due) return false;
        const d = new Date(due);
        return d >= mon && d <= fri && !['completed', 'deployed'].includes(t.status);
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

  // ── Filter events scoped to current period ───────────────────────
  const filteredEvents = (() => {
    if (period === 'Backlog') return [];

    const now = new Date(); now.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    let windowStart, windowEnd;
    if (period === 'Today') {
      windowStart = now;
      windowEnd   = todayEnd;
    } else if (period === 'This week') {
      const { mon, fri } = getWeekBounds();
      windowStart = mon;
      windowEnd   = fri;
    } else {
      windowStart = now;
      windowEnd   = new Date(now); windowEnd.setDate(now.getDate() + 60); windowEnd.setHours(23, 59, 59, 999);
    }

    // My calendar events in window — compare date portion only (ignore time zone shifts)
    const myEvents = events
      .filter(e => {
        if (!myId) return true;
        if (String(e.organizer) === myId) return true;
        if (Array.isArray(e.attendees) && e.attendees.some(a =>
          String(a?.id ?? a?.user_id ?? a) === myId
        )) return true;
        return false;
      })
      .filter(e => {
        const start = e.start_time || e.eventTimestamp || e.start_date;
        if (!start) return false;
        // Compare date strings to avoid timezone issues
        const evDateStr = start.substring(0, 10);
        const startStr  = windowStart.toISOString().substring(0, 10);
        const endStr    = windowEnd.toISOString().substring(0, 10);
        return evDateStr >= startStr && evDateStr <= endStr;
      })
      .map(e => ({ ...e, _kind: 'event' }));

    // My tasks with dates in window
    const taskRows = myTasks
      .filter(t => !['completed', 'deployed'].includes(t.status))
      .filter(t => {
        const dateStr = (t.start_date || t.end_date || t.due_date || '').substring(0, 10);
        if (!dateStr) return false;
        const startStr = windowStart.toISOString().substring(0, 10);
        const endStr   = windowEnd.toISOString().substring(0, 10);
        return dateStr >= startStr && dateStr <= endStr;
      })
      .map(t => ({
        id: `task_${t.id}`,
        _kind: 'task',
        _task: t,
        title: t.heading || t.title || 'Untitled',
        start_time: t.start_date || t.end_date || t.due_date,
        event_type: 'Task',
        duration_minutes: null,
        attendees: [],
        organizer_name: null,
      }));

    return [...myEvents, ...taskRows]
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


  // ── Focus block (first in_progress task) ─────────────────────────
  const focusTask = myTasks.find(t => t.status === 'in_progress') || filteredTasks[0] || null;
  const focusProgress = focusTask ? (focusTask.progress ?? 0) : 0; // real progress from task data

  const todayFormatted = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />

      {/* ── Navbar ── */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={s.navLeft}>
          <SidebarMenu activeScreen="MyWork" />
          <View>
            <Text style={[s.navTitle, { color: txt }]}>My Work</Text>
            <Text style={{ fontSize: 11, color: sub }}>{todayFormatted}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={{ padding: 6 }} onPress={() => navigation.navigate('Search')}>
            <SearchIcon size={20} color='#3B72EE' />
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {loading ? (
        <SkeletonList count={5} type="row" isDark={isDark} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B72EE" />}
        >
          {/* ── Period tabs ── */}
          <View style={{ paddingHorizontal: 12, paddingTop: 14 }}>
            <View style={[s.segWrap, { backgroundColor: isDark ? '#252530' : '#F0F2F6' }]}>
              {PERIODS.map(p => {
                const active = p === period;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPeriod(p)}
                    style={[s.segBtn, active && { backgroundColor: card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.segText, { color: active ? txt : sub, fontWeight: active ? '700' : '500' }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Focus Block ── */}
          {focusTask && period === 'Today' && (
            <View style={{ paddingHorizontal: 12, paddingTop: 14 }}>
              <View style={s.focusCard}>
                <Text style={s.focusLabel}>FOCUS BLOCK</Text>
                <Text style={s.focusTitle} numberOfLines={2}>{focusTask.heading || focusTask.title || 'Current task'}</Text>
                <Text style={s.focusTime}>
                  {(() => {
                    const start = focusTask.start_date;
                    const end   = focusTask.end_date || focusTask.due_date;
                    const fmt   = d => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    if (start && end) {
                      const mins = Math.round((new Date(end) - new Date(start)) / 60000);
                      const dur  = mins >= 60 ? `${Math.floor(mins/60)}h${mins%60 ? ` ${mins%60}m` : ''}` : `${mins}m`;
                      return `${fmt(start)} — ${fmt(end)} · ${dur}`;
                    }
                    if (start) return fmt(start);
                    return 'In progress';
                  })()}
                </Text>
                {/* Progress bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 16 }}>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${focusProgress}%` }]} />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', width: 36 }}>{focusProgress}%</Text>
                </View>
                {/* Buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={s.focusResumeBtn}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: focusTask.id, task: focusTask })}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Resume</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.focusSkipBtn}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Skip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={{ paddingHorizontal: 12 }}>
            {/* ── Schedule (Events + Tasks) ── */}
            {period !== 'Backlog' && filteredEvents.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>
                  {period === 'This week' ? 'This Week (Mon–Fri)' : 'Schedule'}
                </Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {filteredEvents.slice(0, 8).map((ev, i) => {
                    const isTask     = ev._kind === 'task';
                    const title      = ev.title || ev.name || 'Event';
                    const startTime  = ev.start_time || ev.eventTimestamp || ev.start_date;
                    const endTime    = ev.end_time;
                    const timeStr    = startTime
                      ? new Date(startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '';
                    // Duration from start/end times
                    const dur = (() => {
                      if (ev.duration_minutes) return `${ev.duration_minutes}m`;
                      if (startTime && endTime) {
                        const mins = Math.round((new Date(endTime) - new Date(startTime)) / 60000);
                        return mins > 0 ? `${mins}m` : '';
                      }
                      return '';
                    })();
                    const type       = ev.event_type || ev.type || 'Meeting';
                    const typeColors = { Meeting: '#3B72EE', Task: '#F59E0B', Event: '#3B72EE', Review: '#3B72EE' };
                    const barColor   = isTask ? '#F59E0B' : '#3B72EE';
                    const AVATAR_COLORS = ['#3B72EE', '#3B72EE', '#3B72EE', '#F59E0B', '#3B72EE'];
                    // Organizer name avatar (attendees are plain IDs — no names available)
                    const organizerName = ev.organizer_name || '';
                    const organizerInitials = organizerName.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
                    // Date label if not today
                    const evDate = startTime ? new Date(startTime) : null;
                    const todayD = new Date(); todayD.setHours(0,0,0,0);
                    const isToday = evDate && evDate.toDateString() === todayD.toDateString();
                    const dateLabel = evDate && !isToday
                      ? evDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : '';

                    return (
                      <TouchableOpacity
                        key={ev.id || i}
                        style={[s.schedRow, i < Math.min(filteredEvents.length, 8) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                        onPress={() => isTask && ev._task ? navigation.navigate('TaskDetail', { taskId: ev._task.id, task: ev._task }) : null}
                        activeOpacity={isTask ? 0.7 : 1}
                      >
                        <View style={{ width: 68 }}>
                          <Text style={[s.schedTime, { color: sub }]}>{timeStr}</Text>
                          {dateLabel ? <Text style={{ fontSize: 10, color: sub }}>{dateLabel}</Text> : null}
                        </View>
                        <View style={[s.schedBar, { backgroundColor: barColor }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.schedTitle, { color: txt }]} numberOfLines={1}>{title}</Text>
                          <Text style={[s.schedType, { color: sub }]}>{type}{dur ? ` · ${dur}` : ''}</Text>
                        </View>
                        {organizerInitials ? (
                          <View style={[s.attendeeAvatar, { backgroundColor: AVATAR_COLORS[0] }]}>
                            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{organizerInitials}</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── Assigned to me ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
              <Text style={[s.sectionTitle, { color: txt, marginTop: 0, marginBottom: 0 }]}>
                {period === 'Backlog' ? 'Backlog Tasks' : period === 'This week' ? 'Due This Week' : 'Assigned to me'}
              </Text>
              <TouchableOpacity onPress={() => { try { navigation.jumpTo('Tasks'); } catch { navigation.navigate('Main', { screen: 'Tasks' }); } }}>
                <Text style={{ color: '#3B72EE', fontSize: 13, fontWeight: '600' }}>View all</Text>
              </TouchableOpacity>
            </View>

            {filteredTasks.length === 0 ? (
              <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr, padding: 32, alignItems: 'center' }]}>
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
                        <Text style={[s.taskMeta, { color: sub }]}>{t.project_details.name}</Text>
                      )}
                      <Text style={{ fontSize: 10, color: sub }}>📅 {fmtDate(t.end_date || t.due_date)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pc }} />
                        <Text style={[s.taskMeta, { color: pc }]}>
                          {(t.priority || 'medium').charAt(0).toUpperCase() + (t.priority || 'medium').slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: sc + '18' }]}>
                    <Text style={[s.statusPillText, { color: sc }]}>{sl}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
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
  navTitle: { fontWeight: '700', fontSize: 17 },

  // Segmented
  segWrap: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segText: { fontSize: 13 },

  // Focus block
  focusCard: {
    borderRadius: 18, padding: 20,
    backgroundColor: '#0F1B3D',
    overflow: 'hidden',
  },
  focusLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.2, marginBottom: 6 },
  focusTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4, lineHeight: 26 },
  focusTime: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#3B72EE' },
  focusResumeBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#3B72EE', justifyContent: 'center', alignItems: 'center' },
  focusSkipBtn: { width: 80, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  // Section title
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 10 },

  // Group card
  groupCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },

  // Schedule row
  schedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  schedTime: { width: 68, fontSize: 12, fontWeight: '600' },
  schedBar: { width: 4, height: 36, borderRadius: 2 },
  schedTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  schedType: { fontSize: 12 },
  attendeeAvatar: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },

  // Task card
  taskCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, padding: 14, marginBottom: 8 },
  taskCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#DEDEE8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  taskTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  taskMeta: { fontSize: 11, fontWeight: '500' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexShrink: 0 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
});