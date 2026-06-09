import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, StatusBar, Animated, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { NotificationsContext } from '../context/NotificationsContext';
import { getUsers, getProjects, createTask } from '../services/ApiService';
import { invalidateTasksCache } from '../hooks/useTasksCache';

// ── Constants ───────────────────────────────────────────────────────────────
const PRIORITIES = [
  { key: 'low',      label: 'Low',      color: '#22A06B' },
  { key: 'medium',   label: 'Medium',   color: '#E5A60E' },
  { key: 'high',     label: 'High',     color: '#E5484D' },
  { key: 'critical', label: 'Critical', color: '#A4133C' },
];

const STATUSES = [
  { key: 'pending',     label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'backlog',     label: 'Backlog' },
  { key: 'review',      label: 'Review' },
];

// ── Format date as YYYY-MM-DD ─────────────────────────────────────────────────
const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const fmtDateLabel = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function CreateTaskScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
  const isDark = theme === 'Dark';

  // Theme
  const bgColor  = isDark ? '#0D0D14' : '#F5F5FA';
  const cardBg   = isDark ? '#1A1A28' : '#FFFFFF';
  const inputBg  = isDark ? '#252538' : '#F5F5F7';
  const bdr      = isDark ? '#303048' : '#E0E0EC';
  const txt      = isDark ? '#F0F0F8' : '#18182E';
  const sub      = isDark ? '#8080A0' : '#7070A0';
  const accent   = '#4ECDC4';

  // Form state
  const [heading,     setHeading]     = useState('');
  const [description, setDescription] = useState('');
  const [priority,    setPriority]    = useState('medium');
  const [status,      setStatus]      = useState('pending');
  const [endDate,     setEndDate]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d;
  });
  const [startDate,   setStartDate]   = useState(() => new Date());
  const [project,     setProject]     = useState(null);
  const [assignees,   setAssignees]   = useState([]);   // array of user objects

  // Data
  const [projects, setProjects] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [saving,   setSaving]   = useState(false);

  // Dropdown open state
  const [projectOpen, setProjectOpen] = useState(false);
  const [assignOpen,  setAssignOpen]  = useState(false);
  const [statusOpen,  setStatusOpen]  = useState(false);
  const [assignSearch, setAssignSearch] = useState('');

  // Date picker (simple +/- day stepper to avoid extra deps)
  const [dateExpanded, setDateExpanded] = useState(false);

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
    `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || u.email || 'User';

  const toggleAssignee = (u) => {
    setAssignees(prev =>
      prev.some(a => a.id === u.id)
        ? prev.filter(a => a.id !== u.id)
        : [...prev, u]
    );
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
    assignees.forEach(u => formData.append('assigned_to', String(u.id)));

    setSaving(true);
    try {
      await createTask(formData);
      invalidateTasksCache(); // force TasksScreen + Dashboard to refetch
      addNotification({
        type: 'task', icon: '📋',
        title: 'Task Created',
        body: `"${heading.trim()}" was created.`,
      });
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

  const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899'];
  const avatarColor = (str = '') => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bgColor }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: cardBg, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={[s.backText, { color: txt }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: txt }]}>New Task</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={saving}
          style={[s.saveBtn, { backgroundColor: saving ? '#9090B0' : '#1A1A2E' }]}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Create</Text>}
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: bdr }]}>
          <Text style={[s.label, { color: sub }]}>TASK TITLE *</Text>
          <TextInput
            value={heading}
            onChangeText={setHeading}
            placeholder="What needs to be done?"
            placeholderTextColor={sub}
            style={[s.input, { backgroundColor: inputBg, borderColor: bdr, color: txt }]}
          />
          <Text style={[s.label, { color: sub, marginTop: 4 }]}>DESCRIPTION</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add more detail..."
            placeholderTextColor={sub}
            multiline
            style={[s.textarea, { backgroundColor: inputBg, borderColor: bdr, color: txt }]}
          />
        </View>

        {/* Project */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: bdr }]}>
          <Text style={[s.label, { color: sub }]}>PROJECT *</Text>
          <TouchableOpacity
            style={[s.dropTrigger, { backgroundColor: inputBg, borderColor: projectOpen ? accent : bdr }]}
            onPress={() => { setProjectOpen(o => !o); setAssignOpen(false); setStatusOpen(false); }}
          >
            <Text style={[s.dropText, { color: project ? txt : sub }]} numberOfLines={1}>
              {project ? project.name : 'Select project'}
            </Text>
            <Text style={{ color: sub, fontSize: 11 }}>{projectOpen ? '▲' : '▾'}</Text>
          </TouchableOpacity>
          {projectOpen && (
            <View style={[s.dropList, { backgroundColor: cardBg, borderColor: accent }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {projects.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.dropItem, { borderBottomColor: bdr }]}
                    onPress={() => { setProject(p); setProjectOpen(false); }}
                  >
                    <Text style={[s.dropItemText, { color: project?.id === p.id ? accent : txt, fontWeight: project?.id === p.id ? '700' : '500' }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {project?.id === p.id && <Text style={{ color: accent }}>✓</Text>}
                  </TouchableOpacity>
                ))}
                {projects.length === 0 && <Text style={[s.empty, { color: sub }]}>No projects</Text>}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Assignees */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: bdr }]}>
          <Text style={[s.label, { color: sub }]}>ASSIGNEES</Text>
          <TouchableOpacity
            style={[s.dropTrigger, { backgroundColor: inputBg, borderColor: assignOpen ? accent : bdr }]}
            onPress={() => { setAssignOpen(o => !o); setProjectOpen(false); setStatusOpen(false); }}
          >
            <Text style={[s.dropText, { color: assignees.length ? txt : sub }]} numberOfLines={1}>
              {assignees.length ? `${assignees.length} selected` : 'Assign members'}
            </Text>
            <Text style={{ color: sub, fontSize: 11 }}>{assignOpen ? '▲' : '▾'}</Text>
          </TouchableOpacity>

          {/* Selected chips */}
          {assignees.length > 0 && (
            <View style={s.chipRow}>
              {assignees.map(u => (
                <View key={u.id} style={[s.chip, { backgroundColor: isDark ? '#252538' : '#EEF2FF' }]}>
                  <View style={[s.chipAvatar, { backgroundColor: avatarColor(u.username) }]}>
                    <Text style={s.chipAvatarText}>{userName(u)[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={[s.chipText, { color: txt }]}>{userName(u).split(' ')[0]}</Text>
                  <TouchableOpacity onPress={() => toggleAssignee(u)}>
                    <Text style={{ color: sub, fontSize: 14, marginLeft: 2 }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {assignOpen && (
            <View style={[s.dropList, { backgroundColor: cardBg, borderColor: accent }]}>
              <TextInput
                value={assignSearch}
                onChangeText={setAssignSearch}
                placeholder="Search members..."
                placeholderTextColor={sub}
                style={[s.searchInput, { backgroundColor: inputBg, borderColor: bdr, color: txt }]}
              />
              <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                {filteredUsers.map(u => {
                  const selected = assignees.some(a => a.id === u.id);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.dropItem, { borderBottomColor: bdr }]}
                      onPress={() => toggleAssignee(u)}
                    >
                      <View style={[s.chipAvatar, { backgroundColor: avatarColor(u.username), width: 28, height: 28, borderRadius: 14 }]}>
                        <Text style={[s.chipAvatarText, { fontSize: 11 }]}>{userName(u)[0]?.toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.dropItemText, { color: txt }]} numberOfLines={1}>{userName(u)}</Text>
                        {u.email ? <Text style={{ fontSize: 10, color: sub }}>{u.email}</Text> : null}
                      </View>
                      {selected && <Text style={{ color: accent, fontSize: 16 }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
                {filteredUsers.length === 0 && <Text style={[s.empty, { color: sub }]}>No members found</Text>}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Status + Due date row */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: bdr }]}>
          <Text style={[s.label, { color: sub }]}>STATUS</Text>
          <TouchableOpacity
            style={[s.dropTrigger, { backgroundColor: inputBg, borderColor: statusOpen ? accent : bdr }]}
            onPress={() => { setStatusOpen(o => !o); setProjectOpen(false); setAssignOpen(false); }}
          >
            <Text style={[s.dropText, { color: txt }]}>
              {STATUSES.find(st => st.key === status)?.label || 'Pending'}
            </Text>
            <Text style={{ color: sub, fontSize: 11 }}>{statusOpen ? '▲' : '▾'}</Text>
          </TouchableOpacity>
          {statusOpen && (
            <View style={[s.dropList, { backgroundColor: cardBg, borderColor: accent }]}>
              {STATUSES.map(st => (
                <TouchableOpacity
                  key={st.key}
                  style={[s.dropItem, { borderBottomColor: bdr }]}
                  onPress={() => { setStatus(st.key); setStatusOpen(false); }}
                >
                  <Text style={[s.dropItemText, { color: status === st.key ? accent : txt, fontWeight: status === st.key ? '700' : '500' }]}>
                    {st.label}
                  </Text>
                  {status === st.key && <Text style={{ color: accent }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Due date stepper */}
          <Text style={[s.label, { color: sub, marginTop: 14 }]}>START DATE</Text>
          <View style={s.dateRow}>
            <TouchableOpacity
              style={[s.dateStepBtn, { backgroundColor: inputBg, borderColor: bdr }]}
              onPress={() => setStartDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })}
            >
              <Text style={[s.dateStepText, { color: txt }]}>−</Text>
            </TouchableOpacity>
            <View style={[s.dateDisplay, { backgroundColor: inputBg, borderColor: bdr }]}>
              <Text style={[s.dateText, { color: txt }]}>{fmtDateLabel(startDate)}</Text>
            </View>
            <TouchableOpacity
              style={[s.dateStepBtn, { backgroundColor: inputBg, borderColor: bdr }]}
              onPress={() => setStartDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}
            >
              <Text style={[s.dateStepText, { color: txt }]}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.label, { color: sub, marginTop: 14 }]}>END DATE</Text>
          <View style={s.dateRow}>
            <TouchableOpacity
              style={[s.dateStepBtn, { backgroundColor: inputBg, borderColor: bdr }]}
              onPress={() => setEndDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n < new Date() ? d : n; })}
            >
              <Text style={[s.dateStepText, { color: txt }]}>−</Text>
            </TouchableOpacity>
            <View style={[s.dateDisplay, { backgroundColor: inputBg, borderColor: bdr }]}>
              <Text style={[s.dateText, { color: txt }]}>{fmtDateLabel(endDate)}</Text>
            </View>
            <TouchableOpacity
              style={[s.dateStepBtn, { backgroundColor: inputBg, borderColor: bdr }]}
              onPress={() => setEndDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}
            >
              <Text style={[s.dateStepText, { color: txt }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Priority */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: bdr }]}>
          <Text style={[s.label, { color: sub }]}>PRIORITY</Text>
          <View style={s.priorityRow}>
            {PRIORITIES.map(p => {
              const active = p.key === priority;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setPriority(p.key)}
                  style={[
                    s.priorityChip,
                    { backgroundColor: inputBg, borderColor: bdr },
                    active && { backgroundColor: p.color + '22', borderColor: p.color },
                  ]}
                >
                  <View style={[s.priorityDot, { backgroundColor: p.color }]} />
                  <Text style={[s.priorityLabel, { color: active ? p.color : sub, fontWeight: active ? '700' : '500' }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Create button */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.85}
          style={[s.createBtn, { backgroundColor: saving ? '#9090B0' : '#1A1A2E' }]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.createBtnText}>Create Task</Text>}
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backText: { fontSize: 32, fontWeight: '300', marginTop: -4 },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, minWidth: 72, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  scroll: { padding: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  input: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, height: 48, fontSize: 14, marginBottom: 14 },
  textarea: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },

  dropTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, height: 48 },
  dropText: { fontSize: 14, flex: 1 },
  dropList: { borderRadius: 10, borderWidth: 1.5, marginTop: 6, overflow: 'hidden' },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1 },
  dropItemText: { fontSize: 13, fontWeight: '500', flex: 1 },
  empty: { fontSize: 12, fontStyle: 'italic', padding: 12, textAlign: 'center' },
  searchInput: { margin: 8, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, height: 38, fontSize: 13 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 8 },
  chipAvatar: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  chipAvatarText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  chipText: { fontSize: 12, fontWeight: '600' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateStepBtn: { width: 48, height: 46, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  dateStepText: { fontSize: 22, fontWeight: '600' },
  dateDisplay: { flex: 1, height: 46, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  dateText: { fontSize: 14, fontWeight: '600' },

  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityLabel: { fontSize: 12 },

  createBtn: { height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 4, shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
