import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, StatusBar, Platform, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useContext, useRef, useEffect } from 'react';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';
import { NotificationsContext } from '../context/NotificationsContext';
import { getUsers } from '../services/ApiService';

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
  const [allUsers,        setAllUsers]        = useState([]);
  const slideAnim = useRef(new Animated.Value(-600)).current;

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) setEvents(JSON.parse(data).filter(e => e.type === 'event'));
      else setEvents([]);
    });
  }, []));

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
    }, [route.params?.openCreateModal])
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

    const newEvent = {
      id: Date.now().toString(), type: 'event',
      name: eventName.trim(),
      description: eventDesc.trim(),
      eventDate: pickerDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' at ' +
        pickerDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      eventTimestamp:     pickerDate.toISOString(),
      eventEndTimestamp:  endPickerDate.toISOString(),
      eventType:          resolvedType,
      teamsMeeting:       teamsMeeting,
      location:           location.trim(),
      participants:       participants, // [{id, name, avatar}]
      images: [], createdAt: new Date().toISOString(), status: 'Todo',
    };
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const all = existing ? JSON.parse(existing) : [];
      const updated = [newEvent, ...all];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setEvents(updated.filter(e => e.type === 'event'));

      // Send notification ONLY to selected participants (if any)
      // When no participants selected, fire a general notification for the creator
      if (participants.length > 0) {
        participants.forEach(p => {
          addNotification({
            type: 'event', icon: '📅',
            title: `Event: ${newEvent.name}`,
            body: `${resolvedType} scheduled for ${newEvent.eventDate}. You've been invited.`,
            recipientId: p.id, // backend will route this
          });
        });
      } else {
        addNotification({
          type: 'event', icon: '📅',
          title: 'Event Created',
          body: `"${newEvent.name}" scheduled.`,
        });
      }
      closeModal();
    } catch { Alert.alert('Error', 'Could not save event.'); }
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
        const existing = await AsyncStorage.getItem(STORAGE_KEY);
        const all = existing ? JSON.parse(existing) : [];
        const updated = all.filter(e => e.id !== id);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setEvents(updated.filter(e => e.type === 'event'));
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
                  if (isPast) {
                    Alert.alert(
                      "Can't schedule in the past",
                      "Events can only be created for the current time or a future date.",
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  const nd = new Date(d);
                  nd.setHours(hour, 0, 0, 0);
                  openModal(nd);
                }}
                activeOpacity={0.7}
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
          <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
          <Text style={[styles.brandName, { color: txt }]}>Calendar</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.navigate('Chat')}>
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
                    <View style={[styles.dayHeaderNum, isToday && styles.dayHeaderNumToday]}>
                      <Text style={[styles.dayHeaderNumText, { color: isToday ? '#fff' : txt }]}>
                        {d.getDate()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {viewMode === 'month' ? renderMonthView() : renderTimeGrid()}
      </View>

      {/* ── Create Event Modal ── */}
      {modalVisible && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.topPanel, { transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={styles.handle} />
              <ScrollView style={styles.panelScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                <View style={styles.panelHeader}>
                  <Text style={styles.modalTitle}>Create event</Text>
                  <TouchableOpacity style={styles.closeCircle} onPress={closeModal}>
                    <Text style={styles.closeCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* ── Row: Date + Start — End Time ── */}
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={[styles.miniPickerBtn, { flex: 1.4 }]}
                    onPress={() => { setShowDatePicker(s => !s); setShowTimePicker(false); setShowEndTimePicker(false); }}
                  >
                    <Text style={styles.miniPickerText} numberOfLines={1}>
                      📅  {pickerDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={styles.miniPickerChevron}>▾</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniPickerBtn, { flex: 1 }]}
                    onPress={() => { setShowTimePicker(s => !s); setShowDatePicker(false); setShowEndTimePicker(false); }}
                  >
                    <Text style={styles.miniPickerText}>
                      {pickerDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <Text style={styles.miniPickerChevron}>▾</Text>
                  </TouchableOpacity>
                  <Text style={styles.dash}>—</Text>
                  <TouchableOpacity
                    style={[styles.miniPickerBtn, { flex: 1 }]}
                    onPress={() => { setShowEndTimePicker(s => !s); setShowDatePicker(false); setShowTimePicker(false); }}
                  >
                    <Text style={styles.miniPickerText}>
                      {endPickerDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <Text style={styles.miniPickerChevron}>▾</Text>
                  </TouchableOpacity>
                </View>

                {/* Date Picker expanded */}
                {showDatePicker && (
                  <View style={styles.pickerCard}>
                    <DateTimePicker
                      value={tempPickerDate}
                      mode="date"
                      display="inline"
                      minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                      onChange={(_, date) => { if (date) setTempPickerDate(date); }}
                      style={{ width: '100%' }}
                    />
                    <View style={styles.pickerActions}>
                      <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.pickerCancelText}>Cancel</Text>
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
                  <View style={styles.pickerCard}>
                    <DateTimePicker
                      value={tempPickerDate}
                      mode="time"
                      display="spinner"
                      onChange={(_, date) => { if (date) setTempPickerDate(date); }}
                      style={{ width: '100%' }}
                    />
                    <View style={styles.pickerActions}>
                      <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowTimePicker(false)}>
                        <Text style={styles.pickerCancelText}>Cancel</Text>
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
                  <View style={styles.pickerCard}>
                    <DateTimePicker
                      value={tempEndPickerDate}
                      mode="time"
                      display="spinner"
                      onChange={(_, date) => { if (date) setTempEndPickerDate(date); }}
                      style={{ width: '100%' }}
                    />
                    <View style={styles.pickerActions}>
                      <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowEndTimePicker(false)}>
                        <Text style={styles.pickerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => {
                        const ne = new Date(pickerDate);
                        ne.setHours(tempEndPickerDate.getHours(), tempEndPickerDate.getMinutes());
                        setEndPickerDate(ne);
                        setShowEndTimePicker(false);
                      }}>
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Event Name */}
                <Text style={styles.fieldLabel}>EVENT NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter event name"
                  placeholderTextColor="#AAAABC"
                  value={eventName}
                  onChangeText={setEventName}
                />

                {/* Event Type Dropdown */}
                <Text style={styles.fieldLabel}>EVENT TYPE</Text>
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
                  <View style={styles.typeDropdown}>
                    {EVENT_TYPES.map((t, i) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.typeOption, eventType === t.id && styles.typeOptionActive]}
                        onPress={() => { setEventType(t.id); setShowTypeDropdown(false); }}
                      >
                        <Text style={{ fontSize: 16, marginRight: 10 }}>{t.icon}</Text>
                        <Text style={[styles.typeOptionText, eventType === t.id && styles.typeOptionTextActive]}>
                          {t.label}
                        </Text>
                        {eventType === t.id && <Text style={styles.typeCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                    {/* Custom 'Other' input */}
                    <View style={styles.typeCustomRow}>
                      <Text style={{ fontSize: 16, marginRight: 8 }}>✏️</Text>
                      <TextInput
                        style={styles.typeCustomInput}
                        placeholder="Other (type custom name)"
                        placeholderTextColor="#AAAABC"
                        value={customType}
                        onChangeText={t => { setCustomType(t); setEventType('Other'); }}
                        onFocus={() => setEventType('Other')}
                      />
                    </View>
                  </View>
                )}

                {/* Teams meeting toggle */}
                <TouchableOpacity
                  style={[styles.teamsBtn, teamsMeeting && styles.teamsBtnOn]}
                  onPress={() => setTeamsMeeting(v => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, marginRight: 8 }}>📹</Text>
                  <Text style={[styles.teamsBtnText, teamsMeeting && styles.teamsBtnTextOn]}>
                    Teams meeting
                  </Text>
                  {teamsMeeting && <Text style={{ marginLeft: 8, color: '#4ECDC4', fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>

                {/* Description */}
                <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.input, { height: 80, paddingTop: 12 }]}
                  placeholder="Let's discuss"
                  placeholderTextColor="#AAAABC"
                  value={eventDesc}
                  onChangeText={setEventDesc}
                  multiline
                  textAlignVertical="top"
                />

                {/* Location */}
                <View style={styles.locationWrap}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <TextInput
                    style={styles.locationInput}
                    placeholder="Add location (optional)"
                    placeholderTextColor="#AAAABC"
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                {/* Participants */}
                <View style={styles.participantsHeaderRow}>
                  <Text style={styles.fieldLabel}>PARTICIPANTS</Text>
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
                        <Text style={styles.participantChipName}>{p.name}</Text>
                        <TouchableOpacity onPress={() => toggleParticipant({ id: p.id, first_name: p.name })}>
                          <Text style={styles.participantChipRemove}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  !showParticipants && (
                    <View style={styles.noParticipants}>
                      <Text style={styles.noParticipantsIcon}>👥</Text>
                      <Text style={styles.noParticipantsText}>No participants yet</Text>
                    </View>
                  )
                )}

                {/* Participants picker */}
                {showParticipants && (
                  <View style={styles.participantsPicker}>
                    <TextInput
                      style={styles.participantSearchInput}
                      placeholder="Search users..."
                      placeholderTextColor="#AAAABC"
                      value={participantSearch}
                      onChangeText={setParticipantSearch}
                    />
                    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                      {filteredUsers.length === 0 ? (
                        <Text style={styles.noUsersText}>No users found</Text>
                      ) : (
                        filteredUsers.map(u => {
                          const isSelected = participants.some(p => p.id === u.id);
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={styles.userRow}
                              onPress={() => toggleParticipant(u)}
                            >
                              <View style={styles.userAvatar}>
                                <Text style={styles.userAvatarText}>
                                  {((u.first_name || u.username || 'U')[0] || 'U').toUpperCase()}
                                </Text>
                              </View>
                              <Text style={styles.userName}>{u.first_name || u.username || 'User'}</Text>
                              <View style={[styles.userCheckbox, isSelected && styles.userCheckboxActive]}>
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
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
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
    </SafeAreaView>
  );
}

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
