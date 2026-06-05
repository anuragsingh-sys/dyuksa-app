import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, Alert, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import { BASE_URL } from '../config';

// ── Token colours ─────────────────────────────────────────────────────────────
const T = {
  brand: '#2D6AE3', brandSoft: '#EAF1FE',
  ink: '#0E1726', ink2: '#3B4658', ink3: '#6B7588', ink4: '#9AA3B2',
  hairline: '#E6E9EF', hairlineSoft: '#F0F2F6',
  surface: '#FFFFFF', surfaceAlt: '#F7F8FB', surfaceCool: '#F2F4F8',
  cBlue: '#2D6AE3', cGreen: '#22A06B', cYellow: '#E5A60E',
  cPurple: '#7A5AF8', cRed: '#E5484D',
  r: 10, rMd: 14,
};

const STATUS_COLORS = {
  pending: '#F59E0B', in_progress: '#3B82F6', completed: '#22C55E',
  backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA',
};
const STATUS_BG = {
  pending: '#FEF3C7', in_progress: '#EFF6FF', completed: '#F0FDF4',
  backlog: '#FDF2F8', deployed: '#EFF6FF', deferred: '#FFFBEB', review: '#F5F3FF',
};
const STATUS_LABELS = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed',
  backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review',
};
const PRIORITY_COLORS = { low: '#22C55E', medium: '#F59E0B', high: '#F97316', urgent: '#EF4444' };

// ── Auth headers ──────────────────────────────────────────────────────────────
const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return fmtDate(iso);
  } catch { return ''; }
};

const getInitial = (name = '') => name.trim().charAt(0).toUpperCase() || '?';

// ── Mini components ───────────────────────────────────────────────────────────
function Card({ children, style, padding = 16 }) {
  return (
    <View style={[{ backgroundColor: T.surface, borderRadius: T.rMd, borderWidth: 1, borderColor: T.hairline, padding }, style]}>
      {children}
    </View>
  );
}

function MetaRow({ label, children, isLast }) {
  return (
    <View style={[s.metaRow, !isLast && { borderBottomWidth: 1, borderBottomColor: T.hairline }]}>
      <Text style={s.metaLabel}>{label}</Text>
      <View style={s.metaRight}>{children}</View>
    </View>
  );
}

