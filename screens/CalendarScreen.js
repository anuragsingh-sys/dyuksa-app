import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Modal, TextInput, StatusBar, Platform, Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarScreen() {
  const navigation = useNavigation();
  const today = new Date();

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [events, setEvents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
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

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const selectedDateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;

  const dayEvents = events.filter(e => {
    try { return e.eventDate?.startsWith(selectedDateStr); } catch { return false; }
  });

  const hasEvent = (day) => events.some(e => {
    try { return e.eventDate?.startsWith(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`); }
    catch { return false; }
  });

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
      const list     = existing ? JSON.parse(existing) : [];
      const updated  = [newEvent, ...list];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setEvents(updated.filter(e => e.type === 'event'));
      setEventName(''); setEventTime(''); setEventDesc('');
      setModalVisible(false);
    } catch { Alert.alert('Error', 'Could not save event.'); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* Navbar */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          {/* D — goes to Dashboard */}
          <TouchableOpacity style={styles.logoBox} onPress={() => navigation.navigate('Dashboard')} activeOpacity={0.75}>
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={styles.brandName}>Calendar</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn}>
            <Text style={styles.navIcon}>🔔</Text>
          </TouchableOpacity>
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
          <View style={styles.dayLabels}>
            {DAYS.map(d => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
          </View>
          <View style={styles.datesGrid}>
            {Array.from({ length: firstDay }).map((_, i) => <View key={`e${i}`} style={styles.dateCell} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day     = i + 1;
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSel   = day === selectedDay;
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dateCell, isToday && styles.todayCell, isSel && !isToday && styles.selectedCell]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text style={[styles.dateText, (isSel || isToday) && { color: '#fff' }]}>{day}</Text>
                  {hasEvent(day) && <View style={styles.eventDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected day */}
        <View style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>📅  {MONTHS[month]} {selectedDay}, {year}</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
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
                <View style={styles.eventBadge}><Text style={styles.eventBadgeText}>Event</Text></View>
              </View>
            ))
          )}
        </View>

        {/* All events */}
        {events.length > 0 && (
          <View style={styles.daySection}>
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

      {/* Add Event Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Event — {MONTHS[month]} {selectedDay}</Text>

            <Text style={styles.fieldLabel}>Event Name *</Text>
            <TextInput style={styles.input} placeholder="Event title..." placeholderTextColor="#AAAABC" value={eventName} onChangeText={setEventName} autoFocus />

            <Text style={styles.fieldLabel}>Time</Text>
            <TextInput style={styles.input} placeholder="e.g. 3:00 PM" placeholderTextColor="#AAAABC" value={eventTime} onChangeText={setEventTime} />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.input, { height: 70, paddingTop: 10 }]} placeholder="Add details..." placeholderTextColor="#AAAABC" value={eventDesc} onChangeText={setEventDesc} multiline textAlignVertical="top" />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); setEventName(''); setEventTime(''); setEventDesc(''); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEvent}>
                <Text style={styles.saveBtnText}>Save Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  dateCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  todayCell: { backgroundColor: '#1A1A2E' },
  selectedCell: { backgroundColor: '#4ECDC4' },
  dateText: { fontSize: 13, fontWeight: '500', color: '#1A1A2E' },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4ECDC4', marginTop: 2 },

  daySection: { paddingHorizontal: 12, marginTop: 14 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  addBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyDay: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#EBEBF0', marginBottom: 8 },
  emptyDayText: { fontSize: 13, fontWeight: '600', color: '#888899' },
  emptyDaySub: { fontSize: 12, color: '#888899' },
  eventCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EBEBF0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventLine: { width: 3, height: 40, backgroundColor: '#4ECDC4', borderRadius: 2 },
  eventName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  eventTime: { fontSize: 12, color: '#4ECDC4', fontWeight: '500' },
  eventDesc: { fontSize: 12, color: '#888899', marginTop: 2 },
  eventBadge: { backgroundColor: 'rgba(78,205,196,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  eventBadgeText: { color: '#4ECDC4', fontSize: 11, fontWeight: '600' },
  allEventsLabel: { fontSize: 12, fontWeight: '700', color: '#888899', letterSpacing: 0.5, marginBottom: 8 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
  saveBtn: { flex: 1, height: 48, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
