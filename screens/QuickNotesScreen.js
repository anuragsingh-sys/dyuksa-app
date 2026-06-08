import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList,
  TextInput, StatusBar, Platform, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Pressable, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useCallback, useRef } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';

import { API_BASE, BASE_URL, WS_BASE } from '../config';

// ── Module-level cache — survives workspace switches (remounts) ───────────────
// Notes and folders are global (no X-Workspace-ID), so they should never
// change on workspace switch. Cache them to avoid blank flashes.
let _cachedFolders = [];
let _cachedNotes   = [];
let _notesFetchedAt = 0;
const NOTES_STALE_MS = 30_000;

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return fmtDate(iso);
  } catch { return ''; }
};

// ── Note Detail — full screen slide-in ──────────────────────────────────────
function NoteDetail({ note, onClose, isDark, card, txt, sub, bdr }) {
  const slideAnim = useRef(new Animated.Value(400)).current;

  useState(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  });

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true })
      .start(() => onClose());
  };

  return (
    <Animated.View style={[styles.detailOverlay, { backgroundColor: card, transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.detailHeader, { borderBottomColor: bdr }]}>
          <TouchableOpacity onPress={handleClose} style={styles.detailBackBtn}>
            <Text style={styles.detailBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.detailHeaderTitle, { color: txt }]} numberOfLines={1}>
            {note?.title || 'Note'}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        {/* Content */}
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.detailTitle, { color: txt }]}>
            {note?.title || 'Untitled note'}
          </Text>
          <Text style={[styles.detailTime, { color: sub }]}>
            {fmtRelative(note?.created_at)}
          </Text>
          <View style={[styles.detailDivider, { backgroundColor: bdr }]} />
          <Text style={[styles.detailContent, { color: txt }]}>
            {note?.content || '(No content)'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function QuickNotesScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  // ── Data ──────────────────────────────────────────────────────────────
  const [folders,  setFolders]  = useState(_cachedFolders);
  const [notes,    setNotes]    = useState(_cachedNotes);
  const [loading,  setLoading]  = useState(_cachedNotes.length === 0);

  // ── Selection / detail ────────────────────────────────────────────────
  const [selectedFolder, setSelectedFolder] = useState(null); // null = All Notes
  const [detailNote,     setDetailNote]     = useState(null); // open note detail

  // ── Search ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  // ── New Note modal ─────────────────────────────────────────────────────
  const [noteModal,    setNoteModal]    = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [draftFolder,  setDraftFolder]  = useState(null);
  const [draftProject, setDraftProject] = useState(null);
  const [projects,     setProjects]     = useState([]);
  const [savingNote,   setSavingNote]   = useState(false);
  const [notePicker,   setNotePicker]   = useState(null); // 'folder'|'project'|null

  // ── New Folder modal ───────────────────────────────────────────────────
  const [folderModal,  setFolderModal]  = useState(false);
  const [folderName,   setFolderName]   = useState('');
  const [savingFolder, setSavingFolder] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    // Skip if data is fresh — prevents blank flash on workspace switch remount
    if (_cachedNotes.length > 0 && Date.now() - _notesFetchedAt < NOTES_STALE_MS) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      // quicknotes API does NOT use X-Workspace-ID
      const headers = { Authorization: `Bearer ${token}` };
      const [fRes, nRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/quicknotes/folders/`, { headers }),
        fetch(`${API_BASE}/api/v1/quicknotes/notes/`,   { headers }),
        fetch(`${API_BASE}/api/v1/projects/`,            { headers }),
      ]);
      if (fRes.ok) {
        const fd = await fRes.json();
        const fl = (Array.isArray(fd) ? fd : (fd.results || []));
        fl.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        _cachedFolders = fl;
        setFolders(fl);
        if (!draftFolder && fl[0]) setDraftFolder(fl[0].id);
      }
      if (nRes.ok) {
        const nd = await nRes.json();
        const nl = (Array.isArray(nd) ? nd : (nd.results || []));
        nl.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        _cachedNotes = nl;
        _notesFetchedAt = Date.now();
        setNotes(nl);
      }
      if (pRes.ok) {
        const pd = await pRes.json();
        const pl = Array.isArray(pd) ? pd : (pd.results || pd.projects || []);
        setProjects(pl);
        if (!draftProject && pl[0]) setDraftProject(pl[0].id);
      }
    } catch (e) {
      console.warn('QuickNotes fetchAll:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  // ── Filtered notes ─────────────────────────────────────────────────────
  const visibleNotes = notes.filter(n => {
    if (selectedFolder !== null && n.folder !== selectedFolder) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(n.title || '').toLowerCase().includes(q) && !(n.content || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const folderCount = (fId) => notes.filter(n => n.folder === fId).length;

  // ── Save Note ──────────────────────────────────────────────────────────
  const saveNote = async () => {
    const content = draftContent.trim();
    if (!content)      { Alert.alert('Empty', 'Type something to save.'); return; }
    if (!draftFolder)  { Alert.alert('Missing', 'Select a folder.'); return; }
    if (!draftProject) { Alert.alert('Missing', 'Select a project.'); return; }
    setSavingNote(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/quicknotes/notes/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, folder: draftFolder, project: draftProject }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || JSON.stringify(e));
      }
      const created = await res.json();
      const updated = [created, ...notes];
      _cachedNotes = updated;
      _notesFetchedAt = Date.now();
      setNotes(updated);
      setNoteModal(false);
      setDraftContent('');
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Try again.');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Save Folder ────────────────────────────────────────────────────────
  const saveFolder = async () => {
    const name = folderName.trim();
    if (!name) { Alert.alert('Empty', 'Enter a folder name.'); return; }
    setSavingFolder(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/quicknotes/folders/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || JSON.stringify(e));
      }
      const created = await res.json();
      setFolders(prev => [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setFolderModal(false);
      setFolderName('');
    } catch (e) {
      Alert.alert('Could not create folder', e.message || 'Try again.');
    } finally {
      setSavingFolder(false);
    }
  };

  const openNoteModal = () => {
    setDraftContent('');
    setNotePicker(null);
    setNoteModal(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} translucent={false} />

      {/* Navbar only */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="QuickNotes" />
          <TouchableOpacity
            style={styles.logoBox}
            onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}
            activeOpacity={0.7}
          >
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={[styles.brandName, { color: txt }]}>Quick Notes</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity
            style={[styles.navIconBtn, { backgroundColor: isDark ? '#252530' : '#FAFAFA', borderColor: bdr }]}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Body: folders + notes side by side, full height */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={[styles.emptySub, { color: sub }]}>Loading notes…</Text>
        </View>
      ) : (
        <View style={styles.body}>

          {/* ── Left: Folders panel ── */}
          <View style={[styles.foldersPanel, { backgroundColor: card, borderRightColor: bdr }]}>
            {/* Header */}
            <View style={[styles.panelHeader, { borderBottomColor: bdr }]}>
              <Text style={[styles.panelHeaderLabel, { color: sub }]}>FOLDERS</Text>
              <TouchableOpacity
                onPress={() => { setFolderName(''); setFolderModal(true); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.panelHeaderPlus}>+</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* All Notes */}
              <TouchableOpacity
                style={[
                  styles.folderRow,
                  { borderBottomColor: bdr },
                  selectedFolder === null && styles.folderRowActive,
                  selectedFolder === null && { backgroundColor: isDark ? '#252530' : '#F0FDF4' },
                ]}
                onPress={() => setSelectedFolder(null)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 15 }}>📋</Text>
                <Text
                  style={[styles.folderName, { color: selectedFolder === null ? '#4ECDC4' : txt }]}
                  numberOfLines={1}
                >
                  All N...
                </Text>
                <View style={[styles.folderBadge, { backgroundColor: isDark ? '#333340' : '#EBEBF0' }]}>
                  <Text style={[styles.folderBadgeText, { color: selectedFolder === null ? '#4ECDC4' : sub }]}>
                    {notes.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Folder rows */}
              {folders.map(f => {
                const count  = folderCount(f.id);
                const active = selectedFolder === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.folderRow,
                      { borderBottomColor: bdr },
                      active && { backgroundColor: isDark ? '#252530' : '#F0FDF4' },
                    ]}
                    onPress={() => setSelectedFolder(f.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 15 }}>📁</Text>
                    <Text
                      style={[styles.folderName, { color: active ? '#4ECDC4' : txt }]}
                      numberOfLines={1}
                    >
                      {f.name}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.folderBadge, { backgroundColor: isDark ? '#333340' : '#EBEBF0' }]}>
                        <Text style={[styles.folderBadgeText, { color: active ? '#4ECDC4' : sub }]}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* All Projects */}
              <TouchableOpacity style={[styles.folderRow, { borderBottomColor: bdr }]} activeOpacity={0.5}>
                <Text style={{ fontSize: 15 }}>🗂</Text>
                <Text style={[styles.folderName, { color: sub }]} numberOfLines={1}>All Projects</Text>
                <Text style={{ color: sub, fontSize: 16 }}>›</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* ── Right: Notes list ── */}
          <View style={[styles.notesPanel, { backgroundColor: bg }]}>
            {/* Header */}
            <View style={[styles.panelHeader, { borderBottomColor: bdr, backgroundColor: card }]}>
              <Text style={[styles.panelHeaderLabel, { color: sub }]}>
                {visibleNotes.length} NOTE{visibleNotes.length !== 1 ? 'S' : ''}
              </Text>
              <TouchableOpacity
                onPress={openNoteModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.panelHeaderPlus}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchWrap, { backgroundColor: card, borderColor: bdr }]}>
              <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { color: txt }]}
                placeholder="Search notes…"
                placeholderTextColor={sub}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: sub, fontSize: 13 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Notes */}
            {visibleNotes.length === 0 ? (
              <View style={styles.centerState}>
                <Text style={{ fontSize: 32, opacity: 0.2 }}>⚡</Text>
                <Text style={[styles.emptyTitle, { color: txt }]}>No notes</Text>
                <Text style={[styles.emptySub, { color: sub, textAlign: 'center' }]}>
                  Tap + to create one
                </Text>
              </View>
            ) : (
              <FlatList
                data={visibleNotes}
                keyExtractor={n => String(n.id)}
                contentContainerStyle={{ paddingBottom: 110 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.noteRow, { borderBottomColor: bdr }]}
                    onPress={() => setDetailNote(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.noteTitle, { color: txt }]} numberOfLines={1}>
                        {item.title || 'Untitled note'}
                      </Text>
                      <Text style={[styles.noteDate, { color: sub }]}>
                        {fmtDate(item.created_at)}
                      </Text>
                      {!!item.content && (
                        <Text style={[styles.notePreview, { color: sub }]} numberOfLines={2}>
                          {item.content}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.noteMenuBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ color: sub, fontSize: 18, lineHeight: 20 }}>⋯</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      )}

      {/* ── Note Detail — full screen slide-in from right ── */}
      {detailNote && (
        <NoteDetail
          note={detailNote}
          onClose={() => setDetailNote(null)}
          isDark={isDark}
          card={card}
          txt={txt}
          sub={sub}
          bdr={bdr}
        />
      )}

      {/* ── New Note Modal ── */}
      <Modal visible={noteModal} transparent animationType="fade" onRequestClose={() => !savingNote && setNoteModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => !savingNote && setNoteModal(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: card, borderColor: bdr }]} onPress={() => {}}>
              <View style={[styles.modalHeader, { borderBottomColor: bdr }]}>
                <Text style={[styles.modalTitle, { color: txt }]}>New Note</Text>
                <TouchableOpacity onPress={() => !savingNote && setNoteModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ color: sub, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                <Text style={[styles.fieldLabel, { color: sub }]}>Content *</Text>
                <TextInput
                  style={[styles.contentInput, { color: txt, borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                  placeholder="Type your note here…"
                  placeholderTextColor={sub}
                  value={draftContent}
                  onChangeText={setDraftContent}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  editable={!savingNote}
                />
                <Text style={[styles.fieldHint, { color: sub }]}>Title is auto-generated from your content.</Text>

                {/* Folder + Project */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>Folder *</Text>
                    <TouchableOpacity
                      style={[styles.pickerBtn, { borderColor: notePicker === 'folder' ? '#4ECDC4' : bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                      onPress={() => setNotePicker(p => p === 'folder' ? null : 'folder')}
                      disabled={savingNote}
                    >
                      <Text style={[{ flex: 1, fontSize: 13, color: draftFolder ? txt : sub }]} numberOfLines={1}>
                        {folders.find(f => f.id === draftFolder)?.name || 'Choose…'}
                      </Text>
                      <Text style={{ color: sub, fontSize: 11 }}>{notePicker === 'folder' ? '▲' : '▾'}</Text>
                    </TouchableOpacity>
                    {notePicker === 'folder' && (
                      <View style={[styles.dropdownList, { backgroundColor: card, borderColor: '#4ECDC4' }]}>
                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {folders.map(f => (
                            <TouchableOpacity
                              key={f.id}
                              style={[styles.dropdownItem, { borderBottomColor: bdr }, draftFolder === f.id && { backgroundColor: isDark ? '#252530' : '#F0FDF4' }]}
                              onPress={() => { setDraftFolder(f.id); setNotePicker(null); }}
                            >
                              <Text style={[{ fontSize: 13, color: draftFolder === f.id ? '#4ECDC4' : txt, fontWeight: draftFolder === f.id ? '700' : '500' }]} numberOfLines={1}>{f.name}</Text>
                              {draftFolder === f.id && <Text style={{ color: '#4ECDC4' }}>✓</Text>}
                            </TouchableOpacity>
                          ))}
                          {folders.length === 0 && (
                            <Text style={[{ fontSize: 12, color: sub, padding: 12, textAlign: 'center' }]}>No folders yet</Text>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: sub }]}>Project *</Text>
                    <TouchableOpacity
                      style={[styles.pickerBtn, { borderColor: notePicker === 'project' ? '#4ECDC4' : bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                      onPress={() => setNotePicker(p => p === 'project' ? null : 'project')}
                      disabled={savingNote}
                    >
                      <Text style={[{ flex: 1, fontSize: 13, color: draftProject ? txt : sub }]} numberOfLines={1}>
                        {projects.find(p => p.id === draftProject)?.name || 'Choose…'}
                      </Text>
                      <Text style={{ color: sub, fontSize: 11 }}>{notePicker === 'project' ? '▲' : '▾'}</Text>
                    </TouchableOpacity>
                    {notePicker === 'project' && (
                      <View style={[styles.dropdownList, { backgroundColor: card, borderColor: '#4ECDC4' }]}>
                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {projects.map(p => (
                            <TouchableOpacity
                              key={p.id}
                              style={[styles.dropdownItem, { borderBottomColor: bdr }, draftProject === p.id && { backgroundColor: isDark ? '#252530' : '#F0FDF4' }]}
                              onPress={() => { setDraftProject(p.id); setNotePicker(null); }}
                            >
                              <Text style={[{ fontSize: 13, color: draftProject === p.id ? '#4ECDC4' : txt, fontWeight: draftProject === p.id ? '700' : '500' }]} numberOfLines={1}>{p.name}</Text>
                              {draftProject === p.id && <Text style={{ color: '#4ECDC4' }}>✓</Text>}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>

                {/* Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                  <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: bdr }]} onPress={() => setNoteModal(false)} disabled={savingNote}>
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: sub }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalSaveBtn, savingNote && { opacity: 0.6 }]} onPress={saveNote} disabled={savingNote}>
                    {savingNote ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Save Note</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── New Folder Modal ── */}
      <Modal visible={folderModal} transparent animationType="fade" onRequestClose={() => !savingFolder && setFolderModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => !savingFolder && setFolderModal(false)}>
            <Pressable style={[styles.folderModalCard, { backgroundColor: card, borderColor: bdr }]} onPress={() => {}}>
              <View style={[styles.modalHeader, { borderBottomColor: bdr }]}>
                <Text style={[styles.modalTitle, { color: txt }]}>New Folder</Text>
                <TouchableOpacity onPress={() => !savingFolder && setFolderModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ color: sub, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={{ padding: 16 }}>
                <Text style={[styles.fieldLabel, { color: sub }]}>Folder Name *</Text>
                <TextInput
                  style={[styles.folderInput, { color: txt, borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
                  placeholder="e.g. Daily Updates, Research…"
                  placeholderTextColor={sub}
                  value={folderName}
                  onChangeText={setFolderName}
                  autoFocus
                  editable={!savingFolder}
                  returnKeyType="done"
                  onSubmitEditing={saveFolder}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: bdr }]} onPress={() => setFolderModal(false)} disabled={savingFolder}>
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: sub }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalSaveBtn, savingFolder && { opacity: 0.6 }]} onPress={saveFolder} disabled={savingFolder}>
                    {savingFolder ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Create Folder</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Navbar
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  navIcon: { fontSize: 16 },

  // Body — folders + notes side by side
  body: { flex: 1, flexDirection: 'row' },

  // Panel shared header
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  panelHeaderLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  panelHeaderPlus: { color: '#4ECDC4', fontSize: 20, fontWeight: '700', lineHeight: 22 },

  // Folders panel
  foldersPanel: { width: 130, borderRightWidth: 1 },
  folderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 10, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderRowActive: {},
  folderName: { flex: 1, fontSize: 13, fontWeight: '500' },
  folderBadge: { minWidth: 22, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  folderBadgeText: { fontSize: 10, fontWeight: '700' },

  // Notes panel
  notesPanel: { flex: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 10, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, height: 38,
  },
  searchInput: { flex: 1, fontSize: 13 },
  noteRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  noteTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 2 },
  noteDate: { fontSize: 11, marginBottom: 4 },
  notePreview: { fontSize: 12, lineHeight: 17 },
  noteMenuBtn: { paddingTop: 2, paddingLeft: 6 },

  // Note detail slide-in
  detailOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  detailBackBtn: { width: 60 },
  detailBackText: { color: '#4ECDC4', fontSize: 14, fontWeight: '600' },
  detailHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  detailTitle: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginBottom: 4 },
  detailTime: { fontSize: 12, marginBottom: 16 },
  detailDivider: { height: 1, marginBottom: 18 },
  detailContent: { fontSize: 15, lineHeight: 24 },

  // Empty / loading
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptySub: { fontSize: 13 },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalCard: { width: '100%', maxWidth: 440, borderRadius: 14, borderWidth: 1, overflow: 'hidden', maxHeight: '88%' },
  folderModalCard: { width: '100%', maxWidth: 380, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  fieldHint: { fontSize: 11, marginTop: -6, marginBottom: 14 },
  contentInput: { minHeight: 120, maxHeight: 200, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, lineHeight: 20, textAlignVertical: 'top', marginBottom: 6 },
  folderInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 46, fontSize: 14, marginBottom: 16 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, height: 44 },
  dropdownList: { borderWidth: 1.5, borderRadius: 10, marginTop: 4, marginBottom: 8, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  modalCancelBtn: { flex: 1, height: 46, borderWidth: 1, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalSaveBtn: { flex: 1, height: 46, backgroundColor: '#1A1A2E', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
