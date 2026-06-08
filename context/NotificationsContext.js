import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebSocketService from '../services/WebSocketService';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
const NOTIF_KEY    = 'DYUKSA_NOTIFICATIONS';
const SETTINGS_KEY = 'DYUKSA_SETTINGS';

// ── Module-level singleton cache ─────────────────────────────────────────────
// Survives workspace switches (component remounts) — notifications are global
let _cachedNotifications = [];
let _cachedUnread = 0;
let _lastFetchedAt = 0;
const STALE_MS = 30_000; // re-fetch only if > 30s old

export const NotificationsContext = createContext({
  notifications:   [],
  unreadCount:     0,
  loading:         false,
  fetchNotifications: async () => {},
  markAllRead:     async () => {},
  markOneRead:     async () => {},
  clearAll:        () => {},
  addNotification: () => {},
});

// ── Notification type → icon + colour ────────────────────────────────────────
export const TYPE_META = {
  task_assigned:      { icon: '📋', color: '#4ECDC4' },
  task_completed:     { icon: '✅', color: '#4ADE80' },
  task_status_updated:{ icon: '🔄', color: '#60A5FA' },
  document_shared:    { icon: '📄', color: '#A78BFA' },
  event_created:      { icon: '📅', color: '#FBBF24' },
  new_message:        { icon: '💬', color: '#F472B6' },
  system:             { icon: '🔔', color: '#9898A6' },
  reminder:           { icon: '⏰', color: '#F59E0B' },
};

