import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, StatusBar, Platform, Alert, Animated, Dimensions, ActivityIndicator,
  KeyboardAvoidingView, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import React, { useState, useCallback, useContext, useRef, useEffect } from 'react';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SidebarMenu from '../../components/SidebarMenu';
import TaskDetailModal from '../../components/TaskDetailModal';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import { NotificationsContext } from '../../context/NotificationsContext';
import { getUsers, getAccessToken, getWorkspaceId } from '../../services/ApiService';
import * as Notifications from 'expo-notifications';

import { BASE_URL, WS_BASE, WEB_BASE } from '../../config';
const SCREEN_WIDTH = Dimensions.get('window').width;
const DAILY_UPDATE_STORAGE_KEY = 'DYUKSA_DAILY_UPDATES'; // local cache: { 'YYYY-MM-DD': { priorities, progress, blockers, upcoming } }
const DAILY_UPDATE_API = `${BASE_URL}/daily-updates/`;
const EVENTS_API       = `${BASE_URL}/daily-updates/events/`;
const TASKS_API        = `${BASE_URL}/tasksite/`;

const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 to 22:00
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_COLORS = { pending: '#FBBF24', in_progress: '#3B72EE', completed: '#4ADE80', deployed: '#3B82F6', deferred: '#888899', review: '#A78BFA' };
const EVENT_TYPES = [
  { id: 'Meeting',   label: 'Meeting',   color: '#2D6AE3', soft: '#E6EEFC' },
  { id: 'Review',    label: 'Review',    color: '#A78BFA', soft: '#EEEAFE' },
  { id: 'Interview', label: 'Interview', color: '#F59E0B', soft: '#FEF3CE' },
  { id: 'Training',  label: 'Training',  color: '#22A06B', soft: '#E2F5EC' },
  { id: 'Webinar',   label: 'Webinar',   color: '#E5484D', soft: '#FBE3E3' },
  { id: 'Other',     label: 'Other',     color: '#6B7588', soft: '#F0F2F6' },
];

const getEventColor = (ev) => {
  if (!ev) return '#3B72EE';
  const rawType = (ev.event_type || ev.eventType || '').toLowerCase();
  const found = EVENT_TYPES.find(t => t.id.toLowerCase() === rawType);
  return found ? found.color : (ev.type === 'task' ? '#3B72EE' : '#2D6AE3');
};

