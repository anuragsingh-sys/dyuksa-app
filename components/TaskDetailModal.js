import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, ActivityIndicator, Alert, Animated, Platform, StatusBar, Dimensions, Image, Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAccessToken, getUsers } from '../services/ApiService';

// Optional dependency: file upload via DocumentPicker. Loaded lazily so that
// if `expo-document-picker` isn't installed, the rest of the modal still runs.
let DocumentPicker = null;
try { DocumentPicker = require('expo-document-picker'); } catch {}

const BASE_URL = 'http://192.168.1.188:8000/api/v1';
const SCREEN_WIDTH = Dimensions.get('window').width;

const STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review' };
const STATUS_COLORS = { pending: '#888899', in_progress: '#4ECDC4', completed: '#4ADE80', backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA' };
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const PRIORITY_COLORS = { low: '#4ADE80', medium: '#FBBF24', high: '#F97316', urgent: '#EF4444' };

export default function TaskDetailModal({ visible, task, onClose, onUpdated }) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
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

  // ── Assignees (editable) ──
  const [assignedIds, setAssignedIds]         = useState([]);  // number[]
  const [assignedDetails, setAssignedDetails] = useState([]);  // cached user objects for rendering
  const [allUsers, setAllUsers]               = useState([]);  // for picker
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  // ── Links (editable via POST /tasksite/:id/links/) ──
  const [links, setLinks]             = useState([]);           // [{id, url}]
  const [newLinkUrl, setNewLinkUrl]   = useState('');
  const [addingLink, setAddingLink]   = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState(null);

  // ── Attachments (editable via PATCH /tasksite/:id/ with multipart `uploaded_files`) ──
  const [attachments, setAttachments] = useState([]);           // [{id, file_name, file_url, uploaded_at}]
  const [uploading, setUploading]     = useState(false);

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
      // Assignees + links + attachments
      const ids = Array.isArray(task.assigned_to) ? task.assigned_to : [];
      const details = Array.isArray(task.assigned_to_user_details) ? task.assigned_to_user_details : [];
      setAssignedIds(ids);
      setAssignedDetails(details);
      setLinks(Array.isArray(task.links) ? task.links : []);
      setAttachments(Array.isArray(task.attachments) ? task.attachments : []);
      setNewLinkUrl('');
      setAssigneeSearch('');
      setShowAssigneePicker(false);

      setDirty(false);
      setEditingDesc(false);
      setNewComment('');
      // Slide in
      Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, task?.id]);

  // Fetch all users once when modal first opens, for assignee picker
  useEffect(() => {
    if (!visible) return;
    if (allUsers.length > 0) return;
    getUsers().then(u => setAllUsers(Array.isArray(u) ? u : [])).catch(() => setAllUsers([]));
  }, [visible]);

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
        start_date:  startDate ? startDate.toISOString().split('T')[0] : null,
        end_date:    endDate   ? endDate.toISOString().split('T')[0]   : null,
        description,
        assigned_to: assignedIds,
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
      // Sync assignee details from the server response if provided
      if (Array.isArray(updated.assigned_to_user_details)) {
        setAssignedDetails(updated.assigned_to_user_details);
      }
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

  // ── Assignee helpers ──
  const toggleAssignee = (u) => {
    setAssignedIds(prev => {
      const has = prev.includes(u.id);
      const next = has ? prev.filter(x => x !== u.id) : [...prev, u.id];
      return next;
    });
    setAssignedDetails(prev => {
      const has = prev.some(x => x.id === u.id);
      return has ? prev.filter(x => x.id !== u.id) : [...prev, u];
    });
    markDirty();
  };

  // ── Links: POST / DELETE ──
  const addLink = async () => {
    const url = newLinkUrl.trim();
    if (!url || !task?.id) return;
    // Basic URL validation
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert('Invalid URL', 'Link must start with http:// or https://');
      return;
    }
    setAddingLink(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/links/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || `Error ${res.status}`);
      // Append the new link (use server response if present, else build locally)
      const newLink = data.id ? data : { id: Date.now(), url };
      setLinks(prev => [...prev, newLink]);
      setNewLinkUrl('');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not add link.');
    } finally {
      setAddingLink(false);
    }
  };

  const deleteLink = async (linkId) => {
    if (!task?.id || linkId == null) return;
    setDeletingLinkId(linkId);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/links/${linkId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.message || `Error ${res.status}`);
      }
      setLinks(prev => prev.filter(l => String(l.id) !== String(linkId)));
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not delete link.');
    } finally {
      setDeletingLinkId(null);
    }
  };

  // ── Attachments: POST file (multipart/form-data) ──
  // ── Attachments (editable via PATCH /tasksite/:id/ with multipart `uploaded_files`) ──
  // Matches the web contract: the task endpoint itself accepts multipart PATCH
  // with field name `uploaded_files`. Response is the full updated task object
  // including the refreshed `attachments` array.
  const uploadAttachment = async () => {
    if (!task?.id) return;
    if (!DocumentPicker) {
      Alert.alert(
        'Not available',
        'File upload requires expo-document-picker. Run:\n  npx expo install expo-document-picker',
      );
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      // expo-document-picker API shape:
      //   new: { canceled: false, assets: [{ uri, name, mimeType, size }] }
      //   old: { type: 'success', uri, name, mimeType, size }
      let picked = null;
      if (result.canceled === true) return;
      if (Array.isArray(result.assets) && result.assets.length) picked = result.assets[0];
      else if (result.type === 'success') picked = result;
      if (!picked || !picked.uri) return;

      setUploading(true);
      const token = await getAccessToken();
      const form = new FormData();
      // Field name MUST be `uploaded_files` — matches the DRF serializer
      form.append('uploaded_files', {
        uri:  picked.uri,
        name: picked.name || 'upload',
        type: picked.mimeType || 'application/octet-stream',
      });
      const res = await fetch(`${BASE_URL}/tasksite/${task.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type — let fetch set the correct multipart boundary
        },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || `Error ${res.status}`);
      // Backend returns the FULL updated task — take the fresh attachments list
      if (Array.isArray(data.attachments)) {
        setAttachments(data.attachments);
      } else {
        // Fallback: optimistic append with a local placeholder
        setAttachments(prev => [...prev, {
          id:          Date.now(),
          file_name:   picked.name,
          file_url:    null,
          uploaded_at: new Date().toISOString(),
        }]);
      }
      // Let the parent list also refresh
      onUpdated?.(data);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not upload file.');
    } finally {
      setUploading(false);
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

  // Use the local editable state so adds/removes appear instantly
  const assignees = assignedDetails;
  const createdBy = task.assigned_by_user_details || task.created_by || null;

  const statusColor   = STATUS_COLORS[status]     || '#888';
  const priorityColor = PRIORITY_COLORS[priority] || '#888';

  const fmt = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  // Format a backend "HH:MM:SS" duration string into something friendlier (e.g. "2h 15m")
  const fmtDuration = (raw) => {
    if (!raw) return 'N/A';
    const parts = String(raw).split(':');
    if (parts.length < 2) return raw;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    if (h === 0 && m === 0 && s > 0) return `${s}s`;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
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

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 14, paddingBottom: 360 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={true}
            >

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
              {/* Duration (read-only) */}
              <View style={s.dateBox}>
                <Text style={s.dateLabel}>DURATION</Text>
                <Text style={[s.dateValue, !task.duration_time && { color: '#9898A6', fontWeight: '500' }]}>
                  {task.duration_time ? fmtDuration(task.duration_time) : 'N/A'}
                </Text>
              </View>
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
                    <TouchableOpacity
                      onPress={() => toggleAssignee(u)}
                      style={s.removeAssigneeBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.removeAssigneeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text style={s.emptyText}>No assignees</Text>
            )}

            {/* Add Assignee picker */}
            <TouchableOpacity
              style={s.addAssigneeRow}
              onPress={() => setShowAssigneePicker(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={s.addAssigneePlus}>＋</Text>
              <Text style={s.addAssigneeText}>
                {showAssigneePicker ? 'Hide assignee picker' : 'Add Assignee'}
              </Text>
              <Text style={s.addAssigneeCaret}>{showAssigneePicker ? '▴' : '▾'}</Text>
            </TouchableOpacity>

            {showAssigneePicker && (
              <View style={s.assigneePickerBox}>
                <TextInput
                  style={s.assigneeSearchInput}
                  placeholder="Search users…"
                  placeholderTextColor="#9898A6"
                  value={assigneeSearch}
                  onChangeText={setAssigneeSearch}
                />
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                  {(() => {
                    const q = assigneeSearch.trim().toLowerCase();
                    const pool = allUsers.filter(u => {
                      if (assignedIds.includes(u.id)) return false;
                      if (!q) return true;
                      const full = [u.first_name, u.last_name, u.username, u.email].filter(Boolean).join(' ').toLowerCase();
                      return full.includes(q);
                    });
                    if (pool.length === 0) {
                      return (
                        <Text style={s.assigneePickerEmpty}>
                          {allUsers.length === 0 ? 'Loading users…' : 'No users to add'}
                        </Text>
                      );
                    }
                    return pool.slice(0, 50).map(u => {
                      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.full_name || u.username || 'User';
                      const initial = (name || 'U').charAt(0).toUpperCase();
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={s.pickerRow}
                          onPress={() => { toggleAssignee(u); setAssigneeSearch(''); }}
                          activeOpacity={0.7}
                        >
                          <View style={s.pickerAvatar}>
                            <Text style={s.pickerAvatarText}>{initial}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.pickerName}>{name}</Text>
                            {!!u.email && <Text style={s.pickerEmail} numberOfLines={1}>{u.email}</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>
              </View>
            )}

            {/* Links */}
            <Text style={s.sectionLabel}>🔗 Links{links.length > 0 ? ` (${links.length})` : ''}</Text>
            {links.length > 0 && links.map((l, i) => {
              const url = typeof l === 'string' ? l : l.url;
              const lid = typeof l === 'string' ? null : l.id;
              return (
                <View key={lid ?? i} style={s.linkRowEdit}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => Linking.openURL(url).catch(() => {})}
                  >
                    <Text style={s.linkText} numberOfLines={1}>{url}</Text>
                  </TouchableOpacity>
                  {lid != null && (
                    <TouchableOpacity
                      onPress={() => deleteLink(lid)}
                      disabled={deletingLinkId === lid}
                      style={s.linkDeleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {deletingLinkId === lid
                        ? <ActivityIndicator size="small" color="#EF4444" />
                        : <Text style={s.removeAssigneeText}>✕</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {/* Add link input */}
            <View style={s.linkInputRow}>
              <TextInput
                style={s.linkInput}
                placeholder="Paste URL to add…"
                placeholderTextColor="#9898A6"
                value={newLinkUrl}
                onChangeText={setNewLinkUrl}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={addLink}
                editable={!addingLink}
              />
              <TouchableOpacity
                style={[s.linkAddBtn, (!newLinkUrl.trim() || addingLink) && { opacity: 0.4 }]}
                onPress={addLink}
                disabled={!newLinkUrl.trim() || addingLink}
                activeOpacity={0.7}
              >
                {addingLink
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.linkAddBtnText}>＋</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Attachments */}
            <Text style={s.sectionLabel}>📎 Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}</Text>
            {attachments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {attachments.map((att, i) => {
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
            )}
            <TouchableOpacity
              style={s.attachUploadBox}
              onPress={uploadAttachment}
              disabled={uploading}
              activeOpacity={0.7}
            >
              {uploading
                ? <ActivityIndicator color="#7C3AED" />
                : (
                  <>
                    <Text style={s.attachUploadIcon}>＋</Text>
                    <Text style={s.attachUploadText}>Drop files to attach or <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Browse</Text></Text>
                  </>
                )
              }
            </TouchableOpacity>

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
                onFocus={() => {
                  // Wait for keyboard to start showing, then scroll the comment box into view
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 250);
                }}
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
          </KeyboardAvoidingView>
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

  dateRow: { flexDirection: 'row', gap: 8 },
  dateBox: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    padding: 10,
  },
  dateLabel: { fontSize: 10, color: '#888899', fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  dateValue: { fontSize: 12, color: '#1A1A2E', fontWeight: '600' },

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

  // Assignee edit additions
  removeAssigneeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  removeAssigneeText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
  addAssigneeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0', borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 8,
    marginTop: 4, marginBottom: 10,
  },
  addAssigneePlus: { fontSize: 18, fontWeight: '700', color: '#7C3AED' },
  addAssigneeText: { flex: 1, fontSize: 13, color: '#1A1A2E', fontWeight: '600' },
  addAssigneeCaret: { fontSize: 12, color: '#888899' },

  assigneePickerBox: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10,
    padding: 10, marginBottom: 12,
  },
  assigneeSearchInput: {
    backgroundColor: '#F5F5F7',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: '#1A1A2E', marginBottom: 8,
  },
  assigneePickerEmpty: { fontSize: 12, color: '#9898A6', fontStyle: 'italic', padding: 10, textAlign: 'center' },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEBF0',
  },
  pickerAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center', alignItems: 'center',
  },
  pickerAvatarText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  pickerName:  { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  pickerEmail: { fontSize: 11, color: '#9898A6', marginTop: 1 },

  linkRow: {
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    padding: 12, marginBottom: 6,
  },
  linkRowEdit: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
  },
  linkDeleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  linkText: { fontSize: 13, color: '#3B82F6', fontWeight: '500' },

  linkInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 4, marginBottom: 14,
  },
  linkInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#EBEBF0',
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#1A1A2E',
  },
  linkAddBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#7C3AED',
    justifyContent: 'center', alignItems: 'center',
  },
  linkAddBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  attachThumb: { width: 100, marginRight: 8, alignItems: 'center' },
  attachImg: { width: 100, height: 80, borderRadius: 10, backgroundColor: '#F5F5F7' },
  attachIcon: {
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EBEBF0',
  },
  attachName: { fontSize: 10, color: '#5C5C6E', marginTop: 4, textAlign: 'center' },

  attachUploadBox: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed',
    borderRadius: 12, padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 14,
  },
  attachUploadIcon: { fontSize: 22, color: '#7C3AED', fontWeight: '700' },
  attachUploadText: { fontSize: 13, color: '#5C5C6E' },

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
