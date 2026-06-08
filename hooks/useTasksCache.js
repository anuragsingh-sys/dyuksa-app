/**
 * useTasksCache — singleton in-memory cache for paginated tasks.
 *
 * Guarantees:
 *  • Only ONE fetch runs at a time across all screens
 *  • Result is shared — Dashboard + TasksScreen get the same data
 *  • Re-fetches only when cache is stale (> 60s) or invalidated
 *
 * Usage:
 *   const { tasks, loading, error, refresh } = useTasksCache();
 *
 * After creating/editing/deleting a task:
 *   import { invalidateTasksCache } from '../hooks/useTasksCache';
 *   invalidateTasksCache();
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import { BASE_URL } from '../config';

// ── Singleton module-level state ──────────────────────────────────────────────
const STALE_MS  = 60_000;        // 60 s stale window
const CACHE_KEY = 'TASKS_CACHE_V1';

let _tasks     = [];
let _fetchedAt = 0;
let _fetching  = false;
let _listeners = new Set();      // setState fns from every mounted consumer

function notify(patch) {
  _listeners.forEach(fn => fn(patch));
}

async function fetchAllPages() {
  if (_fetching) return;          // one fetch at a time — all consumers share it
  _fetching = true;
  notify({ loading: true, error: null });

  try {
    const token       = await getAccessToken();
    const workspaceId = await getWorkspaceId();
    if (!token) throw new Error('No auth token');

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (workspaceId) headers['X-Workspace-ID'] = workspaceId;

    let all = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const res = await fetch(`${BASE_URL}/tasksite/?page=${page}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const results = Array.isArray(json) ? json : (json.results || []);
      all = [...all, ...results];
      hasNext = !!json.next;
      page++;
      if (page > 25) break;  // safety cap
    }

    _tasks     = all;
    _fetchedAt = Date.now();

    // Persist for cold-start hydration
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ tasks: all, fetchedAt: _fetchedAt }));
    } catch (_) {}

    notify({ tasks: all, loading: false, error: null });
  } catch (err) {
    notify({ loading: false, error: err.message ?? 'Failed to load tasks' });
  } finally {
    _fetching = false;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTasksCache() {
  const [state, setState] = useState({
    tasks:   _tasks,
    loading: _fetching,
    error:   null,
  });

  // Merge-patch so only changed fields trigger re-render
  const update = useCallback((patch) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    _listeners.add(update);
    return () => _listeners.delete(update);
  }, [update]);

  // Cold-start: hydrate from AsyncStorage if memory cache is empty
  useEffect(() => {
    if (_tasks.length > 0) return;
    AsyncStorage.getItem(CACHE_KEY).then(raw => {
      if (!raw) return;
      try {
        const { tasks, fetchedAt } = JSON.parse(raw);
        if (tasks?.length) {
          _tasks     = tasks;
          _fetchedAt = fetchedAt ?? 0;
          update({ tasks });
        }
      } catch (_) {}
    });
  }, []);

  // Fetch when stale
  useEffect(() => {
    const isStale = Date.now() - _fetchedAt > STALE_MS;
    if (isStale && !_fetching) {
      fetchAllPages();
    }
  }, []);

  const refresh = useCallback(() => {
    _fetchedAt = 0;
    fetchAllPages();
  }, []);

  return { ...state, refresh };
}

/** Call after any task mutation so the next mount triggers a fresh fetch */
export function invalidateTasksCache() {
  _fetchedAt = 0;
  _tasks = [];
}
