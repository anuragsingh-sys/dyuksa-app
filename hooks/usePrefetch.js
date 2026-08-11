import { useEffect, useRef } from 'react';
import { setCached } from './useAppCache';
import { invalidateTasksCache } from './useTasksCache';
import { projectsApi, chatApi, notificationsApi, authApi, tasksApi, calendarApi } from '../api/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../types/index';

// Module-level flag 
const prefetchState = { done: false };

async function fetchTasksAllPages() {
  let all = [], page = 1, hasNext = true;
  while (hasNext) {
    const json = await tasksApi.getPage(page);
    const results = Array.isArray(json) ? json : (json?.results || []);
    all = [...all, ...results];
    hasNext = !!json?.next;
    page++;
    if (page > 25) break; // safety cap
  }
  return all;
}

async function runPrefetch() {
  if (prefetchState.done) return;
  prefetchState.done = true;

  // ── P1: Tasks + Projects (Dashboard needs these first) ────────────────────
  try {
    const [tasks, projects] = await Promise.all([
      fetchTasksAllPages(),
      projectsApi.getAll(),
    ]);

    // Warm the tasks singleton used by useTasksCache
    const fetchedAt = Date.now();
    await AsyncStorage.setItem(
      STORAGE_KEYS.TASKS_CACHE,
      JSON.stringify({ tasks, fetchedAt })
    ).catch(() => {});
    // Force useTasksCache to read from AsyncStorage on next mount
    invalidateTasksCache();

    // Warm the SWR cache for projects
    setCached('projects', projects);
  } catch (e) {
    console.warn('[prefetch] P1 failed:', e?.message);
  }

  // Yield to UI before loading more
  await new Promise(r => setTimeout(r, 300));

  // ── P2: Notifications + Chat rooms (small, fast) ──────────────────────────
  try {
    const [notifData, rooms] = await Promise.all([
      notificationsApi.getAll(),
      chatApi.getRooms(),
    ]);

    if (notifData?.notifications) {
      setCached('notifications', notifData.notifications);
    }
    if (Array.isArray(rooms) && rooms.length) {
      setCached('chat_rooms', rooms);
    }
  } catch (e) {
    console.warn('[prefetch] P2 failed:', e?.message);
  }

  // Yield again before loading P3
  await new Promise(r => setTimeout(r, 500));

  // ── P3: Team members + Calendar events ────────────────────────────────────
  try {
    const [usersData, events] = await Promise.all([
      authApi.getUsers(),
      calendarApi.getEvents('?page_size=50'),
    ]);
    if (Array.isArray(usersData) && usersData.length) {
      setCached('team_members', usersData);
    }
    if (events?.results?.length) {
      setCached('my_work_events', events.results);
    }
  } catch (e) {
    console.warn('[prefetch] P3 failed:', e?.message);
  }
}

/**
 * Call this hook in App.js's RootNavigator after isAuthenticated becomes true.
 * It runs once per login session. Idempotent — safe to call multiple times.
 *
 * @param {boolean} isAuthenticated
 */
export function usePrefetch(isAuthenticated) {
  const ran = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || ran.current) return;
    ran.current = true;
    // Delay slightly so login animation completes and token is persisted
    const t = setTimeout(() => runPrefetch(), 800);
    return () => clearTimeout(t);
  }, [isAuthenticated]);
}

/**
 * Call on logout to allow re-warming on next login.
 */
export function resetPrefetch() {
  prefetchState.done = false;
}