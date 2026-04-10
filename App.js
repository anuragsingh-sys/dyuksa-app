import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Text, View, TouchableOpacity, StyleSheet, Modal,
  TextInput, Alert, Animated, Image, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useState, useRef, useEffect, useContext } from 'react';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationsProvider, NotificationsContext } from './context/NotificationsContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { registerForPushNotifications, addNotificationListeners, rescheduleAllEvents } from './services/PushNotificationService';
import { DataService } from './services/DataService';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import OnboardingScreen, { ONBOARDING_KEY } from './screens/OnboardingScreen';

import LoginScreen            from './screens/LoginScreen';
import SignupScreen            from './screens/SignupScreen';
import ForgotPasswordScreen    from './screens/ForgotPasswordScreen';
import TeamManagementScreen    from './screens/TeamManagementScreen';
import EditProfileScreen       from './screens/EditProfileScreen';
import ChangePasswordScreen    from './screens/ChangePasswordScreen';
import DashboardScreen from './screens/DashboardScreen';
import CalendarScreen  from './screens/CalendarScreen';
import ProjectsScreen  from './screens/ProjectsScreen';
import TasksScreen     from './screens/TasksScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import ChatScreen      from './screens/ChatScreen';
import SettingsScreen  from './screens/SettingsScreen';

