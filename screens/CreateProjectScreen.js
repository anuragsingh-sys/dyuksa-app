import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, StatusBar, Animated, Modal,
  FlatList, Image, Keyboard, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Line } from 'react-native-svg';
import { ThemeContext } from '../context/ThemeContext';
import { NotificationsContext } from '../context/NotificationsContext';
import { getUsers, createProject } from '../services/ApiService';

// ── Constants ─────────────────────────────────────────────────────────────────
const TASK_TYPES = ['client', 'internal', 'content_creation', 'ideas'];
const TASK_TYPE_LABELS = {
  client: 'Client',
  internal: 'Internal',
  content_creation: 'Content Creation',
  ideas: 'Ideas',
};

const PROJECT_COLORS = [
  '#3B72EE', // blue (default, matches accent)
  '#22A06B', // green
  '#E5A60E', // yellow
  '#7A5AF8', // purple
  '#E5484D', // red
  '#F97316', // orange
  '#0EA5E9', // sky
  '#10B981', // emerald
];

// ── Helper: user display name ─────────────────────────────────────────────────
function displayName(u) {
  return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || '?';
}

// ── Helper: initials from user ────────────────────────────────────────────────
function initials(u) {
  const n = displayName(u);
  const parts = n.split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : n.slice(0, 2).toUpperCase();
}

// ── Avatar chip colors (cycle by index) ──────────────────────────────────────
const AVATAR_COLORS = ['#3B72EE', '#7A5AF8', '#22A06B', '#E5A60E', '#E5484D', '#0EA5E9'];

