import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, StatusBar, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../../context/ThemeContext';
import { NotificationsContext } from '../../context/NotificationsContext';
import { authApi, workspaceApi } from '../../api';

const ROLES = ['admin', 'manager', 'developer', 'annotator', 'viewer'];

// ── Design tokens 
const T = {
  brand: '#2D6AE3', ink: '#0E1726', ink3: '#6B7588', ink4: '#9AA3B2',
  hairline: '#E6E9EF', surface: '#FFFFFF', surfaceAlt: '#F7F8FB',
  brandSoft: '#E6EEFC',
};

const ROLE_COLORS = {
  admin: { bg: '#FEE2E2', txt: '#991B1B', label: 'Admin' },
  manager: { bg: '#DBEAFE', txt: '#1E40AF', label: 'Manager' },
  developer: { bg: '#D1FAE5', txt: '#065F46', label: 'Developer' },
  annotator: { bg: '#FEF3C7', txt: '#92400E', label: 'Annotator' },
  viewer: { bg: '#F3F4F6', txt: '#374151', label: 'Viewer' },
};
const roleStyle = (r) =>
  ROLE_COLORS[(r || '').toLowerCase()] || { bg: '#F3F4F6', txt: '#374151', label: r || 'Member' };

export default function InviteUserScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
  const isDark = theme === 'Dark';

  const bgColor = isDark ? '#0D0D0F' : T.surfaceAlt;
  const cardBg = isDark ? '#1A1A20' : T.surface;
  const inputBg = isDark ? '#252530' : '#F2F3F7';
  const bdr = isDark ? '#252530' : T.hairline;
  const txt = isDark ? '#FFFFFF' : T.ink;
  const sub = isDark ? '#9898A6' : T.ink3;
  const accent = T.brand;

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [workspace, setWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [wsDropOpen, setWsDropOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const list = await workspaceApi.getAll();
      setWorkspaces(list);
    } catch (e) { console.warn('fetchWorkspaces:', e.message); }
  };

  const handleInvite = async () => {
    if (!email.trim()) { Alert.alert('Required', 'Enter an email address.'); return; }
    setSaving(true);
    try {
      const payload = { email: email.trim(), role };
      if (workspace?.id) payload.workspace_id = workspace.id;

      const data = await authApi.sendInvite(payload);

      const wsName = data.workspace || workspace?.name || 'Default Workspace';
      addNotification({
        type: 'team', icon: '✉️',
        title: 'Invite Sent',
        body: `Invitation sent to ${email.trim()} (${wsName})`,
      });
      Alert.alert('Invite Sent ✓', `Invitation sent to ${email.trim()}\nWorkspace: ${wsName}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      const msg = e.data?.detail || e.data?.message || e.message || 'Network error. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backText, { color: txt }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt }]}>Invite Member</Text>
        <TouchableOpacity
          onPress={handleInvite}
          disabled={saving}
          style={[styles.sendBtn, { backgroundColor: saving ? T.ink4 : accent }]}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendBtnText}>Send</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.ScrollView
          style={{ flex: 1, opacity: fadeAnim }}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Email */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: bdr }]}>
            <Text style={[styles.fieldLabel, { color: sub }]}>EMAIL ADDRESS *</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address…"
              placeholderTextColor={sub}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={[styles.input, { backgroundColor: inputBg, borderColor: bdr, color: txt }]}
            />
          </View>

          {/* Role */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: bdr }]}>
            <Text style={[styles.fieldLabel, { color: sub }]}>SELECT ROLE</Text>
            {ROLES.map(r => {
              const rs = roleStyle(r);
              const selected = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleOption,
                    { borderColor: selected ? rs.txt : bdr, backgroundColor: selected ? rs.bg : 'transparent' },
                  ]}
                  onPress={() => setRole(r)}
                >
                  <View style={[
                    styles.roleOptionDot,
                    { borderColor: selected ? rs.txt : bdr, backgroundColor: selected ? rs.txt : 'transparent' },
                  ]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleLabel, { color: selected ? rs.txt : txt }]}>{rs.label}</Text>
                  </View>
                  {selected && <Text style={{ color: rs.txt, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Workspace */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: bdr }]}>
            <Text style={[styles.fieldLabel, { color: sub }]}>
              ADD TO WORKSPACE{'  '}
              <Text style={{ fontWeight: '400', fontSize: 10, letterSpacing: 0 }}>(optional)</Text>
            </Text>

            {/* Dropdown trigger */}
            <TouchableOpacity
              style={[styles.dropTrigger, { backgroundColor: inputBg, borderColor: wsDropOpen ? accent : bdr }]}
              onPress={() => setWsDropOpen(o => !o)}
            >
              <Text style={[styles.dropTriggerText, { color: workspace ? txt : sub }]} numberOfLines={1}>
                {workspace ? workspace.name : 'Default Workspace'}
              </Text>
              <Text style={{ color: sub, fontSize: 11 }}>{wsDropOpen ? '▲' : '▾'}</Text>
            </TouchableOpacity>

            {wsDropOpen && (
              <View style={[styles.dropList, { backgroundColor: cardBg, borderColor: accent }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {/* Default option */}
                  <TouchableOpacity
                    style={[styles.dropItem, { borderBottomColor: bdr }]}
                    onPress={() => { setWorkspace(null); setWsDropOpen(false); }}
                  >
                    <Text style={[styles.dropItemText, { color: !workspace ? accent : txt, fontWeight: !workspace ? '700' : '500' }]}>
                      Default Workspace
                    </Text>
                    {!workspace && <Text style={{ color: accent }}>✓</Text>}
                  </TouchableOpacity>

                  {workspaces.map(ws => {
                    const isSelected = workspace?.id === ws.id;
                    return (
                      <TouchableOpacity
                        key={ws.id}
                        style={[styles.dropItem, { borderBottomColor: bdr }]}
                        onPress={() => { setWorkspace(ws); setWsDropOpen(false); }}
                      >
                        <Text style={[styles.dropItemText, { color: isSelected ? accent : txt, fontWeight: isSelected ? '700' : '500', flex: 1 }]}>
                          {ws.name}
                        </Text>
                        {isSelected && <Text style={{ color: accent }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Info box */}
          <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(45,106,227,0.08)' : T.brandSoft, borderColor: isDark ? 'rgba(45,106,227,0.25)' : 'rgba(45,106,227,0.18)' }]}>
            <Text style={{ fontSize: 12, color: accent, lineHeight: 18 }}>
              ✦  An email invitation will be sent. The user can join using the link in the email.
            </Text>
          </View>

          {/* Send button */}
          <TouchableOpacity
            onPress={handleInvite}
            disabled={saving}
            activeOpacity={0.85}
            style={[styles.sendBtnFull, { backgroundColor: saving ? T.ink4 : accent }]}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.sendBtnFullText}>✉  Send Invitation</Text>
            }
          </TouchableOpacity>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backText: { fontSize: 32, fontWeight: '300', marginTop: -4 },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sendBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, minWidth: 72, alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  scroll: { padding: 16 },

  card: {
    borderRadius: 14, borderWidth: 1,
    padding: 16, marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '700',
    letterSpacing: 1, marginBottom: 10,
  },
  input: {
    borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 14, height: 48,
    fontSize: 14,
  },

  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 8,
  },
  roleOptionDot: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2,
  },
  roleLabel: { fontSize: 14, fontWeight: '600' },

  dropTrigger: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 12, height: 46,
  },
  dropTriggerText: { fontSize: 13, flex: 1 },
  dropList: {
    borderRadius: 10, borderWidth: 1.5,
    marginTop: 4, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1,
  },
  dropItemText: { fontSize: 13, flex: 1 },

  infoBox: {
    borderWidth: 1, borderRadius: 12,
    padding: 12, marginBottom: 20,
  },

  sendBtnFull: {
    height: 54, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2D6AE3', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  sendBtnFullText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