export const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function QuickTaskButton({ onPress }) {
  return (
    <View style={styles.fabWrapper}>
      <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

function QuickTaskModal({ visible, onClose, navigation }) {
  const { addNotification } = useContext(NotificationsContext);
  const [activeTab, setActiveTab] = useState('task');
  const [taskName,  setTaskName]  = useState('');
  const [taskDesc,  setTaskDesc]  = useState('');
  const [eventDate, setEventDate] = useState('');
  const [images,    setImages]    = useState([]);
  const slideAnim = useRef(new Animated.Value(-700)).current;
  const animated  = useRef(false);

  useEffect(() => {
    if (visible && !animated.current) {
      animated.current = true;
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    }
  }, [visible]);

  const closeModal = (cb) => {
    animated.current = false;
    Animated.timing(slideAnim, { toValue: -700, duration: 250, useNativeDriver: true })
      .start(() => { setTaskName(''); setTaskDesc(''); setEventDate(''); setImages([]); setActiveTab('task'); onClose(); cb && cb(); });
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera access is needed.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) setImages(p => [...p, result.assets[0].uri]);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Gallery access is needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled && result.assets?.length) setImages(p => [...p, ...result.assets.map(a => a.uri)]);
  };

  const handleSave = async () => {
    if (!taskName.trim()) { Alert.alert('Required', activeTab === 'task' ? 'Enter a task name.' : 'Enter an event name.'); return; }
    const newEntry = { id: Date.now().toString(), type: activeTab, name: taskName.trim(), description: taskDesc.trim(), eventDate: eventDate.trim(), images, createdAt: new Date().toISOString(), status: 'Todo' };
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const updated  = [newEntry, ...(existing ? JSON.parse(existing) : [])];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      // Fire notification
      if (activeTab === 'task') {
        addNotification({ type: 'task', icon: '⚡', title: 'Quick Note Created', body: `"${newEntry.name}" saved to Quick Notes.` });
      } else {
        addNotification({ type: 'event', icon: '📅', title: 'Event Created', body: `"${newEntry.name}"${newEntry.eventDate ? ' on ' + newEntry.eventDate : ''} has been scheduled.` });
      }
      closeModal(() => {
        navigation.navigate('Main', {
          screen: 'Dashboard',
          params: { scrollToNotes: true },
        });
      });
    } catch { Alert.alert('Error', 'Could not save.'); }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeModal()}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => closeModal()} />
      <Animated.View style={[styles.topPanel, { transform: [{ translateY: slideAnim }] }]}>
        <SafeAreaView>
          <View style={styles.handle} />
          <ScrollView style={styles.panelScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Quick Add</Text>
              <TouchableOpacity style={styles.closeCircle} onPress={() => closeModal()}>
                <Text style={styles.closeCircleText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.toggle}>
              {['task', 'event'].map(t => (
                <TouchableOpacity key={t} style={[styles.toggleBtn, activeTab === t && styles.toggleBtnOn]} onPress={() => setActiveTab(t)}>
                  <Text style={[styles.toggleText, activeTab === t && styles.toggleTextOn]}>{t === 'task' ? '📋  Task' : '📅  Event'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>{activeTab === 'task' ? 'Task Name *' : 'Event Name *'}</Text>
            <TextInput style={styles.input} placeholder={activeTab === 'task' ? 'What needs to be done?' : 'Event title...'} placeholderTextColor="#AAAABC" value={taskName} onChangeText={setTaskName} />
            {activeTab === 'event' && (<>
              <Text style={styles.label}>Date & Time</Text>
              <TextInput style={styles.input} placeholder="e.g. April 20, 2026 at 3:00 PM" placeholderTextColor="#AAAABC" value={eventDate} onChangeText={setEventDate} />
            </>)}
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.inputMulti]} placeholder="Add details..." placeholderTextColor="#AAAABC" value={taskDesc} onChangeText={setTaskDesc} multiline numberOfLines={3} textAlignVertical="top" />
            <Text style={styles.label}>Attach Images</Text>
            <View style={styles.attachRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={openCamera} activeOpacity={0.8}>
                <View style={styles.attachIconWrap}><Text style={styles.attachIcon}>📷</Text></View>
                <Text style={styles.attachLabel}>Camera</Text>
                <Text style={styles.attachSub}>Take a photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn} onPress={openGallery} activeOpacity={0.8}>
                <View style={styles.attachIconWrap}><Text style={styles.attachIcon}>🖼️</Text></View>
                <Text style={styles.attachLabel}>Gallery</Text>
                <Text style={styles.attachSub}>Pick from photos</Text>
              </TouchableOpacity>
            </View>
            {images.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewCount}>{images.length} image{images.length > 1 ? 's' : ''} attached</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {images.map((uri, idx) => (
                    <View key={idx} style={styles.previewWrap}>
                      <Image source={{ uri }} style={styles.previewImg} />
                      <TouchableOpacity style={styles.removeImg} onPress={() => setImages(p => p.filter((_, i) => i !== idx))}>
                        <Text style={styles.removeImgText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>💾  Saves to your device → appears in the Tasks tab.{'\n'}Will sync to DYUKSA server once backend is connected.</Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => closeModal()}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>{activeTab === 'task' ? 'Save Task' : 'Save Event'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// Bottom bar: Dashboard | Projects | FAB | Calendar | Tasks | Docs
// Dashboard is the FIRST tab = main screen, bottom bar always visible
function MainTabs() {
  const [modalVisible, setModalVisible] = useState(false);
  const navigation = useNavigation();
  return (
    <>
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#1A1A2E',
          tabBarInactiveTintColor: '#AAAABC',
          tabBarLabel: ({ color, focused }) => (
            <Text style={{ color, fontSize: 10, fontWeight: focused ? '700' : '500', marginTop: -2 }}>
              {route.name}
            </Text>
          ),
          tabBarIcon: ({ color }) => {
            const icons = { Dashboard: '⊞', Projects: '🗂️', Calendar: '📅', Tasks: '📋', Docs: '📄' };
            return <Text style={{ fontSize: 18, color }}>{icons[route.name]}</Text>;
          },
        })}
      >
        {/* Dashboard = main screen = first tab */}
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Projects"  component={ProjectsScreen} />

        {/* Center FAB */}
        <Tab.Screen
          name="Quick"
          component={TasksScreen}
          options={{
            tabBarLabel:  () => null,
            tabBarIcon:   () => null,
            tabBarButton: () => <QuickTaskButton onPress={() => setModalVisible(true)} />,
          }}
        />

        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="Tasks"    component={TasksScreen} />
      </Tab.Navigator>
      <QuickTaskModal visible={modalVisible} onClose={() => setModalVisible(false)} navigation={navigation} />
    </>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useContext(AuthContext);
  const [showOnboarding, setShowOnboarding] = useState(null); // null=checking, true/false

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(done => {
      setShowOnboarding(done !== 'true');
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Register push notifications and reschedule event reminders
    registerForPushNotifications().catch(() => {});
    DataService.Tasks.migrate().catch(() => {}); // migrate existing data to sync schema
    DataService.Tasks.getAll().then(tasks => {
      rescheduleAllEvents(tasks).catch(() => {});
    }).catch(() => {});

    const unsub = addNotificationListeners(
      (notification) => { /* notification received while app is open */ },
      (response)     => { /* user tapped a notification */ }
    );
    return unsub;
  }, [isAuthenticated]);

  if (isLoading || showOnboarding === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: '#4ECDC4', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#1A1A2E', fontSize: 28, fontWeight: '800' }}>D</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 2, marginBottom: 8 }}>DYUKSA</Text>
        <Text style={{ color: '#4ECDC4', fontSize: 13 }}>Loading your workspace...</Text>
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        // Auth stack — unauthenticated
        <>
          <Stack.Screen name="Login"          component={LoginScreen} />
          <Stack.Screen name="Signup"         component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : (
        // App stack — authenticated
        <>
          <Stack.Screen name="Main"     component={MainTabs} />
          <Stack.Screen name="Chat"     component={ChatScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Docs"              component={DocumentsScreen} />
          <Stack.Screen name="TeamManagement"   component={TeamManagementScreen} />
          <Stack.Screen name="EditProfile"      component={EditProfileScreen} />
          <Stack.Screen name="ChangePassword"   component={ChangePasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <SafeAreaProvider>
    <AuthProvider>
      <NotificationsProvider>
        <ThemeProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </NotificationsProvider>
    </AuthProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: '#FFFFFF', borderTopColor: '#EBEBF0', borderTopWidth: 1, height: Platform.OS === 'android' ? 65 : 70, paddingBottom: Platform.OS === 'android' ? 8 : 10, paddingTop: 8, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 10 },
  fabWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', marginTop: -18, borderWidth: 3, borderColor: '#fff', shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 12 },
  fabIcon: { color: '#4ECDC4', fontSize: 26, lineHeight: 30 },
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topPanel: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  panelScroll: { paddingHorizontal: 20 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 4 },
  panelTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  toggle: { flexDirection: 'row', backgroundColor: '#F5F5F7', borderRadius: 10, padding: 4, marginBottom: 18 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  toggleBtnOn: { backgroundColor: '#1A1A2E' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#888899' },
  toggleTextOn: { color: '#fff' },
  label: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBF0', paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  inputMulti: { height: 80, paddingTop: 12 },
  attachRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  attachBtn: { flex: 1, backgroundColor: '#F5F5F7', borderRadius: 12, borderWidth: 1.5, borderColor: '#EBEBF0', paddingVertical: 14, alignItems: 'center', gap: 4 },
  attachIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderWidth: 1, borderColor: '#EBEBF0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  attachIcon: { fontSize: 24 },
  attachLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  attachSub: { fontSize: 11, color: '#AAAABC' },
  previewSection: { marginBottom: 14 },
  previewCount: { fontSize: 12, color: '#888899', fontWeight: '500', marginBottom: 8 },
  previewWrap: { position: 'relative', marginRight: 10 },
  previewImg: { width: 88, height: 88, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0' },
  removeImg: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#F87171', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  removeImgText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  infoBox: { backgroundColor: 'rgba(78,205,196,0.08)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.25)', borderRadius: 10, padding: 12, marginBottom: 16 },
  infoText: { fontSize: 12, color: '#4ECDC4', lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: '#888899', fontSize: 15, fontWeight: '500' },
  saveBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