const metaFor = (type) => TYPE_META[type] || { icon: '🔔', color: '#9898A6' };

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState(_cachedNotifications);
  const [unreadCount,   setUnreadCount]   = useState(_cachedUnread);
  const [loading,       setLoading]       = useState(false);
  const tokenRef = useRef(null);

  // ── Get token helper ──────────────────────────────────────────────
  const getToken = async () => {
    try { return await AsyncStorage.getItem('DYUKSA_AUTH_TOKEN'); }
    catch { return null; }
  };

  // ── Fetch from backend ────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    // Skip if data is fresh — prevents unnecessary re-fetches on workspace switch
    if (_cachedNotifications.length > 0 && Date.now() - _lastFetchedAt < STALE_MS) return;
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    // Clear stale cache that might have un-normalized object fields
    try { await AsyncStorage.removeItem(NOTIF_KEY + '_v1_cleared') } catch {}
    try {
      const res = await fetch(`${BASE_URL}/notification/`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.notifications || [];

      // Safely convert any value (including objects) to string
      const toStr = (v) => {
        if (!v) return '';
        if (typeof v === 'string') return v.replace(/<[^>]*>/g, '').trim();
        if (typeof v === 'object') return v.full_name || v.username || v.name || String(v.id || '');
        return String(v);
      };

      // Normalise to app shape
      const normalised = list.map(n => ({
        id:        String(n.id),
        title:     toStr(n.title || n.heading || 'Notification'),
        body:      toStr(n.message || n.body || n.content || ''),
        type:      toStr(n.notification_type || n.type || 'system'),
        icon:      metaFor(n.notification_type || n.type).icon,
        color:     metaFor(n.notification_type || n.type).color,
        read:      n.is_read ?? n.read ?? false,
        time:      n.created_at || n.timestamp || new Date().toISOString(),
        time_since:toStr(n.time_since || ''),
        priority:  toStr(n.priority || 'medium'),
        actor:     toStr(n.actor_name || n.actor || n.sender || ''),
        metadata:  n.metadata || n.data || {},
      }));

      setNotifications(normalised);
      setUnreadCount(data.unread_count ?? normalised.filter(n => !n.read).length);
      // Update module cache so remounts show data instantly
      _cachedNotifications = normalised;
      _cachedUnread = data.unread_count ?? normalised.filter(n => !n.read).length;
      _lastFetchedAt = Date.now();
      await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(normalised));
    } catch (e) {
      console.warn('fetchNotifications error:', e.message);
      // Fall back to cached
      const cached = await AsyncStorage.getItem(NOTIF_KEY);
      if (cached) {
        try {
          const list = JSON.parse(cached);
          // Re-normalize cached data in case it has old object fields
          const safe = (v) => {
            if (!v) return '';
            if (typeof v === 'string') return v.replace(/<[^>]*>/g, '').trim();
            if (typeof v === 'object') return v.full_name || v.username || v.name || String(v.id || '');
            return String(v);
          };
          const normalized = list.map(n => ({
            ...n,
            title: safe(n.title),
            body:  safe(n.body),
            actor: safe(n.actor),
            type:  safe(n.type),
          }));
          setNotifications(normalized);
          setUnreadCount(normalized.filter(n => !n.read).length);
        } catch { await AsyncStorage.removeItem(NOTIF_KEY); }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Mark all read — calls individual mark-read for each unread ───
  const markAllRead = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    // Get unread ids before optimistic update
    setNotifications(prev => {
      const unreadIds = prev.filter(n => !n.read).map(n => n.id);
      // Fire individual mark-read requests in background (no await)
      if (token && unreadIds.length > 0) {
        Promise.all(unreadIds.map(id =>
          fetch(`${BASE_URL}/notification/${id}/mark-read/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          }).catch(() => {})
        ));
      }
      const next = prev.map(n => ({ ...n, read: true }));
      setUnreadCount(0);
      return next;
    });
  }, []);

  // ── Mark one read ─────────────────────────────────────────────────
  const markOneRead = useCallback(async (id) => {
    const token = await getToken();
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      setUnreadCount(next.filter(n => !n.read).length);
      return next;
    });
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/notification/${id}/mark-read/`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('markOneRead error:', e.message);
    }
  }, []);

  // ── Clear all (local only) ────────────────────────────────────────
  // ── Clear all (local + backend) ───────────────────────────────────
  const clearAll = useCallback(async () => {
    const token = await getToken();
    const current = await AsyncStorage.getItem(NOTIF_KEY);
    const ids = current ? JSON.parse(current).map(n => n.id) : [];

    // Clear local immediately
    setNotifications([]);
    setUnreadCount(0);
    await AsyncStorage.removeItem(NOTIF_KEY);

    // Delete each from backend in background
    if (token && ids.length > 0) {
      Promise.all(ids.map(id =>
        fetch(`${BASE_URL}/notification/${id}/`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }).catch(() => {})
      ));
    }
  }, []);

  // ── Add local notification (from in-app events) ───────────────────
  const addNotification = useCallback(async (notif) => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (notif.type === 'task'  && s.taskAssign   === false) return;
        if (notif.type === 'event' && s.desktopNotif === false) return;
      }
    } catch {}

    setNotifications(prev => {
      const next = [
        { id: Date.now().toString(), read: false, time: new Date().toISOString(), ...notif },
        ...prev,
      ].slice(0, 100);
      setUnreadCount(next.filter(n => !n.read).length);
      return next;
    });
  }, []);

  // ── Clear old corrupted cache once on mount ──────────────────────
  useEffect(() => {
    AsyncStorage.removeItem(NOTIF_KEY).catch(() => {});
  }, []); // empty deps = runs once only

  // ── Fetch once on mount — WebSocket handles real-time updates ──────
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── WebSocket — real-time notifications ───────────────────────────
  useEffect(() => {
    const unsubscribe = WebSocketService.subscribe((message) => {
      

      // Filter out WebSocket system/connection messages — not real notifications
      const systemTypes = [
        'gateway_connected', 'gateway.connected',
        'presence_sync',     'presence.sync',     'presence',
        'ping', 'pong', 'heartbeat', 'connect', 'disconnect',
        'welcome', 'connected', 'connection_established',
      ];
      const msgType = (message?.type || '').toLowerCase().replace(/[\s_]/g, '');
      if (systemTypes.some(t => t.toLowerCase().replace(/[\s_]/g, '') === msgType)) {
        
        return;
      }

      // Unwrap nested data if present
      const payload = message?.data || message?.notification || message?.payload || message;

      // Must have meaningful content — not just a type
      const hasTitle   = payload?.title || payload?.heading;
      const hasMessage = payload?.message || payload?.body || payload?.content;

      // Skip if no real content
      if (!hasTitle && !hasMessage) return;

      const cleanMessage = (str) => (str || '').replace(/<[^>]*>/g, '').trim();
      const notifType    = payload?.notification_type || message?.type || payload?.type || 'system';
      const cfg          = metaFor(notifType);

      const safeStr = (v) => {
        if (!v) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object') return v.full_name || v.username || v.name || String(v.id || '');
        return String(v);
      };
      const n = {
        id:         String(payload?.id || message?.id || Date.now()),
        title:      safeStr(payload?.title || payload?.heading || 'Notification'),
        body:       cleanMessage(safeStr(payload?.message || payload?.body || payload?.content || '')),
        type:       safeStr(notifType),
        icon:       cfg.icon,
        color:      cfg.color,
        read:       payload?.is_read || false,
        time:       payload?.created_at || message?.timestamp || new Date().toISOString(),
        time_since: 'just now',
        priority:   safeStr(payload?.priority || 'medium'),
        actor:      safeStr(payload?.actor_name || payload?.sender || message?.sender || ''),
        metadata:   payload?.metadata || {},
      };

      setNotifications(prev => {
        if (prev.some(p => p.id === n.id)) return prev;
        const next = [n, ...prev].slice(0, 100);
        _cachedNotifications = next;
        _cachedUnread = next.filter(x => !x.read).length;
        setUnreadCount(_cachedUnread);
        return next;
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markAllRead,
      markOneRead,
      clearAll,
      addNotification,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