// ── Member picker bottom sheet ────────────────────────────────────────────────
function MemberPickerSheet({ visible, users, selectedIds, onToggle, onDone, isDark }) {
  const [search, setSearch] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const cardBg = isDark ? '#1A1A28' : '#FFFFFF';
  const inputBg = isDark ? '#252538' : '#F0F0F0';
  const bdr = isDark ? '#303048' : '#EBEBEB';
  const txt = isDark ? '#F0F0F8' : '#111827';
  const sub = isDark ? '#8080A0' : '#9CA3AF';
  const accent = '#3B72EE';

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Reset search when sheet closes
  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const filtered = users.filter(u =>
    displayName(u).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={sheet.overlay}>
        <View style={[
          sheet.container,
          { backgroundColor: cardBg, paddingBottom: keyboardHeight || 34, flex: 1 },
        ]}>
          {/* Handle */}
          <View style={[sheet.handle, { backgroundColor: bdr }]} />

          {/* Title row */}
          <View style={sheet.titleRow}>
            <Text style={[sheet.title, { color: txt }]}>Add Members</Text>
            <TouchableOpacity onPress={onDone} style={[sheet.doneBtn, { backgroundColor: accent }]}>
              <Text style={sheet.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[sheet.searchWrap, { backgroundColor: inputBg, borderColor: bdr }]}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
              <Circle cx="11" cy="11" r="7" stroke={sub} strokeWidth="2" />
              <Line x1="16.5" y1="16.5" x2="22" y2="22" stroke={sub} strokeWidth="2" strokeLinecap="round" />
            </Svg>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search members..."
              placeholderTextColor={sub}
              style={[sheet.searchInput, { color: txt }]}
            />
          </View>

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={u => String(u.id)}
            style={{ flex: 1, minHeight: 200 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            renderItem={({ item: u, index }) => {
              const selected = selectedIds.includes(u.id);
              const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
              return (
                <TouchableOpacity
                  onPress={() => onToggle(u)}
                  style={[sheet.row, { borderBottomColor: bdr }]}
                  activeOpacity={0.7}
                >
                  <View style={[sheet.avatar, { backgroundColor: avatarColor }]}>
                    <Text style={sheet.avatarText}>{initials(u)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sheet.rowName, { color: txt }]}>{displayName(u)}</Text>
                    {u.role && <Text style={[sheet.rowRole, { color: sub }]}>{u.role}</Text>}
                  </View>
                  <View style={[
                    sheet.checkbox,
                    selected
                      ? { backgroundColor: accent, borderColor: accent }
                      : { backgroundColor: 'transparent', borderColor: bdr },
                  ]}>
                    {selected && <Text style={sheet.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={[sheet.empty, { color: sub }]}>No members found</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', minHeight: 360 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { fontSize: 17, fontWeight: '700' },
  doneBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowRole: { fontSize: 12, marginTop: 1 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 14 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CreateProjectScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
  const isDark = theme === 'Dark';

  // Theme tokens
  const bgColor  = isDark ? '#0D0D14' : '#FFFFFF';
  const cardBg   = isDark ? '#1A1A28' : '#FFFFFF';
  const inputBg  = isDark ? '#252538' : '#F0F0F0';
  const bdr      = isDark ? '#303048' : 'transparent';
  const txt      = isDark ? '#F0F0F8' : '#111827';
  const sub      = isDark ? '#8080A0' : '#9CA3AF';
  const accent   = '#3B72EE';

  // Form state
  const [projectName, setProjectName]   = useState('');
  const [description, setDescription]   = useState('');
  const [taskType,    setTaskType]      = useState(null);
  const [color,       setColor]         = useState(PROJECT_COLORS[0]);
  const [privacy,     setPrivacy]       = useState('workspace');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [users,       setUsers]         = useState([]);
  const [saving,      setSaving]        = useState(false);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);
  const [projectImages, setProjectImages] = useState([]);

  // Fade-in
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  const toggleMember = (user) => {
    setSelectedMembers(prev =>
      prev.find(m => m.id === user.id)
        ? prev.filter(m => m.id !== user.id)
        : [...prev, user]
    );
  };

  const selectedIds = selectedMembers.map(m => m.id);

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera access is needed.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri)
      setProjectImages(p => [...p, result.assets[0].uri]);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Gallery access is needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled && result.assets?.length)
      setProjectImages(p => [...p, ...result.assets.map(a => a.uri)]);
  };

  const handleCreate = async () => {
    if (!projectName.trim()) { Alert.alert('Required', 'Enter a project name.'); return; }
    if (!taskType)            { Alert.alert('Required', 'Select a task type.'); return; }

    const body = {
      name:             projectName.trim(),
      task_type:        taskType,
      description:      description.trim() || undefined,
      assigned_members: selectedMembers.map(m => ({ user_id: m.id, role: 'viewer' })),
      project_settings: { priority: 'high', privacy },
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

  const projectInitials = (projectName.trim()[0] || 'P').toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backChevron, { color: txt }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt }]}>New Project</Text>
        <TouchableOpacity onPress={handleCreate} disabled={saving} activeOpacity={0.8}>
          {saving
            ? <ActivityIndicator size="small" color={accent} />
            : <Text style={[styles.saveText, { color: accent }]}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Project icon preview ── */}
        <View style={styles.iconWrap}>
          <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
            <Text style={[styles.iconLetter, { color }]}>{projectInitials}</Text>
          </View>
          <View style={[styles.cameraBadge, { backgroundColor: cardBg, borderColor: bdr }]}>
            <Text style={{ fontSize: 13 }}>+</Text>
          </View>
        </View>

        {/* ── Color swatches ── */}
        <View style={styles.colorRow}>
          {PROJECT_COLORS.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
              activeOpacity={0.85}
            />
          ))}
        </View>

        {/* ── Project Name ── */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: sub }]}>Project name</Text>
          <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: bdr }]}>
            <TextInput
              value={projectName}
              onChangeText={setProjectName}
              placeholderTextColor={sub}
              style={[styles.inputField, { color: txt }]}
            />
          </View>
        </View>

        {/* ── Description ── */}
        <View style={[styles.textareaWrap, { backgroundColor: inputBg, borderColor: bdr }]}>
          <Text style={[styles.textareaLabel, { color: sub }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's this project about?"
            placeholderTextColor={sub}
            multiline
            style={[styles.textarea, { color: txt }]}
          />
        </View>

        {/* ── Task Type — chips ── */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: sub }]}>
            Task type <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <View style={styles.typeChipsRow}>
            {TASK_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setTaskType(t)}
                style={[
                  styles.typeChip,
                  {
                    borderColor: taskType === t ? accent : inputBg,
                    backgroundColor: taskType === t ? accent + '15' : inputBg,
                  },
                ]}
                activeOpacity={0.75}
              >
                <Text style={[styles.typeChipText, { color: taskType === t ? accent : sub }]}>
                  {TASK_TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Members ── */}
        <View style={styles.membersSection}>
          <View style={styles.membersTitleRow}>
            <Text style={[styles.sectionTitle, { color: txt }]}>Members</Text>
            <TouchableOpacity onPress={() => setMemberSheetOpen(true)} activeOpacity={0.7}>
              <Text style={[styles.addText, { color: accent }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.membersCard, { backgroundColor: inputBg, borderColor: bdr }]}>
            {selectedMembers.length > 0 ? (
              <View style={styles.memberChipsWrap}>
                {selectedMembers.map((m, idx) => {
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  return (
                    <View key={m.id} style={styles.memberChip}>
                      <View style={[styles.chipAvatar, { backgroundColor: avatarColor }]}>
                        <Text style={styles.chipAvatarText}>{initials(m)}</Text>
                      </View>
                      <Text style={[styles.chipName, { color: txt }]}>
                        {displayName(m).split(' ')[0]}
                      </Text>
                    </View>
                  );
                })}
                <TouchableOpacity
                  onPress={() => setMemberSheetOpen(true)}
                  style={[styles.inviteBtn, { borderColor: bdr }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.inviteBtnText, { color: sub }]}>+ Invite</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setMemberSheetOpen(true)}
                style={styles.emptyMembersBtn}
                activeOpacity={0.7}
              >
                <Text style={[styles.emptyMembersText, { color: sub }]}>Tap + Add to invite team members</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Privacy ── */}
        <View style={styles.privacySection}>
          <Text style={[styles.sectionTitle, { color: txt }]}>Privacy</Text>

          <View style={[styles.privacyCard, { backgroundColor: inputBg, borderColor: bdr }]}>
            <TouchableOpacity
              onPress={() => setPrivacy('workspace')}
              style={[styles.privacyRow, { borderBottomColor: bdr }]}
              activeOpacity={0.75}
            >
              <View style={[styles.radio, { borderColor: privacy === 'workspace' ? accent : bdr }]}>
                {privacy === 'workspace' && <View style={[styles.radioDot, { backgroundColor: accent }]} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.privacyTitle, { color: txt }]}>Workspace</Text>
                <Text style={[styles.privacySub, { color: sub }]}>Everyone in Dyuksa can see and join</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPrivacy('private')}
              style={styles.privacyRow}
              activeOpacity={0.75}
            >
              <View style={[styles.radio, { borderColor: privacy === 'private' ? accent : bdr }]}>
                {privacy === 'private' && <View style={[styles.radioDot, { backgroundColor: accent }]} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.privacyTitle, { color: txt }]}>Private</Text>
                <Text style={[styles.privacySub, { color: sub }]}>Only invited members have access</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Attachments ── */}
        <View style={styles.attachSection}>
          <Text style={[styles.sectionTitle, { color: txt }]}>Attachments</Text>

          <TouchableOpacity
            onPress={openGallery}
            style={[styles.uploadBox, { borderColor: '#D8DBEA', backgroundColor: inputBg }]}
            activeOpacity={0.7}
          >
            {/* Upload icon SVG-style using Text */}
            <View style={styles.uploadIconWrap}>
              <Text style={[styles.uploadArrow, { color: sub }]}>↑</Text>
              <View style={[styles.uploadTray, { borderColor: sub }]} />
            </View>
            <Text style={[styles.uploadTitle, { color: txt }]}>Upload files</Text>
            <Text style={[styles.uploadSub, { color: sub }]}>PNG, PDF, DOCX up to 20MB</Text>
          </TouchableOpacity>

          {/* Previews */}
          {projectImages.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {projectImages.map((uri, i) => (
                <View key={i} style={{ position: 'relative', marginRight: 10 }}>
                  <Image source={{ uri }} style={[styles.previewImg, { borderColor: bdr }]} />
                  <TouchableOpacity
                    style={styles.removeImg}
                    onPress={() => setProjectImages(p => p.filter((_, idx) => idx !== i))}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Create button ── */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.85}
          style={[styles.createBtn, { backgroundColor: saving ? '#9090B0' : accent }]}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.createBtnText}>Create Project</Text>
          }
        </TouchableOpacity>
      </Animated.ScrollView>

      {/* ── Member picker sheet ── */}
      <MemberPickerSheet
        visible={memberSheetOpen}
        users={users}
        selectedIds={selectedIds}
        onToggle={toggleMember}
        onDone={() => setMemberSheetOpen(false)}
        isDark={isDark}
      />
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
    borderBottomWidth: 0,
  },
  backBtn:     { width: 36, height: 36, justifyContent: 'center' },
  backChevron: { fontSize: 32, fontWeight: '300', marginTop: -4 },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  saveText:    { fontSize: 15, fontWeight: '600' },

  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  // Icon preview
  iconWrap: { alignItems: 'center', marginBottom: 20, alignSelf: 'center' },
  iconBox: {
    width: 88, height: 88, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  iconLetter: { fontSize: 38, fontWeight: '800' },
  cameraBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },

  // Color swatches
  colorRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 28 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  swatchActive: {
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22, shadowRadius: 4, elevation: 5,
  },

  // Fields
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 7, color: '#8A8FAB' },

  inputWrap: {
    borderRadius: 14, borderWidth: 0,
    paddingHorizontal: 16, height: 52, justifyContent: 'center',
  },
  inputField: { fontSize: 15, paddingVertical: 0 },

  textareaWrap: {
    borderRadius: 14, borderWidth: 0,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    marginBottom: 14, minHeight: 110,
  },
  textareaLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8, color: '#8A8FAB' },
  textarea: { fontSize: 15, minHeight: 70, textAlignVertical: 'top', paddingVertical: 0 },

  // Task type chips
  typeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  typeChipText: { fontSize: 13, fontWeight: '600' },

  // Members
  membersSection: { marginBottom: 22 },
  membersTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  addText: { fontSize: 14, fontWeight: '600' },
  membersCard: { borderRadius: 16, borderWidth: 0, padding: 16, minHeight: 54 },
  memberChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  memberChip: { alignItems: 'center', gap: 4 },
  chipAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  chipAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  chipName: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  inviteBtn: {
    borderWidth: 0, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, marginTop: 8,
  },
  inviteBtnText: { fontSize: 13, fontWeight: '600' },
  emptyMembersBtn: { paddingVertical: 8, alignItems: 'center' },
  emptyMembersText: { fontSize: 14 },

  // Privacy
  privacySection: { marginBottom: 22 },
  privacyCard: { borderRadius: 16, borderWidth: 0, overflow: 'hidden', marginTop: 10 },
  privacyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  privacyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  privacySub: { fontSize: 12 },

  // Attachments
  attachSection: { marginBottom: 22 },
  uploadBox: {
    marginTop: 10, borderWidth: 1.5, borderRadius: 16,
    borderStyle: 'dashed', paddingVertical: 32,
    alignItems: 'center', gap: 6,
  },
  uploadIconWrap: { alignItems: 'center', marginBottom: 4 },
  uploadArrow: { fontSize: 26, lineHeight: 28, fontWeight: '300' },
  uploadTray: {
    width: 28, height: 6, borderWidth: 1.5,
    borderTopWidth: 0, borderRadius: 2,
    marginTop: -4,
  },
  uploadTitle: { fontSize: 16, fontWeight: '700' },
  uploadSub:   { fontSize: 13 },
  previewImg:  { width: 80, height: 80, borderRadius: 10, borderWidth: 1 },
  removeImg: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },

  // Create button
  createBtn: {
    height: 54, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#3B72EE', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    marginBottom: 8,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
