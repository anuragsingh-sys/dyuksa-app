import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { NotificationsContext } from '../context/NotificationsContext';
import { getUsers, createProject } from '../services/ApiService';

// ── Constants (mirrors ProjectsScreen exactly) ────────────────────────────────
const TASK_TYPES = ['client', 'internal', 'content_creation', 'ideas'];
const TASK_TYPE_LABELS = {
  client: 'Client',
  internal: 'Internal',
  content_creation: 'Content Creation',
  ideas: 'Ideas',
};
const ROLES = ['manager', 'annotator', 'viewer', 'admin'];

const PROJECT_COLORS = ['#2D6AE3', '#7A5AF8', '#22A06B', '#E5A60E', '#E5484D', '#0EA5E9', '#10B981', '#F97316'];

// ── Member row component ──────────────────────────────────────────────────────
function MemberRow({ member, index, users, isDark, onChangeUser, onChangeRole, onRemove }) {
  const [userSearch, setUserSearch] = useState('');
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [roleDropOpen, setRoleDropOpen] = useState(false);

  const cardBg  = isDark ? '#1E1E2C' : '#FFFFFF';
  const inputBg = isDark ? '#252538' : '#F5F5F7';
  const bdr     = isDark ? '#303048' : '#E0E0EC';
  const txt     = isDark ? '#F0F0F8' : '#18182E';
  const sub     = isDark ? '#8080A0' : '#7070A0';
  const accent  = '#4ECDC4';

  const filtered = users.filter(u => {
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || '';
    return name.toLowerCase().includes(userSearch.toLowerCase());
  });

  const displayName = member.user
    ? (`${member.user.first_name || ''} ${member.user.last_name || ''}`.trim() || member.user.username)
    : '';

  return (
    <View style={[styles.memberRow, { backgroundColor: cardBg, borderColor: bdr }]}>
      {/* User picker */}
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={[styles.fieldLabel, { color: sub }]}>MEMBER</Text>
        <TouchableOpacity
          style={[styles.dropTrigger, { backgroundColor: inputBg, borderColor: userDropOpen ? accent : bdr }]}
          onPress={() => { setUserDropOpen(o => !o); setRoleDropOpen(false); }}
        >
          <Text style={[styles.dropTriggerText, { color: member.user ? txt : sub }]} numberOfLines={1}>
            {displayName || 'Select member'}
          </Text>
          <Text style={{ color: sub, fontSize: 10 }}>{userDropOpen ? '▲' : '▾'}</Text>
        </TouchableOpacity>
        {userDropOpen && (
          <View style={[styles.dropList, { backgroundColor: cardBg, borderColor: accent }]}>
            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Search..."
              placeholderTextColor={sub}
              style={[styles.dropSearch, { backgroundColor: inputBg, color: txt, borderColor: bdr }]}
            />
            <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
              {filtered.map(u => {
                const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.dropItem, { borderBottomColor: bdr }]}
                    onPress={() => { onChangeUser(u); setUserDropOpen(false); setUserSearch(''); }}
                  >
                    <View style={[styles.miniAvatar, { backgroundColor: accent + '33' }]}>
                      <Text style={[styles.miniAvatarText, { color: accent }]}>
                        {(name[0] || 'U').toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.dropItemText, { color: txt }]}>{name}</Text>
                      {u.email ? <Text style={{ fontSize: 10, color: sub }}>{u.email}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {filtered.length === 0 && (
                <Text style={[styles.dropEmpty, { color: sub }]}>No members found</Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Role picker */}
      <View style={{ width: 110 }}>
        <Text style={[styles.fieldLabel, { color: sub }]}>ROLE</Text>
        <TouchableOpacity
          style={[styles.dropTrigger, { backgroundColor: inputBg, borderColor: roleDropOpen ? accent : bdr }]}
          onPress={() => { setRoleDropOpen(o => !o); setUserDropOpen(false); }}
        >
          <Text style={[styles.dropTriggerText, { color: member.role ? txt : sub, fontSize: 12 }]} numberOfLines={1}>
            {member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Role'}
          </Text>
          <Text style={{ color: sub, fontSize: 10 }}>{roleDropOpen ? '▲' : '▾'}</Text>
        </TouchableOpacity>
        {roleDropOpen && (
          <View style={[styles.dropList, { backgroundColor: cardBg, borderColor: accent, right: 0, left: 'auto' }]}>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.dropItem, { borderBottomColor: bdr }]}
                onPress={() => { onChangeRole(r); setRoleDropOpen(false); }}
              >
                <Text style={[styles.dropItemText, { color: txt }]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Remove button */}
      {index > 0 && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '700' }}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CreateProjectScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
  const isDark = theme === 'Dark';

  // Theme
  const bgColor   = isDark ? '#0D0D14' : '#F5F5FA';
  const cardBg    = isDark ? '#1A1A28' : '#FFFFFF';
  const inputBg   = isDark ? '#252538' : '#F5F5F7';
  const bdr       = isDark ? '#303048' : '#E0E0EC';
  const txt       = isDark ? '#F0F0F8' : '#18182E';
  const sub       = isDark ? '#8080A0' : '#7070A0';
  const accent    = '#4ECDC4';

  // Form state
  const [projectName,   setProjectName]   = useState('');
  const [description,   setDescription]   = useState('');
  const [taskType,      setTaskType]      = useState(null);
  const [color,         setColor]         = useState(PROJECT_COLORS[0]);
  const [members,       setMembers]       = useState([{ user: null, role: null }]);
  const [users,         setUsers]         = useState([]);
  const [saving,        setSaving]        = useState(false);
  const [typeDropOpen,  setTypeDropOpen]  = useState(false);

  // Fade-in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  // Member helpers
  const addMemberRow    = () => setMembers(m => [...m, { user: null, role: null }]);
  const removeMemberRow = (i) => setMembers(m => m.filter((_, idx) => idx !== i));
  const setMemberUser   = (i, user) => setMembers(m => m.map((r, idx) => idx === i ? { ...r, user } : r));
  const setMemberRole   = (i, role) => setMembers(m => m.map((r, idx) => idx === i ? { ...r, role } : r));

  // Submit — same body shape as ProjectsScreen.addProject
  const handleCreate = async () => {
    if (!projectName.trim()) { Alert.alert('Required', 'Enter a project name.'); return; }
    if (!taskType)           { Alert.alert('Required', 'Select a task type.'); return; }

    const validMembers = members.filter(m => m.user && m.role);
    const body = {
      name:             projectName.trim(),
      task_type:        taskType,
      description:      description.trim() || undefined,
      assigned_members: validMembers.map(m => ({ user_id: m.user.id, role: m.role })),
      project_settings: { priority: 'high' },
    };

    setSaving(true);
    try {
      await createProject(body);
      addNotification({
        type: 'project', icon: '🗂️',
        title: 'Project Created',
        body: `"${projectName.trim()}" was created successfully.`,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const initials = (projectName.trim()[0] || 'P').toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backText, { color: txt }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt }]}>New Project</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: saving ? '#9090B0' : '#1A1A2E' }]}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Create</Text>
          }
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Project icon preview ── */}
        <View style={styles.iconPreviewWrap}>
          <View style={[styles.iconPreview, { backgroundColor: color + '22' }]}>
            <Text style={[styles.iconPreviewText, { color }]}>{initials}</Text>
          </View>
          <Text style={[styles.iconHint, { color: sub }]}>
            Pick a colour below
          </Text>
        </View>

        {/* ── Colour swatches ── */}
        <View style={styles.colorRow}>
          {PROJECT_COLORS.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                color === c && styles.colorSwatchActive,
              ]}
            >
              {color === c && <Text style={styles.colorCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Project name ── */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: bdr }]}>
          <Text style={[styles.fieldLabel, { color: sub }]}>PROJECT NAME *</Text>
          <TextInput
            value={projectName}
            onChangeText={setProjectName}
            placeholder="Enter project name"
            placeholderTextColor={sub}
            style={[styles.input, { backgroundColor: inputBg, borderColor: bdr, color: txt }]}
          />

          <Text style={[styles.fieldLabel, { color: sub, marginTop: 4 }]}>DESCRIPTION</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's this project about?"
            placeholderTextColor={sub}
            multiline
            style={[styles.textarea, { backgroundColor: inputBg, borderColor: bdr, color: txt }]}
          />
        </View>

        {/* ── Task type ── */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: bdr }]}>
          <Text style={[styles.fieldLabel, { color: sub }]}>TASK TYPE *</Text>
          <TouchableOpacity
            style={[styles.dropTrigger, { backgroundColor: inputBg, borderColor: typeDropOpen ? accent : bdr }]}
            onPress={() => setTypeDropOpen(o => !o)}
          >
            <Text style={[styles.dropTriggerText, { color: taskType ? txt : sub }]}>
              {taskType ? TASK_TYPE_LABELS[taskType] : 'Select task type'}
            </Text>
            <Text style={{ color: sub, fontSize: 11 }}>{typeDropOpen ? '▲' : '▾'}</Text>
          </TouchableOpacity>
          {typeDropOpen && (
            <View style={[styles.dropList, { backgroundColor: cardBg, borderColor: accent, position: 'relative', marginTop: 4 }]}>
              {TASK_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.dropItem, { borderBottomColor: bdr }]}
                  onPress={() => { setTaskType(t); setTypeDropOpen(false); }}
                >
                  <Text style={[styles.dropItemText, { color: taskType === t ? accent : txt, fontWeight: taskType === t ? '700' : '500' }]}>
                    {TASK_TYPE_LABELS[t]}
                  </Text>
                  {taskType === t && <Text style={{ color: accent }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Members ── */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: bdr }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.fieldLabel, { color: sub, marginBottom: 0 }]}>MEMBERS</Text>
            <TouchableOpacity onPress={addMemberRow} style={[styles.addMemberBtn, { borderColor: accent }]}>
              <Text style={[styles.addMemberText, { color: accent }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {members.map((member, i) => (
            <MemberRow
              key={i}
              index={i}
              member={member}
              users={users}
              isDark={isDark}
              onChangeUser={(u) => setMemberUser(i, u)}
              onChangeRole={(r) => setMemberRole(i, r)}
              onRemove={() => removeMemberRow(i)}
            />
          ))}

          {members.length === 0 && (
            <Text style={[styles.emptyHint, { color: sub }]}>No members added yet</Text>
          )}
        </View>

        {/* ── Privacy note ── */}
        <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(78,205,196,0.08)' : 'rgba(78,205,196,0.06)', borderColor: 'rgba(78,205,196,0.25)' }]}>
          <Text style={{ fontSize: 12, color: accent, lineHeight: 18 }}>
            ✦  Project will be visible to all assigned members. You can update settings after creation.
          </Text>
        </View>

        {/* ── Create button ── */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.85}
          style={[styles.createBtn, { backgroundColor: saving ? '#9090B0' : '#1A1A2E' }]}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.createBtnText}>Create Project</Text>
          }
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, minWidth: 72, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  scroll: { padding: 16 },

  // Icon preview
  iconPreviewWrap: { alignItems: 'center', marginBottom: 16 },
  iconPreview: {
    width: 88, height: 88, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  iconPreviewText: { fontSize: 38, fontWeight: '800' },
  iconHint: { fontSize: 12, fontWeight: '500' },

  // Color swatches
  colorRow: {
    flexDirection: 'row', justifyContent: 'center',
    flexWrap: 'wrap', gap: 10, marginBottom: 20,
  },
  colorSwatch: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  colorSwatchActive: {
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  colorCheck: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Cards
  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '700',
    letterSpacing: 1, marginBottom: 8,
  },
  input: {
    borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 14, height: 48,
    fontSize: 14, marginBottom: 14,
  },
  textarea: {
    borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },

  // Dropdowns
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
  dropSearch: {
    margin: 8, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, height: 36, fontSize: 13,
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1,
  },
  dropItemText: { fontSize: 13, fontWeight: '500', flex: 1 },
  dropEmpty: { fontSize: 12, fontStyle: 'italic', padding: 12, textAlign: 'center' },

  // Member row
  memberRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    borderRadius: 12, borderWidth: 1,
    padding: 12, marginTop: 10,
  },
  miniAvatar: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  miniAvatarText: { fontSize: 11, fontWeight: '700' },
  removeBtn: {
    width: 32, height: 32, marginLeft: 8,
    justifyContent: 'center', alignItems: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  addMemberBtn: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  addMemberText: { fontSize: 12, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  // Info box
  infoBox: {
    borderWidth: 1, borderRadius: 12,
    padding: 12, marginBottom: 20,
  },

  // Create button
  createBtn: {
    height: 54, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
