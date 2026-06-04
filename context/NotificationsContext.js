import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebSocketService from '../services/WebSocketService';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
const NOTIF_KEY    = 'DYUKSA_NOTIFICATIONS';
const SETTINGS_KEY = 'DYUKSA_SETTINGS';
// BASE_URL → imported from config

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
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const tokenRef = useRef(null);

  // ── Get token helper ──────────────────────────────────────────────
  const getToken = async () => {
    try { return await AsyncStorage.getItem('DYUKSA_AUTH_TOKEN'); }
    catch { return null; }
  };

  // ── Fetch from backend ────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/notification/`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.notifications || [];

      // Normalise to app shape
      const normalised = list.map(n => ({
        id:        String(n.id),
        title:     n.title || 'Notification',
        body:      n.message?.replace(/<[^>]*>/g, '') || '',  // strip HTML tags
        type:      n.notification_type || 'system',
        icon:      metaFor(n.notification_type).icon,
        color:     metaFor(n.notification_type).color,
        read:      n.is_read,
        time:      n.created_at,
        time_since:n.time_since,
        priority:  n.priority,
        actor:     n.actor_name,
        metadata:  n.metadata || {},
      }));

      setNotifications(normalised);
      setUnreadCount(data.unread_count ?? normalised.filter(n => !n.read).length);
      await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(normalised));
    } catch (e) {
      console.warn('fetchNotifications error:', e.message);
      // Fall back to cached
      const cached = await AsyncStorage.getItem(NOTIF_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        setNotifications(list);
        setUnreadCount(list.filter(n => !n.read).length);
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

      const n = {
        id:         String(payload?.id || message?.id || Date.now()),
        title:      payload?.title || payload?.heading || 'Notification',
        body:       cleanMessage(payload?.message || payload?.body || payload?.content || ''),
        type:       notifType,
        icon:       cfg.icon,
        color:      cfg.color,
        read:       payload?.is_read || false,
        time:       payload?.created_at || message?.timestamp || new Date().toISOString(),
        time_since: 'just now',
        priority:   payload?.priority || 'medium',
        actor:      payload?.actor_name || payload?.sender || message?.sender || null,
        metadata:   payload?.metadata || {},
      };

      setNotifications(prev => {
        if (prev.some(p => p.id === n.id)) return prev;
        const next = [n, ...prev].slice(0, 100);
        setUnreadCount(next.filter(x => !x.read).length);
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
