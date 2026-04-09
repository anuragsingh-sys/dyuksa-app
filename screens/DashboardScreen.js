import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Modal, Animated, StatusBar, Platform,
} from 'react-native';
import { useState, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';

const SIDEBAR_WIDTH = 260;

const QuickAction = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress}>
    <Text style={styles.quickIcon}>{icon}</Text>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

const SidebarItem = ({ icon, label, active, hasArrow }) => (
  <TouchableOpacity style={[styles.sidebarItem, active && styles.sidebarItemActive]}>
    <Text style={styles.sidebarItemIcon}>{icon}</Text>
    <Text style={[styles.sidebarItemLabel, active && styles.sidebarItemLabelActive]}>{label}</Text>
    {hasArrow && <Text style={styles.sidebarArrow}>›</Text>}
  </TouchableOpacity>
);

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeSidebar = () => {
    Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 220, useNativeDriver: true })
      .start(() => setSidebarOpen(false));
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Fix Android status bar */}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* Top Navbar */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <TouchableOpacity style={styles.hamburger} onPress={openSidebar}>
            <View style={styles.hamLine} />
            <View style={styles.hamLine} />
            <View style={styles.hamLine} />
          </TouchableOpacity>
          {/* D — tappable on every screen to jump to Dashboard */}
          <TouchableOpacity style={styles.logoBox} activeOpacity={0.75}>
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={styles.brandName}>DYUKSA</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn}>
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn}>
            <Text style={styles.navIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.welcomeText}>Welcome back, Anurag!</Text>
        <Text style={styles.subText}>Here's a quick overview of your workspace.</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* In Progress */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>In Progress ▾</Text>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🕐</Text>
            <Text style={styles.emptyLabel}>No in-progress tasks assigned to you</Text>
            <Text style={styles.emptySubLabel}>No tasks are currently assigned to you</Text>
          </View>
        </View>

        {/* Recent Documents */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Recent Documents</Text>
            <TouchableOpacity><Text style={styles.viewAll}>View All →</Text></TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyLabel}>No documents yet</Text>
          </View>
        </View>

        {/* Favourite Projects */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Favourite Projects</Text>
            <TouchableOpacity><Text style={styles.viewAll}>View All →</Text></TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyLabel}>No projects yet</Text>
          </View>
        </View>

        {/* Quick Actions — Events replaces Review Doc */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.quickRow}>
            <QuickAction icon="🗂️" label="New Project" />
            <QuickAction icon="📅" label="Events" />
            <QuickAction icon="👍" label="Approved Doc" />
          </View>
        </View>

      </ScrollView>

      {/* Sidebar Modal */}
      {sidebarOpen && (
        <Modal transparent visible animationType="none" onRequestClose={closeSidebar}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSidebar} />
          <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
              <View style={styles.sidebarHeader}>
                <View style={styles.logoBox}>
                  <Text style={styles.logoText}>D</Text>
                </View>
                <Text style={styles.sidebarBrand}>DYUKSA</Text>
                <TouchableOpacity onPress={closeSidebar} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
                <SidebarItem icon="⊞" label="Dashboard" active />
                <SidebarItem icon="🗂️" label="Projects" hasArrow />
                <SidebarItem icon="📋" label="My Tasks" hasArrow />
                <SidebarItem icon="📄" label="Documents" />
                <SidebarItem icon="📅" label="Calendar" />
                <SidebarItem icon="⚡" label="Quick Notes" />
                <SidebarItem icon="👥" label="Team Management" hasArrow />
                <SidebarItem icon="💬" label="Chats" hasArrow />
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
                <TouchableOpacity style={styles.sidebarBottomBtn}>
                  <Text style={styles.sidebarBottomIcon}>⚙️</Text>
                  <Text style={styles.sidebarBottomText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sidebarBottomBtn}>
                  <Text style={styles.sidebarBottomIcon}>🚪</Text>
                  <Text style={[styles.sidebarBottomText, { color: '#F87171' }]}>Logout</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    // Android status bar fix
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  navbar: {
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#EBEBF0',
    elevation: 2,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hamburger: { gap: 5, padding: 4, justifyContent: 'center' },
  hamLine: { width: 20, height: 2, backgroundColor: '#1A1A2E', borderRadius: 2 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', letterSpacing: 1 },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },

  pageHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  welcomeText: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  subText: { fontSize: 12, color: '#888899', marginTop: 2 },

  scroll: { flex: 1, padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EBEBF0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 10 },
  viewAll: { fontSize: 12, color: '#888899' },
  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 30, opacity: 0.3 },
  emptyLabel: { fontSize: 13, color: '#888899', textAlign: 'center', fontWeight: '500' },
  emptySubLabel: { fontSize: 11, color: '#AAAABC', textAlign: 'center' },

  quickRow: { flexDirection: 'row', gap: 8 },
  quickAction: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0', gap: 6 },
  quickIcon: { fontSize: 22 },
  quickLabel: { fontSize: 10, color: '#888899', textAlign: 'center', fontWeight: '500' },

  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
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
