import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebSocketService from '../services/WebSocketService';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
const NOTIF_KEY    = 'DYUKSA_NOTIFICATIONS';
const SETTINGS_KEY = 'DYUKSA_SETTINGS';

// ── Per-workspace module-level cache ─────────────────────────────────────────
// Keyed by workspaceId so switching workspaces shows correct notifications
// instantly from cache without a blank flash
const _cache = {};       // { [workspaceId]: { notifications, unread, fetchedAt } }
const STALE_MS = 30_000;

const getCached = (wsId) => _cache[wsId] || null;
const setCached = (wsId, notifications, unread) => {
  _cache[wsId] = { notifications, unread, fetchedAt: Date.now() };
};
const isFresh = (wsId) => {
  const c = _cache[wsId];
  return c && Date.now() - c.fetchedAt < STALE_MS;
};

export const NotificationsContext = createContext({
  notifications:   [],
  unreadCount:     0,   // current workspace only
  totalUnread:     0,   // all workspaces — use for bell badge
  otherWorkspaces: [],
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
  const [unreadCount,   setUnreadCount]   = useState(0);  // current workspace unread
  const [totalUnread,   setTotalUnread]   = useState(0);  // all workspaces — for bell badge
  const [otherWorkspaces, setOtherWorkspaces] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const tokenRef = useRef(null);
  const currentWsIdRef = useRef(null);

  // ── Get token + workspace helper ──────────────────────────────────
  const getToken = async () => {
    try { return await AsyncStorage.getItem('DYUKSA_AUTH_TOKEN'); }
    catch { return null; }
  };

  const getWsId = async () => {
    try { return await getWorkspaceId(); }
    catch { return null; }
  };

  // ── Fetch from backend ────────────────────────────────────────────
  const fetchNotifications = useCallback(async (force = false) => {
    const token = await getToken();
    const wsId  = await getWsId();
    if (!token) return;

    // Show cached data instantly for this workspace
    const cached = getCached(wsId);
    if (cached) {
      setNotifications(cached.notifications);
      setUnreadCount(cached.unread);
      if (!force && isFresh(wsId)) return; // fresh and not forced — skip network
    }

    currentWsIdRef.current = wsId;
    setLoading(true);
    try { await AsyncStorage.removeItem(NOTIF_KEY + '_v1_cleared') } catch {}
    try {
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      if (wsId) headers['X-Workspace-ID'] = wsId;
      const res = await fetch(`${BASE_URL}/notification/`, { headers });
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

      // Merge server list with any local-only WS notifications
      // so opening the panel never wipes real-time notifications
      setNotifications(prev => {
        const serverIds = new Set(normalised.map(n => n.id));
        const localOnly = prev.filter(p => !serverIds.has(p.id));
        const merged = [...normalised, ...localOnly];
        merged.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
        return merged;
      });
      setUnreadCount(data.unread_count ?? normalised.filter(n => !n.read).length);
      setTotalUnread(data.total_unread ?? data.unread_count ?? normalised.filter(n => !n.read).length);
      setOtherWorkspaces(data.other_workspaces || []);
      // Update per-workspace cache
      setCached(wsId, normalised, data.unread_count ?? normalised.filter(n => !n.read).length);
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

  // ── Sync currentWsIdRef immediately on mount ─────────────────────
  // This ensures the WebSocket handler has the workspace ID even before
  // fetchNotifications completes its async work
  useEffect(() => {
    getWorkspaceId().then(id => {
      if (id) currentWsIdRef.current = String(id);
    }).catch(() => {});
  }, []);

  // ── Fetch once on mount — WebSocket handles real-time updates ──────
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── WebSocket — real-time notifications ───────────────────────────
  useEffect(() => {
    const unsubscribe = WebSocketService.subscribe((message) => {

      // ── Filter out system/connection messages ──────────────────────
      const systemTypes = [
        'gateway_connected', 'gateway.connected',
        'presence_sync',     'presence.sync',     'presence',
        'ping', 'pong', 'heartbeat', 'connect', 'disconnect',
        'welcome', 'connected', 'connection_established',
      ];
      const msgType = (message?.type || '').toLowerCase().replace(/[\s_]/g, '');
      if (systemTypes.some(t => t.toLowerCase().replace(/[\s_]/g, '') === msgType)) return;

      // ── Handle NEW_NOTIFICATION signal ────────────────────────────
      if (message?.type === 'SIGNAL' && message?.event === 'NEW_NOTIFICATION') {
        const data = message.data || {};
        const notifWsId   = String(data.workspace_id || '');
        const currentWsId = String(currentWsIdRef.current || '');
        const isSameWs    = notifWsId === currentWsId;
        console.log('[Notif] WS signal:', { notifWsId, currentWsId, isSameWs, title: data.title });

        if (isSameWs) {
          // ── Same workspace: add full notification ──────────────────
          const n = {
            id:         String(data.id || Date.now()),
            title:      data.title || 'Notification',
            body:       data.message || '',
            type:       data.related_object?.type || 'system',
            icon:       metaFor(data.related_object?.type).icon,
            color:      metaFor(data.related_object?.type).color,
            read:       false,
            time:       new Date().toISOString(),
            time_since: 'just now',
            priority:   'medium',
            actor:      '',
            metadata:   data.related_object || {},
            workspace_id:   notifWsId,
            workspace_name: data.workspace_name || '',
          };

          setNotifications(prev => {
            if (prev.some(p => p.id === n.id)) return prev;
            const next = [n, ...prev].slice(0, 100);
            if (currentWsIdRef.current) {
              setCached(currentWsIdRef.current, next, next.filter(x => !x.read).length);
            }
            return next;
          });
          // Update unread counts from the backend payload — source of truth
          if (data.unread_count != null) {
            setUnreadCount(data.unread_count);
            // totalUnread = current workspace unread + other workspaces unread
            setTotalUnread(prev => {
              const otherUnread = prev - (data.unread_count - 1 >= 0 ? data.unread_count - 1 : 0);
              return data.unread_count + Math.max(0, otherUnread);
            });
          } else {
            setTotalUnread(prev => prev + 1);
          }

        } else {
          // ── Different workspace: update other_workspaces badge only ─
          setOtherWorkspaces(prev => {
            const existing = prev.find(w => String(w.workspace_id) === notifWsId);
            if (existing) {
              return prev.map(w =>
                String(w.workspace_id) === notifWsId
                  ? { ...w, unread_count: (w.unread_count || 0) + 1,
                      message: `You have ${(w.unread_count || 0) + 1} new notification${(w.unread_count || 0) + 1 !== 1 ? 's' : ''} in '${data.workspace_name || w.workspace_name}'` }
                  : w
              );
            }
            return [...prev, {
              workspace_id:   data.workspace_id,
              workspace_name: data.workspace_name || '',
              unread_count:   1,
              message:        `You have 1 new notification in '${data.workspace_name || ''}'`,
            }];
          });
          setTotalUnread(prev => prev + 1);
        }
        return;
      }

      // ── Legacy fallback: explicit notification types ONLY ─────────
      // Block chat/presence/unread-update events — they have content fields
      // that would otherwise match the hasMessage check and leak in as
      // fake "Notification" entries (e.g. CHAT_MESSAGE with content: "Hlo")
      const rawType = (message?.type || '').toUpperCase();
      const BLOCKED = ['CHAT_MESSAGE', 'CHAT_UNREAD_UPDATE', 'PRESENCE',
                       'PRESENCE_SYNC', 'TYPING', 'READ_RECEIPT', 'GATEWAY_CONNECTED'];
      if (BLOCKED.includes(rawType)) return;

      // Only proceed if this is explicitly a notification shape
      const isNotif = rawType === 'NOTIFICATION' ||
                      message?.event === 'NEW_NOTIFICATION' ||
                      message?.data?.notification_type ||
                      message?.notification_type;
      if (!isNotif) return;

      const payload    = message?.data || message?.notification || message?.payload || message;
      const hasTitle   = payload?.title || payload?.heading;
      const hasMessage = payload?.message || payload?.body; // intentionally exclude 'content'
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
        if (currentWsIdRef.current) {
          setCached(currentWsIdRef.current, next, next.filter(x => !x.read).length);
        }
        setUnreadCount(next.filter(x => !x.read).length);
        setTotalUnread(t => t + 1);
        return next;
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      totalUnread,
      otherWorkspaces,
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