// ── Custom 3-column wheel time picker ──────────────────────────────────────
// Identical look on iOS + Android. Each column is a snap-scrolling ScrollView
// with vertical padding so the selected row sits in the middle of the wheel.
// `value` is a Date; `onChange(newDate)` fires whenever the wheel settles.
const WHEEL_ITEM_HEIGHT = 36;
const WHEEL_VISIBLE_COUNT = 5; // 2 above + 1 selected + 2 below
function WheelColumn({ data, selectedIndex, onChange, txtColor, subColor, accent }) {
  const ref = React.useRef(null);
  const lastIndexRef = React.useRef(selectedIndex);
  // Set initial scroll position once after mount (ScrollView has no initialScrollIndex)
  React.useEffect(() => {
    // Defer one tick to make sure the ScrollView has measured before scrolling
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_HEIGHT, animated: false });
      lastIndexRef.current = selectedIndex;
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Sync external changes (e.g. user changes hour → AM/PM may roll)
  React.useEffect(() => {
    if (lastIndexRef.current !== selectedIndex && ref.current) {
      ref.current.scrollTo({
        y: selectedIndex * WHEEL_ITEM_HEIGHT,
        animated: true,
      });
      lastIndexRef.current = selectedIndex;
    }
  }, [selectedIndex]);

  const handleMomentumEnd = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / WHEEL_ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    if (clamped !== lastIndexRef.current) {
      lastIndexRef.current = clamped;
      onChange(clamped);
    }
    // Snap exactly (in case it landed slightly off)
    ref.current?.scrollTo({ y: clamped * WHEEL_ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={{ height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_COUNT, width: '100%' }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={{
          paddingTop: WHEEL_ITEM_HEIGHT * 2,
          paddingBottom: WHEEL_ITEM_HEIGHT * 2,
        }}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {data.map((item, index) => {
          const distance = Math.abs(index - selectedIndex);
          const isSelected = index === selectedIndex;
          const opacity = isSelected ? 1 : Math.max(0.25, 1 - distance * 0.30);
          return (
            <View key={index} style={{ height: WHEEL_ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{
                fontSize: isSelected ? 22 : 18,
                fontWeight: isSelected ? '700' : '400',
                color: isSelected ? (accent || txtColor) : txtColor,
                opacity,
              }}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function WheelTimePicker({ value, onChange, txtColor, subColor, bdrColor, accent = '#3B72EE' }) {
  // Derive 12-hour display values
  const d = value instanceof Date ? value : new Date();
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours24 >= 12 ? 1 : 0; // 0=AM, 1=PM
  const hour12 = ((hours24 + 11) % 12) + 1; // 1-12

  const HOURS   = React.useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), []);
  const MINUTES = React.useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), []);
  const PERIODS = React.useMemo(() => ['AM', 'PM'], []);

  const updateTime = (h12, m, p) => {
    const newDate = new Date(value || Date.now());
    let h24 = h12 % 12;
    if (p === 1) h24 += 12; // PM
    newDate.setHours(h24, m, 0, 0);
    onChange(newDate);
  };

  return (
    <View style={{
      borderTopWidth: 1, borderBottomWidth: 1,
      borderColor: bdrColor || '#EBEBF0',
      backgroundColor: 'transparent',
      paddingVertical: 4,
      alignItems: 'center',     // centers the inner row
    }}>
      <View style={{
        flexDirection: 'row',
        width: 240,             // tight, centered group of 3 wheels
        position: 'relative',
      }}>
        {/* Selection highlight bar */}
        <View pointerEvents="none" style={{
          position: 'absolute',
          top:    WHEEL_ITEM_HEIGHT * 2,
          height: WHEEL_ITEM_HEIGHT,
          left: 0, right: 0,
          backgroundColor: (accent || '#3B72EE') + '12',
          borderRadius: 8,
        }} />
        <View style={{ width: 80 }}>
          <WheelColumn
            data={HOURS}
            selectedIndex={hour12 - 1}
            onChange={(i) => updateTime(i + 1, minutes, ampm)}
            txtColor={txtColor}
            subColor={subColor}
            accent={accent}
          />
        </View>
        <View style={{ width: 12, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: txtColor, fontWeight: '700', fontSize: 20 }}>:</Text>
        </View>
        <View style={{ width: 80 }}>
          <WheelColumn
            data={MINUTES}
            selectedIndex={minutes}
            onChange={(i) => updateTime(hour12, i, ampm)}
            txtColor={txtColor}
            subColor={subColor}
            accent={accent}
          />
        </View>
        <View style={{ width: 8 }} />
        <View style={{ width: 60 }}>
          <WheelColumn
            data={PERIODS}
            selectedIndex={ampm}
            onChange={(i) => updateTime(hour12, minutes, i)}
            txtColor={txtColor}
            subColor={subColor}
            accent={accent}
          />
        </View>
      </View>
    </View>
  );
}

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
  const [viewMode,    setViewMode]    = useState('workWeek'); // day | twoDay | workWeek | week | month
  const [showViewMenu, setShowViewMenu] = useState(false);
  // Where to place the dropdown — measured from the Today button's position
  // in window coordinates. We render the menu inside a Modal (so taps don't
  // get blocked by overlays), which means we need screen coords, not relative.
  const [viewMenuPos, setViewMenuPos] = useState({ top: 0, left: 12 });
  const todayBtnRef = useRef(null);
  const openViewMenu = () => {
    if (todayBtnRef.current?.measureInWindow) {
      todayBtnRef.current.measureInWindow((x, y, w, h) => {
        setViewMenuPos({ top: y + h + 4, left: Math.max(8, x) });
        setShowViewMenu(true);
      });
    } else {
      setShowViewMenu(true);
    }
  };
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showMiniCal, setShowMiniCal] = useState(false);
  const [miniYear,  setMiniYear]  = useState(today.getFullYear());
  const [miniMonth, setMiniMonth] = useState(today.getMonth());

  // ── Events ──
  const [events, setEvents] = useState([]);
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date()); // tapped date in month view
  const [selectedWeekDate,  setSelectedWeekDate]  = useState(new Date()); // tapped date in week/day view
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError,   setEventsError]   = useState(null);

  // ── Task stats for the header bar ──
  const [taskStats, setTaskStats] = useState({ total: 0, done: 0, active: 0, pending: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Event detail / edit modal ──
  const [detailEvent,    setDetailEvent]    = useState(null);   // event currently open
  const [editMode,       setEditMode]       = useState(false);
  const [savingEdit,     setSavingEdit]     = useState(false);
  // Draft fields used in edit mode (so cancel doesn't mutate the original event)
  const [editTitle,       setEditTitle]       = useState('');
  const [editType,        setEditType]        = useState('Meeting');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation,    setEditLocation]    = useState('');
  const [editOnline,      setEditOnline]      = useState(false);
  const [editStart,       setEditStart]       = useState(new Date());
  const [editEnd,         setEditEnd]         = useState(new Date());
  const [editAttendees,   setEditAttendees]   = useState([]);   // array of user ids
  const [showEditDate,    setShowEditDate]    = useState(false);
  const [showEditStart,   setShowEditStart]   = useState(false);
  const [showEditEnd,     setShowEditEnd]     = useState(false);
  // Drafts so the spinner can update freely without re-rendering its `value` prop
  const [draftDate,       setDraftDate]       = useState(new Date());
  const [draftStart,      setDraftStart]      = useState(new Date());
  const [draftEnd,        setDraftEnd]        = useState(new Date());
  const [showEditTypeMenu,    setShowEditTypeMenu]    = useState(false);
  const [showEditAttendees,   setShowEditAttendees]   = useState(false);
  const [editAttendeeSearch, setEditAttendeeSearch]   = useState('');

  // ── Modal ──
  const [modalVisible,   setModalVisible]   = useState(false);
  const [eventName,      setEventName]      = useState('');
  const [eventDesc,      setEventDesc]      = useState('');

  // Track keyboard height so modals can scroll past it (works inside absolutely-positioned Modal)
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setKbHeight(e?.endCoordinates?.height || 0);
    const onHide = () => setKbHeight(0);
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => { s.remove(); h.remove(); };
  }, []);

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
  // AI participants picker
  const [aiPickerOpen,   setAiPickerOpen]   = useState(false);
  const [aiPickerSearch, setAiPickerSearch] = useState('');

  // ── Fetch task stats for header bar ──
  const fetchTaskStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const token       = await getAccessToken();
      const workspaceId = await getWorkspaceId();
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
      if (workspaceId) headers['X-Workspace-ID'] = workspaceId;

      const res = await fetch(`${BASE_URL}/tasksite/`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const tasks = Array.isArray(data) ? data : (data.results || []);

      setTaskStats({
        total:   tasks.length,
        done:    tasks.filter(t => t.status === 'completed' || t.status === 'deployed').length,
        active:  tasks.filter(t => t.status === 'in_progress').length,
        pending: tasks.filter(t => t.status === 'pending' || t.status === 'backlog' || t.status === 'review' || t.status === 'deferred').length,
      });
    } catch (e) {
      console.warn('fetchTaskStats failed:', e.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const handleAskDyuksa = async () => {
    if (!askDyuksaText.trim()) return;
    setAskDyuksaLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/task-ai/chat/agent/`, {
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

  // ── Share modal helpers (local-state only for now) ──
  const shareSearchResults = () => {
    const q = (shareSearch || '').toLowerCase().trim();
    if (!q) return [];
    const alreadySharedIds = new Set(sharedWith.map(p => String(p.id)));
    return allUsers
      .filter(u => {
        if (!u?.id || alreadySharedIds.has(String(u.id))) return false;
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        return fullName.includes(q)
          || (u.username || '').toLowerCase().includes(q)
          || (u.email || '').toLowerCase().includes(q);
      })
      .slice(0, 6);
  };

  const addSharedPerson = (user) => {
    if (!user?.id) return;
    if (sharedWith.some(p => String(p.id) === String(user.id))) return;
    const today = new Date();
    const sharedAt = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const name = (user.first_name && user.last_name)
      ? `${user.first_name} ${user.last_name}`
      : (user.first_name || user.username || `User #${user.id}`);
    setSharedWith(prev => [...prev, { id: user.id, name, sharedAt, permission: 'view' }]);
    setShareSearch('');
  };

  const removeSharedPerson = (id) => {
    // Backend currently has no delete endpoint — show a friendly placeholder
    // until the API supports removal. (When the endpoint lands, swap this
    // with a fetch DELETE and the local state filter.)
    Alert.alert('Coming soon', 'Removing shared users will be available soon.');
    // Keep id in scope for when we wire the real delete:
    void id;
  };

  // Permission options (label = visible text, value = backend value)
  const PERMISSION_LABELS = { view: 'View only', edit: 'Can edit', full: 'Full access' };

  const setSharedPermission = (id, value) => {
    setSharedWith(prev => prev.map(p =>
      String(p.id) === String(id) ? { ...p, permission: value } : p
    ));
    setOpenPermDropdownId(null);
  };

  const closeAiModal = () => {
    setAiSuggestion(null);
    setAiSelectedSlot(null);
    setAiEditTitle('');
    setAiEditDuration(30);
    setAiEditDate('');
    setShowDurationMenu(false);
    setShowAiDatePicker(false);
    setAiPickerOpen(false);
    setAiPickerSearch('');
  };

  // ── AI participants — add/remove on the suggestion before creating ──
  // The AI returns `attendee_names` (display) and `attendee_ids` (sent to API).
  // We keep both arrays in sync so the chip list and the eventual POST body
  // both reflect the user's edits.
  const aiToggleParticipant = (user) => {
    if (!aiSuggestion || !user?.id) return;
    const ids   = Array.isArray(aiSuggestion.attendee_ids)   ? [...aiSuggestion.attendee_ids]   : [];
    const names = Array.isArray(aiSuggestion.attendee_names) ? [...aiSuggestion.attendee_names] : [];
    const displayName = (user.first_name && user.last_name)
      ? `${user.first_name} ${user.last_name}`.trim()
      : (user.first_name || user.username || 'User');
    const idx = ids.findIndex(id => String(id) === String(user.id));
    if (idx >= 0) {
      ids.splice(idx, 1);
      // Best-effort: drop the matching display name (by index if lists are aligned)
      if (names[idx] !== undefined) names.splice(idx, 1);
    } else {
      ids.push(user.id);
      names.push(displayName);
    }
    setAiSuggestion({ ...aiSuggestion, attendee_ids: ids, attendee_names: names });
  };

  const aiRemoveParticipantAt = (i) => {
    if (!aiSuggestion) return;
    const ids   = Array.isArray(aiSuggestion.attendee_ids)   ? [...aiSuggestion.attendee_ids]   : [];
    const names = Array.isArray(aiSuggestion.attendee_names) ? [...aiSuggestion.attendee_names] : [];
    if (i >= 0 && i < names.length) names.splice(i, 1);
    if (i >= 0 && i < ids.length)   ids.splice(i, 1);
    setAiSuggestion({ ...aiSuggestion, attendee_ids: ids, attendee_names: names });
  };

  // Filtered users for the AI picker — exclude already-added by id
  const aiFilteredUsers = () => {
    const q = (aiPickerSearch || '').toLowerCase().trim();
    const addedIds = new Set((aiSuggestion?.attendee_ids || []).map(String));
    return allUsers.filter(u => {
      if (!u?.id) return false;
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
      const match = !q || fullName.includes(q) || (u.username || '').toLowerCase().includes(q);
      // Show all matches (including already-added) so the user can see ✓ state
      return match;
    });
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
      const res = await fetch(`${BASE_URL}/task-ai/chat/agent/`, {
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
  // Tasks shown in the All Day / Tasks row
  const [tasks,           setTasks]           = useState([]);
  // Per-day expansion of the All Day / Tasks row. Keyed by 'YYYY-MM-DD'.
  const [expandedDays,    setExpandedDays]    = useState({});
  // Task tapped from the All Day / Tasks list — opens TaskDetailModal
  const [detailTask,      setDetailTask]      = useState(null);
  // Calendar-sharing controls (top-left of grid). UI only for now; backend
  // wiring will follow once the share endpoints are captured.
  const [shareModalOpen,  setShareModalOpen]  = useState(false);
  const [calendarShared,  setCalendarShared]  = useState(false);
  const [showSettingsDrop, setShowSettingsDrop] = useState(false);
  const [showSharedEvents, setShowSharedEvents] = useState(false);
  // Local-only state for the share modal — replaced with API data later.
  // Each entry shape: { id, name, sharedAt: 'DD/MM/YYYY', permission: 'view'|'edit'|'full' }
  const [sharedWith,      setSharedWith]      = useState([]);
  const [sharedWithMe,    setSharedWithMe]    = useState([]);
  const [shareSearch,     setShareSearch]     = useState('');
  const [publicLinkOn,    setPublicLinkOn]    = useState(false);
  // Which row's permission dropdown is open (null = none).
  const [openPermDropdownId, setOpenPermDropdownId] = useState(null);
  // Public link is generated locally for UI demo; replaced by server URL later.
  const publicLinkUrl = `${WEB_BASE}/calendar/shared/local-demo`;
  const slideAnim = useRef(new Animated.Value(600)).current;

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
  // Different backends return participants differently — accept any of:
  //   attendees, attendee_ids, participants, invitations, invitees
  // and any of: [1,2,3], [{id:1,...}], or [{user:1,...}] (Django invitation pattern).
  const extractAttendeeIds = (be) => {
    const candidate =
      (Array.isArray(be?.attendees)        && be.attendees) ||
      (Array.isArray(be?.attendee_ids)     && be.attendee_ids) ||
      (Array.isArray(be?.participants)     && be.participants) ||
      (Array.isArray(be?.invitations)      && be.invitations) ||
      (Array.isArray(be?.invitees)         && be.invitees) ||
      [];
    return candidate
      .map(item => {
        if (item == null) return null;
        // Plain id (number or string)
        if (typeof item === 'number' || typeof item === 'string') return item;
        // Object: try common shapes — { id }, { user }, { user_id }, { user: { id } }
        if (typeof item === 'object') {
          if (item.id != null) return item.id;
          if (item.user_id != null) return item.user_id;
          if (typeof item.user === 'number' || typeof item.user === 'string') return item.user;
          if (item.user && typeof item.user === 'object' && item.user.id != null) return item.user.id;
        }
        return null;
      })
      .filter(v => v != null);
  };

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
      attendees:         extractAttendeeIds(be),
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

  // Fetch tasks for the All Day / Tasks row.
  // We don't paginate aggressively here — the row only needs a few items per day;
  // first page is plenty. If the user has thousands of tasks, the website
  // probably filters by week too, but the simple version works fine to start.
  const fetchTasks = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(TASKS_API, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      setTasks(list);
    } catch (err) {
      if (__DEV__) console.warn('[Calendar] fetchTasks failed:', err);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // Fetch events from backend (replaces the old AsyncStorage load)
    fetchEvents();
    // Fetch tasks for the All Day / Tasks row
    fetchTasks();
    // Fetch task stats for the header bar
    fetchTaskStats();

    // Load daily updates from local cache first (fast), then refresh from backend
    AsyncStorage.getItem(DAILY_UPDATE_STORAGE_KEY).then(data => {
      if (data) {
        try { setDailyUpdates(JSON.parse(data)); } catch { setDailyUpdates({}); }
      }
    });
    // Fetch fresh from backend (will overwrite my updates + populate team updates)
    fetchDailyUpdates();
  }, [currentUserId, fetchEvents, fetchTasks, fetchTaskStats]));

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
                try { navigation.navigate('Main', { screen: returnToTab }); } catch {}
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
    // twoDay is anchored to today + tomorrow — no navigation
    if (viewMode === 'twoDay') return;
    const d = new Date(currentDate);
    if (viewMode === 'day')      d.setDate(d.getDate() - 1);
    else if (viewMode === 'week' || viewMode === 'workWeek') d.setDate(d.getDate() - 7);
    else { d.setMonth(d.getMonth() - 1); }
    setCurrentDate(d);
  };

  const goNext = () => {
    if (viewMode === 'twoDay') return;
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

  const weekDays = (() => {
    if (viewMode === 'day') return [currentDate];
    if (viewMode === 'twoDay') {
      // Always today + tomorrow, regardless of currentDate
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return [today, tomorrow];
    }
    return getWeekDays(currentDate, viewMode === 'workWeek');
  })();

  // ── Header label ──
  const getHeaderLabel = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
    }
    if (viewMode === 'twoDay') {
      const a = weekDays[0];
      const b = weekDays[1];
      return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;
    }
    if (viewMode === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    const first = weekDays[0];
    const last  = weekDays[weekDays.length - 1];
    return `${MONTHS_SHORT[first.getMonth()]} ${first.getDate()} – ${first.getMonth() !== last.getMonth() ? MONTHS_SHORT[last.getMonth()] + ' ' : ''}${last.getDate()}, ${last.getFullYear()}`;
  };

  // Navbar subtitle — always shows current month + year
  const getMonthYearLabel = () =>
    `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

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

  // Tasks active on a given day. A task is active if `d` falls between
  // start_date and due_date (inclusive). If only due_date exists, show on
  // that day only. If only start_date exists, show on that day only.
  const tasksForDay = (d) => {
    const key = dateKey(d);
    return tasks.filter(t => {
      const startStr = t.start_date ? String(t.start_date).slice(0, 10) : null;
      const dueStr   = t.due_date   ? String(t.due_date).slice(0, 10)   : null;
      if (startStr && dueStr) return key >= startStr && key <= dueStr;
      if (dueStr)             return key === dueStr;
      if (startStr)           return key === startStr;
      return false;
    });
  };

  const toggleDayExpanded = (d) => {
    const key = dateKey(d);
    setExpandedDays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Stats — based on tasks for current workspace ──
  const totalEvents   = taskStats.total;
  const doneEvents    = taskStats.done;
  const activeEvents  = taskStats.active;
  const pendingEvents = taskStats.pending;

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
      // Also save to QuickNotes — find or create "Daily Updates" folder
      try {
        const foldersRes = await fetch(`${BASE_URL}/quicknotes/folders/`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        let dailyFolderId = null;
        if (foldersRes.ok) {
          const folders = await foldersRes.json();
          const existing = (Array.isArray(folders) ? folders : (folders.results || [])).find(f => f.name === 'Daily Updates');
          if (existing) {
            dailyFolderId = existing.id;
          } else {
            const createRes = await fetch(`${BASE_URL}/quicknotes/folders/`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Daily Updates' }),
            });
            if (createRes.ok) {
              const created = await createRes.json();
              dailyFolderId = created.id;
            }
          }
        }
        await fetch(`${BASE_URL}/quicknotes/notes/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Daily Update – ${formatBackendDate(dailyPanelDate)}`,
            content,
            folder: dailyFolderId,
          }),
        });
      } catch (noteErr) {
        console.warn('Could not save to QuickNotes:', noteErr.message);
      }
      // Success — refresh from backend
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
    Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true })
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
          try { navigation.navigate('Main', { screen: returnTo }); } catch {}
        }
      });
  };

  // ── Workaround for a backend bug: events created/updated with
  // is_online_meeting=true silently drop attendee_ids on the way in.
  // After every save we GET the event back; if attendees is empty but we
  // intended to save some, fire a follow-up PATCH that re-asserts them.
  // Returns the final, fresh event from the server so callers can use it.
  const ensureAttendeesPersisted = async (eventId, intendedIds, token) => {
    if (!eventId || !Array.isArray(intendedIds) || intendedIds.length === 0) return null;
    try {
      // 1) Read what the server actually saved
      const verifyRes = await fetch(`${EVENTS_API}${eventId}/`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      if (!verifyRes.ok) return null;
      const verified = await verifyRes.json();
      const savedIds = Array.isArray(verified?.attendees) ? verified.attendees : [];

      // Treat as "missing" if any intended id isn't in the saved list. We
      // don't compare strict equality because some backends auto-include
      // the organizer or status filter the list — extra ids are fine.
      const missing = intendedIds.filter(id => !savedIds.map(String).includes(String(id)));
      if (missing.length === 0) return verified; // already correct, nothing to do

      // 2) Force-write the full intended list with a follow-up PATCH
      const patchRes = await fetch(`${EVENTS_API}${eventId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ attendee_ids: intendedIds }),
      });
      if (!patchRes.ok) {
        if (__DEV__) console.warn('[Calendar] re-assert PATCH failed:', patchRes.status);
        return verified;
      }
      const reasserted = await patchRes.json().catch(() => null);

      // 3) Re-read once more to confirm (the PATCH response may itself
      // be lighter/lacking attendees from the same backend bug)
      const finalRes = await fetch(`${EVENTS_API}${eventId}/`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      if (!finalRes.ok) return reasserted || verified;
      return await finalRes.json();
    } catch (err) {
      if (__DEV__) console.warn('[Calendar] ensureAttendeesPersisted error:', err);
      return null;
    }
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

      // Workaround: re-assert attendees if the create silently dropped them
      // (happens on the backend's online-meeting code path). Loop over all
      // created_events for recurring events.
      const intendedIds = participants.map(p => p.id);
      if (intendedIds.length > 0 && Array.isArray(data.created_events)) {
        for (const ev of data.created_events) {
          if (ev?.id) await ensureAttendeesPersisted(ev.id, intendedIds, token);
        }
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

  // ── Event Detail / Edit handlers ────────────────────────────────────────
  // Tap an event card → open read-only detail. From there: Edit (organizer only)
  // or Delete (organizer only) or Close.
  // We also re-fetch the event by id, because the list endpoint sometimes
  // omits or summarises the attendees field; the detail endpoint is the source
  // of truth.
  const openEventDetail = (ev) => {
    setDetailEvent(ev);
    setEditMode(false);

    if (!ev?.id) return;
    (async () => {
      try {
        const token = await getAccessToken();
        // Fetch event detail + RSVP status in parallel.
        // /events/<id>/ returns the event's own fields (title, time, attendees IDs, etc.)
        // /events/<id>/rsvp-status/ returns the participant list with names and statuses
        // (the rich data the website's Edit modal displays).
        const [detailRes, rsvpRes] = await Promise.all([
          fetch(`${EVENTS_API}${ev.id}/`, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          }),
          fetch(`${EVENTS_API}${ev.id}/rsvp-status/`, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          }),
        ]);

        if (!detailRes.ok) return; // keep the list version on failure
        const data = await detailRes.json();
        let rsvp = null;
        if (rsvpRes.ok) {
          try { rsvp = await rsvpRes.json(); }
          catch { rsvp = null; }
        }

        const fresh = normaliseEvent(data);
        // Attach the rsvp payload so the participants UI can render names + statuses
        // straight from the dedicated endpoint, instead of guessing from `attendees` IDs.
        fresh.rsvp = rsvp;
        // Only update if the user is still viewing this event
        setDetailEvent(prev => (prev && String(prev.id) === String(fresh.id) ? fresh : prev));
        // Also refresh the row in the list so attendee count stays in sync
        setEvents(prev => prev.map(e => String(e.id) === String(fresh.id) ? { ...e, ...fresh } : e));
      } catch (err) {
        if (__DEV__) console.warn('[Calendar] failed to refetch event detail:', err);
      }
    })();
  };

  const closeEventDetail = () => {
    if (savingEdit) return;
    setDetailEvent(null);
    setEditMode(false);
    setShowEditDate(false);
    setShowEditStart(false);
    setShowEditEnd(false);
    setShowEditTypeMenu(false);
    setShowEditAttendees(false);
    setEditAttendeeSearch('');
  };

  const startEditMode = () => {
    if (!detailEvent) return;
    setEditTitle(detailEvent.name || '');
    setEditType(detailEvent.event_type || 'Meeting');
    setEditDescription(detailEvent.description || '');
    setEditLocation(detailEvent.location || '');
    setEditOnline(!!detailEvent.is_online_meeting);
    try { setEditStart(new Date(detailEvent.eventTimestamp || Date.now())); }
    catch { setEditStart(new Date()); }
    try { setEditEnd(new Date(detailEvent.end_time || detailEvent.eventTimestamp || Date.now())); }
    catch { setEditEnd(new Date()); }
    // Seed the editable attendee list. Prefer rsvp-status (which includes the
    // organizer + all invitees with their user_ids) over the bare `attendees`
    // field, because the latter can be empty for organizer-view on some events.
    let initialIds = [];
    const rsvpRows = detailEvent.rsvp?.attendee_status;
    if (Array.isArray(rsvpRows) && rsvpRows.length > 0) {
      initialIds = rsvpRows
        .map(r => r?.user_id)
        .filter(id => id != null);
    } else if (Array.isArray(detailEvent.attendees)) {
      initialIds = [...detailEvent.attendees];
    }
    setEditAttendees(initialIds);
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (savingEdit) return;
    setEditMode(false);
    setShowEditDate(false);
    setShowEditStart(false);
    setShowEditEnd(false);
    setShowEditTypeMenu(false);
    setShowEditAttendees(false);
    setEditAttendeeSearch('');
  };

  // Apply the date portion of `editStart` to a time-only Date so a separate
  // time-pick doesn't reset the day. Also ensures end stays after start.
  const combineDateTime = (dateBase, timeBase) => {
    const out = new Date(dateBase);
    out.setHours(timeBase.getHours(), timeBase.getMinutes(), 0, 0);
    return out;
  };

  const saveEditedEvent = async () => {
    if (!detailEvent?.id) return;
    if (!editTitle.trim()) {
      Alert.alert('Required', 'Event name is required.');
      return;
    }
    // Final safety net: silently auto-bump end if it's not after start.
    // (UI already prevents this via picker logic — this is a belt-and-braces guard.)
    let safeEnd = editEnd;
    if (safeEnd.getTime() <= editStart.getTime()) {
      safeEnd = new Date(editStart.getTime() + 30 * 60 * 1000);
      setEditEnd(safeEnd);
    }
    setSavingEdit(true);
    try {
      const token = await getAccessToken();
      const body = {
        title:             editTitle.trim(),
        event_type:        editType,
        start_time:        editStart.toISOString(),
        end_time:          safeEnd.toISOString(),
        description:       editDescription.trim() || null,
        location:          editLocation.trim()    || null,
        is_online_meeting: editOnline,
        attendee_ids:      editAttendees,
      };
      const res = await fetch(`${EVENTS_API}${detailEvent.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Could not save changes', data.detail || data.message || JSON.stringify(data) || `Error ${res.status}`);
        return;
      }

      // Workaround: re-assert attendees in case the backend silently dropped
      // them (happens on the online-meeting code path). Use the verified-and-
      // patched event as our source of truth.
      let serverEvent = data;
      if (Array.isArray(editAttendees) && editAttendees.length > 0) {
        const reasserted = await ensureAttendeesPersisted(detailEvent.id, editAttendees, token);
        if (reasserted) serverEvent = reasserted;
      }

      // Re-fetch rsvp-status so the participants section reflects the new
      // attendees (with their fresh invitation statuses) instead of the
      // pre-edit cache.
      let freshRsvp = null;
      try {
        const rsvpRes = await fetch(`${EVENTS_API}${detailEvent.id}/rsvp-status/`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });
        if (rsvpRes.ok) freshRsvp = await rsvpRes.json();
      } catch { /* keep stale rsvp on failure */ }

      // Use the server's updated event so anything we miss (e.g. attendees if
      // the field name differs) still reflects truth
      const fresh = normaliseEvent(serverEvent);
      // Carry the freshly-fetched rsvp data so the participants UI updates.
      // If the re-fetch failed for any reason, keep whatever rsvp we already had.
      fresh.rsvp = freshRsvp || detailEvent.rsvp || null;
      setEvents(prev => prev.map(e => String(e.id) === String(detailEvent.id) ? fresh : e));
      setDetailEvent(fresh);
      setEditMode(false);
      addNotification?.({
        type: 'event', icon: '✅',
        title: 'Event updated',
        body: `"${fresh.name}" saved.`,
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save event.');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleEditAttendee = (userId) => {
    setEditAttendees(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
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
                <Text style={[styles.miniDateText, { color: txt }, isToday && { color: '#fff' }, isSelected && !isToday && { color: '#3B72EE', fontWeight: '700' }]}>{d}</Text>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={[styles.monthGrid, { backgroundColor: isDark ? '#0D0D0F' : '#FFFFFF', borderColor: bdr }]}>
          <View style={styles.monthDayRow}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <Text key={d} style={[styles.monthDayLabel, { color: sub }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.monthDates}>
            {Array.from({ length: fd }).map((_, i) => <View key={`e${i}`} style={[styles.monthCell, { backgroundColor: isDark ? '#0D0D0F' : '#FFFFFF', borderColor: bdr }]} />)}
            {Array.from({ length: dim }, (_, i) => {
              const d = i + 1;
              const date = new Date(y, m, d);
              const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
              const dayEvs = eventsForDay(date);
              return (
                <TouchableOpacity key={d} style={[styles.monthCell, { borderColor: bdr, backgroundColor: isDark ? '#0D0D0F' : '#FFFFFF' }]} onPress={() => setSelectedMonthDate(date)}>
                  <View style={[styles.monthDateCircle, isToday && styles.miniDateToday,
                    selectedMonthDate && date.toDateString() === selectedMonthDate.toDateString() && !isToday && { backgroundColor: isDark ? '#252530' : '#E8EEFF' }
                  ]}>
                    <Text style={[styles.monthDateText, { color: txt }, isToday && { color: '#fff' }]}>{d}</Text>
                  </View>
                  {/* Colored dots for events */}
                  {dayEvs.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 3, justifyContent: 'center' }}>
                      {dayEvs.slice(0, 3).map((ev, i) => (
                        <View key={i} style={{
                          width: 5, height: 5, borderRadius: 3,
                          backgroundColor: getEventColor(ev),
                        }} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {/* Trailing empty cells to complete the last row */}
            {Array.from({ length: (7 - ((fd + dim) % 7)) % 7 }).map((_, i) => (
              <View key={`t${i}`} style={[styles.monthCell, { backgroundColor: isDark ? '#0D0D0F' : '#FFFFFF', borderColor: bdr }]} />
            ))}
          </View>
        </View>

        {/* Events list for selected date */}
        {selectedMonthDate && (() => {
          const selEvs  = eventsForDay(selectedMonthDate);
          const isToday = selectedMonthDate.toDateString() === today.toDateString();
          const label   = isToday
            ? `Today, ${selectedMonthDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
            : selectedMonthDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          return (
            <View style={{ marginTop: 8 }}>
              {/* Header row */}
              <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: sub, marginBottom: 2 }}>Selected</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: txt }}>{label}</Text>
                  <TouchableOpacity onPress={() => { setCurrentDate(selectedMonthDate); setViewMode('day'); }}>
                    <Text style={{ fontSize: 12, color: '#3B72EE', fontWeight: '600' }}>Open day →</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Count + Add */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: sub }}>{selEvs.length} event{selEvs.length !== 1 ? 's' : ''}</Text>
                <TouchableOpacity onPress={() => { const nd = new Date(selectedMonthDate); nd.setHours(9,0,0,0); openModal(nd); }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#3B72EE' }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {/* Event cards */}
              {selEvs.length === 0 ? (
                <View style={{ paddingHorizontal: 14, paddingVertical: 16, alignItems: 'center' }}>
                  <Text style={{ color: sub, fontSize: 13, fontStyle: 'italic' }}>No events on this day</Text>
                </View>
              ) : selEvs.map((ev, i) => {
                const startTime = ev.eventTimestamp ? new Date(ev.eventTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                const endTime   = ev.eventEndTimestamp ? new Date(ev.eventEndTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                const color     = getEventColor(ev);
                const typeLabel = ev.type === 'task' ? 'Task' : (ev.event_type || ev.eventType || 'Meeting');
                return (
                  <TouchableOpacity
                    key={ev.id || i}
                    style={{ marginHorizontal: 14, marginBottom: 8, backgroundColor: card, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#252530' : '#EBEBF0', flexDirection: 'row', overflow: 'hidden' }}
                    onPress={() => ev.type === 'task' ? null : openEventDetail(ev)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 4, backgroundColor: color }} />
                    <View style={{ flex: 1, padding: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {startTime ? <Text style={{ fontSize: 11, color: sub }}>{startTime}{endTime ? ` — ${endTime}` : ''}</Text> : null}
                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: color + '20' }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color }}>{typeLabel}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>{ev.name}</Text>
                      {ev.assignees?.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
                          <View style={{ flexDirection: 'row' }}>
                            {ev.assignees.slice(0, 3).map((a, j) => (
                              <View key={j} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: card, marginLeft: j > 0 ? -6 : 0 }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{(a.name || a.username || '?')[0].toUpperCase()}</Text>
                              </View>
                            ))}
                          </View>
                          {ev.assignees.length > 3 && <Text style={{ fontSize: 11, color: sub }}>+ {ev.assignees.length - 3} attendees</Text>}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}
      </ScrollView>
    );
  };

  // ── Week / Day grid view ──
  const renderTimeGrid = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      {/* Hourly rows */}
      {HOURS.map(hour => (
        <View key={hour} style={[styles.hourRow, { borderColor: '#C0C0C0', backgroundColor: isDark ? '#0D0D0F' : '#FFFFFF' }]}>
          <View style={styles.timeLabel}>
            <Text style={[styles.timeLabelText, { color: sub }]}>{hour === 12 ? '12 pm' : hour > 12 ? `${hour - 12} pm` : `${hour} am`}</Text>
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
                  { borderColor: '#C0C0C0', backgroundColor: isDark ? '#0D0D0F' : '#FFFFFF' },
                  isPast && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8F9FB' },
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
                  <TouchableOpacity
                    key={ei}
                    style={[styles.eventBlock, { backgroundColor: getEventColor(ev) }]}
                    onPress={() => openEventDetail(ev)}
                    onLongPress={() => deleteEvent(ev.id)}
                    activeOpacity={0.7}
                  >
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

      {/* ── Selected day events panel ── */}
      {selectedWeekDate && (() => {
        const selEvs  = eventsForDay(selectedWeekDate);
        const isToday = selectedWeekDate.toDateString() === today.toDateString();
        const label   = isToday
          ? `Today, ${selectedWeekDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
          : selectedWeekDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        return (
          <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: bdr }}>
            {/* Header row */}
            <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: sub, marginBottom: 2 }}>Selected</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: txt }}>{label}</Text>
                <TouchableOpacity onPress={() => { setCurrentDate(selectedWeekDate); setViewMode('day'); }}>
                  <Text style={{ fontSize: 12, color: '#3B72EE', fontWeight: '600' }}>Open day →</Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Count + Add */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: sub }}>{selEvs.length} event{selEvs.length !== 1 ? 's' : ''}</Text>
              <TouchableOpacity onPress={() => { const nd = new Date(selectedWeekDate); nd.setHours(9,0,0,0); openModal(nd); }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#3B72EE' }}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {/* Event cards */}
            {selEvs.length === 0 ? (
              <View style={{ paddingHorizontal: 14, paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: sub, fontSize: 13, fontStyle: 'italic' }}>No events or tasks for this day</Text>
              </View>
            ) : selEvs.map((ev, i) => {
              const startTime = ev.eventTimestamp ? new Date(ev.eventTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
              const endTime   = ev.eventEndTimestamp ? new Date(ev.eventEndTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
              const color     = getEventColor(ev);
              const typeLabel = ev.type === 'task' ? 'Task' : (ev.event_type || ev.eventType || 'Meeting');
              return (
                <TouchableOpacity
                  key={ev.id || i}
                  style={{ marginHorizontal: 14, marginBottom: 8, backgroundColor: card, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#252530' : '#EBEBF0', flexDirection: 'row', overflow: 'hidden' }}
                  onPress={() => ev.type === 'task' ? null : openEventDetail(ev)}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 4, backgroundColor: color }} />
                  <View style={{ flex: 1, padding: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {startTime ? <Text style={{ fontSize: 11, color: sub }}>{startTime}{endTime ? ` — ${endTime}` : ''}</Text> : null}
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: color + '20' }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color }}>{typeLabel}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>{ev.name}</Text>
                    {ev.assignees?.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
                        <View style={{ flexDirection: 'row' }}>
                          {ev.assignees.slice(0, 3).map((a, j) => (
                            <View key={j} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: card, marginLeft: j > 0 ? -6 : 0 }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{(a.name || a.username || '?')[0].toUpperCase()}</Text>
                            </View>
                          ))}
                        </View>
                        {ev.assignees.length > 3 && <Text style={{ fontSize: 11, color: sub }}>+ {ev.assignees.length - 3} attendees</Text>}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })()}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D0D0F' : '#fff'} translucent={false} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Calendar" />
          <View>
            <Text style={[styles.brandName, { color: txt }]}>Calendar</Text>
            <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>{getMonthYearLabel()}</Text>
          </View>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={{ padding: 6 }} onPress={() => navigation.navigate('Search')}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              <Path d="M21 21L16.65 16.65" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* ── Ask Dyuksa AI input bar with settings on left ── */}
      <View style={[ad.wrap, { backgroundColor: isDark ? '#1A1A20' : '#FFFFFF', borderColor: bdr, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>

        {/* Settings icon + dropdown */}
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            onPress={() => setShowSettingsDrop(s => !s)}
            activeOpacity={0.7}
            style={{ padding: 6 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M14 17H5" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              <Path d="M19 7h-9" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              <Circle cx={17} cy={17} r={3} stroke="#3B72EE" strokeWidth={2}/>
              <Circle cx={7} cy={7} r={3} stroke="#3B72EE" strokeWidth={2}/>
            </Svg>
          </TouchableOpacity>

          {showSettingsDrop && (
            <View style={{
              position: 'absolute', top: 38, left: 0, zIndex: 400,
              backgroundColor: card, borderRadius: 10, borderWidth: 1, borderColor: bdr,
              minWidth: 210, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.14, shadowRadius: 10, elevation: 14,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: bdr }}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 17H5" stroke={txt} strokeWidth={1.8} strokeLinecap="round"/>
                  <Path d="M19 7h-9" stroke={txt} strokeWidth={1.8} strokeLinecap="round"/>
                  <Circle cx={17} cy={17} r={3} stroke={txt} strokeWidth={1.8}/>
                  <Circle cx={7} cy={7} r={3} stroke={txt} strokeWidth={1.8}/>
                </Svg>
                <Text style={{ fontSize: 13, fontWeight: '700', color: txt }}>Calendar Settings</Text>
              </View>

              {/* New Event */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: bdr }}
                onPress={() => { setShowSettingsDrop(false); openModal(); }}
                activeOpacity={0.7}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round"/>
                  <Path d="M12 12v4M10 14h4" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round"/>
                </Svg>
                <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '600' }}>New Event</Text>
              </TouchableOpacity>

              {/* Show Shared Events toggle */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: bdr }}>
                <Text style={{ fontSize: 13, color: txt }}>Show Shared Events</Text>
                <TouchableOpacity
                  onPress={() => setShowSharedEvents(s => !s)}
                  style={{ width: 42, height: 24, borderRadius: 12, backgroundColor: showSharedEvents ? '#3B72EE' : (isDark ? '#3A3A48' : '#D1D1DB'), justifyContent: 'center', paddingHorizontal: 2 }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', marginLeft: showSharedEvents ? 18 : 0 }} />
                </TouchableOpacity>
              </View>

              {/* Share My Calendar */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 }}
                onPress={() => { setShowSettingsDrop(false); setShareModalOpen(true); }}
                activeOpacity={0.7}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Circle cx={18} cy={5}  r={3} stroke="#3B72EE" strokeWidth={2}/>
                  <Circle cx={6}  cy={12} r={3} stroke="#3B72EE" strokeWidth={2}/>
                  <Circle cx={18} cy={19} r={3} stroke="#3B72EE" strokeWidth={2}/>
                  <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} stroke="#3B72EE" strokeWidth={2} strokeLinecap="round"/>
                  <Line x1={15.41} y1={6.51} x2={8.59}  y2={10.49} stroke="#3B72EE" strokeWidth={2} strokeLinecap="round"/>
                </Svg>
                <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '600' }}>Share My Calendar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Ask Dyuksa input */}
        <View style={[ad.inputBox, { flex: 1, backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr }]}>
          <Text style={{ fontSize: 16, color: '#2D6AE3', fontWeight: '700' }}>✦</Text>
          <TextInput
            style={[ad.input, { color: txt }]}
            value={askDyuksaText}
            onChangeText={setAskDyuksaText}
            placeholder='Try: "dyuksa find 30 mins with Vaibhav tomorrow"'
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

      {/* Month/Week/Day segmented control + nav */}
      <View style={{ position: 'relative', zIndex: 50 }}>
        {/* Segmented control row */}
        <View style={[styles.segRow, { backgroundColor: isDark ? '#0D0D0F' : '#F5F5F7', borderBottomColor: bdr }]}>
          {/* Month */}
          <TouchableOpacity
            style={[styles.segBtn, viewMode === 'month' && [styles.segBtnActive, { backgroundColor: card }]]}
            onPress={() => setViewMode('month')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segBtnText, { color: viewMode === 'month' ? (isDark ? '#fff' : '#1A1A2E') : sub }, viewMode === 'month' && { fontWeight: '700' }]}>
              Month
            </Text>
          </TouchableOpacity>

          {/* Week — tap to toggle between Week and Work Week */}
          <TouchableOpacity
            style={[styles.segBtn, (viewMode === 'week' || viewMode === 'workWeek') && [styles.segBtnActive, { backgroundColor: card }]]}
            onPress={() => {
              if (viewMode === 'week') setViewMode('workWeek');
              else if (viewMode === 'workWeek') setViewMode('week');
              else setViewMode('week');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.segBtnText, { color: (viewMode === 'week' || viewMode === 'workWeek') ? (isDark ? '#fff' : '#1A1A2E') : sub }, (viewMode === 'week' || viewMode === 'workWeek') && { fontWeight: '700' }]}>
              {viewMode === 'workWeek' ? 'Work Week' : 'Week'}
            </Text>
          </TouchableOpacity>

          {/* Day */}
          <TouchableOpacity
            style={[styles.segBtn, viewMode === 'day' && [styles.segBtnActive, { backgroundColor: card }]]}
            onPress={() => setViewMode('day')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segBtnText, { color: viewMode === 'day' ? (isDark ? '#fff' : '#1A1A2E') : sub }, viewMode === 'day' && { fontWeight: '700' }]}>
              Day
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nav row: prev arrow · date label center · next arrow — hidden in Day view (has its own header) */}
        {viewMode !== 'day' && (
        <View style={[styles.toolbar, { backgroundColor: card, borderBottomColor: bdr, flexWrap: 'wrap', gap: 6 }]}>
          {/* Date navigation */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity style={styles.arrowBtn} onPress={goPrev}>
              <Text style={[styles.arrowText, { color: txt }]}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMiniCal(s => !s)} style={[styles.dateRangeBtn, { flex: 1, justifyContent: 'center' }]}>
              <Text style={[styles.dateRange, { color: txt, textAlign: 'center' }]} numberOfLines={1}>{getHeaderLabel()}</Text>
              <Text style={{ fontSize: 10, color: sub, marginLeft: 4 }}>{showMiniCal ? '▲' : '▾'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.arrowBtn} onPress={goNext}>
              <Text style={[styles.arrowText, { color: txt }]}>›</Text>
            </TouchableOpacity>
          </View>

        </View>
        )}
      </View>

      {/* Main content — full width now, no sidebar */}
      <View style={{ flex: 1 }}>

        {/* Tap outside settings dropdown to close */}
        {showSettingsDrop && (
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 199 }}
            activeOpacity={1}
            onPress={() => setShowSettingsDrop(false)}
          />
        )}

        {/* Mini calendar dropdown overlay */}
        {showMiniCal && (
          <View style={[styles.miniCalOverlay, { backgroundColor: card, borderColor: bdr }]}>
            {renderMiniCalendar()}
            {/* Status legend */}
            <View style={[styles.legend, { borderTopColor: bdr }]}>
              {[
                { label: 'Pending',     color: '#FBBF24' },
                { label: 'In Progress', color: '#3B72EE' },
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
          {/* ── Day view special header ── */}
          {viewMode === 'day' && (() => {
            const isToday  = currentDate.toDateString() === today.toDateString();
            const dayLabel = currentDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const monLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
            const dateLabel = isToday
              ? `Today, ${currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
              : currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            // Build 7-day strip centred on currentDate
            const strip = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() - 3 + i);
              return d;
            });

            // Stats for current day
            const dayEvs   = eventsForDay(currentDate);
            const evCount  = dayEvs.filter(e => e.type !== 'task').length;
            const mtgCount = dayEvs.filter(e => e.type !== 'task' && (e.event_type || '').toLowerCase() === 'meeting').length;
            const totalMin = dayEvs.filter(e => e.type !== 'task').reduce((acc, e) => {
              try {
                const s = new Date(e.eventTimestamp || e.eventDate);
                const en = e.end_time ? new Date(e.end_time) : new Date(s.getTime() + 30 * 60000);
                return acc + (en - s) / 60000;
              } catch { return acc; }
            }, 0);
            const hrs = (totalMin / 60).toFixed(1);

            return (
              <View style={{ backgroundColor: card, borderBottomWidth: 1, borderBottomColor: bdr }}>
                {/* Subtitle + date + arrows */}
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: sub, letterSpacing: 0.5 }}>{dayLabel} · {monLabel}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: txt }}>{dateLabel}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity style={styles.arrowBtn} onPress={goPrev}>
                        <Text style={[styles.arrowText, { color: txt }]}>‹</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.arrowBtn} onPress={goNext}>
                        <Text style={[styles.arrowText, { color: txt }]}>›</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Mini week strip */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10, gap: 4 }} style={{ flexDirection: 'row' }}>
                  {strip.map((d, i) => {
                    const isCur  = d.toDateString() === currentDate.toDateString();
                    const isTod  = d.toDateString() === today.toDateString();
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setCurrentDate(new Date(d))}
                        style={{ alignItems: 'center', paddingHorizontal: 8 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: isCur ? '#3B72EE' : sub, marginBottom: 4 }}>
                          {['S','M','T','W','T','F','S'][d.getDay()]}
                        </Text>
                        <View style={{
                          width: 32, height: 32, borderRadius: 10,
                          backgroundColor: isCur ? '#2952C4' : 'transparent',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: isCur ? '#fff' : (isTod ? '#3B72EE' : txt) }}>
                            {d.getDate()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Stats pills */}
                {evCount > 0 && (
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
                    <View style={{ backgroundColor: isDark ? '#252530' : '#F0F0F5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 12, color: sub, fontWeight: '500' }}>{evCount} event{evCount !== 1 ? 's' : ''}</Text>
                    </View>
                    {mtgCount > 0 && (
                      <View style={{ backgroundColor: isDark ? '#252530' : '#F0F0F5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 12, color: sub, fontWeight: '500' }}>{mtgCount} meeting{mtgCount !== 1 ? 's' : ''}</Text>
                      </View>
                    )}
                    {parseFloat(hrs) > 0 && (
                      <View style={{ backgroundColor: isDark ? '#252530' : '#F0F0F5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 12, color: sub, fontWeight: '500' }}>{hrs}h booked</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })()}

          {/* Day column headers */}
          {viewMode !== 'month' && viewMode !== 'day' && (
            <View style={[styles.dayHeaders, { borderBottomColor: '#C0C0C0', backgroundColor: card }]}>
              {/* Top-left corner cell — empty spacer */}
              <View style={[styles.timeLabel, { alignItems: 'center', justifyContent: 'center' }]} />
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                const dayEvents = eventsForDay(d);
                const dotColors = [...new Set(dayEvents.slice(0, 3).map(e => getEventColor(e)))];
                return (
                  <View key={i} style={[styles.dayHeaderCell, { borderColor: '#C0C0C0' }]}>
                    <Text style={[styles.dayHeaderDay, { color: isToday ? '#3B72EE' : sub }]}>
                      {['S','M','T','W','T','F','S'][d.getDay()]}
                    </Text>
                    <TouchableOpacity
                      style={[styles.dayHeaderNum, isToday && styles.dayHeaderNumToday]}
                      onPress={() => { openDailyPanel(d); setSelectedWeekDate(d); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayHeaderNumText, { color: isToday ? '#fff' : txt }]}>
                        {d.getDate()}
                      </Text>
                    </TouchableOpacity>
                    {/* Event dots */}
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 3, justifyContent: 'center' }}>
                      {dotColors.map((c, di) => (
                        <View key={di} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c }} />
                      ))}
                    </View>
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
              {/* Panel header — matches reference */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: bdr }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: txt }}>
                  {dailyPanelDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </Text>
                <TouchableOpacity
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? '#252530' : '#F0F0F5', alignItems: 'center', justifyContent: 'center' }}
                  onPress={closeDailyPanel}
                >
                  <Text style={{ fontSize: 14, color: sub, fontWeight: '600' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

                {/* Empty state */}
                <View style={{ backgroundColor: isDark ? '#252530' : '#F5F5F7', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 14 }}>
                  <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 8 }}>
                    <Path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="#9AA3B2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                    <Path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                  </Svg>
                  <Text style={{ fontSize: 13, color: sub, textAlign: 'center' }}>No tasks or events scheduled for this day</Text>
                </View>

                {/* Create Task button — full width solid blue */}
                <TouchableOpacity
                  style={{ backgroundColor: '#3B72EE', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}
                  onPress={() => {
                    closeDailyPanel();
                    setTimeout(() => navigation.navigate('Main', { screen: 'Tasks', params: { openCreateModal: true, returnTo: 'Calendar' } }), 250);
                  }}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 11l3 3L22 4" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                    <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                  </Svg>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Create Task</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: bdr, marginBottom: 14 }} />

                {/* ── Daily Update Section ── */}
                {dailyPanelDateClass === 'today' && !editingUpdate && !dailyUpdates[dateKey(dailyPanelDate)] && (
                  <TouchableOpacity
                    style={{ backgroundColor: isDark ? '#252530' : '#F5F5F7', borderRadius: 14, borderWidth: 1, borderColor: bdr, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, marginBottom: 14 }}
                    onPress={() => setEditingUpdate(true)}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#3B72EE' }}>Add Daily Update</Text>
                  </TouchableOpacity>
                )}

                {dailyPanelDateClass === 'today' && !editingUpdate && dailyUpdates[dateKey(dailyPanelDate)] && (
                  <View style={{ backgroundColor: isDark ? '#252530' : '#F5F5F7', borderRadius: 14, borderWidth: 1, borderColor: bdr, padding: 16, marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>Daily Update</Text>
                        <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '500', marginTop: 2 }}>
                          {dailyPanelDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setEditingUpdate(true)}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#3B72EE' }}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                    {renderUpdateField('Today\'s Priorities', dailyUpdates[dateKey(dailyPanelDate)].priorities, txt, sub)}
                    {renderUpdateField('Progress (Yesterday)', dailyUpdates[dateKey(dailyPanelDate)].progress, txt, sub)}
                    {renderUpdateField('Blockers / Needs', dailyUpdates[dateKey(dailyPanelDate)].blockers, txt, sub)}
                    {renderUpdateField('Upcoming', dailyUpdates[dateKey(dailyPanelDate)].upcoming, txt, sub)}
                  </View>
                )}

                {dailyPanelDateClass === 'today' && editingUpdate && (
                  <View style={{ backgroundColor: isDark ? '#252530' : '#F5F5F7', borderRadius: 14, borderWidth: 1, borderColor: bdr, padding: 16, marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>Daily Update</Text>
                        <Text style={{ fontSize: 13, color: '#3B72EE', fontWeight: '500', marginTop: 2 }}>
                          {dailyPanelDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      </View>
                      {dailyUpdates[dateKey(dailyPanelDate)] && (
                        <TouchableOpacity onPress={() => setEditingUpdate(false)}>
                          <Text style={{ fontSize: 16, color: sub }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {renderUpdateInput('Today\'s Priorities:-', editPriorities, setEditPriorities, 'What are you focusing on today?', isDark, card, bdr, txt, sub)}
                    {renderUpdateInput('Progress (Yesterday):-', editProgress, setEditProgress, 'What did you accomplish yesterday?', isDark, card, bdr, txt, sub)}
                    {renderUpdateInput('Blockers / Needs:-', editBlockers, setEditBlockers, 'Any blockers or help needed?', isDark, card, bdr, txt, sub)}
                    {renderUpdateInput('Upcoming:-', editUpcoming, setEditUpcoming, 'What\'s coming up next?', isDark, card, bdr, txt, sub)}
                    <TouchableOpacity
                      style={{ backgroundColor: '#3B72EE', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 }}
                      onPress={saveDailyUpdate}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>➤  Submit Update</Text>
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
                  <Text style={{ fontSize: 11, fontWeight: '700', color: sub, letterSpacing: 0.6 }}>TEAM UPDATES</Text>
                  {loadingUpdates && <ActivityIndicator size="small" color="#3B72EE" />}
                </View>
                {(() => {
                  const teamList = teamUpdates[dateKey(dailyPanelDate)] || [];
                  if (teamList.length === 0) {
                    return (
                      <Text style={{ fontSize: 13, color: sub, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 }}>
                        {loadingUpdates ? 'Loading team updates…' : 'No team updates for this date yet.'}
                      </Text>
                    );
                  }
                  return teamList.map((u, idx) => (
                    <View
                      key={u.id || idx}
                      style={[du.teamCard, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}
                    >
                      <Text style={[du.teamName, { color: '#3B72EE' }]}>{u.user_name}</Text>
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
          {/* Backdrop */}
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={closeModal} />
          <Animated.View
            style={[
              styles.topPanel,
              {
                backgroundColor: isDark ? '#0D0D0F' : '#F5F5F7',
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <SafeAreaView edges={['bottom']} style={{ flexShrink: 1 }}>
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? '#3A3A48' : '#DEDEE8' }} />
              </View>

              <ScrollView
                contentContainerStyle={{ paddingBottom: kbHeight > 0 ? kbHeight + 16 : 32 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* ── Header: back arrow left, title centered, ✕ right ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18 }}>
                  <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 26, color: txt, fontWeight: '300', lineHeight: 28 }}>‹</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: txt }}>New Event</Text>
                  <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 18, color: sub, fontWeight: '400' }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* ── Event Name ── */}
                <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: sub, marginBottom: 6, letterSpacing: 0.2 }}>
                    Event Name <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <View style={{ backgroundColor: card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}>
                    <TextInput
                      style={{ fontSize: 15, color: txt }}
                      placeholder="Enter event name"
                      placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                      value={eventName}
                      onChangeText={setEventName}
                    />
                  </View>
                </View>

                {/* ── Description ── */}
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: sub, marginBottom: 6, letterSpacing: 0.2 }}>Description</Text>
                  <View style={{ backgroundColor: card, borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 }}>
                    <TextInput
                      style={{ fontSize: 14, color: txt, minHeight: 72, textAlignVertical: 'top', lineHeight: 21 }}
                      placeholder="Add event details..."
                      placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                      value={eventDesc}
                      onChangeText={setEventDesc}
                      multiline
                    />
                  </View>
                </View>

                {/* ── Date / Time / Location ── */}
                <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: card, borderRadius: 16, overflow: 'hidden' }}>

                  {/* Date */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}
                    onPress={() => { setShowDatePicker(s => !s); setShowTimePicker(false); setShowEndTimePicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14, color: sub }}>Date</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>
                      {pickerDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <View style={[styles.pickerCard, { backgroundColor: card, borderColor: bdr }]}>
                      <DateTimePicker value={tempPickerDate} mode="date" display="inline" themeVariant={isDark ? 'dark' : 'light'} minimumDate={new Date(new Date().setHours(0,0,0,0))} onChange={(_, date) => { if (date) setTempPickerDate(date); }} style={{ width: '100%' }} />
                      <View style={[styles.pickerActions, { borderTopColor: bdr }]}>
                        <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowDatePicker(false)}><Text style={[styles.pickerCancelText, { color: sub }]}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => { const nd = new Date(tempPickerDate); nd.setHours(pickerDate.getHours(), pickerDate.getMinutes()); const nde = new Date(nd); nde.setHours(endPickerDate.getHours(), endPickerDate.getMinutes()); setPickerDate(nd); setEndPickerDate(nde); setShowDatePicker(false); }}><Text style={styles.pickerDoneText}>Done</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Start time */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}
                    onPress={() => { setShowTimePicker(s => !s); setShowDatePicker(false); setShowEndTimePicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14, color: sub }}>Start time</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>
                      {pickerDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                  </TouchableOpacity>
                  {showTimePicker && (
                    <View style={[styles.pickerCard, { backgroundColor: card, borderColor: bdr }]}>
                      <DateTimePicker value={tempPickerDate} mode="time" display="spinner" themeVariant={isDark ? 'dark' : 'light'} onChange={(_, date) => { if (date) setTempPickerDate(date); }} style={{ width: '100%' }} />
                      <View style={[styles.pickerActions, { borderTopColor: bdr }]}>
                        <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowTimePicker(false)}><Text style={[styles.pickerCancelText, { color: sub }]}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => { const nd = new Date(pickerDate); nd.setHours(tempPickerDate.getHours(), tempPickerDate.getMinutes()); setPickerDate(nd); if (endPickerDate.getTime() <= nd.getTime()) { const ne = new Date(nd); ne.setMinutes(ne.getMinutes() + 30); setEndPickerDate(ne); setTempEndPickerDate(ne); } setShowTimePicker(false); }}><Text style={styles.pickerDoneText}>Done</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* End time */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}
                    onPress={() => { setShowEndTimePicker(s => !s); setShowDatePicker(false); setShowTimePicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14, color: sub }}>End time</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>
                      {endPickerDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                  </TouchableOpacity>
                  {showEndTimePicker && (
                    <View style={[styles.pickerCard, { backgroundColor: card, borderColor: bdr }]}>
                      <DateTimePicker value={tempEndPickerDate} mode="time" display="spinner" themeVariant={isDark ? 'dark' : 'light'} onChange={(_, date) => { if (date) setTempEndPickerDate(date); }} style={{ width: '100%' }} />
                      <View style={[styles.pickerActions, { borderTopColor: bdr }]}>
                        <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowEndTimePicker(false)}><Text style={[styles.pickerCancelText, { color: sub }]}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => { const ne = new Date(pickerDate); ne.setHours(tempEndPickerDate.getHours(), tempEndPickerDate.getMinutes()); if (ne.getTime() <= pickerDate.getTime()) { Alert.alert('Invalid end time', 'End time must be after start time.', [{ text: 'OK' }]); return; } setEndPickerDate(ne); setShowEndTimePicker(false); }}><Text style={styles.pickerDoneText}>Done</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Location */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 }}>
                    <Text style={{ fontSize: 14, color: sub, flex: 1 }}>Location</Text>
                    <TextInput
                      style={{ fontSize: 14, color: txt, textAlign: 'right', flex: 2 }}
                      placeholder="Add location"
                      placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                      value={location}
                      onChangeText={setLocation}
                    />
                  </View>
                </View>

                {/* ── Event Type + Participants — merged card ── */}
                <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: card, borderRadius: 16, overflow: 'hidden' }}>

                  {/* ── Event Type row (collapsible) ── */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}
                    onPress={() => { setShowTypeDropdown(s => !s); setShowParticipants(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14, color: sub }}>Event Type</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {/* Show selected type pill */}
                      {(() => {
                        const t = EVENT_TYPES.find(t => t.id === eventType);
                        return t ? (
                          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: t.color }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{t.label}</Text>
                          </View>
                        ) : null;
                      })()}
                      <Text style={{ color: sub, fontSize: 12 }}>{showTypeDropdown ? '▲' : '▾'}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Event Type dropdown — list style matching edit screen */}
                  {showTypeDropdown && (
                    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}>
                      {EVENT_TYPES.map(t => {
                        const active = eventType === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr, backgroundColor: active ? (isDark ? 'rgba(59,114,238,0.08)' : '#F0F5FF') : 'transparent' }}
                            onPress={() => { setEventType(t.id); if (t.id !== 'Other') setCustomType(''); setShowTypeDropdown(false); }}
                            activeOpacity={0.7}
                          >
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color, marginRight: 12 }} />
                            <Text style={{ flex: 1, fontSize: 14, color: txt, fontWeight: active ? '600' : '400' }}>{t.label}</Text>
                            {active && <Text style={{ color: '#3B72EE', fontWeight: '700', fontSize: 15 }}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })}
                      {eventType === 'Other' && (
                        <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                          <TextInput
                            style={{ backgroundColor: isDark ? '#1A1A20' : '#F5F5F7', borderRadius: 10, borderWidth: 1, borderColor: bdr, color: txt, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }}
                            placeholder="Type custom event name"
                            placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                            value={customType}
                            onChangeText={setCustomType}
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── Online meeting row — separate toggle row ── */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: bdr, backgroundColor: teamsMeeting ? (isDark ? 'rgba(59,114,238,0.08)' : '#F0F5FF') : 'transparent' }}
                    onPress={() => setTeamsMeeting(v => !v)}
                    activeOpacity={0.7}
                  >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginRight: 10 }}>
                      <Path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke={teamsMeeting ? '#3B72EE' : sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                    <Text style={{ flex: 1, fontSize: 14, color: teamsMeeting ? '#3B72EE' : txt, fontWeight: teamsMeeting ? '600' : '400' }}>Online meeting</Text>
                    {/* Toggle switch — matches edit screen style */}
                    <View style={[detailStyles.toggleSwitch, teamsMeeting && { backgroundColor: '#3B72EE' }]}>
                      <View style={[detailStyles.toggleKnob, teamsMeeting && { transform: [{ translateX: 16 }] }]} />
                    </View>
                  </TouchableOpacity>

                  {/* ── Participants row (collapsible) ── */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: (participants.length > 0 || showParticipants) ? StyleSheet.hairlineWidth : 0, borderBottomColor: bdr }}
                    onPress={() => { setShowParticipants(s => !s); setShowTypeDropdown(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14, color: sub }}>Participants</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {participants.length > 0 && (
                        <View style={{ backgroundColor: '#3B72EE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{participants.length}</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#3B72EE' }}>+ Add</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Selected participant chips */}
                  {participants.length > 0 && !showParticipants && (
                    <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                      <View style={styles.participantChipsRow}>
                        {participants.map(p => (
                          <View key={p.id} style={[styles.participantChip, { backgroundColor: isDark ? '#252530' : '#F0F4FF', borderColor: isDark ? '#3A3A48' : '#D0D8FF' }]}>
                            <View style={[styles.participantChipAvatar, { backgroundColor: '#3B72EE' }]}>
                              <Text style={styles.participantChipAvatarText}>{p.avatar}</Text>
                            </View>
                            <Text style={[styles.participantChipName, { color: txt }]}>{p.name}</Text>
                            <TouchableOpacity onPress={() => toggleParticipant({ id: p.id, first_name: p.name })} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                              <Text style={{ color: sub, fontSize: 12 }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Participants picker dropdown */}
                  {showParticipants && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 }}>
                      <TextInput
                        style={[styles.participantSearchInput, { backgroundColor: isDark ? '#1A1A20' : '#F5F5F7', borderColor: bdr, color: txt, marginBottom: 4 }]}
                        placeholder="Search users..."
                        placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                        value={participantSearch}
                        onChangeText={setParticipantSearch}
                      />
                      <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
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
                                <View style={[styles.userAvatar, { backgroundColor: '#3B72EE' }]}>
                                  <Text style={styles.userAvatarText}>
                                    {((u.first_name || u.username || 'U')[0] || 'U').toUpperCase()}
                                  </Text>
                                </View>
                                <Text style={[styles.userName, { color: txt }]}>{u.first_name || u.username || 'User'}</Text>
                                <View style={[styles.userCheckbox, { borderColor: isDark ? '#3A3A48' : '#DEDEE8' }, isSelected && styles.userCheckboxActive]}>
                                  {isSelected && <Text style={styles.userCheckmark}>✓</Text>}
                                </View>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* ── Alert banner ── */}
                <View style={{ marginHorizontal: 16, marginBottom: 20, backgroundColor: isDark ? 'rgba(59,114,238,0.08)' : '#EEF3FF', borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(59,114,238,0.2)' : '#C7D7FE', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 16 }}>🔔</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: '#3B72EE', fontWeight: '500', lineHeight: 18 }}>
                    {participants.length > 0
                      ? `${participants.length} participant${participants.length > 1 ? 's' : ''} will be notified 1 hour before`
                      : "You'll receive an alert 1 hour before this event"}
                  </Text>
                </View>

                {/* ── Create button — full width, #3B72EE ── */}
                <TouchableOpacity
                  style={{ marginHorizontal: 16, marginBottom: 12, paddingVertical: 16, borderRadius: 14, backgroundColor: '#3B72EE', alignItems: 'center' }}
                  onPress={saveEvent}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Create event</Text>
                </TouchableOpacity>

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

                {/* Attendees — editable: tap a chip to remove, tap '+' to add */}
                <Text style={[aiStyles.label, { color: sub }]}>Participants</Text>
                <View style={aiStyles.attendeeRow}>
                  {(Array.isArray(aiSuggestion.attendee_names) ? aiSuggestion.attendee_names : []).map((n, i) => (
                    <TouchableOpacity
                      key={`${n}_${i}`}
                      style={[aiStyles.attendee, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                      onPress={() => aiRemoveParticipantAt(i)}
                      activeOpacity={0.7}
                    >
                      <View style={aiStyles.avatar}>
                        <Text style={aiStyles.avatarText}>{aiInitials(n)}</Text>
                      </View>
                      <Text style={[aiStyles.attendeeName, { color: txt }]} numberOfLines={1}>{n}</Text>
                      <Text style={[aiStyles.attendeeRemove, { color: sub }]}>×</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[aiStyles.attendeeAddBtn, { borderColor: isDark ? '#3A3A48' : '#DEDEE8' }]}
                    onPress={() => setAiPickerOpen(o => !o)}
                    activeOpacity={0.7}
                  >
                    <Text style={[aiStyles.attendeeAddBtnText, { color: '#7C3AED' }]}>
                      {aiPickerOpen ? '× Close' : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* AI Participant picker — search + scrollable user list */}
                {aiPickerOpen && (
                  <View style={[aiStyles.pickerBox, { backgroundColor: isDark ? '#1A1A20' : '#FAFAFA', borderColor: bdr }]}>
                    <TextInput
                      style={[aiStyles.pickerSearch, { backgroundColor: card, borderColor: bdr, color: txt }]}
                      placeholder="Search users..."
                      placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                      value={aiPickerSearch}
                      onChangeText={setAiPickerSearch}
                    />
                    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                      {aiFilteredUsers().length === 0 ? (
                        <Text style={[aiStyles.pickerEmpty, { color: sub }]}>No users found</Text>
                      ) : (
                        aiFilteredUsers().map(u => {
                          const isSelected = (aiSuggestion.attendee_ids || []).map(String).includes(String(u.id));
                          const display = (u.first_name && u.last_name)
                            ? `${u.first_name} ${u.last_name}`
                            : (u.first_name || u.username || 'User');
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[aiStyles.pickerRow, { borderBottomColor: bdr }]}
                              onPress={() => aiToggleParticipant(u)}
                              activeOpacity={0.7}
                            >
                              <View style={aiStyles.pickerAvatar}>
                                <Text style={aiStyles.pickerAvatarText}>
                                  {((u.first_name || u.username || 'U')[0] || 'U').toUpperCase()}
                                </Text>
                              </View>
                              <Text style={[aiStyles.pickerName, { color: txt }]}>{display}</Text>
                              <View style={[
                                aiStyles.pickerCheck,
                                { borderColor: isDark ? '#3A3A48' : '#DEDEE8' },
                                isSelected && { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
                              ]}>
                                {isSelected && <Text style={aiStyles.pickerCheckMark}>✓</Text>}
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
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
      {/* ── Event Detail / Edit Modal ─────────────────────────────────── */}
      {!!detailEvent && (() => {
        // Multiple signals — any one of these means the viewer is the organizer.
        // We're permissive here because backend serialisers occasionally omit
        // fields (e.g. `my_invitation_status` is null for some events).
        const userId   = user?.id ?? user?.pk ?? user?.user_id;
        const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '';
        const isOrganizer = !!detailEvent && (
          // a) numeric id match against `organizer`
          (userId != null && String(userId) === String(detailEvent.organizer)) ||
          // b) explicit invitation flag
          (detailEvent.my_invitation_status === 'ORGANIZER') ||
          // c) name match against the `organizer` string in the rsvp payload
          (!!userName && !!detailEvent.rsvp?.organizer && userName === detailEvent.rsvp.organizer) ||
          // d) name match against the `organizer_name` event field
          (!!userName && !!detailEvent.organizer_name && userName === detailEvent.organizer_name)
        );
        if (__DEV__) {
          console.log('[Calendar] detail open — isOrganizer:', isOrganizer,
            { userId, userName, organizer: detailEvent.organizer, organizer_name: detailEvent.organizer_name, my_invitation_status: detailEvent.my_invitation_status, rsvpOrganizer: detailEvent.rsvp?.organizer });
        }
        const fmtDate = (iso) => {
          try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
        };
        const fmtTime = (iso) => {
          try { return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); } catch { return iso; }
        };
        return (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={closeEventDetail}
          >
            <KeyboardAvoidingView
              style={detailStyles.backdrop}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={[detailStyles.card, { backgroundColor: card, borderColor: bdr }]}>
                {/* ── Header ── */}
                <View style={detailStyles.header}>
                  <View style={{ flex: 1 }}>
                    <Text style={[detailStyles.title, { color: txt }]}>
                      {editMode ? 'Edit event' : 'Event details'}
                    </Text>
                    {isOrganizer && (
                      <View style={detailStyles.organizerBadge}>
                        <Text style={detailStyles.organizerBadgeText}>ORGANIZER</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={closeEventDetail}
                    disabled={savingEdit}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 14, color: sub, fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={{ flexGrow: 0, flexShrink: 1 }}
                  contentContainerStyle={{ paddingBottom: 80 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* ── Read-only view ── */}
                  {!editMode && (
                    <View style={{ gap: 0 }}>

                      {/* Event name */}
                      <View style={{ marginBottom: 16 }}>
                        <Text style={[detailStyles.label, { color: sub }]}>EVENT NAME</Text>
                        <Text style={[detailStyles.bigValue, { color: txt }]}>{detailEvent.name}</Text>
                      </View>

                      {/* Meta card — date, time, type, organizer, location in one bordered card */}
                      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: bdr, overflow: 'hidden', marginBottom: 14 }}>

                        {/* Date + Time row */}
                        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: bdr }}>
                          <View style={{ flex: 1, padding: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                                <Path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke={sub} strokeWidth={2} strokeLinecap="round"/>
                              </Svg>
                              <Text style={[detailStyles.label, { color: sub, marginBottom: 0 }]}>DATE</Text>
                            </View>
                            <Text style={[detailStyles.value, { color: txt }]}>{fmtDate(detailEvent.eventTimestamp)}</Text>
                          </View>
                          <View style={{ width: 1, backgroundColor: bdr }} />
                          <View style={{ flex: 1, padding: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                                <Circle cx={12} cy={12} r={10} stroke={sub} strokeWidth={2}/>
                                <Path d="M12 6v6l4 2" stroke={sub} strokeWidth={2} strokeLinecap="round"/>
                              </Svg>
                              <Text style={[detailStyles.label, { color: sub, marginBottom: 0 }]}>TIME</Text>
                            </View>
                            <Text style={[detailStyles.value, { color: txt }]}>
                              {fmtTime(detailEvent.eventTimestamp)} – {fmtTime(detailEvent.end_time)}
                            </Text>
                          </View>
                        </View>

                        {/* Type row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: bdr }}>
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={sub} strokeWidth={2} strokeLinecap="round"/>
                            <Circle cx={9} cy={7} r={4} stroke={sub} strokeWidth={2}/>
                            <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={sub} strokeWidth={2} strokeLinecap="round"/>
                          </Svg>
                          <View style={{ flex: 1 }}>
                            <Text style={[detailStyles.label, { color: sub, marginBottom: 2 }]}>TYPE</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              {(() => {
                                const typeObj = EVENT_TYPES.find(t => t.id.toLowerCase() === (detailEvent.event_type || '').toLowerCase());
                                return (
                                  <>
                                    {typeObj && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: typeObj.color }} />}
                                    <Text style={[detailStyles.value, { color: txt }]}>{detailEvent.event_type || 'Meeting'}</Text>
                                  </>
                                );
                              })()}
                              {detailEvent.is_online_meeting && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,58,237,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                                    <Path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="#7C3AED" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                                  </Svg>
                                  <Text style={{ color: '#7C3AED', fontSize: 10, fontWeight: '700' }}>Online</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>

                        {/* Organizer row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: detailEvent.location || detailEvent.description ? 1 : 0, borderBottomColor: bdr }}>
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={sub} strokeWidth={2} strokeLinecap="round"/>
                            <Circle cx={12} cy={7} r={4} stroke={sub} strokeWidth={2}/>
                          </Svg>
                          <View>
                            <Text style={[detailStyles.label, { color: sub, marginBottom: 2 }]}>ORGANIZER</Text>
                            <Text style={[detailStyles.value, { color: txt }]}>
                              {detailEvent.organizer_name || `User #${detailEvent.organizer || '—'}`}
                            </Text>
                          </View>
                        </View>

                        {/* Location row */}
                        {!!detailEvent.location && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: detailEvent.description ? 1 : 0, borderBottomColor: bdr }}>
                            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                              <Path d="M12 21c-4-4-7-7.582-7-11a7 7 0 1114 0c0 3.418-3 7-7 11z" stroke={sub} strokeWidth={2}/>
                              <Circle cx={12} cy={10} r={2} stroke={sub} strokeWidth={2}/>
                            </Svg>
                            <View>
                              <Text style={[detailStyles.label, { color: sub, marginBottom: 2 }]}>LOCATION</Text>
                              <Text style={[detailStyles.value, { color: txt }]}>{detailEvent.location}</Text>
                            </View>
                          </View>
                        )}

                        {/* Description row */}
                        {!!detailEvent.description && (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 }}>
                            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginTop: 2 }}>
                              <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={sub} strokeWidth={2} strokeLinecap="round"/>
                              <Path d="M9 13h6M9 17h4M14 2v6h6" stroke={sub} strokeWidth={2} strokeLinecap="round"/>
                            </Svg>
                            <View style={{ flex: 1 }}>
                              <Text style={[detailStyles.label, { color: sub, marginBottom: 2 }]}>DESCRIPTION</Text>
                              <Text style={[detailStyles.value, { color: txt, lineHeight: 20 }]}>{detailEvent.description}</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Participants */}
                      <View>
                        {(() => {
                          const rsvpRows = Array.isArray(detailEvent.rsvp?.attendee_status)
                            ? detailEvent.rsvp.attendee_status
                            : null;
                          const fallbackIds = Array.isArray(detailEvent.attendees) ? detailEvent.attendees : [];
                          const total = rsvpRows ? rsvpRows.length : fallbackIds.length;

                          const statusInfo = (s) => {
                            const v = String(s || '').toUpperCase();
                            if (v === 'ORGANIZER') return { label: 'Organizer', color: '#3B72EE' };
                            if (v === 'ACCEPTED')  return { label: 'Accepted',  color: '#4ADE80' };
                            if (v === 'PENDING')   return { label: 'Pending',   color: '#F59E0B' };
                            if (v === 'DECLINED')  return { label: 'Declined',  color: '#EF4444' };
                            if (v === 'TENTATIVE') return { label: 'Tentative', color: '#A78BFA' };
                            return { label: v || 'Invited', color: sub };
                          };

                          return (
                            <>
                              <Text style={[detailStyles.label, { color: sub }]}>
                                PARTICIPANTS ({total})
                              </Text>

                              {total === 0 ? (
                                <Text style={[detailStyles.value, { color: sub, fontStyle: 'italic' }]}>
                                  No participants
                                </Text>
                              ) : (
                                <View style={{ flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                  {rsvpRows
                                    ? rsvpRows.map((row, i) => {
                                        const name = row.name || `User #${row.user_id}`;
                                        const initial = (name || '?').charAt(0).toUpperCase();
                                        const info = statusInfo(row.status);
                                        return (
                                          <View key={`rsvp-${row.user_id ?? i}`} style={detailStyles.attendeeRow}>
                                            <View style={detailStyles.attendeeAvatar}>
                                              <Text style={detailStyles.attendeeInitial}>{initial}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                              <Text style={[detailStyles.attendeeName, { color: txt }]} numberOfLines={1}>
                                                {name}
                                              </Text>
                                              <Text style={[detailStyles.attendeeStatus, { color: info.color }]}>
                                                {info.label}
                                              </Text>
                                            </View>
                                          </View>
                                        );
                                      })
                                    : fallbackIds.map((aid) => {
                                        const u = allUsers.find(x => String(x.id) === String(aid));
                                        const name = u ? (u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username) : `User #${aid}`;
                                        const initial = (name || '?').charAt(0).toUpperCase();
                                        return (
                                          <View key={aid} style={detailStyles.attendeeRow}>
                                            <View style={detailStyles.attendeeAvatar}>
                                              <Text style={detailStyles.attendeeInitial}>{initial}</Text>
                                            </View>
                                            <Text style={[detailStyles.attendeeName, { color: txt, flex: 1 }]} numberOfLines={1}>{name}</Text>
                                          </View>
                                        );
                                      })}
                                </View>
                              )}
                            </>
                          );
                        })()}
                      </View>
                    </View>
                  )}

                  {/* ── Edit mode ── */}
                  {editMode && (
                    <View style={{ gap: 12 }}>
                      {/* Date row */}
                      <View>
                        <Text style={[detailStyles.label, { color: sub }]}>DATE</Text>
                        <TouchableOpacity
                          style={[detailStyles.input, { borderColor: bdr }]}
                          onPress={() => {
                            setDraftDate(new Date(editStart));
                            setShowEditStart(false);
                            setShowEditEnd(false);
                            setShowEditDate(s => !s);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                              <Path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke={sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                            </Svg>
                            <Text style={{ color: txt, fontSize: 14 }}>{fmtDate(editStart.toISOString())}</Text>
                          </View>
                        </TouchableOpacity>
                        {showEditDate && (
                          <View style={[detailStyles.inlinePickerWrap, { borderColor: bdr, backgroundColor: bg }]}>
                            <DateTimePicker
                              value={draftDate}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              themeVariant={isDark ? 'dark' : 'light'}
                              onChange={(_e, d) => {
                                if (Platform.OS === 'android') {
                                  setShowEditDate(false);
                                  if (d) {
                                    setEditStart(combineDateTime(d, editStart));
                                    setEditEnd(combineDateTime(d, editEnd));
                                  }
                                  return;
                                }
                                if (d) setDraftDate(d);
                              }}
                            />
                            {Platform.OS === 'ios' && (
                              <View style={detailStyles.inlinePickerActions}>
                                <TouchableOpacity onPress={() => setShowEditDate(false)}>
                                  <Text style={[detailStyles.pickerCancel, { color: sub }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                  setEditStart(combineDateTime(draftDate, editStart));
                                  setEditEnd(combineDateTime(draftDate, editEnd));
                                  setShowEditDate(false);
                                }}>
                                  <Text style={detailStyles.pickerDone}>Done</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        )}
                      </View>

                      {/* Times row */}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[detailStyles.label, { color: sub }]}>START</Text>
                          <TouchableOpacity
                            style={[detailStyles.input, { borderColor: bdr }]}
                            onPress={() => {
                              setDraftStart(new Date(editStart));
                              setShowEditDate(false);
                              setShowEditEnd(false);
                              setShowEditStart(s => !s);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: txt, fontSize: 14 }}>{fmtTime(editStart.toISOString())}</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[detailStyles.label, { color: sub }]}>END</Text>
                          <TouchableOpacity
                            style={[detailStyles.input, { borderColor: bdr }]}
                            onPress={() => {
                              setDraftEnd(new Date(editEnd));
                              setShowEditDate(false);
                              setShowEditStart(false);
                              setShowEditEnd(s => !s);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: txt, fontSize: 14 }}>{fmtTime(editEnd.toISOString())}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Inline START wheel picker — same UI on iOS + Android */}
                      {showEditStart && (
                        <View style={[detailStyles.inlinePickerWrap, { borderColor: bdr, backgroundColor: bg }]}>
                          <Text style={[detailStyles.inlinePickerTitle, { color: sub }]}>SELECT START TIME</Text>
                          <WheelTimePicker
                            value={draftStart}
                            onChange={setDraftStart}
                            txtColor={txt}
                            subColor={sub}
                            bdrColor={bdr}
                          />
                          <View style={detailStyles.inlinePickerActions}>
                            <TouchableOpacity onPress={() => setShowEditStart(false)}>
                              <Text style={[detailStyles.pickerCancel, { color: sub }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                              const newStart = combineDateTime(editStart, draftStart);
                              setEditStart(newStart);
                              // Auto-bump: if end is now ≤ start, push end to start + 30 min
                              if (editEnd.getTime() <= newStart.getTime()) {
                                const bumped = new Date(newStart.getTime() + 30 * 60 * 1000);
                                setEditEnd(bumped);
                              }
                              setShowEditStart(false);
                            }}>
                              <Text style={detailStyles.pickerDone}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Inline END wheel picker */}
                      {showEditEnd && (
                        <View style={[detailStyles.inlinePickerWrap, { borderColor: bdr, backgroundColor: bg }]}>
                          <Text style={[detailStyles.inlinePickerTitle, { color: sub }]}>SELECT END TIME</Text>
                          <WheelTimePicker
                            value={draftEnd}
                            onChange={setDraftEnd}
                            txtColor={txt}
                            subColor={sub}
                            bdrColor={bdr}
                          />
                          <View style={detailStyles.inlinePickerActions}>
                            <TouchableOpacity onPress={() => setShowEditEnd(false)}>
                              <Text style={[detailStyles.pickerCancel, { color: sub }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                              let newEnd = combineDateTime(editEnd, draftEnd);
                              // Auto-bump: end must be after start. If user picked
                              // a time at or before start, silently set end = start + 30 min.
                              if (newEnd.getTime() <= editStart.getTime()) {
                                newEnd = new Date(editStart.getTime() + 30 * 60 * 1000);
                              }
                              setEditEnd(newEnd);
                              setShowEditEnd(false);
                            }}>
                              <Text style={detailStyles.pickerDone}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Title */}
                      <View>
                        <Text style={[detailStyles.label, { color: sub }]}>EVENT NAME</Text>
                        <TextInput
                          style={[detailStyles.input, { color: txt, borderColor: bdr }]}
                          value={editTitle}
                          onChangeText={setEditTitle}
                          placeholder="Event name"
                          placeholderTextColor={isDark ? '#5C5C6E' : '#AAAABC'}
                          editable={!savingEdit}
                        />
                      </View>

                      {/* Type */}
                      <View>
                        <Text style={[detailStyles.label, { color: sub }]}>EVENT TYPE</Text>
                        <TouchableOpacity
                          style={[detailStyles.input, { borderColor: bdr, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                          onPress={() => setShowEditTypeMenu(s => !s)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {(() => {
                              const t = EVENT_TYPES.find(t => t.id === editType);
                              return (
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t?.color || '#6B7588' }} />
                              );
                            })()}
                            <Text style={{ color: txt, fontSize: 14 }}>{editType}</Text>
                          </View>
                          <Text style={{ color: sub, fontSize: 12 }}>{showEditTypeMenu ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {showEditTypeMenu && (
                          <View style={[detailStyles.dropdown, { backgroundColor: card, borderColor: bdr }]}>
                            {EVENT_TYPES.map(t => (
                              <TouchableOpacity
                                key={t.id}
                                style={[detailStyles.dropdownItem, { borderBottomColor: bdr }, t.id === editType && { backgroundColor: 'rgba(59,114,238,0.08)' }]}
                                onPress={() => { setEditType(t.id); setShowEditTypeMenu(false); }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color }} />
                                  <Text style={{ color: txt, fontSize: 14 }}>{t.label}</Text>
                                </View>
                                {t.id === editType && <Text style={{ color: '#3B72EE', fontWeight: '700' }}>✓</Text>}
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Online meeting toggle */}
                      <TouchableOpacity
                        style={[detailStyles.toggleRow, { borderColor: bdr, backgroundColor: editOnline ? 'rgba(59,114,238,0.08)' : 'transparent' }]}
                        onPress={() => setEditOnline(v => !v)}
                        activeOpacity={0.7}
                      >
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginRight: 10 }}>
                          <Path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke={editOnline ? '#3B72EE' : sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                        </Svg>
                        <Text style={{ flex: 1, color: txt, fontSize: 14 }}>Online meeting</Text>
                        <View style={[detailStyles.toggleSwitch, editOnline && { backgroundColor: '#3B72EE' }]}>
                          <View style={[detailStyles.toggleKnob, editOnline && { transform: [{ translateX: 16 }] }]} />
                        </View>
                      </TouchableOpacity>

                      {/* Description */}
                      <View>
                        <Text style={[detailStyles.label, { color: sub }]}>DESCRIPTION</Text>
                        <TextInput
                          style={[detailStyles.input, { color: txt, borderColor: bdr, minHeight: 70, textAlignVertical: 'top' }]}
                          value={editDescription}
                          onChangeText={setEditDescription}
                          placeholder="Add a description"
                          placeholderTextColor={isDark ? '#5C5C6E' : '#AAAABC'}
                          multiline
                          editable={!savingEdit}
                        />
                      </View>

                      {/* Location */}
                      <View>
                        <Text style={[detailStyles.label, { color: sub }]}>LOCATION</Text>
                        <TextInput
                          style={[detailStyles.input, { color: txt, borderColor: bdr }]}
                          value={editLocation}
                          onChangeText={setEditLocation}
                          placeholder="Add location (optional)"
                          placeholderTextColor={isDark ? '#5C5C6E' : '#AAAABC'}
                          editable={!savingEdit}
                        />
                      </View>

                      {/* Participants */}
                      <View>
                        <Text style={[detailStyles.label, { color: sub }]}>
                          PARTICIPANTS ({editAttendees.length})
                        </Text>
                        <TouchableOpacity
                          style={[detailStyles.input, { borderColor: bdr }]}
                          onPress={() => setShowEditAttendees(s => !s)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: txt, fontSize: 14 }}>
                            {editAttendees.length === 0 ? 'Tap to add participants' : `${editAttendees.length} selected · tap to manage`}
                          </Text>
                        </TouchableOpacity>
                        {showEditAttendees && (
                          <View style={[detailStyles.attendeeList, { borderColor: bdr, backgroundColor: bg }]}>
                            <TextInput
                              style={[detailStyles.attendeeSearch, { color: txt, borderBottomColor: bdr }]}
                              value={editAttendeeSearch}
                              onChangeText={setEditAttendeeSearch}
                              placeholder="Search users…"
                              placeholderTextColor={isDark ? '#5C5C6E' : '#AAAABC'}
                            />
                            <ScrollView style={{ maxHeight: 200 }}>
                              {allUsers
                                .filter(u => {
                                  const q = editAttendeeSearch.toLowerCase().trim();
                                  if (!q) return true;
                                  return (u.first_name || '').toLowerCase().includes(q) ||
                                         (u.full_name  || '').toLowerCase().includes(q) ||
                                         (u.username   || '').toLowerCase().includes(q);
                                })
                                .map(u => {
                                  const selected = editAttendees.includes(u.id);
                                  const name = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || `User #${u.id}`;
                                  return (
                                    <TouchableOpacity
                                      key={u.id}
                                      style={[detailStyles.attendeeListItem, { borderBottomColor: bdr }, selected && { backgroundColor: 'rgba(59,114,238,0.08)' }]}
                                      onPress={() => toggleEditAttendee(u.id)}
                                    >
                                      <View style={detailStyles.attendeeAvatar}>
                                        <Text style={detailStyles.attendeeInitial}>{(name || '?').charAt(0).toUpperCase()}</Text>
                                      </View>
                                      <Text style={{ flex: 1, color: txt, fontSize: 13 }}>{name}</Text>
                                      {selected && <Text style={{ color: '#3B72EE', fontWeight: '700' }}>✓</Text>}
                                    </TouchableOpacity>
                                  );
                                })
                              }
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* ── Footer buttons ── */}
                <View style={detailStyles.footer}>
                  {!editMode && (
                    <>
                      {isOrganizer && (
                        <TouchableOpacity
                          style={[detailStyles.btn, detailStyles.btnDanger]}
                          onPress={() => {
                            const id = detailEvent.id;
                            closeEventDetail();
                            setTimeout(() => deleteEvent(id), 100);
                          }}
                        >
                          <Text style={detailStyles.btnDangerText}>
                            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                              <Path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                            </Svg>
                            {"  Delete"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {isOrganizer && (
                        <TouchableOpacity
                          style={[detailStyles.btn, detailStyles.btnPrimary]}
                          onPress={startEditMode}
                        >
                          <Text style={detailStyles.btnPrimaryText}>
                            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                              <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                              <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                            </Svg>
                            {"  Edit"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  {editMode && (
                    <>
                      <TouchableOpacity
                        style={[detailStyles.btn, detailStyles.btnSecondary, { borderColor: bdr }]}
                        onPress={cancelEdit}
                        disabled={savingEdit}
                      >
                        <Text style={[detailStyles.btnSecondaryText, { color: txt }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[detailStyles.btn, detailStyles.btnPrimary, savingEdit && { opacity: 0.6 }]}
                        onPress={saveEditedEvent}
                        disabled={savingEdit}
                      >
                        {savingEdit
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={detailStyles.btnPrimaryText}>Save changes</Text>
                        }
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        );
      })()}

      {/* Task detail modal — opened from the All Day / Tasks row */}
      <TaskDetailModal
        visible={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onUpdated={(updatedTask) => {
          // Refresh the tasks list and update the open task with server response
          fetchTasks();
          if (updatedTask) setDetailTask(updatedTask);
        }}
      />

      {/* Calendar share — UI matches the website's Share Calendar modal.
          Local state only for now; backend wiring will follow once the
          share endpoints are captured. */}
      <Modal
        transparent
        visible={shareModalOpen}
        animationType="fade"
        onRequestClose={() => setShareModalOpen(false)}
      >
        <TouchableOpacity
          style={shareStyles.backdrop}
          activeOpacity={1}
          onPress={() => setShareModalOpen(false)}
        />
        <View style={[shareStyles.card, { backgroundColor: card }]}>
          {/* Header */}
          <View style={shareStyles.header}>
            <View style={shareStyles.headerIcon}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx={18} cy={5}  r={3} stroke="#3B72EE" strokeWidth={2} />
                <Circle cx={6}  cy={12} r={3} stroke="#3B72EE" strokeWidth={2} />
                <Circle cx={18} cy={19} r={3} stroke="#3B72EE" strokeWidth={2} />
                <Line x1={8.59}  y1={13.51} x2={15.42} y2={17.49} stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" />
                <Line x1={15.41} y1={6.51}  x2={8.59}  y2={10.49} stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[shareStyles.title, { color: txt }]}>Share Calendar</Text>
              <Text style={[shareStyles.subtitle, { color: sub }]}>Share your calendar with team members</Text>
            </View>
            <TouchableOpacity onPress={() => setShareModalOpen(false)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={[shareStyles.close, { color: sub }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Add people */}
            <Text style={[shareStyles.sectionLabel, { color: txt }]}>Add people</Text>
            <View style={[shareStyles.searchBox, { backgroundColor: isDark ? '#1A1A20' : '#F5F5F7', borderColor: bdr }]}>
              <Text style={{ color: sub, fontSize: 13, marginRight: 6 }}>🔍</Text>
              <TextInput
                style={{ flex: 1, color: txt, fontSize: 13, paddingVertical: 0 }}
                placeholder="Search by name or email..."
                placeholderTextColor={isDark ? '#6C6C80' : '#AAAABC'}
                value={shareSearch}
                onChangeText={setShareSearch}
              />
            </View>

            {/* Search results dropdown — only when typing */}
            {shareSearch.trim().length > 0 && (
              <View style={[shareStyles.searchResults, { backgroundColor: card, borderColor: bdr }]}>
                {shareSearchResults().length === 0 ? (
                  <Text style={[shareStyles.empty, { color: sub }]}>No matching users</Text>
                ) : (
                  shareSearchResults().map(u => {
                    const display = (u.first_name && u.last_name)
                      ? `${u.first_name} ${u.last_name}`
                      : (u.first_name || u.username || 'User');
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[shareStyles.searchResultRow, { borderBottomColor: bdr }]}
                        onPress={() => addSharedPerson(u)}
                      >
                        <View style={shareStyles.avatar}>
                          <Text style={shareStyles.avatarText}>
                            {((u.first_name || u.username || 'U')[0] || 'U').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[shareStyles.personName, { color: txt }]}>{display}</Text>
                          {u.email ? <Text style={[shareStyles.personMeta, { color: sub }]} numberOfLines={1}>{u.email}</Text> : null}
                        </View>
                        <Text style={shareStyles.addBtn}>+ Add</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            {/* Shared with */}
            <Text style={[shareStyles.sectionLabel, { color: txt, marginTop: 18 }]}>
              Shared with ({sharedWith.length})
            </Text>
            {sharedWith.length === 0 ? (
              <Text style={[shareStyles.empty, { color: sub, paddingVertical: 12 }]}>
                Not shared with anyone yet.
              </Text>
            ) : (
              sharedWith.map(p => {
                const isOpen = String(openPermDropdownId) === String(p.id);
                const currentLabel = PERMISSION_LABELS[p.permission] || PERMISSION_LABELS.view;
                return (
                <View key={p.id} style={[shareStyles.personRow, { backgroundColor: isDark ? '#1A1A20' : '#FAFAFA', borderColor: bdr }]}>
                  <View style={shareStyles.avatar}>
                    <Text style={shareStyles.avatarText}>
                      {(p.name[0] || '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[shareStyles.personName, { color: txt }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[shareStyles.personMeta, { color: sub }]}>Shared {p.sharedAt}</Text>
                  </View>
                  <View>
                    <TouchableOpacity
                      onPress={() => setOpenPermDropdownId(isOpen ? null : p.id)}
                      style={[shareStyles.permPill, { borderColor: bdr }]}
                    >
                      <Text style={[shareStyles.permPillText, { color: txt }]}>
                        {currentLabel} ▾
                      </Text>
                    </TouchableOpacity>
                    {isOpen && (
                      <View style={[shareStyles.permDropdown, { backgroundColor: card, borderColor: bdr }]}>
                        {Object.entries(PERMISSION_LABELS).map(([value, label]) => {
                          const selected = p.permission === value;
                          return (
                            <TouchableOpacity
                              key={value}
                              style={[shareStyles.permDropdownItem, selected && { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                              onPress={() => setSharedPermission(p.id, value)}
                            >
                              <Text style={[shareStyles.permDropdownCheck, { color: selected ? '#10B981' : 'transparent' }]}>✓</Text>
                              <Text style={[shareStyles.permDropdownLabel, { color: txt }]}>{label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => removeSharedPerson(p.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ marginLeft: 6 }}
                  >
                    <Text style={{ color: '#EF4444', fontSize: 16 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
                );
              })
            )}

            {/* Calendars shared with you */}
            <Text style={[shareStyles.sectionLabel, { color: txt, marginTop: 18 }]}>
              Calendars shared with you ({sharedWithMe.length})
            </Text>
            {sharedWithMe.length === 0 ? (
              <Text style={[shareStyles.empty, { color: sub, paddingVertical: 12 }]}>
                No calendars shared with you yet.
              </Text>
            ) : (
              sharedWithMe.map(p => (
                <View key={p.id} style={[shareStyles.personRow, { backgroundColor: isDark ? '#1A1A20' : '#FAFAFA', borderColor: bdr }]}>
                  <View style={[shareStyles.avatar, { backgroundColor: '#E9D5FF' }]}>
                    <Text style={[shareStyles.avatarText, { color: '#7C3AED' }]}>
                      {(p.name[0] || '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[shareStyles.personName, { color: txt }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[shareStyles.personMeta, { color: sub }]}>{PERMISSION_LABELS[p.permission] || PERMISSION_LABELS.view}</Text>
                  </View>
                  {!calendarShared && (
                    <View style={shareStyles.enableHint}>
                      <Text style={shareStyles.enableHintText}>Enable "Shared: On" to view</Text>
                    </View>
                  )}
                </View>
              ))
            )}

            {/* Or share via link */}
            <View style={[shareStyles.divider, { backgroundColor: bdr, marginTop: 18 }]}>
              <View style={[shareStyles.dividerLabel, { backgroundColor: card }]}>
                <Text style={{ color: sub, fontSize: 11 }}>Or share via link</Text>
              </View>
            </View>

            <View style={shareStyles.publicLinkRow}>
              <Text style={[shareStyles.publicLinkLabel, { color: txt }]}>🔗  Public link</Text>
              <TouchableOpacity
                style={[
                  shareStyles.toggle,
                  publicLinkOn ? { backgroundColor: '#3B82F6' } : { backgroundColor: isDark ? '#3A3A48' : '#DEDEE8' },
                ]}
                onPress={() => setPublicLinkOn(o => !o)}
                activeOpacity={0.8}
              >
                <View style={[shareStyles.toggleKnob, publicLinkOn && { transform: [{ translateX: 18 }] }]} />
              </TouchableOpacity>
            </View>

            {publicLinkOn && (
              <>
                <View style={[shareStyles.linkBox, { backgroundColor: isDark ? '#1A1A20' : '#F5F5F7', borderColor: bdr }]}>
                  <Text style={[shareStyles.linkText, { color: txt }]} numberOfLines={1}>{publicLinkUrl}</Text>
                  <TouchableOpacity style={shareStyles.copyBtn}>
                    <Text style={shareStyles.copyBtnText}>📋 Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[shareStyles.linkNote, { color: sub }]}>
                  🔒 Anyone with this link can view your calendar (read-only)
                </Text>
              </>
            )}

            {/* Export Calendar */}
            <View style={[shareStyles.exportRow, { backgroundColor: isDark ? '#0F2C25' : '#ECFDF5', borderColor: '#10B981' }]}>
              <View style={shareStyles.exportLeft}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>⬇️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[shareStyles.exportTitle, { color: txt }]}>Export Calendar</Text>
                  <Text style={[shareStyles.exportSub, { color: sub }]}>Download as ICS file for Google/Outlook</Text>
                </View>
              </View>
              <TouchableOpacity style={shareStyles.exportBtn}>
                <Text style={shareStyles.exportBtnText}>⬇  Export All</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Close */}
          <TouchableOpacity
            style={[shareStyles.closeFooter, { borderTopColor: bdr }]}
            onPress={() => setShareModalOpen(false)}
          >
            <Text style={[shareStyles.closeFooterText, { color: txt }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
    backgroundColor: '#0000CD',
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 12, borderWidth: 1,
    width: '100%', marginBottom: 14,
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, borderWidth: 1, width: '100%',
  },
  createTaskTopText: { fontSize: 14, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#3B72EE', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 17, fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },

  // Stats
  statsBar: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '700', marginTop: 3, letterSpacing: 0.8 },

  // Toolbar
  segRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 0,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  toolbarCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  todayBtn: { backgroundColor: '#1A1A2E', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  todayBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  todayBtnChevron: { color: '#fff', fontSize: 9, marginTop: 1 },
  arrowBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  arrowText: { fontSize: 22, fontWeight: '300' },
  dateRange: { fontSize: 16, fontWeight: '700' },
  newEventBtn: { backgroundColor: '#3B72EE', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  newEventBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // View-mode dropdown menu (positioned dynamically — see openViewMenu)
  viewMenu: { position: 'absolute', minWidth: 140, borderRadius: 8, borderWidth: 1, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 12 },
  viewMenuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  viewMenuItemText: { fontSize: 13 },
  viewMenuCheck: { color: '#3B72EE', fontSize: 13, fontWeight: '700' },

  // Sidebar
  miniCalOverlay: { position: 'absolute', top: 0, left: 0, width: 300, borderRadius: 12, borderWidth: 1, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 20, padding: 8 },
  miniCalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 },
  miniCalClose: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F5', marginTop: 6 },
  dateRangeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  miniCal: { padding: 8, borderRadius: 10, margin: 4, borderWidth: 1 },
  miniCalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  miniArrow: { fontSize: 22, fontWeight: '600', paddingHorizontal: 6 },
  miniMonthLabel: { fontSize: 15, fontWeight: '700' },
  miniDayRow: { flexDirection: 'row', marginBottom: 6 },
  miniDayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  miniDatesGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  miniDateCell: { width: '14.28%', alignItems: 'center', paddingVertical: 3 },
  miniDateCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  miniDateToday: { backgroundColor: '#2952C4' },
  miniDateSelected: { borderWidth: 1.5, borderColor: '#3B72EE' },
  miniDateText: { fontSize: 13, fontWeight: '500' },
  miniDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#3B72EE', marginTop: 1 },

  legend: { borderTopWidth: 1, paddingTop: 10, paddingHorizontal: 10, gap: 7, flexDirection: 'row', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '48%' },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontSize: 12, fontWeight: '500' },

  // Calendar grid
  dayHeaders: { flexDirection: 'row', borderBottomWidth: 1 },
  timeLabel: { width: 48, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 },
  // Top-left corner cell holding the Share icon + Shared On/Off pill
  shareCornerCell: { alignItems: 'center', justifyContent: 'center', paddingRight: 0, gap: 3 },
  shareIconBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E6F9F6' },
  // Custom-drawn share glyph (3 connected dots, mimics standard "share" icon)
  shareGlyph: { width: 16, height: 16, position: 'relative' },
  shareGlyphDot: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981' },
  shareGlyphDotTopRight:    { top: 0,  right: 0 },
  shareGlyphDotLeft:        { top: 5.5, left: 0 },
  shareGlyphDotBottomRight: { bottom: 0, right: 0 },
  shareGlyphLine: { position: 'absolute', height: 1.4, backgroundColor: '#10B981', borderRadius: 1 },
  // Top line: from left dot to top-right dot (slanting up-right)
  shareGlyphLineTop:    { width: 9, top: 4.5,  left: 4, transform: [{ rotate: '-30deg' }] },
  shareGlyphLineBottom: { width: 9, bottom: 4.5, left: 4, transform: [{ rotate:  '30deg' }] },
  sharedPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, minWidth: 30, alignItems: 'center' },
  sharedPillText: { fontSize: 9, fontWeight: '700' },
  timeLabelText: { fontSize: 10, fontWeight: '500' },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderLeftWidth: 1 },
  dayHeaderDay: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  dayHeaderNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  dayHeaderNumToday: { backgroundColor: '#2952C4' },
  dayHeaderNumText: { fontSize: 13, fontWeight: '700' },

  // All day row
  allDayRow: { flexDirection: 'row', minHeight: 36, borderBottomWidth: 1 },
  dayCol: { flex: 1, borderLeftWidth: 1, minHeight: 56, padding: 2 },
  noTasksText: { fontSize: 9, textAlign: 'center', marginTop: 6 },
  allDayEvent: { backgroundColor: '#3B72EE15', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2, borderLeftWidth: 2, borderLeftColor: '#3B72EE' },
  allDayEventText: { fontSize: 9, color: '#3B72EE', fontWeight: '600' },
  allDayHeader: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, gap: 1 },
  allDayChevron: { fontSize: 14, fontWeight: '700', lineHeight: 14 },
  allDayCountText: { fontSize: 9, fontWeight: '500', marginTop: 1 },
  allDayTask: { backgroundColor: 'rgba(124,58,237,0.08)', borderLeftWidth: 2, borderLeftColor: '#7C3AED', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3, marginBottom: 3 },
  allDayTaskText: { fontSize: 9, fontWeight: '600' },

  // Hour rows
  hourRow: { flexDirection: 'row', minHeight: 58, borderBottomWidth: 1 },
  currentHourCol: { backgroundColor: 'rgba(239,68,68,0.04)' },
  currentTimeLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: '#EF4444', borderRadius: 1 },
  eventBlock: { backgroundColor: '#5B8FF5', borderRadius: 6, padding: 4, marginBottom: 2, borderLeftWidth: 3, borderLeftColor: 'rgba(0,0,0,0.12)' },
  eventBlockText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  eventBlockTime: { fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  // Month view
  monthGrid: { margin: 8, borderRadius: 14, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  monthDayRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  monthDayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  monthDates: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFFFFF' },
  monthCell: { width: '14.28%', minHeight: 64, borderTopWidth: 1, padding: 4, alignItems: 'center' },
  monthDateCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  monthDateText: { fontSize: 13, fontWeight: '500' },
  monthEventChip: { backgroundColor: '#3B72EE15', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginTop: 2, borderLeftWidth: 2, borderLeftColor: '#3B72EE', alignSelf: 'stretch' },
  monthEventChipText: { fontSize: 9, color: '#3B72EE', fontWeight: '650' },
  monthMoreText: { fontSize: 8, color: '#888899', marginTop: 1 },

  // Modal
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20 },
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
  alertInfoBox: { backgroundColor: 'rgba(59,114,238,0.08)', borderWidth: 1, borderColor: 'rgba(59,114,238,0.3)', borderRadius: 10, padding: 12, marginBottom: 14 },
  alertInfoText: { fontSize: 12, color: '#3B72EE', fontWeight: '500', lineHeight: 18 },
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
    borderColor: '#3B72EE', backgroundColor: 'rgba(59,114,238,0.08)',
  },
  teamsBtnText: { fontSize: 13, color: '#5C5C6E', fontWeight: '600' },
  teamsBtnTextOn: { color: '#3B72EE' },

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
    fontSize: 13, color: '#3B72EE', fontWeight: '700',
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
    backgroundColor: 'rgba(59,114,238,0.1)',
    borderRadius: 16, paddingLeft: 4, paddingRight: 10, paddingVertical: 3,
  },
  participantChipAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center',
  },
  participantChipAvatarText: { color: '#3B72EE', fontSize: 10, fontWeight: '700' },
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
  userAvatarText: { color: '#3B72EE', fontSize: 12, fontWeight: '700' },
  userName: { flex: 1, fontSize: 13, color: '#1A1A2E', fontWeight: '500' },
  userCheckbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#DEDEE8',
    justifyContent: 'center', alignItems: 'center',
  },
  userCheckboxActive: {
    backgroundColor: '#3B72EE', borderColor: '#3B72EE',
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
  attendeeRemove: { fontSize: 16, fontWeight: '600', marginLeft: 2, marginTop: -1 },
  attendeeAddBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  attendeeAddBtnText: { fontSize: 12, fontWeight: '600' },

  // Add-participant picker (search box + scrollable user list)
  pickerBox: { borderRadius: 10, borderWidth: 1, padding: 8, marginTop: -6, marginBottom: 14 },
  pickerSearch: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginBottom: 6 },
  pickerEmpty: { fontSize: 12, textAlign: 'center', paddingVertical: 16 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, gap: 10 },
  pickerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center' },
  pickerAvatarText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  pickerName: { flex: 1, fontSize: 13, fontWeight: '500' },
  pickerCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  pickerCheckMark: { color: '#fff', fontSize: 13, fontWeight: '700' },

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

// ── Event Detail / Edit modal styles ────────────────────────────────────
const detailStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%', maxWidth: 420,
    borderRadius: 16, borderWidth: 1,
    padding: 16,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '700' },
  organizerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59,114,238,0.12)',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginTop: 4,
  },
  organizerBadgeText: { color: '#3B72EE', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  closeBtn: { fontSize: 18, fontWeight: '700', paddingHorizontal: 4 },

  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: '500' },
  bigValue: { fontSize: 17, fontWeight: '700' },

  onlinePill: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, marginLeft: 6,
  },
  onlinePillText: { color: '#7C3AED', fontSize: 10, fontWeight: '700' },

  attendeeChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(59,114,238,0.10)',
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 16, gap: 6,
    maxWidth: 180,
  },
  attendeeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 4,
  },
  attendeeStatus: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  attendeeAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#3B72EE',
    justifyContent: 'center', alignItems: 'center',
  },
  attendeeInitial: { color: '#fff', fontSize: 13, fontWeight: '700' },
  attendeeName: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },

  // Edit-mode inputs
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
  },
  dropdown: {
    borderWidth: 1, borderRadius: 10,
    marginTop: 6, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  toggleSwitch: {
    width: 38, height: 22, borderRadius: 11,
    backgroundColor: '#D1D5DB',
    padding: 2,
  },
  toggleKnob: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff',
  },
  attendeeList: {
    borderWidth: 1, borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
  attendeeSearch: {
    borderBottomWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13,
  },
  attendeeListItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1,
  },

  // Footer buttons
  footer: {
    flexDirection: 'row', gap: 8,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#EBEBF0',
  },
  btn: {
    flex: 1, height: 44, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#EEF3FF' },
  btnPrimaryText: { color: '#3B72EE', fontSize: 14, fontWeight: '700' },
  btnSecondary: { borderWidth: 1, backgroundColor: 'transparent' },
  btnSecondaryText: { fontSize: 14, fontWeight: '600' },
  btnDanger: { backgroundColor: 'rgba(239,68,68,0.10)' },
  btnDangerText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },

  // Picker modals (date / start / end)
  pickerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#EBEBF0',
  },
  pickerTitle: { fontSize: 14, fontWeight: '700' },
  pickerCancel: { fontSize: 14, fontWeight: '500' },
  pickerDone:   { fontSize: 14, fontWeight: '700', color: '#3B72EE' },

  // Inline (non-modal) date/time spinner that appears below the field
  inlinePickerWrap: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4,
  },
  inlinePickerTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.6,
    marginBottom: 2, marginLeft: 6,
  },
  inlinePickerActions: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EBEBF0',
    marginTop: 4,
  },
});

const shareStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  // Card sized to take up most of the screen, with a max height so the inner ScrollView can scroll
  card: {
    position: 'absolute',
    left: 16, right: 16, top: '8%', bottom: '8%',
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 18,
  },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)' },
  headerIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 11, marginTop: 1 },
  close: { fontSize: 18, fontWeight: '500', paddingHorizontal: 4 },
  // Section heading
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  // Search input wrapper
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    height: 40, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 10,
  },
  // Search results dropdown
  searchResults: {
    marginTop: 6, borderWidth: 1, borderRadius: 10, overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Person row (Shared with / Shared with you)
  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 10, borderWidth: 1,
    marginBottom: 8,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FED7AA', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#9A3412', fontSize: 12, fontWeight: '700' },
  personName: { fontSize: 13, fontWeight: '600' },
  personMeta: { fontSize: 11, marginTop: 1 },
  // "+ Add" inline button on the search-result row
  addBtn: { color: '#3B82F6', fontSize: 12, fontWeight: '700', paddingHorizontal: 6 },
  // Permission pill
  permPill: { paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderRadius: 6 },
  permPillText: { fontSize: 11, fontWeight: '600' },
  // Permission dropdown menu (shown below the pill when tapped)
  permDropdown: {
    position: 'absolute', top: 28, right: 0,
    minWidth: 130, borderWidth: 1, borderRadius: 8,
    paddingVertical: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    zIndex: 50,
  },
  permDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, gap: 6 },
  permDropdownCheck: { fontSize: 12, width: 12, fontWeight: '700' },
  permDropdownLabel: { fontSize: 12, fontWeight: '500' },
  // "Enable Shared On to view" hint pill on shared-with-me rows when sharing is off
  enableHint: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  enableHintText: { color: '#92400E', fontSize: 10, fontWeight: '600' },
  // Empty-state text
  empty: { fontSize: 12, paddingVertical: 8 },
  // Divider with centered label ("Or share via link")
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6, position: 'relative' },
  dividerLabel: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 10, top: -8 },
  // Public link toggle row
  publicLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  publicLinkLabel: { fontSize: 13, fontWeight: '600' },
  toggle: { width: 38, height: 22, borderRadius: 11, padding: 2, justifyContent: 'center' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  // Public link copy box
  linkBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    marginTop: 10, borderRadius: 10, borderWidth: 1,
  },
  linkText: { flex: 1, fontSize: 12 },
  copyBtn: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  copyBtnText: { color: '#1D4ED8', fontSize: 11, fontWeight: '700' },
  linkNote: { fontSize: 11, marginTop: 6 },
  // Export Calendar row
  exportRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 10, marginTop: 14, borderRadius: 10, borderWidth: 1,
  },
  exportLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  exportTitle: { fontSize: 13, fontWeight: '700' },
  exportSub: { fontSize: 11, marginTop: 1 },
  exportBtn: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  exportBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Footer Close button
  closeFooter: { paddingVertical: 12, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  closeFooterText: { fontSize: 14, fontWeight: '600' },
});
