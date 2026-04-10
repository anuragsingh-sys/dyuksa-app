import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';
const NOTIF_KEY   = 'DYUKSA_NOTIFICATIONS';
const FIRED_KEY   = 'DYUKSA_REMINDER_FIRED';
const SETTINGS_KEY = 'DYUKSA_SETTINGS';

export const NotificationsContext = createContext({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAllRead: () => {},
  clearAll: () => {},
});

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then(data => {
      if (data) setNotifications(JSON.parse(data));
    });
  }, []);

  const persist = (list) => AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(list));

  // Check if a notification type is enabled in settings
  const isEnabled = async (type) => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) return true; // default on
      const settings = JSON.parse(raw);
      if (type === 'task')     return settings.taskAssign     !== false;
      if (type === 'event')    return settings.desktopNotif   !== false;
      if (type === 'reminder') return settings.desktopNotif   !== false;
      if (type === 'project')  return settings.desktopNotif   !== false;
      return true;
    } catch { return true; }
  };

  const addNotification = useCallback(async (notif) => {
    const enabled = await isEnabled(notif.type);
    if (!enabled) return; // respect notification preferences

    setNotifications(prev => {
      const next = [
        { id: Date.now().toString(), read: false, time: new Date().toISOString(), ...notif },
        ...prev,
      ].slice(0, 50);
      persist(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    AsyncStorage.removeItem(NOTIF_KEY);
  }, []);

  // Hourly event reminder check
  useEffect(() => {
    const checkReminders = async () => {
      try {
        const enabled = await isEnabled('reminder');
        if (!enabled) return;

        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (!data) return;
        const items  = JSON.parse(data);
        const events = items.filter(i => i.type === 'event' && i.eventDate);

        const firedRaw = await AsyncStorage.getItem(FIRED_KEY);
        const fired    = firedRaw ? JSON.parse(firedRaw) : [];
        const newFired = [...fired];
        const now      = new Date();

        for (const ev of events) {
          const parsed    = new Date(ev.eventDate.replace(' at ', ' '));
          if (isNaN(parsed)) continue;
          const hoursUntil = (parsed - now) / (1000 * 60 * 60);

          const rid = `reminder_${ev.id}`;
          if (hoursUntil > 0 && hoursUntil <= 25 && hoursUntil >= 23 && !fired.includes(rid)) {
            addNotification({ type: 'reminder', icon: '⏰', title: 'Event Tomorrow', body: `"${ev.name}" is scheduled for tomorrow.` });
            newFired.push(rid);
          }

          const sid = `sameday_${ev.id}`;
          if (hoursUntil > 0 && hoursUntil <= 2 && !fired.includes(sid)) {
            addNotification({ type: 'reminder', icon: '🔔', title: 'Event Soon', body: `"${ev.name}" starts in less than 2 hours!` });
            newFired.push(sid);
          }
        }

        if (newFired.length !== fired.length)
          await AsyncStorage.setItem(FIRED_KEY, JSON.stringify(newFired));
      } catch {}
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [addNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
