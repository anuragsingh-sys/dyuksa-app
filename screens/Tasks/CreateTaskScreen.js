import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Pressable,
  StyleSheet, Alert, ActivityIndicator, StatusBar, Animated, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../../context/ThemeContext';
import { NotificationsContext } from '../../context/NotificationsContext';
import { getUsers, getProjects, createTask, refineTextAI } from '../../services/ApiService';
import { invalidateTasksCache } from '../../hooks/useTasksCache';

const PRIORITIES = [
  { key: 'low',      label: 'Low',      color: '#22A06B' },
  { key: 'medium',   label: 'Medium',   color: '#3B72EE' },
  { key: 'high',     label: 'High',     color: '#F97316' },
  { key: 'critical', label: 'Critical', color: '#EF4444' },
];

const STATUSES = [
  { key: 'pending',     label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'backlog',     label: 'Backlog' },
  { key: 'review',      label: 'Review' },
];

const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtDateLabel = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const AVATAR_COLORS = ['#3B72EE', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];
const avatarColor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export default function CreateTaskScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
  const isDark = theme === 'Dark';

  const bg    = isDark ? '#0D0D14' : '#F7F8FB';
  const card  = isDark ? '#1A1A28' : '#FFFFFF';
  const inputBg = isDark ? '#252538' : '#F5F5F7';
  const bdr   = isDark ? '#303048' : '#E8E8EF';
  const txt   = isDark ? '#F0F0F8' : '#0E1726';
  const sub   = isDark ? '#8080A0' : '#888899';

  // Form state
  const [heading,     setHeading]     = useState('');
  const [description, setDescription] = useState('');
  const [priority,    setPriority]    = useState('medium');
  const [status,      setStatus]      = useState('pending');
  const [endDate,     setEndDate]     = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; });
  const [startDate,   setStartDate]   = useState(() => new Date());
  const [showDateSheet2, setShowDateSheet2] = useState(null); // 'start' | 'end'

  const calcDuration = () => {
    if (!startDate || !endDate) return null;
    const diff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    return diff > 0 ? `${diff}d` : null;
  };
  const [project,     setProject]     = useState(null);
  const [assignees,   setAssignees]   = useState([]);
  const [startTime,    setStartTime]    = useState('');
  const [endTime,      setEndTime]      = useState('');
  const [showTimePicker, setShowTimePicker] = useState(null); // 'start' | 'end' | null
  const [timePickerVal,  setTimePickerVal]  = useState(new Date());

  // AI enhance
  const [enhancingTitle, setEnhancingTitle] = useState(false);
  const [enhancingDesc,  setEnhancingDesc]  = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Data
  const [projects, setProjects] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [linkInput,  setLinkInput]  = useState('');
  const [links,      setLinks]      = useState([]);

  // Sheet modals
  const [showProjectSheet,  setShowProjectSheet]  = useState(false);
  const [showAssignSheet,   setShowAssignSheet]   = useState(false);
  const [showDateSheet,     setShowDateSheet]     = useState(null); // 'start' | 'end' | null
  const [assignSearch,      setAssignSearch]      = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getProjects().then(pl => {
      setProjects(pl);
      if (route.params?.projectId) {
        const pre = pl.find(p => String(p.id) === String(route.params.projectId));
        if (pre) setProject(pre);
      }
    }).catch(() => {});
    getUsers().then(setUsers).catch(() => {});
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  const userName = (u) =>
    `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'User';

  const toggleAssignee = (u) => {
    setAssignees(prev =>
      prev.some(a => a.id === u.id) ? prev.filter(a => a.id !== u.id) : [...prev, u]
    );
  };

  const addSubtask = () => {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { id: Date.now(), title: t, done: false }]);
    setNewSubtask('');
  };

  const toggleSubtask = (id) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  const enhanceTitle = async () => {
    if (!heading.trim()) { Alert.alert('Empty', 'Enter a task title first.'); return; }
    setEnhancingTitle(true);
    try {
      const result = await refineTextAI(heading, 'optimize_title');
      if (result) setHeading(result);
      else Alert.alert('Error', 'Could not enhance title.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setEnhancingTitle(false); }
  };

  const generateDescription = async () => {
    if (!heading.trim()) { Alert.alert('Empty', 'Enter a task title first to generate description.'); return; }
    setGeneratingDesc(true);
    try {
      const result = await refineTextAI(heading, 'generate_description');
      if (result) setDescription(result);
      else Alert.alert('Error', 'Could not generate description.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setGeneratingDesc(false); }
  };

  const refineDescription = async () => {
    if (!description.trim()) { Alert.alert('Empty', 'Enter a description first.'); return; }
    setEnhancingDesc(true);
    try {
      const result = await refineTextAI(description, 'refine_description');
      if (result) setDescription(result);
      else Alert.alert('Error', 'Could not refine description.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setEnhancingDesc(false); }
  };

  const handleCreate = async () => {
    if (!heading.trim()) { Alert.alert('Required', 'Enter a task title.'); return; }
    if (!project)        { Alert.alert('Required', 'Select a project.'); return; }

    const formData = new FormData();
    formData.append('heading', heading.trim());
    if (description.trim()) formData.append('description', description.trim());
    formData.append('priority', priority);
    formData.append('status', status);
    formData.append('start_date', fmtDate(startDate));
    formData.append('end_date', fmtDate(endDate));
    if (project) formData.append('project', String(project.id));
    if (startTime) formData.append('start_time', startTime);
    if (endTime)   formData.append('end_time', endTime);
    assignees.forEach(u => formData.append('assigned_to', String(u.id)));
    links.forEach(l => formData.append('links', l));

    setSaving(true);
    try {
      await createTask(formData);
      invalidateTasksCache();
      addNotification({ type: 'task', icon: '📋', title: 'Task Created', body: `"${heading.trim()}" was created.` });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not create task.');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u =>
    userName(u).toLowerCase().includes(assignSearch.toLowerCase())
  );

  const PRIORITY_COLORS_MAP = Object.fromEntries(PRIORITIES.map(p => [p.key, p.color]));

  // ── Bottom sheet component ─────────────────────────────────────────
  const Sheet = ({ visible, onClose, title, children, onDone, doneLabel }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: card }]} onPress={() => {}}>
          <View style={[s.sheetHandle, { backgroundColor: bdr }]} />
          <View style={[s.sheetHeader, { borderBottomColor: bdr }]}>
            <Text style={[s.sheetTitle, { color: txt }]}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {onDone && (
                <TouchableOpacity onPress={onDone} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 14, color: '#3B72EE', fontWeight: '700' }}>{doneLabel || 'Done'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 20, color: sub }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Text style={{ fontSize: 26, color: txt, fontWeight: '300' }}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: txt }]}>New Task</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={saving}
          style={{ padding: 6 }}
        >
          {saving
            ? <ActivityIndicator size="small" color="#3B72EE" />
            : <Text style={{ fontSize: 15, fontWeight: '700', color: '#3B72EE' }}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView
          style={{ flex: 1, opacity: fadeAnim }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Title + Description with AI ── */}
          <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>

            {/* Task Title */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: sub, marginBottom: 6 }}>Task Title *</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: bdr, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, gap: 8 }}>
              <TextInput
                value={heading}
                onChangeText={setHeading}
                placeholder="Enter a concise task title"
                placeholderTextColor={sub}
                style={{ flex: 1, fontSize: 14, color: txt, paddingVertical: 0 }}
                returnKeyType="next"
              />
              <TouchableOpacity
                onPress={enhanceTitle}
                disabled={enhancingTitle}
                style={{ padding: 6 }}
              >
                {enhancingTitle
                  ? <ActivityIndicator size="small" color="#3B72EE" />
                  : <Text style={{ fontSize: 16, color: '#2D6AE3', fontWeight: '700' }}>✦</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: sub, marginBottom: 6 }}>Description</Text>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: bdr, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add task details..."
                  placeholderTextColor={sub}
                  multiline
                  style={{ flex: 1, fontSize: 14, color: txt, minHeight: 80, textAlignVertical: 'top', lineHeight: 20 }}
                />
                <TouchableOpacity
                  onPress={description.trim() ? refineDescription : generateDescription}
                  disabled={enhancingDesc || generatingDesc}
                  style={{ padding: 2, marginTop: 2 }}
                >
                  {(enhancingDesc || generatingDesc)
                    ? <ActivityIndicator size="small" color="#2D6AE3" />
                    : <Text style={{ fontSize: 16, color: '#2D6AE3', fontWeight: '700' }}>✦</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Meta card ── */}
          <View style={{ marginHorizontal: 18, marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: bdr, backgroundColor: card, overflow: 'hidden' }}>

            {/* Project */}
            <TouchableOpacity
              style={[s.metaRow, { borderBottomColor: bdr }]}
              onPress={() => setShowProjectSheet(true)}
              activeOpacity={0.7}
            >
              <Text style={[s.metaLabel, { color: sub }]}>Project</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {project && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B72EE' }} />}
                <Text style={[s.metaValue, { color: project ? txt : sub }]} numberOfLines={1}>
                  {project ? project.name : 'Select project'}
                </Text>
                <Text style={{ color: sub, fontSize: 16 }}>›</Text>
              </View>
            </TouchableOpacity>

            {/* Assignee */}
            <TouchableOpacity
              style={[s.metaRow, { borderBottomColor: bdr }]}
              onPress={() => { setAssignSearch(''); setShowAssignSheet(true); }}
              activeOpacity={0.7}
            >
              <Text style={[s.metaLabel, { color: sub }]}>Assignee</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {assignees.length > 0 ? (
                  <>
                    {assignees.slice(0, 2).map((u, i) => (
                      <View key={u.id} style={[s.miniAvatar, { backgroundColor: avatarColor(u.username), marginLeft: i > 0 ? -6 : 0 }]}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{userName(u)[0]?.toUpperCase()}</Text>
                      </View>
                    ))}
                    <Text style={[s.metaValue, { color: txt }]}>
                      {userName(assignees[0]).split(' ')[0]}{assignees.length > 1 ? ` +${assignees.length - 1}` : '.'}
                    </Text>
                  </>
                ) : (
                  <Text style={[s.metaValue, { color: sub }]}>Assign</Text>
                )}
                <Text style={{ color: sub, fontSize: 16 }}>›</Text>
              </View>
            </TouchableOpacity>

            {/* Start date */}
            <TouchableOpacity
              style={[s.metaRow, { borderBottomColor: bdr }]}
              onPress={() => setShowDateSheet('start')}
              activeOpacity={0.7}
            >
              <Text style={[s.metaLabel, { color: sub }]}>Start date</Text>
              <Text style={[s.metaValue, { color: txt }]}>{fmtDateLabel(startDate)}</Text>
            </TouchableOpacity>

            {/* Due date */}
            <TouchableOpacity
              style={[s.metaRow, { borderBottomColor: bdr }]}
              onPress={() => setShowDateSheet('end')}
              activeOpacity={0.7}
            >
              <Text style={[s.metaLabel, { color: sub }]}>Due date</Text>
              <Text style={[s.metaValue, { color: txt }]}>{fmtDateLabel(endDate)}</Text>
            </TouchableOpacity>

            {/* Duration */}
            <View style={[s.metaRow, { borderBottomColor: bdr }]}>
              <Text style={[s.metaLabel, { color: sub }]}>Duration</Text>
              <Text style={[s.metaValue, { color: calcDuration() ? txt : sub }]}>
                {calcDuration() || '—'}
              </Text>
            </View>

            {/* Priority */}
            <View style={[s.metaRow, { borderBottomWidth: 0 }]}>
              <Text style={[s.metaLabel, { color: sub }]}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRIORITIES.map(p => {
                  const active = p.key === priority;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => setPriority(p.key)}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                        borderWidth: active ? 1.5 : 0,
                        borderColor: active ? p.color : 'transparent',
                        backgroundColor: active ? p.color + '18' : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: active ? '700' : '400', color: active ? p.color : sub }}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── Links ── */}
          <View style={{ paddingHorizontal: 18, marginTop: 28 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Text style={{ fontSize: 16 }}>🔗</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: txt }}>Links</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: bdr, backgroundColor: '#FFFFFF', paddingHorizontal: 14, height: 46 }}>
              <TextInput
                value={linkInput}
                onChangeText={setLinkInput}
                placeholder="Paste URL here..."
                placeholderTextColor={sub}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  const l = linkInput.trim();
                  if (!l) return;
                  const url = l.startsWith('http') ? l : `https://${l}`;
                  setLinks(prev => [...prev, url]);
                  setLinkInput('');
                }}
                style={{ flex: 1, fontSize: 14, color: txt, height: 46 }}
              />
              <TouchableOpacity
                onPress={() => {
                  const l = linkInput.trim();
                  if (!l) return;
                  const url = l.startsWith('http') ? l : `https://${l}`;
                  setLinks(prev => [...prev, url]);
                  setLinkInput('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ color: txt, fontSize: 28, fontWeight: '300', lineHeight: 32 }}>+</Text>
              </TouchableOpacity>
            </View>
            {links.length > 0 && (
              <View style={{ marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: bdr, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
                {links.map((l, i) => (
                  <View
                    key={i}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < links.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: bdr }}
                  >
                    <Text style={{ fontSize: 13 }}>🔗</Text>
                    <Text style={{ flex: 1, fontSize: 13, color: '#3B72EE' }} numberOfLines={1}>{l}</Text>
                    <TouchableOpacity
                      onPress={() => setLinks(prev => prev.filter((_, idx) => idx !== i))}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={{ color: sub, fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Attachments ── */}
          <View style={{ paddingHorizontal: 18, marginTop: 28 }}>
            <Text style={[s.bigLabel, { color: txt, marginBottom: 12 }]}>Attachments</Text>
            <View style={{ borderRadius: 14, borderWidth: 1.5, borderColor: bdr, borderStyle: 'dashed', backgroundColor: card, paddingVertical: 28, alignItems: 'center', gap: 8 }}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={sub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M17 8l-5-5-5 5" stroke={sub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M12 3v12" stroke={sub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
              <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>Upload files</Text>
              <Text style={{ fontSize: 12, color: sub }}>PNG, PDF, DOCX up to 20MB</Text>
            </View>
          </View>
        </Animated.ScrollView>

        {/* ── Create Task button ── */}
        <View style={[s.bottomBar, { backgroundColor: bg, borderTopColor: bdr }]}>
          <TouchableOpacity
            style={[s.createBtn, { backgroundColor: saving ? '#9090B0' : '#3B72EE' }]}
            onPress={handleCreate}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.createBtnText}>Create Task</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Project sheet ── */}
      <Sheet visible={showProjectSheet} onClose={() => setShowProjectSheet(false)} title="Select project">
        <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
          {projects.map(p => {
            const active = project?.id === p.id;
            const col = avatarColor(p.name);
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => { setProject(p); setShowProjectSheet(false); }}
                style={[s.sheetRow, { backgroundColor: active ? '#3B72EE11' : 'transparent', borderBottomColor: bdr }]}
              >
                <View style={[s.sheetAvatar, { backgroundColor: col }]}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{p.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.sheetRowTitle, { color: active ? '#3B72EE' : txt }]}>{p.name}</Text>
                  {p.task_count != null && (
                    <Text style={{ fontSize: 12, color: sub }}>{p.task_count} tasks</Text>
                  )}
                </View>
                {active && <Text style={{ color: '#3B72EE', fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            );
          })}
          {projects.length === 0 && (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: sub, fontSize: 13 }}>No projects found</Text>
            </View>
          )}
        </ScrollView>
      </Sheet>

      {/* ── Assignee sheet ── */}
      <Sheet
        visible={showAssignSheet}
        onClose={() => setShowAssignSheet(false)}
        title={`Assign to${assignees.length > 0 ? ` (${assignees.length})` : ''}`}
        onDone={() => setShowAssignSheet(false)}
        doneLabel="+ Done"
      >
        {/* Selected chips */}
        {assignees.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingVertical: 8 }} contentContainerStyle={{ gap: 8 }}>
            {assignees.map(u => (
              <TouchableOpacity
                key={u.id}
                onPress={() => toggleAssignee(u)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3B72EE18', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}
              >
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: avatarColor(u.username), justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{userName(u)[0]?.toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#3B72EE', fontWeight: '600' }}>{userName(u).split(' ')[0]}</Text>
                <Text style={{ fontSize: 11, color: '#3B72EE' }}>✕</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TextInput
            value={assignSearch}
            onChangeText={setAssignSearch}
            placeholder="Search members..."
            placeholderTextColor={sub}
            style={[s.searchInput, { backgroundColor: inputBg, borderColor: bdr, color: txt }]}
          />
        </View>
        <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
          {filteredUsers.map(u => {
            const active = assignees.some(a => a.id === u.id);
            const col    = avatarColor(u.username);
            return (
              <TouchableOpacity
                key={u.id}
                onPress={() => toggleAssignee(u)}
                style={[s.sheetRow, { backgroundColor: active ? '#3B72EE11' : 'transparent', borderBottomColor: bdr }]}
              >
                <View style={[s.sheetAvatar, { backgroundColor: col }]}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{userName(u)[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.sheetRowTitle, { color: active ? '#3B72EE' : txt }]}>{userName(u)}</Text>
                  {u.role && <Text style={{ fontSize: 12, color: sub, textTransform: 'capitalize' }}>{u.role}</Text>}
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? '#3B72EE' : bdr, backgroundColor: active ? '#3B72EE' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                  {active && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          {filteredUsers.length === 0 && (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: sub, fontSize: 13 }}>No members found</Text>
            </View>
          )}
        </ScrollView>
      </Sheet>

      {/* ── Date picker ── */}
      {showDateSheet && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setShowDateSheet(null)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShowDateSheet(null)}
          >
            <Pressable style={{ backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', width: 300 }} onPress={() => {}}>
              <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0E1726', textAlign: 'center', marginBottom: 4 }}>
                  {showDateSheet === 'start' ? 'Start Date' : 'Due Date'}
                </Text>
              </View>
              <DateTimePicker
                value={showDateSheet === 'start' ? startDate : endDate}
                mode="date"
                display="spinner"
                textColor="#0E1726"
                minimumDate={showDateSheet === 'end' ? startDate : undefined}
                onChange={(event, selected) => {
                  if (event.type === 'set' && selected) {
                    if (showDateSheet === 'start') setStartDate(selected);
                    else setEndDate(selected);
                  }
                }}
                style={{ width: 300 }}
              />
              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E8E8EF' }}>
                <TouchableOpacity
                  onPress={() => setShowDateSheet(null)}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#E8E8EF' }}
                >
                  <Text style={{ fontSize: 15, color: '#888899', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDateSheet(null)}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 15, color: '#3B72EE', fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, minWidth: 60, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  bigLabel: { fontSize: 22, fontWeight: '700', marginBottom: 10 },
  titleInput: {
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, minHeight: 100, textAlignVertical: 'top', lineHeight: 22,
  },

  // Meta rows
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  metaLabel: { fontSize: 14, fontWeight: '500' },
  metaValue: { fontSize: 14, fontWeight: '600' },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },

  // Priority chips
  priorityChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },

  // AI buttons
  aiBtn: { width: 42, height: 46, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },

  // Time
  timeBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, height: 46 },

  // Bottom bar
  bottomBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth },
  cancelBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  createBtn: { flex: 1, height: 52, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Sheets
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sheetRowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },

  searchInput: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, height: 40, fontSize: 13 },

});
