import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, ActivityIndicator, Alert, Animated, Platform, StatusBar, Dimensions, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAccessToken } from '../services/ApiService';

const BASE_URL = 'http://192.168.1.164:8000/api/v1';
const SCREEN_WIDTH = Dimensions.get('window').width;

const STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review' };
const STATUS_COLORS = { pending: '#888899', in_progress: '#4ECDC4', completed: '#4ADE80', backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA' };
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const PRIORITY_COLORS = { low: '#4ADE80', medium: '#FBBF24', high: '#F97316', urgent: '#EF4444' };

export default function TaskDetailModal({ visible, task, onClose, onUpdated }) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);

  // Task state (editable)
  const [status,      setStatus]      = useState('pending');
  const [priority,    setPriority]    = useState('medium');
  const [startDate,   setStartDate]   = useState(null); // Date or null
  const [endDate,     setEndDate]     = useState(null);
  const [description, setDescription] = useState('');

  // Dropdowns / pickers
  const [showStatusDropdown,  setShowStatusDropdown]   = useState(false);
  const [showPriorityDropdown,setShowPriorityDropdown] = useState(false);
  const [showStartPicker,     setShowStartPicker]      = useState(false);
  const [showEndPicker,       setShowEndPicker]        = useState(false);
  const [tempStartDate,       setTempStartDate]        = useState(new Date());
  const [tempEndDate,         setTempEndDate]          = useState(new Date());

  // Comments
  const [comments,    setComments]     = useState([]);
  const [newComment,  setNewComment]   = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Editing description?
  const [editingDesc, setEditingDesc] = useState(false);

  // Track if anything changed (for Save Changes button state)
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (visible && task) {
      // Initialize state from task
      setStatus(task.status || 'pending');
      setPriority(task.priority || 'medium');
      setStartDate(task.start_date ? new Date(task.start_date) : null);
      setEndDate(task.end_date ? new Date(task.end_date) : null);
      // Strip HTML tags from description
      const cleanDesc = (task.description || '').replace(/<[^>]*>/g, '').trim();
      setDescription(cleanDesc);
      setComments(Array.isArray(task.comments) ? task.comments : []);
      setDirty(false);
      setEditingDesc(false);
      setNewComment('');
      // Slide in
      Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, task?.id]);

  const handleClose = () => {
    if (dirty) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Discard and close?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: closeAnimated },
        ]
      );
      return;
    }
    closeAnimated();
  };

  const closeAnimated = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      onClose?.();
    });
  };

  const markDirty = () => setDirty(true);

  const saveChanges = async () => {
    if (!task?.id) return;
    setSaving(true);
    try {
      const token = await getAccessToken();
      const body = {
        status,
        priority,
        start_date: startDate ? startDate.toISOString().split('T')[0] : null,
        end_date:   endDate   ? endDate.toISOString().split('T')[0]   : null,
        description,
      };
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.message || 'Failed to save.');
      }
      const updated = await res.json();
      setDirty(false);
      setEditingDesc(false);
      onUpdated?.(updated);
      Alert.alert('Saved', 'Task updated successfully.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !task?.id) return;
    setPostingComment(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/comments/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newComment.trim() }),
      });
      if (!res.ok) {
        // Backend comment endpoint might not exist — add locally as fallback
        setComments(prev => [...prev, {
          id: `local_${Date.now()}`,
          text: newComment.trim(),
          created_at: new Date().toISOString(),
          user: { username: 'you', full_name: 'You' },
          _local: true,
        }]);
      } else {
        const saved = await res.json();
        setComments(prev => [...prev, saved]);
      }
      setNewComment('');
    } catch (e) {
      // Fallback: add locally
      setComments(prev => [...prev, {
        id: `local_${Date.now()}`,
        text: newComment.trim(),
        created_at: new Date().toISOString(),
        user: { username: 'you', full_name: 'You' },
        _local: true,
      }]);
      setNewComment('');
    } finally {
      setPostingComment(false);
    }
  };

  if (!visible || !task) return null;

  const assignees = Array.isArray(task.assigned_to_user_details)
    ? task.assigned_to_user_details
    : [];
  const createdBy = task.assigned_by_user_details || task.created_by || null;

  const statusColor   = STATUS_COLORS[status]     || '#888';
  const priorityColor = PRIORITY_COLORS[priority] || '#888';

  const fmt = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View
        style={[
          s.screen,
          {
            transform: [{
              translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [SCREEN_WIDTH, 0],
              }),
            }],
          },
        ]}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={s.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle} numberOfLines={1}>{task.heading || 'Task'}</Text>
              {task.project_details?.name && (
                <Text style={s.headerProject}>📁 {task.project_details.name}</Text>
              )}
            </View>
            {dirty && (
              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveChanges}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>

            {/* Status + Priority row */}
            <View style={s.chipRow}>
              <TouchableOpacity
                style={[s.chip, { backgroundColor: statusColor + '20' }]}
                onPress={() => { setShowStatusDropdown(v => !v); setShowPriorityDropdown(false); }}
                activeOpacity={0.7}
              >
                <View style={[s.chipDot, { backgroundColor: statusColor }]} />
                <Text style={[s.chipText, { color: statusColor }]}>
                  {STATUS_LABELS[status] || status}
                </Text>
                <Text style={[s.chipArrow, { color: statusColor }]}>▾</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.chip, { backgroundColor: priorityColor + '20' }]}
                onPress={() => { setShowPriorityDropdown(v => !v); setShowStatusDropdown(false); }}
                activeOpacity={0.7}
              >
                <View style={[s.chipDot, { backgroundColor: priorityColor }]} />
                <Text style={[s.chipText, { color: priorityColor }]}>
                  {PRIORITY_LABELS[priority] || priority}
                </Text>
                <Text style={[s.chipArrow, { color: priorityColor }]}>▾</Text>
              </TouchableOpacity>
            </View>

            {/* Status dropdown */}
            {showStatusDropdown && (
              <View style={s.dropdown}>
                {Object.keys(STATUS_LABELS).map(k => (
                  <TouchableOpacity
                    key={k}
                    style={[s.dropdownItem, status === k && s.dropdownItemActive]}
                    onPress={() => { setStatus(k); markDirty(); setShowStatusDropdown(false); }}
                  >
                    <View style={[s.chipDot, { backgroundColor: STATUS_COLORS[k] }]} />
                    <Text style={s.dropdownText}>{STATUS_LABELS[k]}</Text>
                    {status === k && <Text style={s.dropdownCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Priority dropdown */}
            {showPriorityDropdown && (
              <View style={s.dropdown}>
                {Object.keys(PRIORITY_LABELS).map(k => (
                  <TouchableOpacity
                    key={k}
                    style={[s.dropdownItem, priority === k && s.dropdownItemActive]}
                    onPress={() => { setPriority(k); markDirty(); setShowPriorityDropdown(false); }}
                  >
                    <View style={[s.chipDot, { backgroundColor: PRIORITY_COLORS[k] }]} />
                    <Text style={s.dropdownText}>{PRIORITY_LABELS[k]}</Text>
                    {priority === k && <Text style={s.dropdownCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Dates section */}
            <Text style={s.sectionLabel}>📅 Dates</Text>
            <View style={s.dateRow}>
              <TouchableOpacity
                style={s.dateBox}
                onPress={() => { setTempStartDate(startDate || new Date()); setShowStartPicker(true); }}
                activeOpacity={0.7}
              >
                <Text style={s.dateLabel}>START</Text>
                <Text style={s.dateValue}>{fmt(startDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.dateBox}
                onPress={() => { setTempEndDate(endDate || new Date()); setShowEndPicker(true); }}
                activeOpacity={0.7}
              >
                <Text style={s.dateLabel}>DUE</Text>
                <Text style={s.dateValue}>{fmt(endDate)}</Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <View style={s.pickerCard}>
                <DateTimePicker
                  value={tempStartDate}
                  mode="date"
                  display="inline"
                  onChange={(_, d) => { if (d) setTempStartDate(d); }}
                  style={{ width: '100%' }}
                />
                <View style={s.pickerActions}>
                  <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                    <Text style={s.pickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setStartDate(null); markDirty(); setShowStartPicker(false); }}>
                    <Text style={[s.pickerCancel, { color: '#EF4444' }]}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.pickerDoneBtn}
                    onPress={() => { setStartDate(tempStartDate); markDirty(); setShowStartPicker(false); }}
                  >
                    <Text style={s.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showEndPicker && (
              <View style={s.pickerCard}>
                <DateTimePicker
                  value={tempEndDate}
                  mode="date"
                  display="inline"
                  onChange={(_, d) => { if (d) setTempEndDate(d); }}
                  style={{ width: '100%' }}
                />
                <View style={s.pickerActions}>
                  <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                    <Text style={s.pickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEndDate(null); markDirty(); setShowEndPicker(false); }}>
                    <Text style={[s.pickerCancel, { color: '#EF4444' }]}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.pickerDoneBtn}
                    onPress={() => { setEndDate(tempEndDate); markDirty(); setShowEndPicker(false); }}
                  >
                    <Text style={s.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Description */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>📝 Description</Text>
              <TouchableOpacity onPress={() => setEditingDesc(v => !v)}>
                <Text style={s.editLink}>{editingDesc ? 'Done' : '✏️ Edit'}</Text>
              </TouchableOpacity>
            </View>
            {editingDesc ? (
              <TextInput
                style={s.descInput}
                value={description}
                onChangeText={(t) => { setDescription(t); markDirty(); }}
                multiline
                textAlignVertical="top"
                placeholder="Add description..."
                placeholderTextColor="#AAAABC"
              />
            ) : (
              <Text style={s.descText}>
                {description || <Text style={{ color: '#AAAABC', fontStyle: 'italic' }}>No description</Text>}
              </Text>
            )}

            {/* Assignees */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>👥 Assignees</Text>
              {createdBy && (
                <Text style={s.createdByText}>
                  Created by {createdBy.first_name || createdBy.username || createdBy.full_name || 'Unknown'}
                </Text>
              )}
            </View>
            {assignees.length > 0 ? (
              assignees.map((u, i) => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.full_name || u.username || 'User';
                const initial = (name || 'U').charAt(0).toUpperCase();
                return (
                  <View key={u.id || i} style={s.memberRow}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>{name}</Text>
                      {!!u.role && <Text style={s.memberRole}>{u.role}</Text>}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={s.emptyText}>No assignees</Text>
            )}

            {/* Links */}
            {Array.isArray(task.links) && task.links.length > 0 && (
              <>
                <Text style={s.sectionLabel}>🔗 Links</Text>
                {task.links.map((l, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.linkRow}
                    onPress={() => Linking.openURL(typeof l === 'string' ? l : l.url).catch(() => {})}
                  >
                    <Text style={s.linkText} numberOfLines={1}>{typeof l === 'string' ? l : l.url}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Attachments */}
            {Array.isArray(task.attachments) && task.attachments.length > 0 && (
              <>
                <Text style={s.sectionLabel}>📎 Attachments ({task.attachments.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {task.attachments.map((att, i) => {
                    const isImage = (att.file_name || '').match(/\.(jpg|jpeg|png|gif|webp)$/i);
                    return (
                      <TouchableOpacity
                        key={att.id || i}
                        style={s.attachThumb}
                        onPress={() => att.file_url && Linking.openURL(att.file_url).catch(() => {})}
                      >
                        {isImage ? (
                          <Image source={{ uri: att.file_url }} style={s.attachImg} />
                        ) : (
                          <View style={[s.attachImg, s.attachIcon]}>
                            <Text style={{ fontSize: 22 }}>📄</Text>
                          </View>
                        )}
                        <Text style={s.attachName} numberOfLines={1}>{att.file_name || `File ${i + 1}`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Discussion / Comments */}
            <Text style={s.sectionLabel}>💬 Discussion ({comments.length})</Text>
            {comments.length === 0 ? (
              <Text style={s.emptyText}>No comments yet</Text>
            ) : (
              comments.map((c, i) => {
                const u = c.user || c.created_by || {};
                const name = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'User';
                const initial = (name || 'U').charAt(0).toUpperCase();
                const when = c.created_at ? new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <View key={c.id || i} style={s.commentRow}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.commentAuthor}>{name}</Text>
                        <Text style={s.commentTime}>{when}</Text>
                        {c._local && <Text style={s.localTag}>(unsent)</Text>}
                      </View>
                      <Text style={s.commentText}>{c.text || c.body || ''}</Text>
                    </View>
                  </View>
                );
              })
            )}

            {/* Add comment */}
            <View style={s.commentInputRow}>
              <TextInput
                style={s.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#AAAABC"
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity
                style={[s.commentSendBtn, (!newComment.trim() || postingComment) && { opacity: 0.4 }]}
                onPress={postComment}
                disabled={!newComment.trim() || postingComment}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.commentSendText}>➤</Text>
                )}
              </TouchableOpacity>
            </View>

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F5F5F7',
    paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24),
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#EBEBF0',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 32, fontWeight: '300', marginTop: -3, color: '#1A1A2E' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  headerProject: { fontSize: 11, color: '#888899', fontWeight: '500', marginTop: 2 },
  saveBtn: {
    backgroundColor: '#1A1A2E', borderRadius: 8,
    paddingHorizontal: 14, height: 36,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 36, borderRadius: 10,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { flex: 1, fontSize: 13, fontWeight: '700' },
  chipArrow: { fontSize: 10, fontWeight: '700' },

  dropdown: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#EBEBF0',
    paddingVertical: 4, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  dropdownItemActive: { backgroundColor: 'rgba(78,205,196,0.06)' },
  dropdownText: { flex: 1, fontSize: 13, color: '#1A1A2E', fontWeight: '500' },
  dropdownCheck: { fontSize: 14, color: '#4ECDC4', fontWeight: '700' },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginTop: 12, marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, marginBottom: 8,
  },
  editLink: { fontSize: 12, color: '#4ECDC4', fontWeight: '700' },
  createdByText: { fontSize: 11, color: '#888899', fontStyle: 'italic' },

  dateRow: { flexDirection: 'row', gap: 10 },
  dateBox: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    padding: 12,
  },
  dateLabel: { fontSize: 10, color: '#888899', fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  dateValue: { fontSize: 13, color: '#1A1A2E', fontWeight: '600' },

  pickerCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#EBEBF0',
    marginTop: 8, marginBottom: 14,
    overflow: 'hidden',
  },
  pickerActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#EBEBF0',
  },
  pickerCancel: { fontSize: 14, color: '#888899', fontWeight: '500' },
  pickerDoneBtn: {
    backgroundColor: '#1A1A2E', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8,
  },
  pickerDoneText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  descText: {
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    padding: 12,
    fontSize: 13, color: '#5C5C6E', lineHeight: 19,
    minHeight: 60,
  },
  descInput: {
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1.5, borderColor: '#4ECDC4',
    padding: 12,
    fontSize: 13, color: '#1A1A2E',
    minHeight: 90, maxHeight: 220,
  },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    padding: 10, marginBottom: 6,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#7C3AED', fontSize: 13, fontWeight: '700' },
  memberName: { fontSize: 13, color: '#1A1A2E', fontWeight: '600' },
  memberRole: { fontSize: 11, color: '#888899', marginTop: 1, textTransform: 'capitalize' },

  linkRow: {
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    padding: 12, marginBottom: 6,
  },
  linkText: { fontSize: 13, color: '#3B82F6', fontWeight: '500' },

  attachThumb: { width: 100, marginRight: 8, alignItems: 'center' },
  attachImg: { width: 100, height: 80, borderRadius: 10, backgroundColor: '#F5F5F7' },
  attachIcon: {
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EBEBF0',
  },
  attachName: { fontSize: 10, color: '#5C5C6E', marginTop: 4, textAlign: 'center' },

  emptyText: { fontSize: 12, color: '#AAAABC', fontStyle: 'italic', paddingVertical: 8 },

  commentRow: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    padding: 10, marginBottom: 6,
    alignItems: 'flex-start',
  },
  commentAuthor: { fontSize: 12, color: '#1A1A2E', fontWeight: '700' },
  commentTime: { fontSize: 10, color: '#AAAABC' },
  commentText: { fontSize: 13, color: '#5C5C6E', marginTop: 3, lineHeight: 18 },
  localTag: { fontSize: 10, color: '#F97316', fontStyle: 'italic' },

  commentInputRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-end',
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    padding: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 13, color: '#1A1A2E',
    minHeight: 36, maxHeight: 100,
    paddingHorizontal: 6, paddingVertical: 8,
  },
  commentSendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center',
  },
  commentSendText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
