import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, StatusBar, Platform, Alert, Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useContext, useRef, useEffect } from 'react';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import { NotificationsContext } from '../context/NotificationsContext';
import { getUsers, getAccessToken } from '../services/ApiService';
import * as Notifications from 'expo-notifications';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAILY_UPDATE_STORAGE_KEY = 'DYUKSA_DAILY_UPDATES'; // local cache: { 'YYYY-MM-DD': { priorities, progress, blockers, upcoming } }
const DAILY_UPDATE_API = 'http://192.168.1.164:8000/api/v1/daily-updates/';
const EVENTS_API       = 'http://192.168.1.164:8000/api/v1/daily-updates/events/';

const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 to 22:00
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_COLORS = { pending: '#FBBF24', in_progress: '#4ECDC4', completed: '#4ADE80', deployed: '#3B82F6', deferred: '#888899', review: '#A78BFA' };
const EVENT_TYPES = [
  { id: 'Meeting',   icon: '👥', label: 'Meeting' },
  { id: 'Review',    icon: '📋', label: 'Review' },
  { id: 'Interview', icon: '🎯', label: 'Interview' },
  { id: 'Training',  icon: '📚', label: 'Training' },
];

export default function CalendarScreen() {
  const navigation  = useNavigation();
  const route       = useRoute();
  const { theme }   = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
  const { user }    = useContext(AuthContext);
  const currentUserId = user?.id ?? null;
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';

  const today = new Date();

  // ── View state ──
  const [viewMode,    setViewMode]    = useState('workWeek'); // day | workWeek | week | month
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showMiniCal, setShowMiniCal] = useState(false);
  const [miniYear,  setMiniYear]  = useState(today.getFullYear());
  const [miniMonth, setMiniMonth] = useState(today.getMonth());

  // ── Events ──
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError,   setEventsError]   = useState(null);

  // ── Modal ──
  const [modalVisible,   setModalVisible]   = useState(false);
  const [eventName,      setEventName]      = useState('');
  const [eventDesc,      setEventDesc]      = useState('');
  const [pickerDate,     setPickerDate]     = useState(new Date());
  const [tempPickerDate, setTempPickerDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // End time (30 min after start by default)
  const [endPickerDate,     setEndPickerDate]     = useState(new Date());
  const [tempEndPickerDate, setTempEndPickerDate] = useState(new Date());
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  // Event type
  const [eventType,       setEventType]       = useState('Meeting'); // Meeting, Review, Interview, Training, Other
  const [customType,      setCustomType]      = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  // Teams meeting toggle
  const [teamsMeeting,    setTeamsMeeting]    = useState(false);
  // Location
  const [location,        setLocation]        = useState('');
  // Participants
  const [participants,    setParticipants]    = useState([]); // [{id, name, avatar}]
  const [showParticipants,setShowParticipants]= useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  // Ask Dyuksa AI agent input
  const [askDyuksaText, setAskDyuksaText] = useState('');
  const [askDyuksaLoading, setAskDyuksaLoading] = useState(false);

  // Ask Dyuksa slot-picker modal state (for when AI returns create_event suggestion)
  const [aiSuggestion,   setAiSuggestion]   = useState(null);  // AI response data object (original, untouched)
  const [aiSelectedSlot, setAiSelectedSlot] = useState(null);
  const [aiSaving,       setAiSaving]       = useState(false);
  // Editable fields in the slot-picker modal
  const [aiEditTitle,    setAiEditTitle]    = useState('');
  const [aiEditDuration, setAiEditDuration] = useState(30);    // minutes
  const [aiEditDate,     setAiEditDate]     = useState('');    // 'YYYY-MM-DD'
  const [aiSlotsLoading, setAiSlotsLoading] = useState(false); // while re-fetching slots after date/duration change
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const [showAiDatePicker, setShowAiDatePicker] = useState(false);

  const handleAskDyuksa = async () => {
    if (!askDyuksaText.trim()) return;
    setAskDyuksaLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('http://192.168.1.164:8000/api/v1/task-ai/chat/agent/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: askDyuksaText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Error', data.detail || data.message || `AI request failed (${res.status})`);
        return;
      }

      if (data.action !== 'create_event' || !data.data) {
        Alert.alert('Dyuksa says', data.reply || 'Could not generate an event from that request.');
        return;
      }

      const slots = Array.isArray(data.data.available_slots) ? data.data.available_slots : [];
      if (slots.length === 0) {
        Alert.alert('No slots', 'No free slots were found. Try a different date or duration.');
        return;
      }

      // Open slot-picker modal with editable defaults seeded from AI response
      setAiSuggestion(data.data);
      setAiSelectedSlot(slots[0]);
      setAiEditTitle(data.data.title || '');
      setAiEditDuration(data.data.duration_minutes || 30);
      setAiEditDate(data.data.target_date || '');
      setAskDyuksaText('');
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setAskDyuksaLoading(false);
    }
  };

  const closeAiModal = () => {
    setAiSuggestion(null);
    setAiSelectedSlot(null);
    setAiEditTitle('');
    setAiEditDuration(30);
    setAiEditDate('');
    setShowDurationMenu(false);
    setShowAiDatePicker(false);
  };

  // Re-fetch slots when user changes duration or date — re-hits the agent endpoint
  // with a reconstructed prompt so backend calculates availability for the new params.
  const refetchAiSlots = async (newDurationMin, newDateISO) => {
    if (!aiSuggestion) return;
    const dur = newDurationMin != null ? newDurationMin : aiEditDuration;
    const date = newDateISO != null ? newDateISO : aiEditDate;
    const attendeeNames = Array.isArray(aiSuggestion.attendee_names) ? aiSuggestion.attendee_names : [];
    // Skip self (first attendee is usually the organizer/current user)
    const others = attendeeNames.length > 1 ? attendeeNames.slice(1) : attendeeNames;
    const withPart = others.length ? ` with ${others.join(' and ')}` : '';
    const prompt = `Find ${dur} min meeting${withPart} on ${date}`;

    setAiSlotsLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('http://192.168.1.164:8000/api/v1/task-ai/chat/agent/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.action !== 'create_event' || !data.data) {
        Alert.alert('Dyuksa says', data.reply || data.detail || 'Could not find slots for that date/duration.');
        return;
      }
      const slots = Array.isArray(data.data.available_slots) ? data.data.available_slots : [];
      if (slots.length === 0) {
        // Keep dialog open but show empty state
        setAiSuggestion({ ...aiSuggestion, available_slots: [], duration_minutes: dur, target_date: date });
        setAiSelectedSlot(null);
        return;
      }
      // Merge new slots into existing suggestion; keep attendee list from original response
      setAiSuggestion({
        ...aiSuggestion,
        available_slots:  slots,
        duration_minutes: data.data.duration_minutes || dur,
        target_date:      data.data.target_date      || date,
      });
      setAiSelectedSlot(slots[0]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setAiSlotsLoading(false);
    }
  };

  const confirmAiEvent = async () => {
    if (!aiSuggestion || !aiSelectedSlot) return;
    setAiSaving(true);
    try {
      const token = await getAccessToken();
      const startDate = new Date(aiSelectedSlot);
      const endDate = new Date(startDate.getTime() + (aiEditDuration || aiSuggestion.duration_minutes || 30) * 60 * 1000);
      const body = {
        title:             (aiEditTitle || aiSuggestion.title || 'New meeting').trim(),
        event_type:        aiSuggestion.event_type || 'Meeting',
        start_time:        startDate.toISOString(),
        end_time:          endDate.toISOString(),
        is_online_meeting: true,
        is_recurring:      false,
        attendee_ids:      Array.isArray(aiSuggestion.attendee_ids) ? aiSuggestion.attendee_ids : [],
      };
      const res = await fetch(EVENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert('Error', data.detail || data.message || `Error ${res.status}`); return; }

      closeAiModal();
      fetchEvents();
      setTimeout(() => {
        Alert.alert('✦ Event created', data.message || 'Your event has been added to the calendar.');
      }, 300);
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setAiSaving(false);
    }
  };

  // Formatters for slot picker modal
  const aiFormatSlotTime = (iso) => {
    try { return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return iso; }
  };
  const aiFormatTargetDate = (s) => {
    if (!s) return '';
    try { return new Date(s + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return s; }
  };
  const aiInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const [allUsers,        setAllUsers]        = useState([]);
  const slideAnim = useRef(new Animated.Value(-600)).current;

  // ── Daily Update panel state ──
  const [dailyPanelDate,   setDailyPanelDate]   = useState(null); // Date object when panel is open, null when closed
  const [dailyUpdates,     setDailyUpdates]     = useState({});   // MY updates: { 'YYYY-MM-DD': { id, priorities, progress, blockers, upcoming } }
  const [teamUpdates,      setTeamUpdates]      = useState({});   // TEAM updates: { 'YYYY-MM-DD': [{id, user, user_name, priorities, progress, blockers, upcoming}, ...] }
  const [loadingUpdates,   setLoadingUpdates]   = useState(false);
  const [editingUpdate,    setEditingUpdate]    = useState(false);
  const [editPriorities,   setEditPriorities]   = useState('');
  const [editProgress,     setEditProgress]     = useState('');
  const [editBlockers,     setEditBlockers]     = useState('');
  const [editUpcoming,     setEditUpcoming]     = useState('');
  const dailySlideAnim = useRef(new Animated.Value(0)).current; // 0 = hidden (off-screen right), 1 = visible

  // ── Normalise backend event → shape the existing render code expects ──
  // Render code reads: e.name, e.eventTimestamp / e.eventDate, e.status, e.id
  // Backend shape: { id, title, event_type, start_time, end_time, attendees, ... }
  const normaliseEvent = useCallback((be) => {
    const startIso = be.start_time;
    let status = 'Todo';
    try {
      if (startIso && new Date(startIso).getTime() < new Date().getTime()) status = 'Done';
    } catch {}
    return {
      id:             be.id,
      name:           be.title || '(Untitled event)',
      eventTimestamp: startIso,
      eventDate:      startIso,
      status,
      // Keep backend fields on the same object — useful for future rendering
      event_type:        be.event_type,
      end_time:          be.end_time,
      description:       be.description,
      location:          be.location,
      is_online_meeting: be.is_online_meeting,
      attendees:         be.attendees || [],
      organizer:         be.organizer,
      organizer_name:    be.organizer_name,
      my_invitation_status: be.my_invitation_status,
      my_invitation_id:     be.my_invitation_id,
      type: 'event',
    };
  }, []);

  // ── Fetch events from backend (follows pagination) ──
  const fetchEvents = useCallback(async () => {
    setEventsError(null);
    setEventsLoading(true);
    try {
      const token = await getAccessToken();
      const all = [];
      let url = EVENTS_API;
      let safety = 20; // cap 20 pages

      while (url && safety-- > 0) {
        const res = await fetch(url, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `Error ${res.status}`);
        }
        const json = await res.json();
        let pageList = [];
        let next = null;
        if (Array.isArray(json)) {
          pageList = json;
        } else if (Array.isArray(json.results)) {
          pageList = json.results;
          next = json.next || null;
        } else if (Array.isArray(json.events)) {
          pageList = json.events;
          next = json.next || null;
        }
        all.push(...pageList);
        url = next;
      }

      setEvents(all.map(normaliseEvent));
    } catch (e) {
      setEventsError(e.message || 'Failed to load events');
      // If fetch fails, keep any existing events rather than clearing them
    } finally {
      setEventsLoading(false);
    }
  }, [normaliseEvent]);

  useFocusEffect(useCallback(() => {
    // Fetch events from backend (replaces the old AsyncStorage load)
    fetchEvents();

    // Load daily updates from local cache first (fast), then refresh from backend
    AsyncStorage.getItem(DAILY_UPDATE_STORAGE_KEY).then(data => {
      if (data) {
        try { setDailyUpdates(JSON.parse(data)); } catch { setDailyUpdates({}); }
      }
    });
    // Fetch fresh from backend (will overwrite my updates + populate team updates)
    fetchDailyUpdates();
  }, [currentUserId, fetchEvents]));

  // Fetch all users once for participants list
  useEffect(() => {
    getUsers().then(setAllUsers).catch(() => setAllUsers([]));
  }, []);

  // Auto-open New Event modal when triggered by center "+" FAB (Quick Add → Event)
  useFocusEffect(
    useCallback(() => {
      if (route.params?.openCreateModal) {
        openModal();
        navigation.setParams({ openCreateModal: false });
      }
      // AI pill tapped for Event tab → show a friendly "coming soon" alert.
      // When the backend AI endpoint for event parsing is ready, replace this
      // with a proper AI event flow. For now we just bring the user's attention
      // to the existing Ask Dyuksa bar at the top of the calendar.
      if (route.params?.openCreateModalAI) {
        const returnToTab = route.params?.returnTo;
        Alert.alert(
          '✦ AI Event Creation',
          'AI-powered event creation is coming soon! For now, you can use the "Ask Dyuksa" bar at the top of the Calendar to try natural-language queries, or tap "+ New event" to create one manually.',
          [{
            text: 'Got it',
            onPress: () => {
              if (returnToTab && returnToTab !== 'Calendar') {
                try { navigation.jumpTo(returnToTab); } catch {}
              }
            },
          }]
        );
        navigation.setParams({ openCreateModalAI: false, returnTo: null });
      }
    }, [route.params?.openCreateModal, route.params?.openCreateModalAI])
  );

  // ── Navigation helpers ──
  const goToday  = () => setCurrentDate(new Date());

  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day')      d.setDate(d.getDate() - 1);
    else if (viewMode === 'week' || viewMode === 'workWeek') d.setDate(d.getDate() - 7);
    else { d.setMonth(d.getMonth() - 1); }
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day')      d.setDate(d.getDate() + 1);
    else if (viewMode === 'week' || viewMode === 'workWeek') d.setDate(d.getDate() + 7);
    else { d.setMonth(d.getMonth() + 1); }
    setCurrentDate(d);
  };

  // ── Week days ──
  const getWeekDays = (date, workWeek = false) => {
    const d   = new Date(date);
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
    return workWeek ? days.slice(0, 5) : days;
  };

  const weekDays = viewMode === 'day'
    ? [currentDate]
    : getWeekDays(currentDate, viewMode === 'workWeek');

  // ── Header label ──
  const getHeaderLabel = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (viewMode === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    const first = weekDays[0];
    const last  = weekDays[weekDays.length - 1];
    return `${MONTHS_SHORT[first.getMonth()]} ${first.getDate()} – ${first.getMonth() !== last.getMonth() ? MONTHS_SHORT[last.getMonth()] + ' ' : ''}${last.getDate()}, ${last.getFullYear()}`;
  };

  // ── Event helpers ──
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const eventsForDay = (d) => events.filter(e => {
    try {
      const ts = e.eventTimestamp || e.eventDate;
      if (!ts) return false;
      const ed = new Date(ts);
      return dateKey(ed) === dateKey(d);
    } catch { return false; }
  });

  const eventsForHour = (d, hour) => eventsForDay(d).filter(e => {
    try {
      const ed = new Date(e.eventTimestamp || e.eventDate);
      return ed.getHours() === hour;
    } catch { return false; }
  });

  // ── Stats ──
  const totalEvents  = events.length;
  const doneEvents   = events.filter(e => e.status === 'Done').length;
  const activeEvents = events.filter(e => e.status === 'Todo' && new Date(e.eventTimestamp || e.eventDate) >= today).length;
  const pendingEvents= events.filter(e => e.status === 'Todo').length;

  // ── Daily Update Panel ──

  // Parse backend 'content' string into our 4-field shape.
  // Backend format looks like:
  //   "Daily Update – 23 March 2026\n\nToday's Priorities:-\n...\n\nProgress (Yesterday):-\n...\n\nBlockers / Needs:-\n...\n\nUpcoming:-\n..."
  const parseContent = (content) => {
    if (!content || typeof content !== 'string') {
      return { priorities: '', progress: '', blockers: '', upcoming: '' };
    }
    // Try to split into labeled sections; labels may or may not have '-' after ':'
    // Regex grabs everything between one label and the next (or end of string).
    const extract = (labelPattern) => {
      const re = new RegExp(
        labelPattern + `\\s*:-?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:Today's Priorities|Progress \\(Yesterday\\)|Blockers\\s*/\\s*Needs|Upcoming)\\s*:-?|$)`,
        'i'
      );
      const m = content.match(re);
      return m ? m[1].trim() : '';
    };
    return {
      priorities: extract("Today's Priorities"),
      progress:   extract("Progress \\(Yesterday\\)"),
      blockers:   extract("Blockers\\s*/\\s*Needs"),
      upcoming:   extract("Upcoming"),
    };
  };

  // Format a Date into backend-style header date: "23 March 2026"
  const formatBackendDate = (d) => {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Fetch all daily updates from backend and split into "my updates" vs "team updates"
  const fetchDailyUpdates = async () => {
    try {
      setLoadingUpdates(true);
      const token = await getAccessToken();
      const res = await fetch(DAILY_UPDATE_API, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      const results = data.results || (Array.isArray(data) ? data : []);

      // Split into my vs team, keyed by date
      const myUpdates = {};
      const teamByDate = {};
      for (const row of results) {
        const parsed = parseContent(row.content || '');
        const record = {
          id: row.id,
          user: row.user,
          user_name: row.user_name || 'Unknown',
          date: row.date,
          priorities: parsed.priorities,
          progress:   parsed.progress,
          blockers:   parsed.blockers,
          upcoming:   parsed.upcoming,
          updatedAt:  row.updated_at,
        };
        if (currentUserId != null && row.user === currentUserId) {
          // This is my update — store in myUpdates keyed by date (latest wins if duplicates)
          const existing = myUpdates[row.date];
          if (!existing || new Date(row.updated_at) > new Date(existing.updatedAt)) {
            myUpdates[row.date] = record;
          }
        } else {
          // Team update
          if (!teamByDate[row.date]) teamByDate[row.date] = [];
          teamByDate[row.date].push(record);
        }
      }
      setDailyUpdates(prev => ({ ...prev, ...myUpdates }));
      setTeamUpdates(teamByDate);
      // Also persist my updates to local cache for offline reads
      AsyncStorage.setItem(DAILY_UPDATE_STORAGE_KEY, JSON.stringify(myUpdates)).catch(() => {});
    } catch {
      // Silent — just means no updates shown
    } finally {
      setLoadingUpdates(false);
    }
  };

  const openDailyPanel = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    setDailyPanelDate(d);
    // Reset edit state — load existing update into edit fields if it exists
    const existing = dailyUpdates[dateKey(d)];
    setEditPriorities(existing?.priorities || '');
    setEditProgress(existing?.progress || '');
    setEditBlockers(existing?.blockers || '');
    setEditUpcoming(existing?.upcoming || '');
    setEditingUpdate(false);
    Animated.timing(dailySlideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };

  const closeDailyPanel = () => {
    Animated.timing(dailySlideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setDailyPanelDate(null);
      setEditingUpdate(false);
    });
  };

  const saveDailyUpdate = async () => {
    if (!dailyPanelDate) return;
    const key = dateKey(dailyPanelDate);

    // Build the 4-field values
    const priorities = editPriorities.trim();
    const progress   = editProgress.trim();
    const blockers   = editBlockers.trim();
    const upcoming   = editUpcoming.trim();

    // Require at least one field filled in
    if (!priorities && !progress && !blockers && !upcoming) {
      Alert.alert('Empty update', 'Please fill in at least one section before submitting.');
      return;
    }

    // Combine 4 fields into single 'content' string matching backend convention:
    //   "Daily Update – 23 March 2026\n\nToday's Priorities:-\n...\n\n..."
    const header = `Daily Update – ${formatBackendDate(dailyPanelDate)}`;
    const sections = [
      `Today's Priorities:-\n${priorities}`,
      `Progress (Yesterday):-\n${progress}`,
      `Blockers / Needs:-\n${blockers}`,
      `Upcoming:-\n${upcoming}`,
    ];
    const content = `${header}\n\n${sections.join('\n\n')}`;

    // Optimistic local save first
    const updated = {
      ...dailyUpdates,
      [key]: {
        priorities, progress, blockers, upcoming,
        updatedAt: new Date().toISOString(),
      },
    };
    setDailyUpdates(updated);
    await AsyncStorage.setItem(DAILY_UPDATE_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
    setEditingUpdate(false);

    // Send to backend
    try {
      const token = await getAccessToken();
      const res = await fetch(DAILY_UPDATE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content, date: key }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || errData.message || `Save failed (${res.status})`;
        Alert.alert(
          'Saved locally',
          `Your update was saved on this device but couldn't sync to the server: ${msg}`,
          [{ text: 'OK' }]
        );
        return;
      }
      // Success — refresh from backend to pick up the new entry + any team updates
      fetchDailyUpdates();
    } catch (err) {
      Alert.alert(
        'Saved locally',
        `Your update was saved on this device. Network error — will sync later.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Is the panel's date today / past / future?
  const dailyPanelDateClass = (() => {
    if (!dailyPanelDate) return 'future';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const panel = new Date(dailyPanelDate); panel.setHours(0, 0, 0, 0);
    if (panel.getTime() === t.getTime()) return 'today';
    if (panel.getTime() <  t.getTime()) return 'past';
    return 'future';
  })();

  // ── Modal ──
  const openModal = (date) => {
    let d;
    if (date) {
      d = new Date(date);
    } else {
      d = new Date(currentDate);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        d.setHours(now.getHours(), 0, 0, 0);
      } else {
        d.setHours(9, 0, 0, 0);
      }
    }
    // End time defaults to 30 min after start
    const end = new Date(d);
    end.setMinutes(end.getMinutes() + 30);

    setPickerDate(d); setTempPickerDate(d);
    setEndPickerDate(end); setTempEndPickerDate(end);
    setShowDatePicker(false); setShowTimePicker(false); setShowEndTimePicker(false);
    setShowTypeDropdown(false); setShowParticipants(false);
    setModalVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, { toValue: -600, duration: 250, useNativeDriver: true })
      .start(() => {
        setModalVisible(false);
        setEventName(''); setEventDesc('');
        setEventType('Meeting'); setCustomType('');
        setTeamsMeeting(false); setLocation('');
        setParticipants([]); setParticipantSearch('');
        setShowDatePicker(false); setShowTimePicker(false); setShowEndTimePicker(false);
        setShowTypeDropdown(false); setShowParticipants(false);

        // If opened from center "+" FAB, return user to the tab they came from
        const returnTo = route.params?.returnTo;
        if (returnTo && returnTo !== 'Calendar') {
          navigation.setParams({ returnTo: null });
          try { navigation.jumpTo(returnTo); } catch {}
        }
      });
  };

  const saveEvent = async () => {
    if (!eventName.trim()) { Alert.alert('Required', 'Enter an event name.'); return; }

    // Prevent creating events in the past
    const now = new Date();
    if (pickerDate.getTime() < now.getTime()) {
      Alert.alert(
        "Can't schedule in the past",
        "Events can only be created for the current time or a future date. Please pick a date and time that has not already passed.",
        [{ text: 'OK' }]
      );
      return;
    }

    // End time must be after start time
    if (endPickerDate.getTime() <= pickerDate.getTime()) {
      Alert.alert('Invalid time', 'End time must be after the start time.', [{ text: 'OK' }]);
      return;
    }

    const resolvedType = eventType === 'Other' ? (customType.trim() || 'Other') : eventType;

    // ── Save to backend ──
    // POST /api/v1/daily-updates/events/
    // Expected body fields: title, event_type, start_time, end_time, is_online_meeting,
    //                       is_recurring, description, location, attendee_ids
    try {
      const token = await getAccessToken();
      const body = {
        title:             eventName.trim(),
        event_type:        resolvedType,
        start_time:        pickerDate.toISOString(),
        end_time:          endPickerDate.toISOString(),
        is_online_meeting: !!teamsMeeting,
        is_recurring:      false,
        description:       eventDesc.trim(),
        location:          location.trim(),
        attendee_ids:      participants.map(p => p.id),
      };
      const res = await fetch(EVENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Error', data.detail || data.message || `Error ${res.status}`);
        return;
      }

      // Refresh events list from backend so the new one shows up immediately
      fetchEvents();

      // Use the server-returned event (first of created_events) for reminders
      const createdEvent = (data.created_events && data.created_events[0]) || null;
      const serverEventId = createdEvent?.id || Date.now().toString();

      // ── 1 hour before reminder timestamp ──
      const reminderTime = new Date(pickerDate.getTime() - 60 * 60 * 1000);
      const shouldScheduleReminder = reminderTime.getTime() > Date.now();

      // Helper: schedule a local push notification at a specific time
      const scheduleReminder = async (title, notifBody, recipientId) => {
        if (!shouldScheduleReminder) return null;
        try {
          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body: notifBody,
              data: {
                eventId: serverEventId,
                recipientId: recipientId || null,
                type: 'event_reminder',
              },
              sound: true,
            },
            trigger: { date: reminderTime },
          });
          return id;
        } catch (err) {
          console.warn('Failed to schedule reminder:', err?.message);
          return null;
        }
      };

      // ── Notifications ──
      if (participants.length > 0) {
        // For each participant:
        //  1) Fire "you've been invited" immediately (in-app)
        //  2) Schedule a 1-hour-before reminder (local push)
        for (const p of participants) {
          addNotification({
            type: 'event',
            icon: '📅',
            title: `Event: ${eventName.trim()}`,
            body: `${resolvedType} scheduled. You've been invited.`,
            recipientId: p.id,
          });
          await scheduleReminder(
            `Reminder: ${eventName.trim()}`,
            `${resolvedType} starts in 1 hour${location.trim() ? ` at ${location.trim()}` : ''}.`,
            p.id,
          );
        }
      } else {
        // No participants — only notify creator
        addNotification({
          type: 'event',
          icon: '📅',
          title: 'Event Created',
          body: `"${eventName.trim()}" scheduled.`,
        });
        await scheduleReminder(
          `Reminder: ${eventName.trim()}`,
          `${resolvedType} starts in 1 hour${location.trim() ? ` at ${location.trim()}` : ''}.`,
        );
      }

      closeModal();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save event.');
    }
  };

  // Participant helpers
  const toggleParticipant = (user) => {
    setParticipants(prev => {
      const exists = prev.find(p => p.id === user.id);
      if (exists) return prev.filter(p => p.id !== user.id);
      return [...prev, {
        id: user.id,
        name: user.first_name || user.username || 'User',
        avatar: (user.first_name || user.username || 'U')[0].toUpperCase(),
      }];
    });
  };

  const filteredUsers = allUsers.filter(u => {
    const q = participantSearch.toLowerCase().trim();
    if (!q) return true;
    return (u.first_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
  });

  const deleteEvent = (id) => {
    Alert.alert('Delete Event', 'Remove this event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const token = await getAccessToken();
          const res = await fetch(`${EVENTS_API}${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!res.ok && res.status !== 204) {
            const err = await res.json().catch(() => ({}));
            Alert.alert('Error', err.detail || err.message || `Could not delete (Error ${res.status})`);
            return;
          }
          // Optimistically remove locally, then re-fetch to stay in sync
          setEvents(prev => prev.filter(e => String(e.id) !== String(id)));
          fetchEvents();
        } catch (e) {
          Alert.alert('Error', e.message || 'Could not delete event.');
        }
      }},
    ]);
  };

  // ── Mini calendar ──
  const miniDaysInMonth = new Date(miniYear, miniMonth + 1, 0).getDate();
  const miniFirstDay    = new Date(miniYear, miniMonth, 1).getDay();

  const renderMiniCalendar = () => (
    <View style={[styles.miniCal, { backgroundColor: card, borderColor: bdr }]}>
      <View style={styles.miniCalHeader}>
        <TouchableOpacity onPress={() => { if (miniMonth === 0) { setMiniMonth(11); setMiniYear(y => y-1); } else setMiniMonth(m => m-1); }}>
          <Text style={[styles.miniArrow, { color: txt }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.miniMonthLabel, { color: txt }]}>{MONTHS_SHORT[miniMonth]} {miniYear}</Text>
        <TouchableOpacity onPress={() => { if (miniMonth === 11) { setMiniMonth(0); setMiniYear(y => y+1); } else setMiniMonth(m => m+1); }}>
          <Text style={[styles.miniArrow, { color: txt }]}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.miniDayRow}>
        {['S','M','T','W','T','F','S'].map((d,i) => (
          <Text key={i} style={[styles.miniDayLabel, { color: sub }]}>{d}</Text>
        ))}
      </View>
      <View style={styles.miniDatesGrid}>
        {Array.from({ length: miniFirstDay }).map((_, i) => <View key={`e${i}`} style={styles.miniDateCell} />)}
        {Array.from({ length: miniDaysInMonth }, (_, i) => {
          const d = i + 1;
          const isToday = d === today.getDate() && miniMonth === today.getMonth() && miniYear === today.getFullYear();
          const isSelected = dateKey(currentDate) === `${miniYear}-${String(miniMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const hasEv = events.some(e => {
            try { const ed = new Date(e.eventTimestamp || e.eventDate); return ed.getDate() === d && ed.getMonth() === miniMonth && ed.getFullYear() === miniYear; } catch { return false; }
          });
          return (
            <TouchableOpacity
              key={d}
              style={styles.miniDateCell}
              onPress={() => {
                const newDate = new Date(miniYear, miniMonth, d);
                setCurrentDate(newDate);
                if (viewMode === 'month') setViewMode('day');
              }}
            >
              <View style={[styles.miniDateCircle, isToday && styles.miniDateToday, isSelected && !isToday && styles.miniDateSelected]}>
                <Text style={[styles.miniDateText, { color: txt }, isToday && { color: '#fff' }, isSelected && !isToday && { color: '#4ECDC4', fontWeight: '700' }]}>{d}</Text>
              </View>
              {hasEv && <View style={styles.miniDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Month view ──
  const renderMonthView = () => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const fd  = new Date(y, m, 1).getDay();
    return (
      <ScrollView style={{ flex: 1 }}>
        <View style={[styles.monthGrid, { backgroundColor: card, borderColor: bdr }]}>
          <View style={styles.monthDayRow}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <Text key={d} style={[styles.monthDayLabel, { color: sub }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.monthDates}>
            {Array.from({ length: fd }).map((_, i) => <View key={`e${i}`} style={styles.monthCell} />)}
            {Array.from({ length: dim }, (_, i) => {
              const d = i + 1;
              const date = new Date(y, m, d);
              const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
              const dayEvs = eventsForDay(date);
              return (
                <TouchableOpacity key={d} style={[styles.monthCell, { borderColor: bdr }]} onPress={() => { setCurrentDate(date); setViewMode('day'); }}>
                  <View style={[styles.monthDateCircle, isToday && styles.miniDateToday]}>
                    <Text style={[styles.monthDateText, { color: txt }, isToday && { color: '#fff' }]}>{d}</Text>
                  </View>
                  {dayEvs.slice(0, 2).map((ev, i) => (
                    <View key={i} style={styles.monthEventChip}>
                      <Text style={styles.monthEventChipText} numberOfLines={1}>{ev.name}</Text>
                    </View>
                  ))}
                  {dayEvs.length > 2 && <Text style={styles.monthMoreText}>+{dayEvs.length - 2} more</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  };

  // ── Week / Day grid view ──
  const renderTimeGrid = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* All Day row */}
      <View style={[styles.allDayRow, { borderColor: bdr, backgroundColor: card }]}>
        <View style={styles.timeLabel}><Text style={[styles.timeLabelText, { color: sub }]}>All Day / Tasks</Text></View>
        {weekDays.map((d, i) => (
          <View key={i} style={[styles.dayCol, { borderColor: bdr }]}>
            {eventsForDay(d).filter(e => {
              try { const ed = new Date(e.eventTimestamp || e.eventDate); return isNaN(ed.getHours()); } catch { return true; }
            }).map((ev, j) => (
              <View key={j} style={styles.allDayEvent}>
                <Text style={styles.allDayEventText} numberOfLines={1}>{ev.name}</Text>
              </View>
            ))}
            {eventsForDay(d).length === 0 && <Text style={[styles.noTasksText, { color: sub }]}>No tasks</Text>}
          </View>
        ))}
      </View>

      {/* Hourly rows */}
      {HOURS.map(hour => (
        <View key={hour} style={[styles.hourRow, { borderColor: bdr }]}>
          <View style={styles.timeLabel}>
            <Text style={[styles.timeLabelText, { color: sub }]}>{String(hour).padStart(2,'0')}:00</Text>
          </View>
          {weekDays.map((d, di) => {
            const hourEvs = eventsForHour(d, hour);
            const isNow = d.toDateString() === today.toDateString() && today.getHours() === hour;
            // Check if this cell is in the past
            const cellTime = new Date(d);
            cellTime.setHours(hour, 0, 0, 0);
            const isPast = cellTime.getTime() < new Date().getTime() && !isNow;
            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.dayCol,
                  { borderColor: bdr },
                  isNow && styles.currentHourCol,
                  isPast && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
                ]}
                onPress={() => {
                  // Silently ignore taps on past cells (no popup)
                  if (isPast) return;
                  const nd = new Date(d);
                  nd.setHours(hour, 0, 0, 0);
                  openModal(nd);
                }}
                activeOpacity={isPast ? 1 : 0.7}
              >
                {hourEvs.map((ev, ei) => (
                  <TouchableOpacity key={ei} style={styles.eventBlock} onLongPress={() => deleteEvent(ev.id)}>
                    <Text style={styles.eventBlockText} numberOfLines={2}>{ev.name}</Text>
                    <Text style={styles.eventBlockTime}>{new Date(ev.eventTimestamp || ev.eventDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                  </TouchableOpacity>
                ))}
                {isNow && <View style={styles.currentTimeLine} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D0D0F' : '#fff'} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Calendar" />
          <TouchableOpacity
            style={styles.logoBox}
            onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}
            activeOpacity={0.7}
          >
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={[styles.brandName, { color: txt }]}>Calendar</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity
            style={[styles.navIconBtn, { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr }]}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: card, borderBottomColor: bdr }]}>
        {[
          { label: 'TOTAL',   value: totalEvents,  color: txt },
          { label: 'DONE',    value: doneEvents,   color: '#4ADE80' },
          { label: 'ACTIVE',  value: activeEvents, color: '#4ECDC4' },
          { label: 'PENDING', value: pendingEvents, color: '#FBBF24' },
        ].map((s, i, arr) => (
          <View key={s.label} style={[styles.statItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: bdr }]}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: sub }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Toolbar: Today · ‹ › · Date range · View switchers · New event */}
      <View style={[styles.toolbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.toolbarLeft}>
          <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.arrowBtn} onPress={goPrev}>
            <Text style={[styles.arrowText, { color: txt }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.arrowBtn} onPress={goNext}>
            <Text style={[styles.arrowText, { color: txt }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMiniCal(s => !s)} style={styles.dateRangeBtn}>
            <Text style={[styles.dateRange, { color: txt }]} numberOfLines={1}>{getHeaderLabel()}</Text>
            <Text style={{ fontSize: 10, color: sub, marginLeft: 4 }}>{showMiniCal ? '▲' : '▾'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.newEventBtn} onPress={() => openModal()}>
          <Text style={styles.newEventBtnText}>+ New event</Text>
        </TouchableOpacity>
      </View>

      {/* View mode switcher */}
      <View style={[styles.viewSwitcher, { backgroundColor: card, borderBottomColor: bdr }]}>
        {[
          { id: 'day',      label: 'Day' },
          { id: 'workWeek', label: 'Work Week' },
          { id: 'week',     label: 'Week' },
          { id: 'month',    label: 'Month' },
        ].map(v => (
          <TouchableOpacity
            key={v.id}
            style={[styles.viewBtn, viewMode === v.id && styles.viewBtnActive]}
            onPress={() => setViewMode(v.id)}
          >
            <Text style={[styles.viewBtnText, { color: viewMode === v.id ? '#1A1A2E' : sub }]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Ask Dyuksa AI input bar ── */}
      <View style={[ad.wrap, { backgroundColor: isDark ? '#1A1A20' : '#FFFFFF', borderColor: bdr }]}>
        <View style={[ad.inputBox, { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr }]}>
          <Text style={ad.icon}>✨</Text>
          <TextInput
            style={[ad.input, { color: txt }]}
            value={askDyuksaText}
            onChangeText={setAskDyuksaText}
            placeholder='Try: "dyuksa find 30 mins with Shifali tomorrow"'
            placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
            returnKeyType="send"
            onSubmitEditing={handleAskDyuksa}
            editable={!askDyuksaLoading}
          />
          <TouchableOpacity
            style={[ad.sendBtn, (!askDyuksaText.trim() || askDyuksaLoading) && { opacity: 0.5 }]}
            onPress={handleAskDyuksa}
            disabled={!askDyuksaText.trim() || askDyuksaLoading}
            activeOpacity={0.8}
          >
            {askDyuksaLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={ad.sendIcon}>➤</Text>
                <Text style={ad.sendText}>Ask Dyuksa</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content — full width now, no sidebar */}
      <View style={{ flex: 1 }}>

        {/* Mini calendar dropdown overlay */}
        {showMiniCal && (
          <View style={[styles.miniCalOverlay, { backgroundColor: card, borderColor: bdr }]}>
            {renderMiniCalendar()}
            {/* Status legend */}
            <View style={[styles.legend, { borderTopColor: bdr }]}>
              {[
                { label: 'Pending',     color: '#FBBF24' },
                { label: 'In Progress', color: '#4ECDC4' },
                { label: 'Completed',   color: '#4ADE80' },
                { label: 'Deployed',    color: '#3B82F6' },
                { label: 'Deferred',    color: '#888899' },
                { label: 'Review',      color: '#A78BFA' },
              ].map(s => (
                <View key={s.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.legendLabel, { color: sub }]}>{s.label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.miniCalClose}
              onPress={() => setShowMiniCal(false)}
            >
              <Text style={{ color: sub, fontSize: 12, fontWeight: '600' }}>Close ✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tap outside mini cal to close */}
        {showMiniCal && (
          <TouchableOpacity
            style={styles.miniCalBackdrop}
            activeOpacity={1}
            onPress={() => setShowMiniCal(false)}
          />
        )}
          {/* Day column headers */}
          {viewMode !== 'month' && (
            <View style={[styles.dayHeaders, { borderBottomColor: bdr, backgroundColor: card }]}>
              <View style={styles.timeLabel} />
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <View key={i} style={[styles.dayHeaderCell, { borderColor: bdr }]}>
                    <Text style={[styles.dayHeaderDay, { color: isToday ? '#4ECDC4' : sub }]}>
                      {DAY_LABELS[d.getDay()]}
                    </Text>
                    <TouchableOpacity
                      style={[styles.dayHeaderNum, isToday && styles.dayHeaderNumToday]}
                      onPress={() => openDailyPanel(d)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayHeaderNumText, { color: isToday ? '#fff' : txt }]}>
                        {d.getDate()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {viewMode === 'month' ? renderMonthView() : renderTimeGrid()}
      </View>

      {/* ── Daily Update Panel (right slide-in) ── */}
      {dailyPanelDate && (
        <>
          {/* Backdrop */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 99 }}
            activeOpacity={1}
            onPress={closeDailyPanel}
          />
          <Animated.View
            style={[
              du.panel,
              {
                backgroundColor: card,
                borderLeftColor: bdr,
                transform: [{
                  translateX: dailySlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SCREEN_WIDTH, 0],
                  }),
                }],
              },
            ]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              {/* Panel header */}
              <View style={[du.header, { borderBottomColor: bdr }]}>
                <Text style={[du.headerDate, { color: txt }]}>
                  {dailyPanelDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </Text>
                <TouchableOpacity
                  style={[du.closeBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                  onPress={closeDailyPanel}
                >
                  <Text style={[du.closeBtnText, { color: sub }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

                {/* Empty state (no tasks/events scheduled) */}
                <View style={[du.emptyCard, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
                  <Text style={du.emptyIcon}>📅</Text>
                  <Text style={[du.emptyText, { color: sub }]}>No tasks or events scheduled for this day</Text>
                </View>

                {/* Create Task CTA (moved to top, matching web) */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[du.createTaskTopBtn, { backgroundColor: isDark ? 'rgba(78,205,196,0.12)' : '#EEF2FF', borderColor: isDark ? 'rgba(78,205,196,0.3)' : '#C7D2FE' }]}
                    onPress={() => {
                      closeDailyPanel();
                      setTimeout(() => navigation.jumpTo('Tasks', { openCreateModal: true, returnTo: 'Calendar' }), 250);
                    }}
                  >
                    <Text style={[du.createTaskTopText, { color: isDark ? '#4ECDC4' : '#4F46E5' }]}>✓  Create Task</Text>
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: bdr, marginBottom: 14 }} />

                {/* ── Daily Update Section ── */}
                {dailyPanelDateClass === 'today' && !editingUpdate && !dailyUpdates[dateKey(dailyPanelDate)] && (
                  // Today, no update yet → show "+ Add Daily Update" button (image 3)
                  <TouchableOpacity
                    style={[du.addUpdateBtn, { backgroundColor: isDark ? 'rgba(78,205,196,0.12)' : '#EEF2FF', borderColor: isDark ? 'rgba(78,205,196,0.3)' : '#C7D2FE' }]}
                    onPress={() => setEditingUpdate(true)}
                  >
                    <Text style={[du.addUpdateText, { color: isDark ? '#4ECDC4' : '#4F46E5' }]}>📝  Add Daily Update</Text>
                  </TouchableOpacity>
                )}

                {dailyPanelDateClass === 'today' && !editingUpdate && dailyUpdates[dateKey(dailyPanelDate)] && (
                  // Today with submitted update → show readout + edit button
                  <View style={[du.updateCard, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
                    <View style={du.updateHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[du.updateTitle, { color: txt }]}>Daily Update</Text>
                        <Text style={[du.updateSubtitle, { color: '#4ECDC4' }]}>
                          {dailyPanelDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setEditingUpdate(true)}>
                        <Text style={[du.editLink, { color: '#4ECDC4' }]}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                    {renderUpdateField('Today\'s Priorities', dailyUpdates[dateKey(dailyPanelDate)].priorities, txt, sub)}
                    {renderUpdateField('Progress (Yesterday)', dailyUpdates[dateKey(dailyPanelDate)].progress, txt, sub)}
                    {renderUpdateField('Blockers / Needs', dailyUpdates[dateKey(dailyPanelDate)].blockers, txt, sub)}
                    {renderUpdateField('Upcoming', dailyUpdates[dateKey(dailyPanelDate)].upcoming, txt, sub)}
                  </View>
                )}

                {dailyPanelDateClass === 'today' && editingUpdate && (
                  // Today, editing → form (image 1)
                  <View>
                    <View style={du.formHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[du.updateTitle, { color: txt }]}>Daily Update</Text>
                        <Text style={[du.updateSubtitle, { color: '#4ECDC4' }]}>
                          {dailyPanelDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      </View>
                      {dailyUpdates[dateKey(dailyPanelDate)] && (
                        <TouchableOpacity onPress={() => setEditingUpdate(false)}>
                          <Text style={[du.editLink, { color: sub }]}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {renderUpdateInput('Today\'s Priorities:-', editPriorities, setEditPriorities, 'What are you focusing on today?', isDark, card, bdr, txt, sub)}
                    {renderUpdateInput('Progress (Yesterday):-', editProgress, setEditProgress, 'What did you accomplish yesterday?', isDark, card, bdr, txt, sub)}
                    {renderUpdateInput('Blockers / Needs:-', editBlockers, setEditBlockers, 'Any blockers or help needed?', isDark, card, bdr, txt, sub)}
                    {renderUpdateInput('Upcoming:-', editUpcoming, setEditUpcoming, 'What\'s coming up next?', isDark, card, bdr, txt, sub)}
                    <TouchableOpacity style={du.submitBtn} onPress={saveDailyUpdate}>
                      <Text style={du.submitBtnText}>➤  Submit Update</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {dailyPanelDateClass !== 'today' && (
                  // Past OR Future date → show greyed "Daily updates for today only" banner (image 2)
                  <View style={[du.disabledBanner, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
                    <Text style={[du.disabledBannerText, { color: sub }]}>📋  Daily updates for today only</Text>
                  </View>
                )}

                {/* ── Team Updates Section ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 }}>
                  <Text style={[du.sectionLabel, { color: sub, marginBottom: 0 }]}>TEAM UPDATES</Text>
                  {loadingUpdates && <ActivityIndicator size="small" color="#4ECDC4" />}
                </View>
                {(() => {
                  const teamList = teamUpdates[dateKey(dailyPanelDate)] || [];
                  if (teamList.length === 0) {
                    return (
                      <Text style={[du.noTeamText, { color: sub }]}>
                        {loadingUpdates ? 'Loading team updates…' : 'No team updates for this date yet.'}
                      </Text>
                    );
                  }
                  return teamList.map((u, idx) => (
                    <View
                      key={u.id || idx}
                      style={[du.teamCard, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                    >
                      <Text style={[du.teamName, { color: '#4ECDC4' }]}>{u.user_name}</Text>
                      {u.priorities ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[du.teamFieldLabel, { color: txt }]}>Today's Priorities</Text>
                          <Text style={[du.teamFieldValue, { color: sub }]}>{u.priorities}</Text>
                        </View>
                      ) : null}
                      {u.progress ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[du.teamFieldLabel, { color: txt }]}>Progress (Yesterday)</Text>
                          <Text style={[du.teamFieldValue, { color: sub }]}>{u.progress}</Text>
                        </View>
                      ) : null}
                      {u.blockers ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[du.teamFieldLabel, { color: txt }]}>Blockers / Needs</Text>
                          <Text style={[du.teamFieldValue, { color: sub }]}>{u.blockers}</Text>
                        </View>
                      ) : null}
                      {u.upcoming ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[du.teamFieldLabel, { color: txt }]}>Upcoming</Text>
                          <Text style={[du.teamFieldValue, { color: sub }]}>{u.upcoming}</Text>
                        </View>
                      ) : null}
                    </View>
                  ));
                })()}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </>
      )}

      {/* ── Create Event Modal ── */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal} statusBarTranslucent>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.topPanel, { backgroundColor: card, transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={[styles.handle, { backgroundColor: isDark ? '#3A3A48' : '#DEDEE8' }]} />
              <ScrollView style={styles.panelScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                <View style={styles.panelHeader}>
                  <Text style={[styles.modalTitle, { color: txt }]}>Create event</Text>
                  <TouchableOpacity
                    style={[styles.closeCircle, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                    onPress={closeModal}
                  >
                    <Text style={[styles.closeCircleText, { color: sub }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* ── Row: Date + Start — End Time ── */}
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={[styles.miniPickerBtn, { flex: 1.4, backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                    onPress={() => { setShowDatePicker(s => !s); setShowTimePicker(false); setShowEndTimePicker(false); }}
                  >
                    <Text style={[styles.miniPickerText, { color: txt }]} numberOfLines={1}>
                      📅  {pickerDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={[styles.miniPickerChevron, { color: sub }]}>▾</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniPickerBtn, { flex: 1, backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                    onPress={() => { setShowTimePicker(s => !s); setShowDatePicker(false); setShowEndTimePicker(false); }}
                  >
                    <Text style={[styles.miniPickerText, { color: txt }]}>
                      {pickerDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <Text style={[styles.miniPickerChevron, { color: sub }]}>▾</Text>
                  </TouchableOpacity>
                  <Text style={[styles.dash, { color: sub }]}>—</Text>
                  <TouchableOpacity
                    style={[styles.miniPickerBtn, { flex: 1, backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                    onPress={() => { setShowEndTimePicker(s => !s); setShowDatePicker(false); setShowTimePicker(false); }}
                  >
                    <Text style={[styles.miniPickerText, { color: txt }]}>
                      {endPickerDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <Text style={[styles.miniPickerChevron, { color: sub }]}>▾</Text>
                  </TouchableOpacity>
                </View>

                {/* Date Picker expanded */}
                {showDatePicker && (
                  <View style={[styles.pickerCard, { backgroundColor: card, borderColor: bdr }]}>
                    <DateTimePicker
                      value={tempPickerDate}
                      mode="date"
                      display="inline"
                      themeVariant={isDark ? 'dark' : 'light'}
                      minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                      onChange={(_, date) => { if (date) setTempPickerDate(date); }}
                      style={{ width: '100%' }}
                    />
                    <View style={[styles.pickerActions, { borderTopColor: bdr }]}>
                      <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowDatePicker(false)}>
                        <Text style={[styles.pickerCancelText, { color: sub }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => {
                        const nd  = new Date(tempPickerDate);
                        nd.setHours(pickerDate.getHours(), pickerDate.getMinutes());
                        const nde = new Date(nd);
                        nde.setHours(endPickerDate.getHours(), endPickerDate.getMinutes());
                        setPickerDate(nd);
                        setEndPickerDate(nde);
                        setShowDatePicker(false);
                      }}>
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Start Time Picker expanded */}
                {showTimePicker && (
                  <View style={[styles.pickerCard, { backgroundColor: card, borderColor: bdr }]}>
                    <DateTimePicker
                      value={tempPickerDate}
                      mode="time"
                      display="spinner"
                      themeVariant={isDark ? 'dark' : 'light'}
                      onChange={(_, date) => { if (date) setTempPickerDate(date); }}
                      style={{ width: '100%' }}
                    />
                    <View style={[styles.pickerActions, { borderTopColor: bdr }]}>
                      <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowTimePicker(false)}>
                        <Text style={[styles.pickerCancelText, { color: sub }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => {
                        const nd = new Date(pickerDate);
                        nd.setHours(tempPickerDate.getHours(), tempPickerDate.getMinutes());
                        setPickerDate(nd);
                        // Auto-adjust end time to be 30 min after new start if end is now before start
                        if (endPickerDate.getTime() <= nd.getTime()) {
                          const ne = new Date(nd);
                          ne.setMinutes(ne.getMinutes() + 30);
                          setEndPickerDate(ne);
                          setTempEndPickerDate(ne);
                        }
                        setShowTimePicker(false);
                      }}>
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* End Time Picker expanded */}
                {showEndTimePicker && (
                  <View style={[styles.pickerCard, { backgroundColor: card, borderColor: bdr }]}>
                    <DateTimePicker
                      value={tempEndPickerDate}
                      mode="time"
                      display="spinner"
                      themeVariant={isDark ? 'dark' : 'light'}
                      onChange={(_, date) => { if (date) setTempEndPickerDate(date); }}
                      style={{ width: '100%' }}
                    />
                    <View style={[styles.pickerActions, { borderTopColor: bdr }]}>
                      <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowEndTimePicker(false)}>
                        <Text style={[styles.pickerCancelText, { color: sub }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => {
                        const ne = new Date(pickerDate);
                        ne.setHours(tempEndPickerDate.getHours(), tempEndPickerDate.getMinutes());
                        // Block end time before or equal to start time
                        if (ne.getTime() <= pickerDate.getTime()) {
                          Alert.alert(
                            'Invalid end time',
                            'End time must be after the start time. Please pick a time later than ' +
                            pickerDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + '.',
                            [{ text: 'OK' }]
                          );
                          return;
                        }
                        setEndPickerDate(ne);
                        setShowEndTimePicker(false);
                      }}>
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Event Name */}
                <Text style={[styles.fieldLabel, { color: sub }]}>EVENT NAME</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt },
                  ]}
                  placeholder="Enter event name"
                  placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  value={eventName}
                  onChangeText={setEventName}
                />

                {/* Event Type Dropdown */}
                <Text style={[styles.fieldLabel, { color: sub }]}>EVENT TYPE</Text>
                <TouchableOpacity
                  style={[styles.typeTrigger, showTypeDropdown && styles.typeTriggerOpen]}
                  onPress={() => setShowTypeDropdown(s => !s)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>
                      {(EVENT_TYPES.find(t => t.id === eventType)?.icon) || '✏️'}
                    </Text>
                    <Text style={styles.typeTriggerText}>
                      {eventType === 'Other' ? (customType.trim() || 'Other') : eventType}
                    </Text>
                  </View>
                  <Text style={styles.typeTriggerChevron}>{showTypeDropdown ? '▲' : '▾'}</Text>
                </TouchableOpacity>

                {showTypeDropdown && (
                  <View style={[styles.typeDropdown, { backgroundColor: card, borderColor: bdr }]}>
                    {EVENT_TYPES.map((t, i) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.typeOption, eventType === t.id && styles.typeOptionActive]}
                        onPress={() => { setEventType(t.id); setShowTypeDropdown(false); }}
                      >
                        <Text style={{ fontSize: 16, marginRight: 10 }}>{t.icon}</Text>
                        <Text style={[styles.typeOptionText, { color: txt }, eventType === t.id && styles.typeOptionTextActive]}>
                          {t.label}
                        </Text>
                        {eventType === t.id && <Text style={styles.typeCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                    {/* Custom 'Other' input */}
                    <View style={[styles.typeCustomRow, { borderTopColor: bdr }]}>
                      <Text style={{ fontSize: 16, marginRight: 8 }}>✏️</Text>
                      <TextInput
                        style={[styles.typeCustomInput, { color: txt }]}
                        placeholder="Other (type custom name)"
                        placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                        value={customType}
                        onChangeText={t => { setCustomType(t); setEventType('Other'); }}
                        onFocus={() => setEventType('Other')}
                      />
                    </View>
                  </View>
                )}

                {/* Teams meeting toggle */}
                <TouchableOpacity
                  style={[
                    styles.teamsBtn,
                    { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr },
                    teamsMeeting && styles.teamsBtnOn,
                  ]}
                  onPress={() => setTeamsMeeting(v => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, marginRight: 8 }}>📹</Text>
                  <Text style={[styles.teamsBtnText, { color: sub }, teamsMeeting && styles.teamsBtnTextOn]}>
                    Teams meeting
                  </Text>
                  {teamsMeeting && <Text style={{ marginLeft: 8, color: '#4ECDC4', fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>

                {/* Description */}
                <Text style={[styles.fieldLabel, { color: sub }]}>DESCRIPTION</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt, height: 80, paddingTop: 12 },
                  ]}
                  placeholder="Let's discuss"
                  placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                  value={eventDesc}
                  onChangeText={setEventDesc}
                  multiline
                  textAlignVertical="top"
                />

                {/* Location */}
                <View style={[
                  styles.locationWrap,
                  { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr },
                ]}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <TextInput
                    style={[styles.locationInput, { color: txt }]}
                    placeholder="Add location (optional)"
                    placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                {/* Participants */}
                <View style={styles.participantsHeaderRow}>
                  <Text style={[styles.fieldLabel, { color: sub }]}>PARTICIPANTS</Text>
                  <TouchableOpacity onPress={() => setShowParticipants(s => !s)}>
                    <Text style={styles.participantsToggle}>
                      {showParticipants ? 'Hide' : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Selected participant chips */}
                {participants.length > 0 ? (
                  <View style={styles.participantChipsRow}>
                    {participants.map(p => (
                      <View key={p.id} style={styles.participantChip}>
                        <View style={styles.participantChipAvatar}>
                          <Text style={styles.participantChipAvatarText}>{p.avatar}</Text>
                        </View>
                        <Text style={[styles.participantChipName, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>{p.name}</Text>
                        <TouchableOpacity onPress={() => toggleParticipant({ id: p.id, first_name: p.name })}>
                          <Text style={[styles.participantChipRemove, { color: sub }]}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  !showParticipants && (
                    <View style={[
                      styles.noParticipants,
                      { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr },
                    ]}>
                      <Text style={styles.noParticipantsIcon}>👥</Text>
                      <Text style={[styles.noParticipantsText, { color: sub }]}>No participants yet</Text>
                    </View>
                  )
                )}

                {/* Participants picker */}
                {showParticipants && (
                  <View style={[
                    styles.participantsPicker,
                    { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr },
                  ]}>
                    <TextInput
                      style={[
                        styles.participantSearchInput,
                        { backgroundColor: card, borderColor: bdr, color: txt },
                      ]}
                      placeholder="Search users..."
                      placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                      value={participantSearch}
                      onChangeText={setParticipantSearch}
                    />
                    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                      {filteredUsers.length === 0 ? (
                        <Text style={[styles.noUsersText, { color: sub }]}>No users found</Text>
                      ) : (
                        filteredUsers.map(u => {
                          const isSelected = participants.some(p => p.id === u.id);
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[styles.userRow, { borderBottomColor: bdr }]}
                              onPress={() => toggleParticipant(u)}
                            >
                              <View style={styles.userAvatar}>
                                <Text style={styles.userAvatarText}>
                                  {((u.first_name || u.username || 'U')[0] || 'U').toUpperCase()}
                                </Text>
                              </View>
                              <Text style={[styles.userName, { color: txt }]}>{u.first_name || u.username || 'User'}</Text>
                              <View style={[
                                styles.userCheckbox,
                                { borderColor: isDark ? '#3A3A48' : '#DEDEE8' },
                                isSelected && styles.userCheckboxActive,
                              ]}>
                                {isSelected && <Text style={styles.userCheckmark}>✓</Text>}
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Alert info */}
                <View style={styles.alertInfoBox}>
                  <Text style={styles.alertInfoText}>
                    🔔  {participants.length > 0
                      ? `${participants.length} participant${participants.length > 1 ? 's' : ''} will be notified 1 hour before`
                      : "You'll receive an alert 1 hour before this event"}
                  </Text>
                </View>

                {/* Buttons */}
                <View style={[styles.modalBtns, { marginBottom: 28 }]}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: bdr, backgroundColor: card }]}
                    onPress={closeModal}
                  >
                    <Text style={[styles.cancelBtnText, { color: sub }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveEvent}>
                    <Text style={styles.saveBtnText}>Create event</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}

      {/* ── Ask Dyuksa: AI slot-picker modal ── */}
      {aiSuggestion && (
        <Modal transparent visible animationType="fade" onRequestClose={closeAiModal}>
          <TouchableOpacity style={aiStyles.backdrop} activeOpacity={1} onPress={closeAiModal} />
          <View style={aiStyles.center} pointerEvents="box-none">
            <View style={[aiStyles.sheet, { backgroundColor: card }]}>
              <View style={aiStyles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[aiStyles.title, { color: txt }]}>✦ Create Event</Text>
                  <Text style={aiStyles.subtitle}>Let Nova AI schedule this meeting</Text>
                </View>
                <TouchableOpacity onPress={closeAiModal} style={aiStyles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[aiStyles.closeTxt, { color: sub }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Editable title */}
                <Text style={[aiStyles.label, { color: sub }]}>Event name</Text>
                <TextInput
                  style={[aiStyles.textInput, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, color: txt }]}
                  value={aiEditTitle}
                  onChangeText={setAiEditTitle}
                  placeholder="Meeting title"
                  placeholderTextColor={sub}
                  editable={!aiSaving}
                />

                {/* Event type pill (read-only) */}
                <View style={aiStyles.pillRow}>
                  <View style={aiStyles.pill}><Text style={aiStyles.pillText}>👥 {aiSuggestion.event_type || 'Meeting'}</Text></View>
                </View>

                {/* Duration + Date pickers side-by-side */}
                <View style={aiStyles.pickerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[aiStyles.label, { color: sub, marginTop: 0 }]}>Duration</Text>
                    <TouchableOpacity
                      style={[aiStyles.pickerBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                      onPress={() => setShowDurationMenu(v => !v)}
                      disabled={aiSaving || aiSlotsLoading}
                    >
                      <Text style={{ color: txt, fontSize: 14, fontWeight: '600' }}>⏱ {aiEditDuration} min</Text>
                      <Text style={{ color: sub, fontSize: 12 }}>{showDurationMenu ? '▲' : '▾'}</Text>
                    </TouchableOpacity>
                    {showDurationMenu && (
                      <View style={[aiStyles.durationMenu, { backgroundColor: card, borderColor: bdr }]}>
                        {[15, 30, 45, 60, 90].map(opt => (
                          <TouchableOpacity
                            key={opt}
                            style={[aiStyles.durationItem, { borderBottomColor: bdr }, aiEditDuration === opt && { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                            onPress={() => {
                              setShowDurationMenu(false);
                              if (opt === aiEditDuration) return;
                              setAiEditDuration(opt);
                              refetchAiSlots(opt, null);
                            }}
                          >
                            <Text style={{ color: aiEditDuration === opt ? '#7C3AED' : txt, fontWeight: aiEditDuration === opt ? '700' : '500' }}>
                              {opt} min
                            </Text>
                            {aiEditDuration === opt && <Text style={{ color: '#7C3AED', fontSize: 14 }}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[aiStyles.label, { color: sub, marginTop: 0 }]}>Date</Text>
                    <TouchableOpacity
                      style={[aiStyles.pickerBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                      onPress={() => setShowAiDatePicker(true)}
                      disabled={aiSaving || aiSlotsLoading}
                    >
                      <Text style={{ color: txt, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                        📅 {aiEditDate ? aiFormatTargetDate(aiEditDate) : 'Pick date'}
                      </Text>
                      <Text style={{ color: sub, fontSize: 12 }}>▾</Text>
                    </TouchableOpacity>
                    {showAiDatePicker && (
                      <DateTimePicker
                        value={aiEditDate ? new Date(aiEditDate + 'T00:00:00') : new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        minimumDate={new Date()}
                        onChange={(ev, d) => {
                          if (Platform.OS === 'android') setShowAiDatePicker(false);
                          if (ev.type === 'dismissed') { setShowAiDatePicker(false); return; }
                          if (d) {
                            const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                            if (iso === aiEditDate) { setShowAiDatePicker(false); return; }
                            setAiEditDate(iso);
                            setShowAiDatePicker(false);
                            refetchAiSlots(null, iso);
                          }
                        }}
                      />
                    )}
                  </View>
                </View>

                {/* Attendees */}
                {Array.isArray(aiSuggestion.attendee_names) && aiSuggestion.attendee_names.length > 0 && (
                  <>
                    <Text style={[aiStyles.label, { color: sub }]}>Participants</Text>
                    <View style={aiStyles.attendeeRow}>
                      {aiSuggestion.attendee_names.map((n, i) => (
                        <View key={`${n}_${i}`} style={[aiStyles.attendee, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}>
                          <View style={aiStyles.avatar}>
                            <Text style={aiStyles.avatarText}>{aiInitials(n)}</Text>
                          </View>
                          <Text style={[aiStyles.attendeeName, { color: txt }]} numberOfLines={1}>{n}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* Slot chips — 4 per row */}
                <View style={aiStyles.slotsHeader}>
                  <Text style={[aiStyles.label, { color: sub, marginTop: 0 }]}>
                    Available slots ({aiSuggestion.available_slots?.length || 0}) · tap to select
                  </Text>
                  {aiSlotsLoading && <ActivityIndicator color="#7C3AED" size="small" />}
                </View>

                {(aiSuggestion.available_slots || []).length > 0 ? (
                  <View style={aiStyles.slotGrid}>
                    {aiSuggestion.available_slots.map(slot => {
                      const active = slot === aiSelectedSlot;
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[aiStyles.slotChip, active && aiStyles.slotChipActive]}
                          onPress={() => setAiSelectedSlot(slot)}
                          activeOpacity={0.7}
                          disabled={aiSaving || aiSlotsLoading}
                        >
                          <Text style={[aiStyles.slotChipText, active && aiStyles.slotChipTextActive]}>
                            {aiFormatSlotTime(slot)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  !aiSlotsLoading && (
                    <View style={aiStyles.noSlotsBox}>
                      <Text style={{ fontSize: 13, color: sub, textAlign: 'center' }}>
                        No free slots on this date. Try a different date or duration.
                      </Text>
                    </View>
                  )
                )}

                <View style={aiStyles.infoCard}>
                  <Text style={aiStyles.infoText}>✦ Event will be created as an online meeting with all participants invited.</Text>
                </View>
              </ScrollView>

              {/* Action buttons */}
              <View style={aiStyles.btnRow}>
                <TouchableOpacity
                  style={[aiStyles.cancelBtn, { borderColor: bdr }]}
                  onPress={closeAiModal}
                  disabled={aiSaving}
                >
                  <Text style={[aiStyles.cancelTxt, { color: sub }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[aiStyles.createBtn, (aiSaving || !aiSelectedSlot) && { opacity: 0.5 }]}
                  onPress={confirmAiEvent}
                  disabled={aiSaving || aiSlotsLoading || !aiSelectedSlot}
                >
                  {aiSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={aiStyles.createTxt}>✦ Create Event</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ── Daily Update helpers ───────────────────────────────────────────
function renderUpdateField(label, value, txt, sub) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={[du.updateFieldLabel, { color: txt }]}>{label}</Text>
      <Text style={[du.updateFieldValue, { color: value ? sub : '#AAAABC', fontStyle: value ? 'normal' : 'italic' }]}>
        {value || '— pending —'}
      </Text>
    </View>
  );
}

function renderUpdateInput(label, value, onChange, placeholder, isDark, card, bdr, txt, sub) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[du.updateFieldLabel, { color: txt }]}>{label}</Text>
      <TextInput
        style={[
          du.updateInput,
          { backgroundColor: card, borderColor: bdr, color: txt },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

// Daily Update Panel styles
// Ask Dyuksa AI bar styles
const ad = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    height: 44,
    gap: 6,
  },
  icon: { fontSize: 14, marginRight: 2 },
  input: { flex: 1, fontSize: 13, paddingVertical: 0 },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8B5CF6',   // purple like web
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
  },
  sendIcon: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sendText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

const du = StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: SCREEN_WIDTH,
    borderLeftWidth: 1,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24),
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerDate: { flex: 1, fontSize: 15, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '600' },

  emptyCard: {
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, marginBottom: 12,
    gap: 6,
  },
  emptyIcon: { fontSize: 32, opacity: 0.4 },
  emptyText: { fontSize: 12, textAlign: 'center' },

  editTriggerBtn: {
    paddingVertical: 14, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', marginBottom: 14,
  },
  editTriggerText: { fontSize: 14, fontWeight: '600' },

  updateCard: {
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14,
  },
  updateHeaderRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8,
  },
  formHeader: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10,
  },
  updateTitle: { fontSize: 14, fontWeight: '700' },
  updateSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  editLink: { fontSize: 14, fontWeight: '700' },

  updateFieldLabel: { fontSize: 12, fontWeight: '700' },
  updateFieldValue: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  updateInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10,
    fontSize: 13, minHeight: 56, marginTop: 4,
  },

  // "Add Daily Update" button (shows when today and no update yet)
  addUpdateBtn: {
    paddingVertical: 14, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', marginBottom: 14,
  },
  addUpdateText: { fontSize: 14, fontWeight: '700' },

  // Submit Update button (in the form)
  submitBtn: {
    backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', marginTop: 14,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Disabled banner for past/future dates
  disabledBanner: {
    padding: 14, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', marginBottom: 14,
  },
  disabledBannerText: { fontSize: 13, fontWeight: '500' },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  noTeamText: { fontSize: 12, textAlign: 'center', fontStyle: 'italic', paddingVertical: 14 },

  // Team Update card
  teamCard: {
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10,
  },
  teamName: { fontSize: 13, fontWeight: '700' },
  teamFieldLabel: { fontSize: 11, fontWeight: '700' },
  teamFieldValue: { fontSize: 12, lineHeight: 16, marginTop: 2 },

  // Create Task button at top
  createTaskTopBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
  },
  createTaskTopText: { fontSize: 14, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },

  // Stats
  statsBar: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },

  // Toolbar
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  todayBtn: { backgroundColor: '#1A1A2E', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  todayBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  arrowBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  arrowText: { fontSize: 22, fontWeight: '300' },
  dateRange: { fontSize: 13, fontWeight: '600' },
  newEventBtn: { backgroundColor: '#4ECDC4', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  newEventBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // View switcher
  viewSwitcher: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: 'transparent' },
  viewBtnActive: { backgroundColor: '#F0F0F5', borderColor: '#DEDEE8' },
  viewBtnText: { fontSize: 12, fontWeight: '500' },

  // Sidebar
  miniCalOverlay: { position: 'absolute', top: 0, left: 0, width: 300, borderRadius: 12, borderWidth: 1, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 20, padding: 8 },
  miniCalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 },
  miniCalClose: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F5', marginTop: 6 },
  dateRangeBtn: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniCal: { padding: 8, borderRadius: 10, margin: 4, borderWidth: 1 },
  miniCalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  miniArrow: { fontSize: 22, fontWeight: '600', paddingHorizontal: 6 },
  miniMonthLabel: { fontSize: 15, fontWeight: '700' },
  miniDayRow: { flexDirection: 'row', marginBottom: 6 },
  miniDayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  miniDatesGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  miniDateCell: { width: '14.28%', alignItems: 'center', paddingVertical: 3 },
  miniDateCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  miniDateToday: { backgroundColor: '#1A1A2E' },
  miniDateSelected: { borderWidth: 1.5, borderColor: '#4ECDC4' },
  miniDateText: { fontSize: 13, fontWeight: '500' },
  miniDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4ECDC4', marginTop: 1 },

  legend: { borderTopWidth: 1, paddingTop: 10, paddingHorizontal: 10, gap: 7, flexDirection: 'row', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '48%' },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontSize: 12, fontWeight: '500' },

  // Calendar grid
  dayHeaders: { flexDirection: 'row', borderBottomWidth: 1 },
  timeLabel: { width: 48, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 },
  timeLabelText: { fontSize: 10, fontWeight: '500' },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 7, borderLeftWidth: 1 },
  dayHeaderDay: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  dayHeaderNum: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  dayHeaderNumToday: { backgroundColor: '#4ECDC4' },
  dayHeaderNumText: { fontSize: 14, fontWeight: '700' },

  // All day row
  allDayRow: { flexDirection: 'row', minHeight: 36, borderBottomWidth: 1 },
  dayCol: { flex: 1, borderLeftWidth: 1, minHeight: 56, padding: 2 },
  noTasksText: { fontSize: 9, textAlign: 'center', marginTop: 6 },
  allDayEvent: { backgroundColor: '#4ECDC420', borderRadius: 4, padding: 2, marginBottom: 2 },
  allDayEventText: { fontSize: 9, color: '#4ECDC4', fontWeight: '600' },

  // Hour rows
  hourRow: { flexDirection: 'row', minHeight: 56, borderBottomWidth: 1 },
  currentHourCol: { backgroundColor: 'rgba(78,205,196,0.04)' },
  currentTimeLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: '#4ECDC4', borderRadius: 1 },
  eventBlock: { backgroundColor: '#4ECDC4', borderRadius: 4, padding: 4, marginBottom: 2 },
  eventBlockText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  eventBlockTime: { fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  // Month view
  monthGrid: { margin: 8, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  monthDayRow: { flexDirection: 'row', paddingVertical: 6 },
  monthDayLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600' },
  monthDates: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: '14.28%', minHeight: 60, borderTopWidth: 1, padding: 3 },
  monthDateCircle: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  monthDateText: { fontSize: 11, fontWeight: '500' },
  monthEventChip: { backgroundColor: '#4ECDC420', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginTop: 1 },
  monthEventChipText: { fontSize: 8, color: '#4ECDC4', fontWeight: '600' },
  monthMoreText: { fontSize: 8, color: '#888899', marginTop: 1 },

  // Modal
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topPanel: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxHeight: '92%', paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24), shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  panelScroll: { paddingHorizontal: 20 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 14, height: 50, marginBottom: 10 },
  pickerBtnText: { fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  pickerChevron: { fontSize: 13, color: '#888899' },
  pickerCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EBEBF0', marginBottom: 14, overflow: 'hidden', alignItems: 'center' },
  pickerActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EBEBF0', width: '100%' },
  pickerCancelBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  pickerCancelText: { fontSize: 14, color: '#888899', fontWeight: '500' },
  pickerDoneBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1A1A2E', borderRadius: 8 },
  pickerDoneText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  alertInfoBox: { backgroundColor: 'rgba(78,205,196,0.08)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.3)', borderRadius: 10, padding: 12, marginBottom: 14 },
  alertInfoText: { fontSize: 12, color: '#4ECDC4', fontWeight: '500', lineHeight: 18 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
  saveBtn: { flex: 1, height: 48, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Date + Time row
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  miniPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1,
    borderColor: '#EBEBF0', paddingHorizontal: 10, height: 40,
  },
  miniPickerText: { fontSize: 13, color: '#1A1A2E', fontWeight: '500' },
  miniPickerChevron: { fontSize: 10, color: '#888899', marginLeft: 4 },
  dash: { color: '#AAAABC', fontSize: 16, fontWeight: '500' },

  // Event type
  typeTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(100,140,255,0.08)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(100,140,255,0.25)',
    paddingHorizontal: 14, height: 48, marginBottom: 8,
  },
  typeTriggerOpen: { borderColor: '#648CFF' },
  typeTriggerText: { fontSize: 14, color: '#4A6FDB', fontWeight: '600' },
  typeTriggerChevron: { fontSize: 12, color: '#4A6FDB' },
  typeDropdown: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#EBEBF0',
    paddingVertical: 4, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  typeOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  typeOptionActive: { backgroundColor: 'rgba(100,140,255,0.08)' },
  typeOptionText: { flex: 1, fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  typeOptionTextActive: { color: '#4A6FDB', fontWeight: '700' },
  typeCheck: { color: '#4A6FDB', fontSize: 16, fontWeight: '700' },
  typeCustomRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F0F0F5',
  },
  typeCustomInput: {
    flex: 1, fontSize: 14, color: '#1A1A2E',
    paddingVertical: 6,
  },

  // Teams button
  teamsBtn: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#EBEBF0',
    borderRadius: 10, paddingHorizontal: 14, height: 40,
    marginBottom: 14, backgroundColor: '#FAFAFA',
  },
  teamsBtnOn: {
    borderColor: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.08)',
  },
  teamsBtnText: { fontSize: 13, color: '#5C5C6E', fontWeight: '600' },
  teamsBtnTextOn: { color: '#4ECDC4' },

  // Location
  locationWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F7', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#EBEBF0',
    paddingHorizontal: 14, height: 48, marginBottom: 14,
  },
  locationIcon: { fontSize: 14, marginRight: 8 },
  locationInput: { flex: 1, fontSize: 14, color: '#1A1A2E' },

  // Participants
  participantsHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, marginTop: 4,
  },
  participantsToggle: {
    fontSize: 13, color: '#4ECDC4', fontWeight: '700',
  },
  noParticipants: {
    alignItems: 'center', paddingVertical: 18, gap: 6,
    backgroundColor: '#FAFAFA',
    borderRadius: 10, borderWidth: 1, borderColor: '#F0F0F5',
    marginBottom: 14,
  },
  noParticipantsIcon: { fontSize: 26, opacity: 0.3 },
  noParticipantsText: { fontSize: 12, color: '#AAAABC' },
  participantChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14,
  },
  participantChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(78,205,196,0.1)',
    borderRadius: 16, paddingLeft: 4, paddingRight: 10, paddingVertical: 3,
  },
  participantChipAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center',
  },
  participantChipAvatarText: { color: '#4ECDC4', fontSize: 10, fontWeight: '700' },
  participantChipName: { fontSize: 12, color: '#1A1A2E', fontWeight: '600' },
  participantChipRemove: { color: '#888899', fontSize: 11, fontWeight: '700', paddingHorizontal: 2 },
  participantsPicker: {
    backgroundColor: '#FAFAFA', borderRadius: 10,
    borderWidth: 1, borderColor: '#EBEBF0',
    padding: 10, marginBottom: 14,
  },
  participantSearchInput: {
    backgroundColor: '#fff', borderRadius: 8,
    borderWidth: 1, borderColor: '#EBEBF0',
    paddingHorizontal: 12, height: 40,
    fontSize: 13, color: '#1A1A2E', marginBottom: 8,
  },
  noUsersText: {
    textAlign: 'center', paddingVertical: 12,
    fontSize: 12, color: '#AAAABC',
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  userAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  userAvatarText: { color: '#4ECDC4', fontSize: 12, fontWeight: '700' },
  userName: { flex: 1, fontSize: 13, color: '#1A1A2E', fontWeight: '500' },
  userCheckbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#DEDEE8',
    justifyContent: 'center', alignItems: 'center',
  },
  userCheckboxActive: {
    backgroundColor: '#4ECDC4', borderColor: '#4ECDC4',
  },
  userCheckmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// ── Ask Dyuksa modal styles ──
const aiStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  sheet: {
    width: '100%', maxWidth: 420, borderRadius: 16,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, color: '#A78BFA', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(150,150,170,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { fontSize: 16, fontWeight: '600' },

  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6, marginTop: 6 },
  readonly: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  textInput: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, fontWeight: '600', marginBottom: 14,
    minHeight: 44,
  },

  pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 44,
  },
  durationMenu: {
    position: 'absolute', top: 72, left: 0, right: 0, zIndex: 10,
    borderRadius: 10, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  durationItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill: {
    backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  pillText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },

  attendeeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  attendee: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20 },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 9, fontWeight: '700', color: '#7C3AED' },
  attendeeName: { fontSize: 12, fontWeight: '500', maxWidth: 120 },

  slotsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  // 4 chips per row — computed for a sheet that's ~360px wide (maxWidth 420 - 2*20 padding = 380; 4 chips * width + 3 gaps of 6 = 380 → width ~88)
  slotChip: {
    width: '23.5%',
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
    alignItems: 'center',
  },
  slotChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  slotChipText: { fontSize: 12, fontWeight: '600', color: '#15803D' },
  slotChipTextActive: { color: '#FFFFFF' },
  noSlotsBox: {
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(150,150,170,0.3)',
    padding: 16, marginBottom: 4,
  },

  infoCard: {
    backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
    borderRadius: 10, padding: 12, marginTop: 14, marginBottom: 4,
  },
  infoText: { fontSize: 12, color: '#A78BFA', lineHeight: 18 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, height: 46, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { fontSize: 14, fontWeight: '600' },
  createBtn: { flex: 1.3, backgroundColor: '#7C3AED', borderRadius: 10, height: 46, justifyContent: 'center', alignItems: 'center' },
  createTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
