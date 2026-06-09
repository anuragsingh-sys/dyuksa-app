import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, ScrollView, StatusBar, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRef, useState, useContext, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { canCreateWorkspace, canManageMembers } from '../utils/permissions';
import { Feather } from '@expo/vector-icons';

const SIDEBAR_WIDTH  = 260;

const SidebarItem = ({ icon, label, active, hasArrow, onPress, isDarkMode }) => (
  <TouchableOpacity
    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.sidebarItemIconWrap}>
      <Feather name={icon} size={18} color={active ? '#2D6AE3' : (isDarkMode ? '#9898A6' : '#6B7588')} />
    </View>
    <Text style={[styles.sidebarItemLabel, { color: isDarkMode ? '#9898A6' : '#3B4658' }, active && styles.sidebarItemLabelActive]}>{label}</Text>
    {hasArrow && <Feather name="chevron-right" size={14} color={isDarkMode ? '#5C5C6E' : '#9AA3B2'} style={{ marginLeft: 'auto' }} />}
  </TouchableOpacity>
);

export default function SidebarMenu({ activeScreen }) {
  const navigation = useNavigation();
  const { theme } = useContext(ThemeContext);
  const { logout, user } = useContext(AuthContext);
  const {
    currentWorkspace, workspaces, loadingWorkspaces,
    switchingId, fetchWorkspaces, handleSwitch,
  } = useWorkspace();
  const isDark = theme === 'Dark';
  const [open, setOpen] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(activeScreen === 'Tasks');
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [wsExpanded, setWsExpanded] = useState(false);

  // ── Navigation helpers ───────────────────────────────────────────────
  const openSidebar = () => {
    setOpen(true);
    fetchWorkspaces(); // from WorkspaceContext
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeSidebar = (cb) => {
    setWsExpanded(false);
    Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 220, useNativeDriver: true })
      .start(() => { setOpen(false); cb && cb(); });
  };

  const goToDashboard  = () => closeSidebar(() => {
    try { navigation.jumpTo('Dashboard'); }
    catch { navigation.navigate('Main', { screen: 'Dashboard' }); }
  });
  const goToTab        = (tab)            => closeSidebar(() => {
    try { navigation.jumpTo(tab); }
    catch { navigation.navigate('Main', { screen: tab }); }
  });
  const goToStack      = (screen, params) => closeSidebar(() => navigation.navigate(screen, params));
  const goToTasksWith  = (params)         => closeSidebar(() => {
    try { navigation.jumpTo('Tasks', params); }
    catch { navigation.navigate('Main', { screen: 'Tasks', params }); }
  });

  const taskSubmenu = [
    { icon: '＋', label: 'Create Task',       params: { openCreateModal: true } },
    { icon: '☑',  label: 'All Tasks',         params: { presetFilter: 'All' } },
    { icon: '✓',  label: 'Completed Tasks',   params: { presetFilter: 'completed' } },
    { icon: '⏱',  label: 'Pending Tasks',     params: { presetFilter: 'pending' } },
    { icon: '☷',  label: 'Backlog Tasks',     params: { presetFilter: 'backlog' } },
    { icon: '▶',  label: 'In Progress Tasks', params: { presetFilter: 'in_progress' } },
    { icon: '☑',  label: 'Deployed Tasks',    params: { presetFilter: 'deployed' } },
    { icon: '⏸',  label: 'Deferred Tasks',    params: { presetFilter: 'deferred' } },
    { icon: '👁',  label: 'Review Tasks',      params: { presetFilter: 'review' } },
  ];

  // Initial letter for workspace avatar

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
              backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
            },
          ]}>
            <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
              <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#1A1A2E" : "#FFFFFF"} />

              {/* Header */}
              <View style={styles.sidebarHeader}>
                <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
                <Text style={[styles.sidebarBrand, { color: isDark ? "#fff" : "#1A1A2E" }]}>DYUKSA</Text>
                <TouchableOpacity onPress={() => closeSidebar()} style={styles.closeBtn}>
                  <Text style={[styles.closeBtnText, { color: isDark ? "#5C5C6E" : "#9AA3B2" }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* User card — at top below header */}
              <TouchableOpacity
                style={styles.sidebarFooter}
                onPress={() => goToStack('Profile')}
                activeOpacity={0.7}
              >
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.userAvatarImage} />
                ) : (
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{user?.avatar || user?.name?.[0]?.toUpperCase() || 'U'}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: isDark ? "#fff" : "#1A1A2E" }]}>{user?.name || 'User'}</Text>
                  <Text style={[styles.userRole, { color: isDark ? "#5C5C6E" : "#6B7588" }]}>{user?.role || 'Member'}</Text>
                </View>
                <Text style={{ color: '#5C5C6E', fontSize: 16, marginRight: 4 }}>›</Text>
              </TouchableOpacity>


              {/* Nav items */}
              <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
                <SidebarItem icon="grid"          label="Dashboard" active={activeScreen === 'Dashboard'} onPress={goToDashboard} isDarkMode={isDark} />
                <SidebarItem icon="folder"        label="Projects"  active={activeScreen === 'Projects'}  hasArrow onPress={() => goToTab('Projects')} isDarkMode={isDark} />
                <SidebarItem icon="file-text"     label="Documents"  active={activeScreen === 'Docs'}      onPress={() => goToStack('Docs')} isDarkMode={isDark} />

                {/* Tasks expandable */}
                <TouchableOpacity
                  style={[styles.sidebarItem, activeScreen === 'Tasks' && styles.sidebarItemActive]}
                  onPress={() => setTasksExpanded(v => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sidebarItemIcon}>☑️</Text>
                  <Text style={[styles.sidebarItemLabel, activeScreen === 'Tasks' && styles.sidebarItemLabelActive]}>
                    Tasks
                  </Text>
                  <Text style={[styles.sidebarArrow, tasksExpanded && { transform: [{ rotate: '90deg' }] }]}>›</Text>
                </TouchableOpacity>
                {tasksExpanded && (
                  <View style={styles.submenu}>
                    {taskSubmenu.map((item, i) => (
                      <TouchableOpacity key={i} style={styles.submenuItem} onPress={() => goToTasksWith(item.params)} activeOpacity={0.7}>
                        <Text style={styles.submenuIcon}>{item.icon}</Text>
                        <Text style={styles.submenuLabel}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <SidebarItem icon="calendar"      label="Calendar"       active={activeScreen === 'Calendar'}   hasArrow onPress={() => goToTab('Calendar')} isDarkMode={isDark} />
                <SidebarItem icon="briefcase"     label="My Work"        active={activeScreen === 'MyWork'}     onPress={() => goToStack('MyWork')} isDarkMode={isDark} />
                <SidebarItem icon="bar-chart-2"   label="Reports"        active={activeScreen === 'Reports'}    onPress={() => goToStack('Reports')} isDarkMode={isDark} />
                <SidebarItem icon="zap"           label="Quick Notes"    active={activeScreen === 'QuickNotes'} onPress={() => goToStack('QuickNotes')} isDarkMode={isDark} />
                {canManageMembers(user?.role) && (
                  <SidebarItem icon="users"       label="Team Management" hasArrow onPress={() => goToStack('TeamManagement')} isDarkMode={isDark} />
                )}
                <SidebarItem icon="message-square" label="Chats"          active={activeScreen === 'Chat'} hasArrow onPress={() => goToStack('Chat')} isDarkMode={isDark} />
                <SidebarItem icon="settings"      label="Settings"      active={activeScreen === 'Settings'} onPress={() => goToStack('Settings')} isDarkMode={isDark} />
              </ScrollView>


              {/* ── Workspace Switcher ── */}
              <TouchableOpacity
                style={styles.wsCurrentRow}
                onPress={() => setWsExpanded(v => !v)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.wsName} numberOfLines={1}>
                    {currentWorkspace?.name || 'Select Workspace'}
                  </Text>
                  <Text style={styles.wsLabel}>Workspace</Text>
                </View>
                {loadingWorkspaces
                  ? <ActivityIndicator size="small" color="#4ECDC4" />
                  : <Text style={styles.wsChevron}>{wsExpanded ? '▲' : '▾'}</Text>
                }
              </TouchableOpacity>

                {/* Workspace list dropdown */}
                {wsExpanded && (
                  <View style={styles.wsDropdown}>
                    <Text style={styles.wsDropdownTitle}>SWITCH WORKSPACE</Text>
                    <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                      {workspaces.map(ws => {
                        const isActive  = ws.id === currentWorkspace?.id;
                        const switching = switchingId === ws.id;
                        return (
                          <TouchableOpacity
                            key={ws.id}
                            style={[styles.wsItem, isActive && styles.wsItemActive]}
                            onPress={() => {
                              if (String(ws.id) === String(currentWorkspace?.id)) {
                                setWsExpanded(false);
                                return;
                              }
                              handleSwitch(ws)
                                .then(() => {
                                  setWsExpanded(false);
                                  closeSidebar(() => {
                                    const rootNav = navigation.getParent() || navigation;
                                    rootNav.reset({
                                      index: 0,
                                      routes: [{ name: 'Main' }],
                                    });
                                  });
                                })
                                .catch(e => Alert.alert('Could not switch workspace', e.message || 'Try again.'));
                            }}
                            disabled={!!switchingId}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.wsItemName, isActive && styles.wsItemNameActive]} numberOfLines={1}>
                              {ws.name}
                            </Text>
                            {switching
                              ? <ActivityIndicator size="small" color="#4ECDC4" />
                              : isActive
                                ? <Text style={styles.wsItemCheck}>✓</Text>
                                : null
                            }
                          </TouchableOpacity>
                        );
                      })}
                      {workspaces.length === 0 && !loadingWorkspaces && (
                        <Text style={styles.wsEmpty}>No workspaces found</Text>
                      )}
                    </ScrollView>
                    {/* Read-only note */}
                    <View style={styles.wsFooterNote}>
                      <Text style={styles.wsFooterNoteText}>
                        {canCreateWorkspace(user?.role)
                          ? '🌐 Create workspaces from the web app'
                          : '🔒 Contact your admin to create workspaces'}
                      </Text>
                    </View>
                  </View>
                )}

              {/* Logout only */}
              <View style={styles.sidebarBottom}>
                <TouchableOpacity
                  style={[styles.sidebarBottomBtn, { flex: 1 }]}
                  onPress={() => closeSidebar(async () => { await logout(); })}
                >
                  <Feather name="log-out" size={16} color="#F87171" />
                  <Text style={[styles.sidebarBottomText, { color: '#F87171' }]}>Log out</Text>
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
  sidebar: { position: 'absolute', top: 0, left: 0, width: SIDEBAR_WIDTH, height: '100%', elevation: 20, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 },

  sidebarHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)', gap: 10 },
  sidebarBrand: { flex: 1, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#4ECDC4', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 16 },

  sidebarNav: { flex: 1, paddingTop: 8, paddingHorizontal: 8 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8, marginBottom: 2 },
  sidebarItemActive: { backgroundColor: 'rgba(45,106,227,0.08)' },
  sidebarItemIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  sidebarItemIconWrap: { width: 22, alignItems: 'center', justifyContent: 'center' },
  sidebarItemLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  sidebarItemLabelActive: { color: '#2D6AE3', fontWeight: '600' },
  sidebarArrow: { color: '#5C5C6E', fontSize: 18 },

  submenu: { paddingLeft: 14, marginLeft: 18, borderLeftWidth: 1, borderLeftColor: '#252535', marginBottom: 4 },
  submenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  submenuIcon: { fontSize: 13, color: '#9898A6', width: 16, textAlign: 'center' },
  submenuLabel: { flex: 1, fontSize: 13, color: '#9898A6', fontWeight: '500' },
  myViewsLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },

  sidebarDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: 16, marginVertical: 6 },

  sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  userAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#4ECDC4', justifyContent: 'center', alignItems: 'center' },
  userAvatarImage: { width: 34, height: 34, borderRadius: 17 },
  userAvatarText: { color: '#1A1A2E', fontWeight: '700', fontSize: 14 },
  userName: { fontSize: 13, fontWeight: '600' },
  userRole: { fontSize: 11, marginTop: 1 },

  // ── Workspace switcher ──
  wsCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D4070',
    backgroundColor: '#1A2744',
  },
  wsName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 8,
  },
  wsLabel: {
    color: '#9898A6',
    fontSize: 10,
    marginTop: 1,
  },
  wsChevron: {
    color: '#9898A6',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },

  wsDropdown: {
    borderTopWidth: 1,
    borderTopColor: '#252535',
    backgroundColor: '#131320',
    paddingBottom: 4,
  },
  wsDropdownTitle: {
    fontSize: 9, fontWeight: '700', color: '#5C5C6E',
    letterSpacing: 0.8,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
  },
  wsItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, marginHorizontal: 6, marginBottom: 2,
  },
  wsItemActive: { backgroundColor: 'rgba(78,205,196,0.12)' },
  wsItemAvatar: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: '#252535',
    justifyContent: 'center', alignItems: 'center',
  },
  wsItemAvatarActive: { backgroundColor: '#4ECDC4' },
  wsItemAvatarText: { color: '#9898A6', fontSize: 11, fontWeight: '700' },
  wsItemName: { flex: 1, color: '#9898A6', fontSize: 13, fontWeight: '500' },
  wsItemNameActive: { color: '#4ECDC4', fontWeight: '700' },
  wsItemCheck: { color: '#4ECDC4', fontSize: 14, fontWeight: '700' },
  wsEmpty: { color: '#5C5C6E', fontSize: 12, textAlign: 'center', padding: 12 },
  wsFooterNote: {
    borderTopWidth: 1, borderTopColor: '#252535',
    paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 4,
  },
  wsFooterNoteText: { color: '#5C5C6E', fontSize: 10, textAlign: 'center' },

  sidebarBottom: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 16, gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  sidebarBottomBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  sidebarBottomIcon: { fontSize: 14 },
  sidebarBottomText: { color: '#9898A6', fontSize: 12, fontWeight: '500' },
});
