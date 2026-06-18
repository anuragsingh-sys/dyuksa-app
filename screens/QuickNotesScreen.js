import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList,
  TextInput, StatusBar, Platform, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Pressable, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useCallback, useRef, useEffect } from 'react';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';
import { getAccessToken } from '../services/ApiService';
import Svg, { Path, Rect } from 'react-native-svg';
import { API_BASE } from '../config';

// ── Module-level cache ────────────────────────────────────────────────────────
let _cachedFolders = [];
let _cachedNotes   = [];
let _notesFetchedAt = 0;
const NOTES_STALE_MS = 30_000;

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return fmtDate(iso);
  } catch { return ''; }
};

const ACCENT_COLORS = ['#3B72EE', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6'];

// ── Note Card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, idx, onPress, card, txt, sub, bdr, gridMode }) {
  const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];

  if (gridMode) {
    return (
      <TouchableOpacity
        style={[styles.noteCardGrid, { backgroundColor: card, borderColor: bdr, borderTopColor: accent }]}
        onPress={() => onPress(note)}
        activeOpacity={0.75}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={[styles.noteCardTitle, { color: txt, flex: 1, fontSize: 13 }]} numberOfLines={2}>
            {note.title || 'Untitled note'}
          </Text>
        </View>
        {!!note.content && (
          <Text style={[styles.noteCardPreview, { color: sub, fontSize: 12 }]} numberOfLines={3}>{note.content}</Text>
        )}
        <Text style={[styles.noteCardTime, { color: sub, marginTop: 8 }]}>{fmtRelative(note.created_at)}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.noteCard, { backgroundColor: card, borderColor: bdr, borderLeftColor: accent }]}
      onPress={() => onPress(note)}
      activeOpacity={0.75}
    >
      <Text style={[styles.noteCardTitle, { color: txt }]} numberOfLines={1}>
        {note.title || 'Untitled note'}
      </Text>
      {!!note.content && (
        <Text style={[styles.noteCardPreview, { color: sub }]} numberOfLines={2}>{note.content}</Text>
      )}
      <Text style={[styles.noteCardTime, { color: sub }]}>{fmtRelative(note.created_at)}</Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function QuickNotesScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { theme } = useContext(ThemeContext);
  const { user }  = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [folders,        setFolders]        = useState(_cachedFolders);
  const [notes,          setNotes]          = useState(_cachedNotes);
  const [projects,       setProjects]       = useState([]);
  const [loading,        setLoading]        = useState(_cachedNotes.length === 0);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [gridMode,       setGridMode]       = useState(false);

  const [activeTab,      setActiveTab]      = useState('all'); // 'all' | String(folder.id)
  const [showDropdown,   setShowDropdown]   = useState(false);

  // ── New Note modal ────────────────────────────────────────────────────────
  const [draftContent, setDraftContent] = useState('');
  const [draftFolder,  setDraftFolder]  = useState(null);
  const [draftProject, setDraftProject] = useState(null);
  const [savingNote,   setSavingNote]   = useState(false);
  const [notePicker,   setNotePicker]   = useState(null);

  // ── Full-screen editor state ───────────────────────────────────────────────
  const [editorView,   setEditorView]   = useState(false); // full screen editor
  const [editorNote,   setEditorNote]   = useState(null);  // null = new note
  const [draftTitle,   setDraftTitle]   = useState('');
  const titleInputRef   = useRef(null);
  const contentInputRef = useRef(null);
  const [selection,     setSelection]     = useState({ start: 0, end: 0 });

  // Insert text at cursor position or wrap selection
  const insertAtCursor = (before, after = '') => {
    const { start, end } = selection;
    const selected = draftContent.slice(start, end);
    const newText = draftContent.slice(0, start) + before + selected + after + draftContent.slice(end);
    setDraftContent(newText);
    // Move cursor after inserted text
    const newPos = start + before.length + selected.length + after.length;
    setTimeout(() => {
      contentInputRef.current?.setNativeProps({ selection: { start: newPos, end: newPos } });
    }, 10);
  };


  // ── New Folder modal ──────────────────────────────────────────────────────
  const [folderModal,  setFolderModal]  = useState(false);
  const [folderName,   setFolderName]   = useState('');
  const [savingFolder, setSavingFolder] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (_cachedNotes.length > 0 && Date.now() - _notesFetchedAt < NOTES_STALE_MS) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [fRes, nRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/quicknotes/folders/`, { headers }),
        fetch(`${API_BASE}/api/v1/quicknotes/notes/`,   { headers }),
        fetch(`${API_BASE}/api/v1/projects/`,            { headers }),
      ]);
      if (fRes.ok) {
        const fd = await fRes.json();
        const fl = Array.isArray(fd) ? fd : (fd.results || []);
        fl.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        _cachedFolders = fl;
        setFolders(fl);
        if (!draftFolder && fl[0]) setDraftFolder(fl[0].id);
      }
      if (nRes.ok) {
        const nd = await nRes.json();
        let nl = Array.isArray(nd) ? nd : (nd.results || []);
        // Fetch remaining pages if paginated
        let nextUrl = nd.next || null;
        while (nextUrl) {
          try {
            const pageRes = await fetch(nextUrl, { headers });
            if (!pageRes.ok) break;
            const pageData = await pageRes.json();
            nl = [...nl, ...(pageData.results || [])];
            nextUrl = pageData.next || null;
          } catch { break; }
        }
        nl.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        _cachedNotes    = nl;
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

  // Auto-open editor if navigated with openCreate param
  useEffect(() => {
    if (route?.params?.openCreate) {
      setTimeout(() => openNoteModal(), 350);
    }
  }, [route?.params?.openCreate]);

  // ── Filtered notes ────────────────────────────────────────────────────────
  const visibleNotes = notes.filter(n => {
    return activeTab === 'all' ? true : String(n.folder) === String(activeTab);
  });

  const folderCount = (fId) => notes.filter(n => String(n.folder) === String(fId)).length;

  // ── Save Note ─────────────────────────────────────────────────────────────
  const saveNote = async () => {
    const body = draftContent.trim();
    if (!body)         { Alert.alert('Empty', 'Type something to save.'); return; }
    if (!draftFolder)  { Alert.alert('Missing', 'Select a folder.'); return; }
    if (!draftProject) { Alert.alert('Missing', 'Select a project.'); return; }
    setSavingNote(true);
    try {
      const token = await getAccessToken();
      if (editorNote) {
        // Edit existing
        const res = await fetch(`${API_BASE}/api/v1/quicknotes/notes/${editorNote.id}/`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: body, folder: draftFolder, project: draftProject }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || JSON.stringify(e)); }
        const updated_note = await res.json();
        const updated = notes.map(n => n.id === updated_note.id ? updated_note : n);
        _cachedNotes = updated; _notesFetchedAt = Date.now(); setNotes(updated);
      } else {
        // Create new
        const res = await fetch(`${API_BASE}/api/v1/quicknotes/notes/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: body, folder: draftFolder, project: draftProject }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || JSON.stringify(e)); }
        const created = await res.json();
        const updated = [created, ...notes];
        _cachedNotes = updated; _notesFetchedAt = Date.now(); setNotes(updated);
      }
      closeEditor();
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Try again.');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Save Folder ───────────────────────────────────────────────────────────
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
      const updated = [...folders, created].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      _cachedFolders = updated;
      setFolders(updated);
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
    setDraftTitle('');
    setNotePicker(null);
    setEditorNote(null);
    setEditorView(true);
    setTimeout(() => contentInputRef.current?.focus(), 200);
  };

  const openNoteEditor = (note) => {
    setEditorNote(note);
    setDraftContent(note.content || '');
    setDraftTitle(note.title || '');
    setDraftFolder(note.folder || draftFolder);
    setDraftProject(note.project || draftProject);
    setNotePicker(null);
    setEditorView(true);
  };

  const closeEditor = () => {
    setEditorView(false);
    setEditorNote(null);
    setDraftTitle('');
    setDraftContent('');
    setNotePicker(null);
  };

  // ── Tabs: All + each folder ───────────────────────────────────────────────
  // Use whichever is populated — cached or state
  const folderList = folders.length > 0 ? folders : _cachedFolders;
  const tabs = [
    { key: 'all', label: 'All notes', count: notes.length },
    ...folderList.map(f => ({ key: String(f.id), label: f.name, count: folderCount(f.id) })),
  ];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SidebarMenu activeScreen="QuickNotes" />
          <View>
            <Text style={[styles.navTitle, { color: txt }]}>Notes</Text>
            <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>
              {notes.length} note{notes.length !== 1 ? 's' : ''}{notes[0] ? ` · last updated ${fmtRelative(notes[0].created_at)}` : ''}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={{ padding: 6 }} onPress={() => navigation.navigate('Search')}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              <Path d="M21 21L16.65 16.65" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Quick note banner */}
      <TouchableOpacity
        style={[styles.quickBanner, { backgroundColor: '#3B72EE' }]}
        onPress={openNoteModal}
        activeOpacity={0.85}
      >
        <View style={styles.quickBannerIcon}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <Path d="M14 2V8H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <Path d="M16 13H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <Path d="M16 17H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <Path d="M10 9H9H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Quick note</Text>
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 }}>Capture a thought in one tap</Text>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 22 }}>›</Text>
      </TouchableOpacity>



      {/* Section header with folder dropdown */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, zIndex: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Folder dropdown trigger */}
          <TouchableOpacity
            onPress={() => setShowDropdown(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 19, fontWeight: '700', color: txt }}>
              {tabs.find(t => t.key === String(activeTab))?.label || 'All notes'}
            </Text>
            <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>
              ({tabs.find(t => t.key === String(activeTab))?.count ?? visibleNotes.length})
            </Text>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ marginTop: 2 }}>
              <Path
                d={showDropdown ? "M18 15L12 9L6 15" : "M6 9L12 15L18 9"}
                stroke="#3B72EE"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          {/* + and Grid/list toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity onPress={() => { setFolderName(''); setFolderModal(true); }} style={{ padding: 4 }}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke="#3B72EE" strokeWidth={2.5} strokeLinecap="round"/>
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setGridMode(v => !v)} style={{ padding: 4 }}>
              {gridMode ? (
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M3 12h18M3 6h18M3 18h18"/>
                </Svg>
              ) : (
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Rect x="3" y="3" width="7" height="7" rx="1"/>
                  <Rect x="14" y="3" width="7" height="7" rx="1"/>
                  <Rect x="14" y="14" width="7" height="7" rx="1"/>
                  <Rect x="3" y="14" width="7" height="7" rx="1"/>
                </Svg>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropdown menu */}
        {showDropdown && (
          <View style={{ marginTop: 8, backgroundColor: card, borderRadius: 12, borderWidth: 1, borderColor: bdr, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 20, zIndex: 50 }}>
            {tabs.map((tab, idx) => {
              const isActive = String(activeTab) === String(tab.key);
              return (
                <TouchableOpacity
                  key={String(tab.key)}
                  onPress={() => { setActiveTab(String(tab.key)); setShowDropdown(false); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 16, paddingVertical: 13,
                    borderBottomWidth: idx < tabs.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: bdr,
                    backgroundColor: isActive ? '#3B72EE11' : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT_COLORS[idx % ACCENT_COLORS.length] }} />
                    <Text style={{ fontSize: 14, fontWeight: isActive ? '600' : '400', color: isActive ? '#3B72EE' : txt }}>
                      {tab.label}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: sub }}>{tab.count}</Text>
                    {isActive && <Text style={{ fontSize: 13, color: '#3B72EE' }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Notes list — tap outside closes dropdown */}
      {showDropdown && <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 }} onPress={() => setShowDropdown(false)} />}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#3B72EE" />
          <Text style={{ color: sub, marginTop: 10 }}>Loading notes…</Text>
        </View>
      ) : visibleNotes.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={{ fontSize: 40, opacity: 0.2 }}>⚡</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: txt, marginTop: 8 }}>No notes yet</Text>
          <Text style={{ fontSize: 12, color: sub, textAlign: 'center', marginTop: 4 }}>
            {'Tap + to capture your first thought.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleNotes}
          keyExtractor={n => String(n.id)}
          key={gridMode ? 'grid' : 'list'}
          numColumns={gridMode ? 2 : 1}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100, paddingTop: 4 }}
          columnWrapperStyle={gridMode ? { gap: 10 } : undefined}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={gridMode ? { flex: 1 } : {}}>
              <NoteCard
                note={item}
                idx={index}
                onPress={openNoteEditor}
                card={card}
                txt={txt}
                sub={sub}
                bdr={bdr}
                gridMode={gridMode}
              />
            </View>
          )}
        />
      )}

      {/* ── Full-screen note editor ── */}
      {editorView && (
        <KeyboardAvoidingView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: isDark ? '#0D0D0F' : '#FFFFFF' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            {/* Editor navbar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}>
              <TouchableOpacity onPress={closeEditor} style={{ padding: 4 }}>
                <Text style={{ color: '#4ECDC4', fontSize: 22 }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 15, fontWeight: '600', color: txt }}>
                {editorNote ? 'Edit note' : 'New note'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Text style={{ fontSize: 20 }}>☆</Text>
                <Text style={{ fontSize: 20, color: sub }}>···</Text>
              </View>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* Folder + Project pickers — option 4: bordered cards */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 16 }}>
                {/* Folder card */}
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={{ borderWidth: 1.5, borderRadius: 10, padding: 10, borderColor: notePicker === 'folder' ? '#3B72EE' : bdr, backgroundColor: isDark ? '#1A1A20' : '#FFFFFF' }}
                    onPress={() => setNotePicker(p => p === 'folder' ? null : 'folder')}
                    disabled={savingNote}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: notePicker === 'folder' ? '#3B72EE' : sub, letterSpacing: 0.5, marginBottom: 5 }}>FOLDER</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: draftFolder ? txt : sub }} numberOfLines={1}>
                        {folders.find(f => f.id === draftFolder)?.name || 'Choose…'}
                      </Text>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path d={notePicker === 'folder' ? "M18 15L12 9L6 15" : "M6 9L12 15L18 9"} stroke={sub} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                    </View>
                  </TouchableOpacity>
                  {notePicker === 'folder' && (
                    <View style={{ borderWidth: 1.5, borderRadius: 10, marginTop: 4, borderColor: '#3B72EE', backgroundColor: card, overflow: 'hidden', zIndex: 10 }}>
                      <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {folders.map(f => (
                          <TouchableOpacity key={f.id}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr, backgroundColor: draftFolder === f.id ? '#EBF1FD' : 'transparent' }}
                            onPress={() => { setDraftFolder(f.id); setNotePicker(null); }}>
                            <Text style={{ fontSize: 13, color: draftFolder === f.id ? '#3B72EE' : txt, fontWeight: draftFolder === f.id ? '700' : '500' }} numberOfLines={1}>{f.name}</Text>
                            {draftFolder === f.id && <Text style={{ color: '#3B72EE' }}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                        {folders.length === 0 && <Text style={{ fontSize: 12, color: sub, padding: 12, textAlign: 'center' }}>No folders yet</Text>}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Project card */}
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={{ borderWidth: 1.5, borderRadius: 10, padding: 10, borderColor: notePicker === 'project' ? '#10B981' : bdr, backgroundColor: isDark ? '#1A1A20' : '#FFFFFF' }}
                    onPress={() => setNotePicker(p => p === 'project' ? null : 'project')}
                    disabled={savingNote}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: notePicker === 'project' ? '#10B981' : sub, letterSpacing: 0.5, marginBottom: 5 }}>PROJECT</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" stroke="#10B981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: draftProject ? txt : sub }} numberOfLines={1}>
                        {projects.find(p => p.id === draftProject)?.name || 'Choose…'}
                      </Text>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path d={notePicker === 'project' ? "M18 15L12 9L6 15" : "M6 9L12 15L18 9"} stroke={sub} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                    </View>
                  </TouchableOpacity>
                  {notePicker === 'project' && (
                    <View style={{ borderWidth: 1.5, borderRadius: 10, marginTop: 4, borderColor: '#10B981', backgroundColor: card, overflow: 'hidden', zIndex: 10 }}>
                      <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {projects.map(p => (
                          <TouchableOpacity key={p.id}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr, backgroundColor: draftProject === p.id ? '#ECFDF5' : 'transparent' }}
                            onPress={() => { setDraftProject(p.id); setNotePicker(null); }}>
                            <Text style={{ fontSize: 13, color: draftProject === p.id ? '#10B981' : txt, fontWeight: draftProject === p.id ? '700' : '500' }} numberOfLines={1}>{p.name}</Text>
                            {draftProject === p.id && <Text style={{ color: '#10B981' }}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Title */}
              <TextInput
                ref={titleInputRef}
                style={{ fontSize: 26, fontWeight: '700', color: txt, marginBottom: 8, lineHeight: 32 }}
                placeholder="Title"
                placeholderTextColor={isDark ? '#444455' : '#C0C0CC'}
                value={draftTitle}
                onChangeText={setDraftTitle}
                returnKeyType="next"
                onSubmitEditing={() => contentInputRef.current?.focus()}
                editable={!savingNote}
              />

              {/* Content */}
              <TextInput
                ref={contentInputRef}
                style={{ fontSize: 16, color: txt, lineHeight: 26, minHeight: 300, textAlignVertical: 'top' }}
                placeholder="Start writing..."
                placeholderTextColor={isDark ? '#444455' : '#C0C0CC'}
                value={draftContent}
                onChangeText={setDraftContent}
                onSelectionChange={e => setSelection(e.nativeEvent.selection)}
                multiline
                scrollEnabled={false}
                editable={!savingNote}
              />

              <View style={{ height: 120 }} />
            </ScrollView>

            {/* Formatting toolbar */}
            <SafeAreaView edges={['bottom']} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: bdr, backgroundColor: isDark ? '#1A1A20' : '#FFFFFF' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 }}>
                {[
                  { label: 'B',   style: { fontSize: 18, fontWeight: '700', color: txt }, onPress: () => insertAtCursor('**', '**') },
                  { label: 'I',   style: { fontSize: 18, fontStyle: 'italic', color: txt }, onPress: () => insertAtCursor('_', '_') },
                  { label: '≡',   style: { fontSize: 24, color: txt }, onPress: () => insertAtCursor('\n• ') },
                  { label: '☑',   style: { fontSize: 18, color: txt }, onPress: () => insertAtCursor('\n☐ ') },
                  { label: '📎',  style: { fontSize: 18 }, onPress: () => {} },
                  { label: '🔗',  style: { fontSize: 18 }, onPress: () => insertAtCursor('[', '](url)') },
                ].map((btn, i) => (
                  <TouchableOpacity key={i} style={{ paddingHorizontal: 12, paddingVertical: 6 }} onPress={btn.onPress}>
                    <Text style={btn.style}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={{ backgroundColor: '#3B72EE', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 }}
                  onPress={saveNote}
                  disabled={savingNote}
                >
                  {savingNote
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Done</Text>
                  }
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      )}

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
                    <Text style={{ fontSize: 14, fontWeight: '600', color: sub }}>Cancel</Text>
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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navTitle: { fontWeight: '700', fontSize: 17 },

  quickBanner: { marginHorizontal: 12, marginTop: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  quickBannerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  tabChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, minWidth: 60, alignItems: 'center', flexShrink: 0 },

  noteCard: {
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3, padding: 14, marginBottom: 10,
  },
  noteCardGrid: {
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 3, padding: 12, marginBottom: 10, flex: 1,
  },
  noteCardTitle:   { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  noteCardPreview: { fontSize: 13, lineHeight: 19, marginBottom: 6 },
  noteCardTime:    { fontSize: 11 },


  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6, padding: 20 },

  // Note detail
  detailOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 20 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  detailBackBtn: { width: 60 },
  detailBackText: { color: '#3B72EE', fontSize: 14, fontWeight: '600' },
  detailHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  detailTitle: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginBottom: 4 },
  detailTime: { fontSize: 12, marginBottom: 16 },
  detailDivider: { height: 1, marginBottom: 18 },
  detailContent: { fontSize: 15, lineHeight: 24 },

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
  modalSaveBtn: { flex: 1, height: 46, backgroundColor: '#3B72EE', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
