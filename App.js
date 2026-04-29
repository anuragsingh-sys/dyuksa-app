import { NavigationContainer, useNavigation, useNavigationState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Text, View, TouchableOpacity, StyleSheet, Platform, Modal, Animated, ScrollView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationsProvider } from './context/NotificationsContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { registerForPushNotifications, addNotificationListeners, rescheduleAllEvents } from './services/PushNotificationService';
import { DataService } from './services/DataService';
import { ThemeProvider, ThemeContext } from './context/ThemeContext';
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

function QuickTaskButton({ onPress, borderColor }) {
  return (
    <View style={styles.fabWrapper}>
      <TouchableOpacity
        style={[styles.fab, { borderColor: borderColor || '#fff' }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Quick Add Modal: Task / Event toggle ──────────────────────────────────
// Task  → opens the AI-enhanced Create Task screen (TasksScreen)
// Event → opens the New Event screen (CalendarScreen)
// AI    → opens the "Generate by AI" modal on the relevant screen
function QuickAddModal({ visible, onClose, onPickTask, onPickEvent, onPickAI }) {
  const [activeTab, setActiveTab] = useState('task');
  const slideAnim = useRef(new Animated.Value(-700)).current;

  useEffect(() => {
    if (visible) {
      setActiveTab('task');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(-700);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: -700, duration: 240, useNativeDriver: true })
      .start(() => onClose());
  };

  const handleContinue = () => {
    Animated.timing(slideAnim, { toValue: -700, duration: 220, useNativeDriver: true })
      .start(() => {
        onClose();
        setTimeout(() => {
          if (activeTab === 'task') onPickTask();
          else onPickEvent();
        }, 120);
      });
  };

  // Tap on the "✨ Nova AI" pill → close Quick Add, then open AI modal
  const handleNovaAI = () => {
    Animated.timing(slideAnim, { toValue: -700, duration: 220, useNativeDriver: true })
      .start(() => {
        onClose();
        setTimeout(() => onPickAI(activeTab), 120);
      });
  };

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.qaOverlay} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.qaPanel, { transform: [{ translateY: slideAnim }] }]}>
        <SafeAreaView>
          <View style={styles.qaHandle} />
          <ScrollView style={styles.qaScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.qaHeader}>
              <Text style={styles.qaTitle}>Quick Add</Text>
              <TouchableOpacity style={styles.qaCloseCircle} onPress={handleClose}>
                <Text style={styles.qaCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Task / Event Toggle */}
            <View style={styles.qaToggle}>
              {['task', 'event'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.qaToggleBtn, activeTab === t && styles.qaToggleBtnOn]}
                  onPress={() => setActiveTab(t)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.qaToggleText, activeTab === t && styles.qaToggleTextOn]}>
                    {t === 'task' ? '📋  Task' : '📅  Event'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview / Description card — mirrors your old design */}
            <View style={styles.qaPreviewCard}>
              {activeTab === 'task' ? (
                <>
                  <Text style={styles.qaPreviewTitle}>Create a new task</Text>
                  <Text style={styles.qaPreviewText}>
                    Continue to the Create Task screen with AI-assisted fields: Project,
                    Nova AI title/description refinement, Status, Priority, Start/Due dates,
                    Assignees, Links, and Attachments.
                  </Text>
                  <View style={styles.qaFeatureRow}>
                    <TouchableOpacity
                      style={[styles.qaFeatureChip, styles.qaFeatureChipAI]}
                      onPress={handleNovaAI}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.qaFeatureChipText, styles.qaFeatureChipTextAI]}>✨ Nova AI</Text>
                    </TouchableOpacity>
                    <View style={styles.qaFeatureChip}>
                      <Text style={styles.qaFeatureChipText}>⚡ Auto-generate</Text>
                    </View>
                    <View style={styles.qaFeatureChip}>
                      <Text style={styles.qaFeatureChipText}>👥 Assignees</Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.qaPreviewTitle}>Schedule a new event</Text>
                  <Text style={styles.qaPreviewText}>
                    Continue to the New Event screen to pick date and time. You'll receive
                    an alert 1 hour before the event fires.
                  </Text>
                  <View style={styles.qaFeatureRow}>
                    <TouchableOpacity
                      style={[styles.qaFeatureChip, styles.qaFeatureChipAI]}
                      onPress={handleNovaAI}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.qaFeatureChipText, styles.qaFeatureChipTextAI]}>✨ Nova AI</Text>
                    </TouchableOpacity>
                    <View style={[styles.qaFeatureChip, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
                      <Text style={[styles.qaFeatureChipText, { color: '#A78BFA' }]}>📅 Date picker</Text>
                    </View>
                    <View style={[styles.qaFeatureChip, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
                      <Text style={[styles.qaFeatureChipText, { color: '#A78BFA' }]}>🕐 Time picker</Text>
                    </View>
                    <View style={[styles.qaFeatureChip, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
                      <Text style={[styles.qaFeatureChipText, { color: '#A78BFA' }]}>🔔 Alert</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Info strip */}
            <View style={styles.qaInfoBox}>
              <Text style={styles.qaInfoText}>
                💾  Saves to DYUKSA{'\n'}
                {activeTab === 'task'
                  ? 'Task appears in the Tasks tab instantly.'
                  : 'Event appears in the Calendar tab instantly.'}
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.qaActionRow}>
              <TouchableOpacity style={styles.qaCancelBtn} onPress={handleClose}>
                <Text style={styles.qaCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.qaSaveBtn} onPress={handleContinue}>
                <Text style={styles.qaSaveText}>
                  {activeTab === 'task' ? 'Continue →' : 'Continue →'}
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// Bottom bar: Dashboard | Projects | FAB (Quick Add) | Calendar | Tasks
function MainTabs() {
  const navigation = useNavigation();
  const [qaVisible, setQaVisible] = useState(false);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const insets = useSafeAreaInsets();

  // Theme-aware tab bar colors (matches Calendar screen's dark palette)
  const tabBg       = isDark ? '#1A1A20' : '#FFFFFF';
  const tabBorder   = isDark ? '#252530' : '#EBEBF0';
  const tabActive   = isDark ? '#FFFFFF' : '#1A1A2E';
  const tabInactive = isDark ? '#6C6C80' : '#AAAABC';

  // Compact bar that respects the device's bottom safe area (gesture bar / nav buttons)
  const TAB_BAR_BASE = 60;
  const tabBarHeight = TAB_BAR_BASE + insets.bottom;

  // Remember which tab the user was on before tapping "+"
  const tabState = useNavigationState(state => state);
  const currentTabName = (() => {
    try {
      const mainRoute = tabState?.routes?.find(r => r.name === 'Main');
      const tabRoutes = mainRoute?.state?.routes;
      const idx       = mainRoute?.state?.index ?? 0;
      const name      = tabRoutes?.[idx]?.name;
      return name && name !== 'Quick' ? name : 'Dashboard';
    } catch {
      return 'Dashboard';
    }
  })();

  const openQuickAdd = () => setQaVisible(true);

  // Center + FAB: open AI Task modal directly (skip Quick Add)
  // The modal itself has Task/Event tabs so user can switch inside it.
  const openAIModalDirect = () => {
    navigation.navigate('Main', {
      screen: 'Tasks',
      params: { openCreateModalAI: true, returnTo: currentTabName },
    });
  };

  const handlePickTask = () => {
    navigation.navigate('Main', {
      screen: 'Tasks',
      params: { openCreateModal: true, returnTo: currentTabName },
    });
  };

  const handlePickEvent = () => {
    navigation.navigate('Main', {
      screen: 'Calendar',
      params: { openCreateModal: true, returnTo: currentTabName },
    });
  };

  // Nova AI → opens the "Generate by AI" modal on the matching screen
  const handlePickAI = (tab) => {
    if (tab === 'event') {
      // Calendar AI isn't built yet — go to Calendar with a flag for when we add it
      navigation.navigate('Main', {
        screen: 'Calendar',
        params: { openCreateModalAI: true, returnTo: currentTabName },
      });
    } else {
      // Task AI uses the existing "Generate Task by AI" modal in TasksScreen
      navigation.navigate('Main', {
        screen: 'Tasks',
        params: { openCreateModalAI: true, returnTo: currentTabName },
      });
    }
  };

  return (
    <>
      <Tab.Navigator
        initialRouteName="Dashboard"
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: tabBg,
              height: tabBarHeight,
              paddingBottom: insets.bottom,
              borderTopColor: tabBorder,
            },
          ],
          tabBarActiveTintColor: tabActive,
          tabBarInactiveTintColor: tabInactive,
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
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Projects"  component={ProjectsScreen} />

        {/* Center FAB — opens Generate AI modal directly (Task/Event tabs inside) */}
        <Tab.Screen
          name="Quick"
          component={TasksScreen}
          options={{
            tabBarLabel:  () => null,
            tabBarIcon:   () => null,
            tabBarButton: () => <QuickTaskButton onPress={openAIModalDirect} borderColor={tabBg} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              openAIModalDirect();
            },
          }}
        />

        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="Tasks"    component={TasksScreen} />
      </Tab.Navigator>

      <QuickAddModal
        visible={qaVisible}
        onClose={() => setQaVisible(false)}
        onPickTask={handlePickTask}
        onPickEvent={handlePickEvent}
        onPickAI={handlePickAI}
      />
    </>
  );
}

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
        <>
          <Stack.Screen name="Login"          component={LoginScreen} />
          <Stack.Screen name="Signup"         component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main"            component={MainTabs} />
          <Stack.Screen name="Chat"            component={ChatScreen} />
          <Stack.Screen name="Settings"        component={SettingsScreen} />
          <Stack.Screen name="Docs"            component={DocumentsScreen} />
          <Stack.Screen name="TeamManagement"  component={TeamManagementScreen} />
          <Stack.Screen name="EditProfile"     component={EditProfileScreen} />
          <Stack.Screen name="ChangePassword"  component={ChangePasswordScreen} />
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
  fabWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center',
    marginTop: -22,           // lift above the bar so it sits clear of the icons
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  fabIcon: { color: '#4ECDC4', fontSize: 26, lineHeight: 30 },

  // ── Quick Add modal ──
  qaOverlay: {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  qaPanel: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: '#fff',
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
    fontSize: 11, fontWeight: '600', color: '#4ECDC4',
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
  qaInfoText: { fontSize: 12, color: '#4ECDC4', lineHeight: 18 },

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
