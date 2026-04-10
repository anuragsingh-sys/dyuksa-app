/**
 * PushNotificationService — DYUKSA
 *
 * Uses expo-notifications for:
 *   - Push permission request
 *   - Expo push token retrieval (send to backend for server-side push)
 *   - Scheduling local notifications for event reminders
 *     (1 day before + 2 hours before each event)
 *   - Cancelling notifications when events are deleted
 *
 * Install:  npx expo install expo-notifications expo-device
 * Add to app.json plugins: ["expo-notifications"]
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEDULED_KEY = 'DYUKSA_SCHEDULED_NOTIFS'; // eventId → [notifId, notifId]

// ── Configure foreground behaviour ──────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ── Request permissions + get push token ────────────────────────────────────
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices.');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied.');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dyuksa-events', {
      name:        'Event Reminders',
      importance:  Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:  '#4ECDC4',
    });
    await Notifications.setNotificationChannelAsync('dyuksa-tasks', {
      name:        'Task Alerts',
      importance:  Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Get Expo push token — send this to your backend to send server-side pushes
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  console.log('Expo Push Token:', token);

  // ── BACKEND INTEGRATION POINT ────────────────────────────────────────────
  // When ready: send token to backend so server can push notifications
  // await fetch('https://api.dyuksa.com/users/push-token', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  //   body: JSON.stringify({ token, platform: Platform.OS }),
  // });
  // ─────────────────────────────────────────────────────────────────────────

  return token;
}

// ── Schedule local reminders for an event ───────────────────────────────────
// Call this whenever a new event is created
export async function scheduleEventReminders(event) {
  const { id, name, eventDate } = event;
  if (!eventDate) return;

  // Parse — supports "April 20, 2026 at 3:00 PM" and ISO
  const parsed = new Date(eventDate.replace(' at ', ' '));
  if (isNaN(parsed)) return;

  const now = new Date();
  const scheduled = [];

  // 1-day-before reminder
  const dayBefore = new Date(parsed.getTime() - 24 * 60 * 60 * 1000);
  if (dayBefore > now) {
    const id1 = await Notifications.scheduleNotificationAsync({
      content: {
        title:    '⏰ Event Tomorrow',
        body:     `"${name}" is scheduled for tomorrow.`,
        data:     { eventId: id, type: 'reminder' },
        sound:    true,
        channelId: 'dyuksa-events',
      },
      trigger: { date: dayBefore },
    });
    scheduled.push(id1);
  }

  // 2-hours-before reminder
  const twoHoursBefore = new Date(parsed.getTime() - 2 * 60 * 60 * 1000);
  if (twoHoursBefore > now) {
    const id2 = await Notifications.scheduleNotificationAsync({
      content: {
        title:    '🔔 Starting Soon',
        body:     `"${name}" starts in 2 hours!`,
        data:     { eventId: id, type: 'reminder' },
        sound:    true,
        channelId: 'dyuksa-events',
      },
      trigger: { date: twoHoursBefore },
    });
    scheduled.push(id2);
  }

  // Persist mapping so we can cancel later
  if (scheduled.length) {
    const map = await getScheduledMap();
    map[id] = scheduled;
    await saveScheduledMap(map);
  }
}

// ── Cancel reminders when event is deleted ───────────────────────────────────
export async function cancelEventReminders(eventId) {
  const map = await getScheduledMap();
  const notifIds = map[eventId] || [];
  for (const nid of notifIds) {
    await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
  }
  delete map[eventId];
  await saveScheduledMap(map);
}

// ── Send immediate local notification (for in-app events) ───────────────────
export async function sendLocalNotification({ title, body, data = {}, channelId = 'dyuksa-tasks' }) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true, channelId },
    trigger: null, // immediate
  });
}

// ── Reschedule all events on app start (in case device was restarted) ────────
export async function rescheduleAllEvents(events) {
  // Cancel everything first
  await Notifications.cancelAllScheduledNotificationsAsync();
  await saveScheduledMap({});

  // Re-schedule all future events
  for (const ev of events) {
    if (ev.type === 'event' && !ev.isDeleted) {
      await scheduleEventReminders(ev);
    }
  }
}

// ── Listener setup — call in App.js ─────────────────────────────────────────
export function addNotificationListeners(onReceive, onResponse) {
  const receiveSub  = Notifications.addNotificationReceivedListener(onReceive);
  const responseSub = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => {
    receiveSub.remove();
    responseSub.remove();
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────
async function getScheduledMap() {
  const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveScheduledMap(map) {
  await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(map));
}
