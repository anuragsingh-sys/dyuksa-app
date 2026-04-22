import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, ScrollView, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRef, useState, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

const SIDEBAR_WIDTH = 260;

const SidebarItem = ({ icon, label, active, hasArrow, onPress }) => (
  <TouchableOpacity
    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
    onPress={onPress}
  >
    <Text style={styles.sidebarItemIcon}>{icon}</Text>
    <Text style={[styles.sidebarItemLabel, active && styles.sidebarItemLabelActive]}>{label}</Text>
    {hasArrow && <Text style={styles.sidebarArrow}>›</Text>}
  </TouchableOpacity>
);

export default function SidebarMenu({ activeScreen }) {
  const navigation = useNavigation();
  const { theme } = useContext(ThemeContext);
  const { logout, user } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const [open, setOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  const openSidebar = () => {
    setOpen(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeSidebar = (cb) => {
    Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 220, useNativeDriver: true })
      .start(() => { setOpen(false); cb && cb(); });
  };

  const goToDashboard = () => closeSidebar(() => {
    try { navigation.jumpTo('Dashboard'); }
    catch { navigation.navigate('Main', { screen: 'Dashboard' }); }
  });
  const goToTab = (tab) => closeSidebar(() => {
    try { navigation.jumpTo(tab); }
    catch { navigation.navigate('Main', { screen: tab }); }
  });
  const goToStack = (screen) => closeSidebar(() => navigation.navigate(screen));

  return (
    <>
      {/* Hamburger */}
      <TouchableOpacity style={styles.hamburger} onPress={openSidebar}>
        <View style={[styles.hamLine, isDark && styles.hamLineDark]} />
        <View style={[styles.hamLine, isDark && styles.hamLineDark]} />
        <View style={[styles.hamLine, isDark && styles.hamLineDark]} />
      </TouchableOpacity>

      {open && (
        <Modal transparent visible animationType="none" onRequestClose={() => closeSidebar()} statusBarTranslucent>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => closeSidebar()} />
          <Animated.View style={[
            styles.sidebar,
            {
              paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24),
              transform: [{ translateX: slideAnim }],
            },
          ]}>
            <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
              <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

              <View style={styles.sidebarHeader}>
                <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
                <Text style={styles.sidebarBrand}>DYUKSA</Text>
                <TouchableOpacity onPress={() => closeSidebar()} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
                <SidebarItem icon="⊞"  label="Dashboard"      active={activeScreen === 'Dashboard'} onPress={goToDashboard} />
                <SidebarItem icon="🗂️" label="Projects"        active={activeScreen === 'Projects'}  hasArrow onPress={() => goToTab('Projects')} />
                <SidebarItem icon="📅" label="Calendar"        active={activeScreen === 'Calendar'}  hasArrow onPress={() => goToTab('Calendar')} />
                <SidebarItem icon="📋" label="My Tasks"        active={activeScreen === 'Tasks'}     hasArrow onPress={() => goToTab('Tasks')} />
                <SidebarItem icon="📄" label="Documents"       active={activeScreen === 'Docs'}               onPress={() => goToStack('Docs')} />
                <SidebarItem icon="⚡" label="Quick Notes"     active={activeScreen === 'QuickNotes'}
                  onPress={() => closeSidebar(() => (() => { try { navigation.jumpTo('Dashboard', { scrollToNotes: true }); } catch { navigation.navigate('Main', { screen: 'Dashboard', params: { scrollToNotes: true } }); } })())} />
                <SidebarItem icon="👥" label="Team Management" hasArrow
                  onPress={() => closeSidebar(() => navigation.navigate('TeamManagement'))} />
                <SidebarItem icon="💬" label="Chats"           active={activeScreen === 'Chat'}      hasArrow onPress={() => goToStack('Chat')} />
              </ScrollView>

              <View style={styles.sidebarDivider} />

              <View style={styles.sidebarFooter}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{user?.avatar || user?.name?.[0]?.toUpperCase() || 'U'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user?.name || 'User'}</Text>
                  <Text style={styles.userRole}>{user?.role || 'Member'}</Text>
                </View>
              </View>

              <View style={styles.sidebarBottom}>
                <TouchableOpacity style={styles.sidebarBottomBtn} onPress={() => goToStack('Settings')}>
                  <Text style={styles.sidebarBottomIcon}>⚙️</Text>
                  <Text style={styles.sidebarBottomText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sidebarBottomBtn}
                  onPress={() => closeSidebar(async () => { await logout(); })}
                >
                  <Text style={styles.sidebarBottomIcon}>🚪</Text>
                  <Text style={[styles.sidebarBottomText, { color: '#F87171' }]}>Logout</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hamburger: { gap: 5, padding: 4, justifyContent: 'center' },
  hamLine: { width: 20, height: 2, backgroundColor: '#1A1A2E', borderRadius: 2 },
  hamLineDark: { backgroundColor: '#FFFFFF' },
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  sidebar: { position: 'absolute', top: 0, left: 0, width: SIDEBAR_WIDTH, height: '100%', backgroundColor: '#1A1A2E', elevation: 20, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#252535', gap: 10 },
  sidebarBrand: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#4ECDC4', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#5C5C6E', fontSize: 16 },
  sidebarNav: { flex: 1, paddingTop: 8, paddingHorizontal: 8 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8, marginBottom: 2 },
  sidebarItemActive: { backgroundColor: 'rgba(78,205,196,0.12)' },
  sidebarItemIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  sidebarItemLabel: { flex: 1, fontSize: 14, color: '#9898A6', fontWeight: '500' },
  sidebarItemLabelActive: { color: '#4ECDC4', fontWeight: '600' },
  sidebarArrow: { color: '#5C5C6E', fontSize: 18 },
  sidebarDivider: { height: 1, backgroundColor: '#252535', marginHorizontal: 16, marginVertical: 8 },
  sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4ECDC4', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: '#1A1A2E', fontWeight: '700', fontSize: 15 },
  userName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  userRole: { color: '#5C5C6E', fontSize: 11, marginTop: 1 },
  sidebarBottom: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 16, gap: 8 },
  sidebarBottomBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#252535' },
  sidebarBottomIcon: { fontSize: 14 },
  sidebarBottomText: { color: '#9898A6', fontSize: 12, fontWeight: '500' },
});