function SectionHeader({ children, right }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderText}>{children}</Text>
      {right}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TaskDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const { user }   = useContext(AuthContext);

  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : T.surfaceAlt;
  const card = isDark ? '#1A1A20' : T.surface;
  const txt  = isDark ? '#FFFFFF' : T.ink;
  const sub  = isDark ? '#9898A6' : T.ink3;
  const bdr  = isDark ? '#252530' : T.hairline;

  // Task can be passed directly or fetched by ID
  const taskId = route?.params?.taskId || route?.params?.id;
  const passedTask = route?.params?.task;

  const [task,         setTask]         = useState(passedTask || null);
  const [loading,      setLoading]      = useState(!passedTask);
  const [comment,      setComment]      = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [comments,     setComments]     = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // ── Fetch task ──────────────────────────────────────────────────────────────
  const fetchTask = useCallback(async () => {
    if (!taskId) { setLoading(false); return; }
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${taskId}/`, { headers });
      if (res.ok) setTask(await res.json());
    } catch (e) { console.warn('fetchTask:', e.message); }
    finally { setLoading(false); }
  }, [taskId]);

  // ── Fetch comments ──────────────────────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    if (!taskId) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${taskId}/comments/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : (data.results || []));
      }
    } catch { /* comments are optional */ }
  }, [taskId]);

  useEffect(() => {
    if (!passedTask) fetchTask();
    fetchComments();
  }, [taskId]);

  // ── Update status ───────────────────────────────────────────────────────────
  const updateStatus = async (newStatus) => {
    if (!task?.id) return;
    setShowStatusPicker(false);
    const prev = task.status;
    setTask(t => ({ ...t, status: newStatus }));
    setUpdatingStatus(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTask(t => ({ ...t, status: prev }));
        Alert.alert('Error', 'Could not update status.');
      }
    } catch {
      setTask(t => ({ ...t, status: prev }));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Send comment ────────────────────────────────────────────────────────────
  const sendComment = async () => {
    if (!comment.trim() || !task?.id) return;
    setSendingComment(true);
    const text = comment.trim();
    setComment('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/comments/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [...prev, data]);
      } else {
        // Optimistic fallback — show locally even if API not available
        setComments(prev => [...prev, {
          id: Date.now(),
          content: text,
          created_at: new Date().toISOString(),
          user: { first_name: user?.first_name || 'Me', username: user?.username },
        }]);
      }
    } catch {
      setComments(prev => [...prev, {
        id: Date.now(),
        content: text,
        created_at: new Date().toISOString(),
        user: { first_name: user?.first_name || 'Me', username: user?.username },
      }]);
    } finally {
      setSendingComment(false);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg }}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg }}>
        <Text style={{ color: sub, fontSize: 16 }}>Task not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: T.brand, fontWeight: '600' }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[task.status] || '#888';
  const statusBg    = STATUS_BG[task.status]    || '#F5F5F7';
  const statusLabel = STATUS_LABELS[task.status] || task.status || 'Unknown';
  const priorityKey = (task.priority || 'medium').toLowerCase();
  const priorityColor = PRIORITY_COLORS[priorityKey] || '#888';
  const isDone = (task.status || '').toLowerCase() === 'completed';

  const assignees = Array.isArray(task.assigned_to_user_details) ? task.assigned_to_user_details : [];
  const projectName = task.project_details?.name || `Project ${task.project}` || '—';
  const creatorName = (() => {
    const c = task.assigned_by_user_details || task.created_by;
    if (!c) return null;
    return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name || c.username || null;
  })();

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Nav bar ── */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ color: T.brand, fontSize: 26, fontWeight: '300', marginTop: -3 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: txt }]} numberOfLines={1}>{projectName}</Text>
        <TouchableOpacity style={s.moreBtn} onPress={() => Alert.alert('Options', '', [
          { text: 'Cancel', style: 'cancel' },
        ])}>
          <Text style={{ color: txt, fontSize: 20 }}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Title block (dev_1 style) ── */}
        <View style={s.titleBlock}>
          <View style={[s.titleCheckbox, isDone && { backgroundColor: T.cGreen, borderColor: T.cGreen }]}>
            {isDone && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
          </View>
          <Text style={[s.titleText, { color: txt }, isDone && { textDecorationLine: 'line-through', opacity: 0.55 }]}>
            {task.heading || task.title || 'Untitled'}
          </Text>
        </View>

        {/* ── Meta grid (dev_1 style) ── */}
        <Card style={{ marginTop: 16, padding: 0 }}>
          {/* Status — tappable */}
          <MetaRow label="Status">
            <TouchableOpacity
              style={[s.statusPill, { backgroundColor: statusBg }]}
              onPress={() => setShowStatusPicker(v => !v)}
              activeOpacity={0.7}
              disabled={updatingStatus}
            >
              {updatingStatus
                ? <ActivityIndicator size="small" color={statusColor} />
                : <>
                    <Text style={[s.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                    <Text style={[{ color: statusColor, fontSize: 10 }]}>▾</Text>
                  </>
              }
            </TouchableOpacity>
          </MetaRow>

          {/* Status picker dropdown */}
          {showStatusPicker && (
            <View style={[s.statusDropdown, { backgroundColor: card, borderColor: bdr }]}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.statusDropdownItem, { borderBottomColor: bdr }, task.status === key && { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                  onPress={() => updateStatus(key)}
                >
                  <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[key] }]} />
                  <Text style={[s.statusDropdownText, { color: task.status === key ? STATUS_COLORS[key] : txt }]}>{label}</Text>
                  {task.status === key && <Text style={{ color: STATUS_COLORS[key], fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Priority */}
          <MetaRow label="Priority">
            <View style={s.metaValueRow}>
              <View style={[s.priorityDot, { backgroundColor: priorityColor }]} />
              <Text style={[s.metaValueText, { color: txt }]}>
                {priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1)}
              </Text>
            </View>
          </MetaRow>

          {/* Due date */}
          <MetaRow label="Due Date">
            <Text style={[s.metaValueText, { color: txt }]}>
              {fmtDate(task.end_date || task.due_date)}
            </Text>
          </MetaRow>

          {/* Start date */}
          {task.start_date && (
            <MetaRow label="Start Date">
              <Text style={[s.metaValueText, { color: txt }]}>{fmtDate(task.start_date)}</Text>
            </MetaRow>
          )}

          {/* Project */}
          <MetaRow label="Project">
            <View style={[s.projectChip, { backgroundColor: isDark ? '#252530' : T.surfaceCool }]}>
              <Text style={[s.projectChipText, { color: txt }]}>{projectName}</Text>
            </View>
          </MetaRow>

          {/* Assignees */}
          <MetaRow label="Assignees" isLast>
            {assignees.length === 0 ? (
              <Text style={[s.metaValueText, { color: sub }]}>Unassigned</Text>
            ) : (
              <View style={s.assigneeRow}>
                {assignees.slice(0, 4).map((u, i) => {
                  const name = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || '?';
                  return (
                    <View key={u.id || i} style={[s.assigneeAvatar, { marginLeft: i === 0 ? 0 : -8, borderColor: card }]}>
                      <Text style={s.assigneeInitial}>{getInitial(name)}</Text>
                    </View>
                  );
                })}
                {assignees.length > 4 && (
                  <View style={[s.assigneeAvatar, { marginLeft: -8, borderColor: card, backgroundColor: isDark ? '#252530' : '#F0F0F5' }]}>
                    <Text style={[s.assigneeInitial, { color: sub }]}>+{assignees.length - 4}</Text>
                  </View>
                )}
              </View>
            )}
          </MetaRow>
        </Card>

        {/* ── Description ── */}
        {(task.description || task.desc) ? (
          <View style={{ marginTop: 22 }}>
            <SectionHeader>Description</SectionHeader>
            <Card style={{ marginTop: 8 }}>
              <Text style={[s.descText, { color: isDark ? '#CCCCDD' : T.ink2 }]}>
                {task.description || task.desc}
              </Text>
            </Card>
          </View>
        ) : null}

        {/* ── Links ── */}
        {task.uploaded_links ? (
          <View style={{ marginTop: 22 }}>
            <SectionHeader>Links</SectionHeader>
            <Card style={{ marginTop: 8 }}>
              <Text style={[s.descText, { color: T.brand }]}>{task.uploaded_links}</Text>
            </Card>
          </View>
        ) : null}

        {/* ── Creator info ── */}
        {creatorName && (
          <View style={{ marginTop: 22 }}>
            <SectionHeader>Created by</SectionHeader>
            <Card style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[s.assigneeAvatar, { marginLeft: 0, borderColor: card }]}>
                <Text style={s.assigneeInitial}>{getInitial(creatorName)}</Text>
              </View>
              <View>
                <Text style={[{ fontSize: 14, fontWeight: '600', color: txt }]}>{creatorName}</Text>
                {task.created_at && (
                  <Text style={[{ fontSize: 12, color: sub, marginTop: 2 }]}>{fmtDate(task.created_at)}</Text>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* ── Activity / Comments ── */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader right={
            comments.length > 0
              ? <Text style={{ fontSize: 12, color: sub }}>{comments.length} comment{comments.length !== 1 ? 's' : ''}</Text>
              : null
          }>Activity</SectionHeader>
          <View style={{ gap: 12, marginTop: 8 }}>
            {comments.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, opacity: 0.4 }}>
                <Text style={{ fontSize: 28 }}>💬</Text>
                <Text style={[{ fontSize: 13, color: sub, marginTop: 8 }]}>No comments yet</Text>
              </View>
            ) : comments.map((c, i) => {
              const commenter = c.user || {};
              const commenterName = commenter.full_name ||
                `${commenter.first_name || ''} ${commenter.last_name || ''}`.trim() ||
                commenter.username || 'User';
              return (
                <View key={c.id || i} style={s.commentRow}>
                  <View style={s.commentAvatar}>
                    <Text style={s.commentAvatarText}>{getInitial(commenterName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.commentHeaderRow}>
                      <Text style={[s.commentName, { color: txt }]}>{commenterName}</Text>
                      <Text style={[s.commentTime, { color: sub }]}>{fmtRelative(c.created_at)}</Text>
                    </View>
                    <View style={[s.commentBubble, { backgroundColor: isDark ? '#252530' : T.surfaceAlt }]}>
                      <Text style={[s.commentText, { color: isDark ? '#CCCCDD' : T.ink2 }]}>
                        {c.content || c.text || ''}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom composer (dev_1 style) ── */}
      <View style={[s.composer, { backgroundColor: card, borderTopColor: bdr, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[s.composerInputWrap, { backgroundColor: isDark ? '#252530' : T.surfaceAlt, borderColor: bdr }]}>
          <TextInput
            style={[s.composerInput, { color: txt }]}
            placeholder="Add a comment…"
            placeholderTextColor={sub}
            value={comment}
            onChangeText={setComment}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={sendComment}
          />
        </View>
        <TouchableOpacity
          style={[s.composerSend, { backgroundColor: comment.trim() ? T.brand : (isDark ? '#252530' : '#E5E7EB') }]}
          onPress={sendComment}
          disabled={!comment.trim() || sendingComment}
          activeOpacity={0.75}
        >
          {sendingComment
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ color: comment.trim() ? '#fff' : sub, fontSize: 16 }}>›</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Navbar
  navbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, gap: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  moreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Title block
  titleBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCheckbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: T.hairline, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  titleText: { flex: 1, fontSize: 21, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3 },

  // Meta grid
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, minHeight: 50 },
  metaLabel: { fontSize: 13, fontWeight: '500', color: T.ink3, flex: 1 },
  metaRight: { flexShrink: 1, alignItems: 'flex-end' },
  metaValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaValueText: { fontSize: 13, fontWeight: '600' },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },

  // Status pill
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  // Status dropdown
  statusDropdown: { marginHorizontal: 14, marginBottom: 8, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  statusDropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDropdownText: { flex: 1, fontSize: 13, fontWeight: '500' },

  // Project chip
  projectChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  projectChipText: { fontSize: 12, fontWeight: '600' },

  // Assignees
  assigneeRow: { flexDirection: 'row', alignItems: 'center' },
  assigneeAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E9D5FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  assigneeInitial: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', color: T.ink3, letterSpacing: 0.3, textTransform: 'uppercase' },

  // Description
  descText: { fontSize: 14, lineHeight: 22, letterSpacing: -0.05 },

  // Comments
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E9D5FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentName: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 11 },
  commentBubble: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  commentText: { fontSize: 13, lineHeight: 19 },

  // Bottom composer
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1 },
  composerInputWrap: { flex: 1, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 14 },
  composerInput: { fontSize: 14 },
  composerSend: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
