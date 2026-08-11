import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCache, invalidateCache } from '../../../hooks/useAppCache';
import { tasksApi, calendarApi } from '../../../api';

export const invalidateMyWorkCache = () => {
  invalidateCache('my_work_tasks');
  invalidateCache('my_work_events');
};

export default function useMyWork() {
  const [refreshing, setRefreshing] = useState(false);

  // ── Tasks ─────────────────────────────────────────────────────────
  const fetchTasksFn = useCallback(async () => {
    return tasksApi.getAll();
  }, []);

  const {
    data: tasks,
    isLoading: tasksLoading,
    isValidating: tasksValidating,
    fetchData: fetchTasks,
  } = useCache('my_work_tasks', fetchTasksFn, { staleTime: 2 * 60 * 1000 });

  // ── Calendar events ───────────────────────────────────────────────
  const fetchEventsFn = useCallback(async () => {
    const result = await calendarApi.getEvents('?page_size=50');
    return result?.results || [];
  }, []);

  const {
    data: events,
    isLoading: eventsLoading,
    fetchData: fetchEvents,
  } = useCache('my_work_events', fetchEventsFn, { staleTime: 2 * 60 * 1000 });

  // ── Refresh on focus ──────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    fetchTasks();
    fetchEvents();
  }, [fetchTasks, fetchEvents]));

  // ── Pull-to-refresh ───────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateMyWorkCache();
    try {
      await Promise.all([fetchTasks(true), fetchEvents(true)]);
    } catch {}
    setRefreshing(false);
  }, [fetchTasks, fetchEvents]);

  return {
    tasks: tasks || [],
    events: events || [],
    isLoading: tasksLoading || eventsLoading,
    isValidating: tasksValidating,
    refreshing,
    onRefresh,
  };
}