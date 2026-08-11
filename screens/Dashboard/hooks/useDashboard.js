// =============================================================================
// screens/Dashboard/hooks/useDashboard.js
// =============================================================================
// All business logic, data fetching, and derived state for DashboardScreen.
// The screen imports this hook and focuses only on rendering.
// =============================================================================

import { useState, useCallback, useRef, useContext } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../../../context/AuthContext';
import { useTasksCache } from '../../../hooks/useTasksCache';
import { getProjects, getDocuments } from '../../../services/ApiService';

const STALE_MS = 30_000; // 30s — skip refetch on rapid tab switches

export default function useDashboard() {
  const { user } = useContext(AuthContext);

  // ── Tasks come from the shared cache — no duplicate fetch across screens ───
  const { tasks } = useTasksCache();

  // ── Local state ───────────────────────────────────────────────────────────
  const [projects,      setProjects]      = useState([]);
  const [recentDocs,    setRecentDocs]    = useState([]);
  const [totalDocs,     setTotalDocs]     = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeTaskTab, setActiveTaskTab] = useState('upcoming');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const lastFetchRef = useRef(0);

  // ── Fetch projects + docs ─────────────────────────────────────────────────
  const fetchAll = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetchRef.current < STALE_MS) return;
    try {
      const [projectsData, docsData] = await Promise.all([
        getProjects({ pageSize: 20 }),
        getDocuments({ pageSize: 10 }),
      ]);

      setProjects(Array.isArray(projectsData) ? projectsData : (projectsData.results || []));

      const docsArray = Array.isArray(docsData) ? docsData : (docsData.results || []);
      setTotalDocs(docsData.count ?? docsArray.length);
      setRecentDocs(docsArray.slice(0, 5));

      lastFetchRef.current = Date.now();
    } catch (e) {
      console.warn('useDashboard fetchAll:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Re-fetch when the screen comes into focus ─────────────────────────────
  useFocusEffect(useCallback(() => {
    // Small delay on first mount ensures token/workspace are fully saved to
    // AsyncStorage after login before we start fetching
    if (lastFetchRef.current === 0) {
      const t = setTimeout(() => fetchAll(), 100);
      return () => clearTimeout(t);
    }
    fetchAll();
  }, [fetchAll]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll(true);
  }, [fetchAll]);

  // ── Derived task counts ───────────────────────────────────────────────────
  const totalTasks      = tasks.length;
  const completedTasks  = tasks.filter(t => ['completed', 'done'].includes((t.status || '').toLowerCase())).length;
  const inProgressTasks = tasks.filter(t => (t.status || '').toLowerCase() === 'in_progress').length;
  const pendingTasks    = tasks.filter(t => (t.status || '').toLowerCase() === 'pending').length;
  const backlogTasks    = tasks.filter(t => (t.status || '').toLowerCase() === 'backlog').length;
  const reviewTasks     = tasks.filter(t => (t.status || '').toLowerCase() === 'review').length;
  const deployedTasks   = tasks.filter(t => (t.status || '').toLowerCase() === 'deployed').length;

  const todayStr = new Date().toISOString().slice(0, 10);

  const overdueTasks = tasks.filter(t => {
    const s   = (t.status || '').toLowerCase();
    const due = t.end_date || t.due_date;
    return s !== 'completed' && s !== 'deployed' && due && due < todayStr;
  }).length;

  // ── Derived task lists for tabs ───────────────────────────────────────────
  const upcomingTasksList = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s === 'pending' || s === 'todo';
  }).slice(0, 8);

  const overdueTasksList = tasks.filter(t => {
    const s   = (t.status || '').toLowerCase();
    const due = t.end_date || t.due_date;
    return s !== 'completed' && s !== 'deployed' && due && due < todayStr;
  }).slice(0, 8);

  const completedTasksList = tasks
    .filter(t => ['completed', 'done'].includes((t.status || '').toLowerCase()))
    .slice(0, 8);

  const tasksByTab = (tab) => {
    if (tab === 'upcoming')  return upcomingTasksList;
    if (tab === 'overdue')   return overdueTasksList;
    if (tab === 'completed') return completedTasksList;
    return [];
  };

  const TABS = [
    { id: 'upcoming',  label: `Upcoming (${upcomingTasksList.length})` },
    { id: 'overdue',   label: `Overdue (${overdueTasksList.length})` },
    { id: 'completed', label: `Completed (${completedTasksList.length})` },
  ];

  // ── Sparkline data — tasks per month per filter ───────────────────────────
  const sparkFor = (filterFn) => {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (7 - i));
      const yr = d.getFullYear();
      const mo = d.getMonth();
      return tasks.filter(t => {
        const ds = (t.created_at || t.updated_at || '').slice(0, 7);
        return ds === `${yr}-${String(mo + 1).padStart(2, '0')}` && filterFn(t);
      }).length;
    });
  };

  // ── Tasks Over Time chart data ────────────────────────────────────────────
  const chartData = (() => {
    const { year, month } = selectedMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
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
            return due && new Date(due) < cutoff && !['completed', 'deployed'].includes(t.status);
          }).length;
        })},
        { label: 'Pending', color: '#F59E0B', data: points.map(d => countByDay(d, t => t.status === 'pending' || t.status === 'backlog')) },
      ],
    };
  })();

  return {
    // User
    user,
    userName: user?.first_name || user?.username || 'there',

    // Loading
    loading,
    refreshing,
    onRefresh,

    // Data
    tasks,
    projects,
    recentDocs,
    totalDocs,

    // Derived task counts
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    backlogTasks,
    reviewTasks,
    deployedTasks,
    overdueTasks,

    // Task tab state
    activeTaskTab,
    setActiveTaskTab,
    TABS,
    tasksByTab,

    // Chart
    selectedMonth,
    setSelectedMonth,
    showMonthPicker,
    setShowMonthPicker,
    chartData,

    // Sparklines
    sparkFor,
  };
}
