import React, { useState, useRef, useContext } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, ScrollView, SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';

const SIDEBAR_WIDTH = 260;

const SidebarItem = ({ icon, label, active, hasArrow, onPress, theme }) => (
  <TouchableOpacity
    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
    onPress={onPress}
  >
    <Text style={styles.sidebarItemIcon}>{icon}</Text>
    <Text style={[styles.sidebarItemLabel, active && styles.sidebarItemLabelActive]}>
      {label}
    </Text>
    {hasArrow && <Text style={styles.sidebarArrow}>›</Text>}
  </TouchableOpacity>
);

export default function NavBar({ title, activeScreen }) {
  const navigation = useNavigation();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeSidebar = (cb) => {
    Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 220, useNativeDriver: true })
      .start(() => { setSidebarOpen(false); cb && cb(); });
  };

  // Navigate correctly — Dashboard lives inside the Main tab navigator
  const goTo = (screen) => {
    closeSidebar(() => {
      if (['Chat', 'Settings'].includes(screen)) {
        navigation.navigate(screen);
      } else {
        navigation.navigate('Main', { screen });
      }
    });
  };

  const goToDashboard = () => {
    navigation.navigate('Main', { screen: 'Dashboard' });
  };

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#0D0D0F' : '#ffffff'}
        translucent={false}
      />
      <View style={[styles.navbar, isDark && styles.navbarDark]}>
        <View style={styles.navLeft}>
          {/* Hamburger — available on every screen */}
          <TouchableOpacity style={styles.hamburger} onPress={openSidebar}>
            <View style={[styles.hamLine, isDark && styles.hamLineDark]} />
            <View style={[styles.hamLine, isDark && styles.hamLineDark]} />
            <View style={[styles.hamLine, isDark && styles.hamLineDark]} />
          </TouchableOpacity>

          {/* D — taps to Dashboard from any screen */}
          <TouchableOpacity style={styles.logoBox} onPress={goToDashboard} activeOpacity={0.75}>
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>

          <Text style={[styles.brandName, isDark && styles.brandNameDark]}>
            {title || 'DYUKSA'}
          </Text>
        </View>

        <View style={styles.navRight}>
          <TouchableOpacity
            style={[styles.navIconBtn, isDark && styles.navIconBtnDark]}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navIconBtn, isDark && styles.navIconBtnDark]}>
            <Text style={styles.navIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sidebar Modal */}
      {sidebarOpen && (
        <Modal transparent visible animationType="none" onRequestClose={() => closeSidebar()}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => closeSidebar()} />
          <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

              <View style={styles.sidebarHeader}>
                <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
                <Text style={styles.sidebarBrand}>DYUKSA</Text>
                <TouchableOpacity onPress={() => closeSidebar()} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
                <SidebarItem icon="⊞"  label="Dashboard"       active={activeScreen === 'Dashboard'} onPress={() => goTo('Dashboard')} />
                <SidebarItem icon="🗂️" label="Projects"         active={activeScreen === 'Projects'}  onPress={() => goTo('Projects')} hasArrow />
                <SidebarItem icon="📋" label="My Tasks"         active={activeScreen === 'Tasks'}     onPress={() => goTo('Tasks')} hasArrow />
                <SidebarItem icon="📄" label="Documents"        active={activeScreen === 'Docs'}      onPress={() => goTo('Docs')} />
                <SidebarItem icon="📅" label="Calendar"         active={activeScreen === 'Calendar'}  onPress={() => goTo('Calendar')} />
                <SidebarItem icon="⚡" label="Quick Notes" />
                <SidebarItem icon="👥" label="Team Management"  hasArrow />
                <SidebarItem icon="💬" label="Chats"            active={activeScreen === 'Chat'}      onPress={() => goTo('Chat')} hasArrow />
              </ScrollView>

              <View style={styles.sidebarDivider} />

              <View style={styles.sidebarFooter}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>A</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>Anurag Singh</Text>
                  <Text style={styles.userRole}>Manager</Text>
                </View>
              </View>

              <View style={styles.sidebarBottom}>
                <TouchableOpacity style={styles.sidebarBottomBtn} onPress={() => goTo('Settings')}>
                  <Text style={styles.sidebarBottomIcon}>⚙️</Text>
                  <Text style={styles.sidebarBottomText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sidebarBottomBtn}
                  onPress={() => closeSidebar(() => navigation.navigate('Login'))}
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
  navbar: {
    backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#EBEBF0', elevation: 2,
  },
  navbarDark: { backgroundColor: '#0D0D0F', borderBottomColor: '#252530' },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hamburger: { gap: 5, padding: 4, justifyContent: 'center' },
  hamLine: { width: 20, height: 2, backgroundColor: '#1A1A2E', borderRadius: 2 },
  hamLineDark: { backgroundColor: '#fff' },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', letterSpacing: 0.5 },
  brandNameDark: { color: '#fff' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIconBtnDark: { borderColor: '#252530', backgroundColor: '#141418' },
  navIcon: { fontSize: 16 },

  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)' },
  sidebar: { position: 'absolute', top: 0, left: 0, width: SIDEBAR_WIDTH, height: '100%', backgroundColor: '#1A1A2E', elevation: 20, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#252535', gap: 10 },
  sidebarBrand: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
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
