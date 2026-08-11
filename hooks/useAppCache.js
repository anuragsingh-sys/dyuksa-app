// ─────────────────────────────────────────────────────────────────────────────
// hooks/useAppCache.js — Lightweight in-memory SWR-style cache
//
// Used by screens that wrap a fetch function with stale-while-revalidate:
//   const { data, isLoading, fetchData, setData } = useCache('key', fetchFn, opts);
//
// Also used imperatively:
//   setCached('key', data)   — warm the cache from prefetch
//   getCached('key')         — read without a hook (e.g. initial state)
//   invalidateCache('key')   — force next useCache mount to refetch
//   clearAllCaches()         — wipe everything on logout
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Global in-memory store 
const _cache = {}; 
const _listeners = {};  

const notify = (key) => {
  if (_listeners[key]) {
    _listeners[key].forEach(cb => cb(_cache[key]?.data ?? null));
  }
};

// ── Imperative API 

/** Write data into the cache (used by prefetch to warm cache before screens mount) */
export const setCached = (key, data) => {
  _cache[key] = { data, fetchedAt: Date.now() };
  notify(key);
};

/** Read data from cache without a hook (used for initial state, e.g. getCached('teams')) */
export const getCached = (key) => {
  return _cache[key]?.data ?? null;
};

/** Mark a key stale so the next useCache mount will refetch */
export const invalidateCache = (key) => {
  if (_cache[key]) {
    _cache[key].fetchedAt = 0; // force stale
  }
};

/** Wipe entire cache — call on logout */
export const clearAllCaches = () => {
  for (const key of Object.keys(_cache)) {
    delete _cache[key];
  }
};

// ── Hook 

/**
 * SWR-style cache hook.
 *
 * @param {string}   key       - Unique cache key
 * @param {Function} fetchFn   - async () => data
 * @param {object}   [opts]
 * @param {number}   [opts.staleTime=60000] - ms before data is considered stale
 *
 * @returns {{ data, isLoading, isValidating, fetchData, setData }}
 */
export function useCache(key, fetchFn, opts = {}) {
  const { staleTime = 60 * 1000 } = opts;
  const [data, setDataState]     = useState(() => getCached(key));
  const [isLoading, setLoading]  = useState(!getCached(key));
  const [isValidating, setValidating] = useState(false);
  const mountedRef = useRef(true);

  // Subscribe to external cache writes (e.g. from prefetch or other screens)
  useEffect(() => {
    const handler = (newData) => {
      if (mountedRef.current) setDataState(newData);
    };
    if (!_listeners[key]) _listeners[key] = new Set();
    _listeners[key].add(handler);
    return () => {
      _listeners[key]?.delete(handler);
      mountedRef.current = false;
    };
  }, [key]);

  const fetchData = useCallback(async (force = false) => {
    const entry = _cache[key];
    const isStale = !entry || !entry.fetchedAt || (Date.now() - entry.fetchedAt > staleTime);

    if (!force && !isStale && entry?.data) {
      // Fresh cache — skip network
      if (mountedRef.current) setDataState(entry.data);
      return entry.data;
    }

    // Show loading only if we have no data at all
    if (!entry?.data && mountedRef.current) setLoading(true);
    if (mountedRef.current) setValidating(true);

    try {
      const result = await fetchFn();
      setCached(key, result);
      if (mountedRef.current) {
        setDataState(result);
        setLoading(false);
        setValidating(false);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setLoading(false);
        setValidating(false);
      }
      throw err;
    }
  }, [key, fetchFn, staleTime]);

  /** Manually set data (optimistic updates) */
  const setData = useCallback((updater) => {
    const current = _cache[key]?.data ?? null;
    const next = typeof updater === 'function' ? updater(current) : updater;
    setCached(key, next);
    if (mountedRef.current) setDataState(next);
  }, [key]);

  return { data, isLoading, isValidating, fetchData, setData };
}

export default { useCache, setCached, getCached, invalidateCache, clearAllCaches };