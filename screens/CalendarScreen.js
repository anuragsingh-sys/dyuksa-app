import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, StatusBar, Platform, Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useContext, useRef } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NotificationsContext } from '../context/NotificationsContext';
import { scheduleEventReminders } from '../services/PushNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const { addNotification } = useContext(NotificationsContext);
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [events, setEvents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-500)).current;
  const animated  = useRef(false);
  const [eventName, setEventName] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventDesc, setEventDesc] = useState('');

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) setEvents(JSON.parse(data).filter(e => e.type === 'event'));
    });
  }, []));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const prevMonth   = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth   = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const selectedDateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
  const dayEvents = events.filter(e => { try { return e.eventDate?.startsWith(selectedDateStr); } catch { return false; } });
  const hasEvent  = (day) => events.some(e => {
    try { return e.eventDate?.startsWith(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`); }
    catch { return false; }
  });

  const openModal = () => {
    setModalVisible(true);
    animated.current = true;
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeModal = () => {
    animated.current = false;
    Animated.timing(slideAnim, { toValue: -500, duration: 250, useNativeDriver: true })
      .start(() => { setModalVisible(false); setEventName(''); setEventTime(''); setEventDesc(''); });
  };

  const saveEvent = async () => {
    if (!eventName.trim()) { Alert.alert('Required', 'Enter an event name.'); return; }
    const newEvent = {
      id: Date.now().toString(), type: 'event',
      name: eventName.trim(), description: eventDesc.trim(),
      eventDate: `${selectedDateStr}${eventTime ? ' ' + eventTime : ''}`,
      images: [], createdAt: new Date().toISOString(), status: 'Todo',
    };
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const updated  = [newEvent, ...(existing ? JSON.parse(existing) : [])];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setEvents(updated.filter(e => e.type === 'event'));
      addNotification({
        type: 'event',
        icon: '📅',
        title: 'Event Created',
        body: `"${newEvent.name}" scheduled${newEvent.eventDate ? ' for ' + newEvent.eventDate : ''}.`,
      });
      scheduleEventReminders(newEvent).catch(() => {});
      closeModal();
    } catch { Alert.alert('Error', 'Could not save event.'); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0D0D0F" : "#fff"} translucent={false} />

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

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Month navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthArrow} onPress={prevMonth}>
            <Text style={styles.monthArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity style={styles.monthArrow} onPress={nextMonth}>
            <Text style={styles.monthArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar grid */}
        <View style={styles.calGrid}>
          {/* Day labels */}
          <View style={styles.dayLabels}>
            {DAYS.map(d => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
          </View>

          {/* Date cells */}
          <View style={styles.datesGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`e${i}`} style={styles.dateCellWrapper} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day     = i + 1;
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSel   = day === selectedDay;
              const isActive = isSel || isToday;
              return (
                <TouchableOpacity
                  key={day}
                  style={styles.dateCellWrapper}
                  onPress={() => setSelectedDay(day)}
                >
                  {/* Circle — black when selected/today */}
                  <View style={[styles.dateCircle, isActive && styles.dateCircleActive]}>
                    <Text style={[styles.dateText, isActive && styles.dateTextActive]}>
                      {day}
                    </Text>
                  </View>
                  {hasEvent(day) && <View style={styles.eventDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected day events */}
        <View style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>📅  {MONTHS[month]} {selectedDay}, {year}</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openModal}>
              <Text style={styles.addBtnText}>+ Add Event</Text>
            </TouchableOpacity>
          </View>

          {dayEvents.length === 0 ? (
            <View style={styles.emptyDay}>
              <Text style={{ fontSize: 28, opacity: 0.3 }}>📅</Text>
              <Text style={styles.emptyDayText}>No events this day</Text>
              <Text style={styles.emptyDaySub}>Tap "+ Add Event" to create one</Text>
            </View>
          ) : (
            dayEvents.map(ev => (
              <View key={ev.id} style={styles.eventCard}>
                <View style={styles.eventLine} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventName}>{ev.name}</Text>
                  {!!ev.eventDate && <Text style={styles.eventTime}>{ev.eventDate}</Text>}
                  {!!ev.description && <Text style={styles.eventDesc}>{ev.description}</Text>}
                </View>
                <View style={styles.eventBadge}>
                  <Text style={styles.eventBadgeText}>Event</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* All events */}
        {events.length > 0 && (
          <View style={[styles.daySection, { marginBottom: 20 }]}>
            <Text style={styles.allEventsLabel}>ALL EVENTS</Text>
            {events.map(ev => (
              <View key={ev.id} style={styles.eventCard}>
                <View style={styles.eventLine} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventName}>{ev.name}</Text>
                  {!!ev.eventDate && <Text style={styles.eventTime}>{ev.eventDate}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Add Event Modal — slides from TOP, safe from keyboard */}
      {modalVisible && (
        <Modal visible transparent animationType="none" onRequestClose={closeModal}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.topPanel, { transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={styles.handle} />
              <ScrollView
                style={{ paddingHorizontal: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.panelHeader}>
                  <Text style={styles.modalTitle}>📅  {MONTHS[month]} {selectedDay}, {year}</Text>
                  <TouchableOpacity style={styles.closeCircle} onPress={closeModal}>
                    <Text style={styles.closeCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Event Title *</Text>
                <TextInput
                  placeholder="What's the event?"
                  placeholderTextColor="#AAAABC"
                  style={styles.input}
                  value={eventName}
                  onChangeText={setEventName}
                  autoFocus
                />
                <Text style={styles.fieldLabel}>Time</Text>
                <TextInput
                  placeholder="e.g. 3:00 PM"
                  placeholderTextColor="#AAAABC"
                  style={styles.input}
                  value={eventTime}
                  onChangeText={setEventTime}
                />
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  placeholder="Add details..."
                  placeholderTextColor="#AAAABC"
                  style={[styles.input, { height: 80, paddingTop: 12 }]}
                  value={eventDesc}
                  onChangeText={setEventDesc}
                  multiline
                  textAlignVertical="top"
                />
                <View style={[styles.modalBtns, { marginBottom: 24 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveEvent}>
                    <Text style={styles.saveBtnText}>Save Event</Text>
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
  safe: { flex: 1, backgroundColor: '#F5F5F7', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  monthArrow: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  monthArrowText: { fontSize: 28, color: '#1A1A2E', fontWeight: '300' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },

  calGrid: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#EBEBF0', padding: 12 },
  dayLabels: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#888899' },
  datesGrid: { flexDirection: 'row', flexWrap: 'wrap' },

  // Each date cell wrapper — 1/7 width, square
  dateCellWrapper: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  // Circle inside — black when active
  dateCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,      // perfect circle, no rectangle
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dateCircleActive: {
    backgroundColor: '#1A1A2E',  // solid black circle
  },
  dateText: { fontSize: 13, fontWeight: '500', color: '#1A1A2E' },
  dateTextActive: { color: '#fff', fontWeight: '700' },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4ECDC4', marginTop: 1 },

  daySection: { paddingHorizontal: 12, marginTop: 14 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  addBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyDay: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#EBEBF0' },
  emptyDayText: { fontSize: 13, fontWeight: '600', color: '#888899' },
  emptyDaySub: { fontSize: 12, color: '#AAAABC' },
  eventCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EBEBF0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventLine: { width: 3, height: 40, backgroundColor: '#4ECDC4', borderRadius: 2 },
  eventName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  eventTime: { fontSize: 12, color: '#4ECDC4', fontWeight: '500' },
  eventDesc: { fontSize: 12, color: '#888899', marginTop: 2 },
  eventBadge: { backgroundColor: 'rgba(78,205,196,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  eventBadgeText: { color: '#4ECDC4', fontSize: 11, fontWeight: '600' },
  allEventsLabel: { fontSize: 12, fontWeight: '700', color: '#888899', letterSpacing: 0.5, marginBottom: 8 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topPanel: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxHeight: '88%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
  saveBtn: { flex: 1, height: 48, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
