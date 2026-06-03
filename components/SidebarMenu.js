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

const SIDEBAR_WIDTH  = 260;

const SidebarItem = ({ icon, label, active, hasArrow, onPress }) => (
  <TouchableOpacity
    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
    onPress={onPress}
    activeOpacity={0.7}
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
            },
          ]}>
            <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
              <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

              {/* Header */}
              <View style={styles.sidebarHeader}>
                <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
                <Text style={styles.sidebarBrand}>DYUKSA</Text>
                <TouchableOpacity onPress={() => closeSidebar()} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Nav items */}
              <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
                <SidebarItem icon="⊞"  label="Dashboard" active={activeScreen === 'Dashboard'} onPress={goToDashboard} />
                <SidebarItem icon="🗂️" label="Projects"  active={activeScreen === 'Projects'}  hasArrow onPress={() => goToTab('Projects')} />
                <SidebarItem icon="📅" label="Calendar"  active={activeScreen === 'Calendar'}  hasArrow onPress={() => goToTab('Calendar')} />

                {/* My Tasks expandable */}
                <TouchableOpacity
                  style={[styles.sidebarItem, activeScreen === 'Tasks' && styles.sidebarItemActive]}
                  onPress={() => setTasksExpanded(v => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sidebarItemIcon}>📋</Text>
                  <Text style={[styles.sidebarItemLabel, activeScreen === 'Tasks' && styles.sidebarItemLabelActive]}>
                    My Tasks
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

                <SidebarItem icon="📄" label="Documents"       active={activeScreen === 'Docs'}       onPress={() => goToStack('Docs')} />
                <SidebarItem icon="⚡" label="Quick Notes"     active={activeScreen === 'QuickNotes'} onPress={() => goToStack('QuickNotes')} />
                {canManageMembers(user?.role) && (
                  <SidebarItem icon="👥" label="Team Management" hasArrow onPress={() => goToStack('TeamManagement')} />
                )}
                <SidebarItem icon="💬" label="Chats"           active={activeScreen === 'Chat'}       hasArrow onPress={() => goToStack('Chat')} />
              </ScrollView>

              <View style={styles.sidebarDivider} />

              {/* User footer — tap to open Profile */}
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
                  <Text style={styles.userName}>{user?.name || 'User'}</Text>
                  <Text style={styles.userRole}>{user?.role || 'Member'}</Text>
                </View>
                <Text style={{ color: '#5C5C6E', fontSize: 16, marginRight: 4 }}>›</Text>
              </TouchableOpacity>

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
                                    try { navigation.jumpTo('Dashboard'); }
                                    catch { navigation.navigate('Main', { screen: 'Dashboard' }); }
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

              {/* Settings + Logout */}
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

  submenu: { paddingLeft: 14, marginLeft: 18, borderLeftWidth: 1, borderLeftColor: '#252535', marginBottom: 4 },
  submenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  submenuIcon: { fontSize: 13, color: '#9898A6', width: 16, textAlign: 'center' },
  submenuLabel: { flex: 1, fontSize: 13, color: '#9898A6', fontWeight: '500' },

  sidebarDivider: { height: 1, backgroundColor: '#252535', marginHorizontal: 16, marginVertical: 6 },

  sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  userAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#4ECDC4', justifyContent: 'center', alignItems: 'center' },
  userAvatarImage: { width: 34, height: 34, borderRadius: 17 },
  userAvatarText: { color: '#1A1A2E', fontWeight: '700', fontSize: 14 },
  userName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  userRole: { color: '#5C5C6E', fontSize: 11, marginTop: 1 },

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
    borderColor: '#252535',
    backgroundColor: '#1E1E2A',
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

  sidebarBottom: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 16, gap: 8 },
  sidebarBottomBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#252535' },
  sidebarBottomIcon: { fontSize: 14 },
  sidebarBottomText: { color: '#9898A6', fontSize: 12, fontWeight: '500' },
});
