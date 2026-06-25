import { NavigationContainer, useNavigation, useNavigationState, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Text, View, TouchableOpacity, StyleSheet, Platform, Modal, Animated, ScrollView,
  Image, Alert, KeyboardAvoidingView, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useContext, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './config';
import { NotificationsProvider } from './context/NotificationsContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { registerForPushNotifications, addNotificationListeners, rescheduleAllEvents } from './services/PushNotificationService';
import { DataService } from './services/DataService';
import { ThemeProvider, ThemeContext } from './context/ThemeContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
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
import CreateTaskScreen from './screens/CreateTaskScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import ChatScreen      from './screens/ChatScreen';
import SettingsScreen  from './screens/SettingsScreen';
import QuickNotesScreen      from './screens/QuickNotesScreen';
import ProjectDetailScreen      from './screens/ProjectDetailScreen';
import TaskDetailScreen         from './screens/TaskDetailScreen';
import NotificationsScreen      from './screens/NotificationsScreen';
import SearchScreen             from './screens/SearchScreen';
import TeamScreen               from './screens/TeamScreen';
import MyWorkScreen             from './screens/MyWorkScreen';
import ReportsScreen            from './screens/ReportsScreen';
import DocumentViewerScreen     from './screens/DocumentViewerScreen';
import QuickCreateScreen        from './screens/QuickCreateScreen';
import CreateProjectScreen      from './screens/CreateProjectScreen';
import InviteUserScreen         from './screens/InviteUserScreen';
import NotificationToast        from './components/NotificationToast';

export const STORAGE_KEY = 'DYUKSA_QUICK_TASKS';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Bottom Nav Icons ──────────────────────────────────────────────────────────
const HomeIcon = ({ filled, inactiveColor = '#9AA3B2' }) => filled ? (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#3B72EE"><Path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></Svg>
) : (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" stroke={inactiveColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);
const ProjectsIcon = ({ filled, inactiveColor = '#9AA3B2' }) => filled ? (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#3B72EE"><Path d="M20 6h-8l-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2z"/></Svg>
) : (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={inactiveColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);
const TasksIcon = ({ filled, inactiveColor = '#9AA3B2' }) => filled ? (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#3B72EE">
    <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    <Path d="M9 11l3 3L22 4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
) : (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M9 11l3 3L22 4" stroke={inactiveColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke={inactiveColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);
const ChatIcon = ({ filled, inactiveColor = '#9AA3B2' }) => filled ? (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#3B72EE">
    <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </Svg>
) : (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={inactiveColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const NAV_TABS = [
  { key: 'Dashboard', Icon: HomeIcon },
  { key: 'Projects',  Icon: ProjectsIcon },
  { key: 'CREATE',    Icon: null },
  { key: 'Tasks',     Icon: TasksIcon },
  { key: 'Chat',      Icon: ChatIcon },
];

const navStyles = StyleSheet.create({
  wrapper:     { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 999, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEF0F4' },
  pill:        { overflow: 'hidden' },
  pillGlass:   { backgroundColor: '#FFFFFF' },
  pillRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', height: 54 },
  tabItem:     { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  tabTouch:    { alignItems: 'center', justifyContent: 'center', padding: 4, position: 'relative' },
  tabLabel:    { fontSize: 9, fontWeight: '500', color: '#9AA3B2', marginTop: 2 },
  tabLabelActive: { color: '#3B72EE', fontWeight: '700' },
  fab:         { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B72EE', shadowColor: '#3B72EE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
});

// ── Draggable Floating FAB ────────────────────────────────────────────────────
// ─── Quick Add Modal: Task / Event toggle ──────────────────────────────────
// Task  → opens the AI-enhanced Create Task screen (TasksScreen)
// Event → opens the New Event screen (CalendarScreen)
// AI    → opens the "Generate by AI" modal on the relevant screen
function QuickAddModal({ visible, onClose, navigation }) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const modalBg  = isDark ? '#1A1A20' : '#FFFFFF';
  const modalTxt = isDark ? '#FFFFFF' : '#1A1A2E';
  const modalSub = isDark ? '#9898A6' : '#6B7588';
  const modalBdr = isDark ? '#2A2A38' : '#F0F0F5';
  const inputBg  = isDark ? '#252530' : '#F5F6F9';

  // ── Inline invite state ───────────────────────────────────────────
  const [showInvite,      setShowInvite]      = useState(false);
  const [inviteEmail,     setInviteEmail]     = useState('');
  const [inviteRole,      setInviteRole]      = useState('viewer');
  const [inviteWorkspace, setInviteWorkspace] = useState(null);
  const [inviteWorkspaces, setInviteWorkspaces] = useState([]);
  const [inviteSaving,    setInviteSaving]    = useState(false);
  const [wsDropOpen,      setWsDropOpen]      = useState(false);
  const ROLES = ['admin', 'manager', 'annotator', 'viewer', 'developer'];

  const resetInvite = () => {
    setInviteEmail(''); setInviteRole('viewer');
    setInviteWorkspace(null); setWsDropOpen(false);
  };

  const fetchWS = async () => {
    try {
      const token = await AsyncStorage.getItem('DYUKSA_AUTH_TOKEN');
      const wsId  = await AsyncStorage.getItem('DYUKSA_WORKSPACE_ID');
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      if (wsId) h['X-Workspace-ID'] = wsId;
      const res = await fetch(`${BASE_URL}/organizations/workspaces/`, { headers: h });
      if (res.ok) {
        const d = await res.json();
        setInviteWorkspaces(Array.isArray(d) ? d : (d.results || d.workspaces || []));
      }
    } catch {}
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { Alert.alert('Required', 'Enter email.'); return; }
    setInviteSaving(true);
    try {
      const token = await AsyncStorage.getItem('DYUKSA_AUTH_TOKEN');
      const wsId  = await AsyncStorage.getItem('DYUKSA_WORKSPACE_ID');
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      if (wsId) h['X-Workspace-ID'] = wsId;
      const payload = { email: inviteEmail.trim(), role: inviteRole };
      if (inviteWorkspace?.id) payload.workspace_id = inviteWorkspace.id;
      const res = await fetch(`${BASE_URL}/auth/invite/send/`, { method: 'POST', headers: h, body: JSON.stringify(payload) });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        Alert.alert('Error', `Server error (${res.status})`); return;
      }
      const data = await res.json();
      if (!res.ok) { Alert.alert('Error', data.detail || 'Failed to send invite.'); return; }
      Alert.alert('Invite Sent ✓', `Invitation sent to ${inviteEmail.trim()}`);
      resetInvite(); setShowInvite(false);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setInviteSaving(false); }
  };

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true })
      .start(() => onClose());
  };

  const handleOption = (action) => {
    handleClose();
    setTimeout(() => action(), 250);
  };

  const OPTIONS = [
    {
      icon: '☑️',
      iconBg: '#EEF2FF',
      iconColor: '#4F46E5',
      label: 'New Task',
      desc: 'Add to any project',
      action: () => navigation.navigate('CreateTask'),
    },
    {
      icon: '📁',
      iconBg: '#F0FDF4',
      iconColor: '#16A34A',
      label: 'New Project',
      desc: 'Start a workspace',
      action: () => navigation.navigate('CreateProject'),
    },
    {
      icon: '📝',
      iconBg: '#FFF7ED',
      iconColor: '#EA580C',
      label: 'New Note',
      desc: 'Quick capture',
      action: () => navigation.navigate('QuickNotes'),
    },
    {
      icon: '📝',
      iconBg: '#FFF7ED',
      iconColor: '#F97316',
      label: 'New Note',
      desc: 'Quick capture',
      action: () => navigation.navigate('QuickNotes', { openCreate: true }),
    },
    {
      icon: '⬆️',
      iconBg: '#FFF7ED',
      iconColor: '#EA580C',
      label: 'Upload Doc',
      desc: 'PDF, Word, Sheet, Slide',
      action: () => navigation.navigate('Docs'),
    },
    {
      icon: '📅',
      iconBg: '#FFF1F2',
      iconColor: '#E11D48',
      label: 'New Event',
      desc: 'Meeting or focus block',
      action: () => navigation.navigate('Calendar'),
    },
    {
      icon: '👥',
      iconBg: '#F5F3FF',
      iconColor: '#7C3AED',
      label: 'Invite Member',
      desc: 'By email or link',
      action: () => { fetchWS(); setShowInvite(true); },
    },
  ];

  if (!visible) return null;

  // ── Invite form view ──────────────────────────────────────────────
  if (showInvite) {
    return (
      <Modal transparent visible animationType="slide" onRequestClose={() => { setShowInvite(false); resetInvite(); onClose(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.qaOverlay} activeOpacity={1} onPress={() => { setShowInvite(false); resetInvite(); onClose(); }} />
          <View style={[styles.qaPanel, { backgroundColor: modalBg, paddingHorizontal: 20, paddingBottom: 34 }]}>
            <View style={styles.qaHandle} />
            <View style={[styles.qaHeader, { borderBottomColor: modalBdr }]}>
              <TouchableOpacity onPress={() => setShowInvite(false)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 22, color: modalSub }}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.qaTitle, { color: modalTxt, flex: 1, textAlign: 'center' }]}>Invite Member</Text>
              <TouchableOpacity onPress={() => { setShowInvite(false); resetInvite(); onClose(); }} style={[styles.qaCloseCircle, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}>
                <Text style={[styles.qaCloseText, { color: modalSub }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: modalSub, marginTop: 16, marginBottom: 6, letterSpacing: 0.5 }}>EMAIL</Text>
              <TextInput
                value={inviteEmail} onChangeText={setInviteEmail}
                placeholder="user@example.com" placeholderTextColor={modalSub}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                style={{ borderRadius: 10, borderWidth: 1.5, borderColor: modalBdr, backgroundColor: inputBg, paddingHorizontal: 14, height: 46, fontSize: 14, color: modalTxt }}
              />

              <Text style={{ fontSize: 11, fontWeight: '700', color: modalSub, marginTop: 14, marginBottom: 8, letterSpacing: 0.5 }}>ROLE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ROLES.map(r => (
                  <TouchableOpacity key={r} onPress={() => setInviteRole(r)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
                      backgroundColor: inviteRole === r ? '#1A1A2E' : inputBg,
                      borderColor: inviteRole === r ? '#1A1A2E' : modalBdr }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'capitalize',
                      color: inviteRole === r ? '#fff' : modalSub }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 11, fontWeight: '700', color: modalSub, marginTop: 14, marginBottom: 6, letterSpacing: 0.5 }}>
                WORKSPACE <Text style={{ fontWeight: '400', fontSize: 10 }}>(optional)</Text>
              </Text>
              <TouchableOpacity
                style={{ borderRadius: 10, borderWidth: 1.5, borderColor: wsDropOpen ? '#3B72EE' : modalBdr, backgroundColor: inputBg, paddingHorizontal: 14, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => setWsDropOpen(o => !o)}
              >
                <Text style={{ color: inviteWorkspace ? modalTxt : modalSub, fontSize: 14 }}>{inviteWorkspace?.name || 'Default Workspace'}</Text>
                <Text style={{ color: modalSub, fontSize: 11 }}>{wsDropOpen ? '▲' : '▾'}</Text>
              </TouchableOpacity>
              {wsDropOpen && (
                <View style={{ borderRadius: 10, borderWidth: 1.5, borderColor: '#3B72EE', backgroundColor: modalBg, marginTop: 4, maxHeight: 160, overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: modalBdr }}
                      onPress={() => { setInviteWorkspace(null); setWsDropOpen(false); }}>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: !inviteWorkspace ? '700' : '500', color: !inviteWorkspace ? '#3B72EE' : modalTxt }}>Default Workspace</Text>
                      {!inviteWorkspace && <Text style={{ color: '#3B72EE' }}>✓</Text>}
                    </TouchableOpacity>
                    {inviteWorkspaces.map(ws => (
                      <TouchableOpacity key={ws.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: modalBdr }}
                        onPress={() => { setInviteWorkspace(ws); setWsDropOpen(false); }}>
                        <Text style={{ flex: 1, fontSize: 13, fontWeight: inviteWorkspace?.id === ws.id ? '700' : '500', color: inviteWorkspace?.id === ws.id ? '#3B72EE' : modalTxt }} numberOfLines={1}>{ws.name}</Text>
                        {inviteWorkspace?.id === ws.id && <Text style={{ color: '#3B72EE' }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: modalBdr, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => { setShowInvite(false); resetInvite(); }}>
                <Text style={{ color: modalSub, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, height: 48, borderRadius: 12, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' }}
                onPress={handleInvite} disabled={inviteSaving}>
                {inviteSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>✉ Send Invite</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.qaOverlay} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.qaPanel, { backgroundColor: modalBg, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.qaHandle} />
        {/* Header */}
        <View style={[styles.qaHeader, { borderBottomColor: modalBdr }]}>
          <Text style={[styles.qaTitle, { color: modalTxt }]}>Create</Text>
          <TouchableOpacity onPress={handleClose} style={[styles.qaCloseCircle, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}>
            <Text style={[styles.qaCloseText, { color: modalSub }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Options */}
        {OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handleOption(opt.action)}
            activeOpacity={0.7}
            style={[styles.qaOption, { borderBottomColor: modalBdr, borderBottomWidth: i < OPTIONS.length - 1 ? 1 : 0 }]}
          >
            <View style={[styles.qaOptionIcon, { backgroundColor: isDark ? '#252530' : opt.iconBg }]}>
              <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qaOptionLabel, { color: modalTxt }]}>{opt.label}</Text>
              <Text style={[styles.qaOptionDesc, { color: modalSub }]}>{opt.desc}</Text>
            </View>
            <Text style={{ color: isDark ? '#3A3A4A' : '#D0D0DA', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </Animated.View>
    </Modal>
  );
}

function MainTabs() {
  const navigation = useNavigation();
  const [qaVisible, setQaVisible] = useState(false);

  const handlePickTask = () => {
    navigation.navigate('Main', {
      screen: 'Tasks',
      params: { openCreateModal: true },
    });
  };

  const handlePickEvent = () => {
    navigation.navigate('Calendar', { openCreateModal: true });
  };

  const handlePickAI = (tab) => {
    if (tab === 'event') {
      navigation.navigate('Calendar', { openCreateModalAI: true });
    } else {
      navigation.navigate('Main', {
        screen: 'Tasks',
        params: { openCreateModalAI: true },
      });
    }
  };

  return (
    <>
      <Tab.Navigator
        initialRouteName="Dashboard"
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Projects"  component={ProjectsScreen} />
        <Tab.Screen name="Tasks"     component={TasksScreen} />
        <Tab.Screen name="Chat"      component={ChatScreen} />
      </Tab.Navigator>

      <QuickAddModal
        visible={qaVisible}
        onClose={() => setQaVisible(false)}
        navigation={navigation}
      />
    </>
  );
}

// Wrapper that gives MainTabs a new key whenever the workspace changes.
// React treats a new key as a completely new component — fully unmounts and
// remounts all tab screens, so useFocusEffect fires fresh and every screen
// refetches its data with the correct X-Workspace-ID header.
function MainTabsWithWorkspaceKey(props) {
  const { currentWorkspace } = useWorkspace();
  const workspaceKey = currentWorkspace?.id ? `ws_${currentWorkspace.id}` : 'ws_default';
  return <MainTabs key={workspaceKey} {...props} />;
}

// Screens where the navbar should NOT show
const NAV_HIDDEN_SCREENS = [
  'Login', 'Signup', 'ForgotPassword',
  'QuickCreate', 'CreateProject', 'CreateTask',
  'DocumentViewer', 'ProjectDetail', 'TaskDetail',
  'ChangePassword', 'InviteUser',
  'Settings',
];

function GlobalNavBar() {
  const { isAuthenticated } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const navBg  = isDark ? '#0D0D0F' : '#FFFFFF';
  const navBdr = isDark ? '#252530' : '#EEF0F4';
  const insets         = useSafeAreaInsets();
  const scales         = useRef(NAV_TABS.map(() => new Animated.Value(1))).current;
  const fabPulse       = useRef(new Animated.Value(1)).current;
  const holdAnim       = useRef(new Animated.Value(1)).current;
  const longPressedRef = useRef(false);
  const [navReady,   setNavReady]   = useState(false);
  const [fabHolding, setFabHolding] = useState(false);
  const [activeKey,  setActiveKey]  = useState('Dashboard');
  const [routeName,  setRouteName]  = useState(null);
  const [inChatRoom, setInChatRoom] = useState(false);

  useEffect(() => {
    // Poll until navigationRef is ready before rendering
    const check = setInterval(() => {
      if (navigationRef.isReady()) {
        setNavReady(true);
        clearInterval(check);
      }
    }, 100);
    return () => clearInterval(check);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, { toValue: 1.07, duration: 1800, useNativeDriver: true }),
        Animated.timing(fabPulse, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Track active tab + current route by subscribing to nav state directly.
  useEffect(() => {
    if (!navReady) return;

    const resolve = () => {
      try {
        const route = navigationRef.getCurrentRoute();
        const name  = route?.name || '';
        setRouteName(name);
        // Detect if inside a chat room (individual chat open)
        setInChatRoom(name === 'Chat' && !!route?.params?.roomId);

        // Direct tab screen names
        if (name === 'Dashboard') return setActiveKey('Dashboard');
        if (name === 'Projects')  return setActiveKey('Projects');
        if (name === 'Tasks')     return setActiveKey('Tasks');
        if (name === 'Chat')      return setActiveKey('Chat');

        // Stack screens mapped to their closest tab
        if (['Docs', 'DocumentViewer'].includes(name))                       return setActiveKey('Projects');
        if (['ProjectDetail', 'CreateProject'].includes(name))               return setActiveKey('Projects');
        if (['MyWork', 'Reports', 'CreateTask', 'TaskDetail'].includes(name)) return setActiveKey('Tasks');
        if (['Settings', 'EditProfile', 'ChangePassword', 'InviteUser'].includes(name)) return setActiveKey('Dashboard');

        setActiveKey('Dashboard');
      } catch { /* keep last known */ }
    };

    resolve(); // initial
    const unsub = navigationRef.addListener('state', resolve); // every change
    return unsub;
  }, [navReady]);

  if (!isAuthenticated || !navReady || NAV_HIDDEN_SCREENS.includes(routeName) || inChatRoom) return null;

  const handlePress = (key, i) => {
    Animated.sequence([
      Animated.spring(scales[i], { toValue: 0.82, useNativeDriver: true, speed: 40 }),
      Animated.spring(scales[i], { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();

    if (!navigationRef.isReady()) return;

    if (key === 'CREATE') {
      navigationRef.navigate('QuickCreate');
      return;
    }

    const TAB_ORDER = ['Dashboard', 'Projects', 'Tasks', 'Chat'];
    const tabIndex  = TAB_ORDER.indexOf(key);
    if (tabIndex === -1) return;

    try {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'Main',
              state: {
                routes: TAB_ORDER.map(name => ({ name })),
                index: tabIndex,
              },
            },
          ],
        })
      );
    } catch (e) {
      // Fallback for edge cases
      navigationRef.navigate('Main', { screen: key });
    }
  };

  const handleFabPressIn = () => {
    longPressedRef.current = false;
    Animated.timing(holdAnim, { toValue: 1.12, duration: 150, useNativeDriver: true }).start();
  };

  const handleFabPressOut = () => {
    Animated.timing(holdAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (longPressedRef.current && navigationRef.isReady()) {
      longPressedRef.current = false;
      setFabHolding(false);
      navigationRef.navigate('Search', { voiceTrigger: Date.now() });
    } else {
      setFabHolding(false);
    }
  };

  const handleFabLongPress = () => {
    longPressedRef.current = true;
    setFabHolding(true);
  };

  const inactiveColor = isDark ? '#6B7588' : '#9AA3B2';

  const PillContent = () => (
    <View style={navStyles.pillRow}>
      {NAV_TABS.map((tab, i) => {
        const isActive = tab.key === activeKey;
        if (tab.key === 'CREATE') {
          return (
            <View key="CREATE" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              {fabHolding && (
                <View style={{
                  position: 'absolute', bottom: 70, backgroundColor: '#1A1A2E',
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                  shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 6,
                }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>🎙 Release when ready to speak</Text>
                </View>
              )}
              <Animated.View style={{ transform: [{ scale: Animated.multiply(scales[i], fabPulse) }] }}>
                <TouchableOpacity
                  onPress={() => handlePress('CREATE', i)}
                  onLongPress={handleFabLongPress}
                  onPressIn={handleFabPressIn}
                  onPressOut={handleFabPressOut}
                  delayLongPress={400}
                  activeOpacity={0.85}
                >
                  <Animated.View style={{ transform: [{ scale: holdAnim }] }}>
                    <LinearGradient
                      colors={fabHolding ? ['#2952C4', '#2952C4'] : ['#3B72EE', '#3B72EE']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={[navStyles.fab, fabHolding && { shadowColor: '#2952C4', shadowOpacity: 0.6, shadowRadius: 12, elevation: 10 }]}
                    >
                      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                        <Path d="M12 19v3" stroke="#fff" strokeWidth={fabHolding ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round"/>
                        <Path d="M19 10v2a7 7 0 01-14 0v-2" stroke="#fff" strokeWidth={fabHolding ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round"/>
                        <Rect x={9} y={2} width={6} height={13} rx={3} stroke="#fff" strokeWidth={fabHolding ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                    </LinearGradient>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          );
        }
        const { Icon } = tab;
        return (
          <Animated.View key={tab.key} style={[navStyles.tabItem, { transform: [{ scale: scales[i] }] }]}>
            <TouchableOpacity onPress={() => handlePress(tab.key, i)} activeOpacity={0.7} style={navStyles.tabTouch}>
              <Icon filled={isActive} inactiveColor={inactiveColor} />
              <Text style={[navStyles.tabLabel, { color: inactiveColor }, isActive && navStyles.tabLabelActive]}>{tab.key}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );

  return (
    <View style={[navStyles.wrapper, { paddingBottom: insets.bottom, backgroundColor: navBg, borderTopColor: navBdr }]}>
      <View style={navStyles.pill}>
        <PillContent />
      </View>
    </View>
  );
}

export const navigationRef = createNavigationContainerRef();

function RootNavigator() {
  const { isAuthenticated, isLoading } = useContext(AuthContext);
  const [showOnboarding, setShowOnboarding] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(done => {
      setShowOnboarding(done !== 'true');
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications().catch(() => {});
    DataService.Tasks.migrate().catch(() => {});
    DataService.Tasks.getAll().then(tasks => {
      rescheduleAllEvents(tasks).catch(() => {});
    }).catch(() => {});

    const unsub = addNotificationListeners(
      (notification) => {},
      (response)     => {}
    );
    return unsub;
  }, [isAuthenticated]);

  if (isLoading || showOnboarding === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: '#3B72EE', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>D</Text>
        </View>
        <Text style={{ color: '#0E1726', fontSize: 22, fontWeight: '700', letterSpacing: 2, marginBottom: 8 }}>DYUKSA</Text>
        <Text style={{ color: '#9AA3B2', fontSize: 13 }}>Loading your workspace...</Text>
      </View>
    );
  }

  if (showOnboarding && !isAuthenticated) {
    return (
      <OnboardingScreen onDone={() => {
        AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
        setShowOnboarding(false);
      }} />
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login"          component={LoginScreen} />
          <Stack.Screen name="Signup"         component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main"            component={MainTabsWithWorkspaceKey} />
          <Stack.Screen name="Calendar"          component={CalendarScreen} />
          <Stack.Screen name="Chat"            component={ChatScreen} />
          <Stack.Screen name="Settings"        component={SettingsScreen} />
          <Stack.Screen name="Docs"            component={DocumentsScreen} />
          <Stack.Screen name="QuickNotes"      component={QuickNotesScreen} />
          <Stack.Screen name="Profile"         component={EditProfileScreen} />
          <Stack.Screen name="TeamManagement"  component={TeamManagementScreen} />
          <Stack.Screen name="EditProfile"     component={EditProfileScreen} />
          <Stack.Screen name="ChangePassword"  component={ChangePasswordScreen} />
          <Stack.Screen name="ProjectDetail"      component={ProjectDetailScreen} />
          <Stack.Screen name="TaskDetail"         component={TaskDetailScreen} />
          <Stack.Screen name="Notifications"      component={NotificationsScreen} />
          <Stack.Screen name="Search"             component={SearchScreen} />
          <Stack.Screen name="Team"               component={TeamScreen} />
          <Stack.Screen name="MyWork"             component={MyWorkScreen} />
          <Stack.Screen name="Reports"            component={ReportsScreen} />
          <Stack.Screen name="DocumentViewer"     component={DocumentViewerScreen} options={{ statusBarTranslucent: false, statusBarColor: '#FFFFFF' }} />
          <Stack.Screen name="QuickCreate"         component={QuickCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="CreateProject"       component={CreateProjectScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="CreateTask"           component={CreateTaskScreen}    options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
          <Stack.Screen name="InviteUser"          component={InviteUserScreen}    options={{ animation: 'slide_from_right' }} />
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
          <WorkspaceProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
              <NotificationToast />
            </NavigationContainer>
            <GlobalNavBar />
          </WorkspaceProvider>
        </ThemeProvider>
      </NotificationsProvider>
    </AuthProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,        // remove the extra hairline above the bar
    paddingTop: 8,
    paddingHorizontal: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  // ── Quick Add modal ──
  qaOverlay: {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  qaPanel: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    maxHeight: '92%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 20,
  },
  qaHandle: {
    width: 40, height: 4, backgroundColor: '#DEDEE8',
    borderRadius: 2, alignSelf: 'center',
    marginTop: 8, marginBottom: 4,
  },
  qaScroll: { paddingHorizontal: 20 },
  qaHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14, marginTop: 4,
  },
  qaTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  qaCloseCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center', alignItems: 'center',
  },
  qaCloseText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  qaToggle: {
    flexDirection: 'row', backgroundColor: '#F5F5F7',
    borderRadius: 10, padding: 4, marginBottom: 18,
  },
  qaToggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  qaToggleBtnOn: { backgroundColor: '#1A1A2E' },
  qaToggleText: { fontSize: 14, fontWeight: '600', color: '#888899' },
  qaToggleTextOn: { color: '#fff' },

  qaPreviewCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBEBF0',
    padding: 16,
    marginBottom: 14,
  },
  qaPreviewTitle: {
    fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 6,
  },
  qaPreviewText: {
    fontSize: 13, color: '#5C5C6E', lineHeight: 19, marginBottom: 12,
  },
  qaFeatureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaFeatureChip: {
    backgroundColor: 'rgba(78,205,196,0.12)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  qaFeatureChipText: {
    fontSize: 11, fontWeight: '600', color: '#3B72EE',
  },
  // Tappable "Nova AI" chip — purple, with slight shadow to signal it's interactive
  qaFeatureChipAI: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
  },
  qaFeatureChipTextAI: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  qaInfoBox: {
    backgroundColor: 'rgba(78,205,196,0.08)',
    borderWidth: 1, borderColor: 'rgba(78,205,196,0.25)',
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  qaInfoText: { fontSize: 12, color: '#3B72EE', lineHeight: 18 },

  qaActionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  qaCancelBtn: {
    flex: 1, height: 50, borderRadius: 12,
    borderWidth: 1, borderColor: '#EBEBF0',
    justifyContent: 'center', alignItems: 'center',
  },
  qaCancelText: { color: '#888899', fontSize: 15, fontWeight: '500' },
  qaSaveBtn: {
    flex: 1, height: 50, borderRadius: 12,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center',
  },
  qaSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
