import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  TextInput, StatusBar, Platform, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import SidebarMenu from '../components/SidebarMenu';
import { ThemeContext } from '../context/ThemeContext';
import { sanitizeLabel, sanitizeBody } from '../services/InputSanitizer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOCS_KEY  = 'DYUKSA_DOCUMENTS';
const DOC_TYPES = { Doc: '#4ECDC4', Report: '#FBBF24', Note: '#A78BFA' };

export default function DocumentsScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const [docs,         setDocs]         = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editorDoc,    setEditorDoc]    = useState(null); // null = list, obj = editing
  const [docName,      setDocName]      = useState('');
  const [docType,      setDocType]      = useState('Doc');

  // Slide animation for New Doc panel
  const slideAnim = useRef(new Animated.Value(-500)).current;
  const animated  = useRef(false);

  const openModal = () => {
    setModalVisible(true);
    animated.current = true;
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeModal = () => {
    animated.current = false;
    Animated.timing(slideAnim, { toValue: -500, duration: 250, useNativeDriver: true })
      .start(() => { setModalVisible(false); setDocName(''); setDocType('Doc'); });
  };

  const addDoc = () => {
    const name = sanitizeLabel(docName);
    if (!name) return;
    const newDoc = {
      id:        Date.now().toString(),
      name,
      type:      docType,
      content:   '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newDoc, ...docs];
    setDocs(updated);
    AsyncStorage.setItem(DOCS_KEY, JSON.stringify(updated));
    closeModal();
    // Open editor immediately
    setEditorDoc(newDoc);
  };

  const saveDocContent = (id, content) => {
    const sanitized = sanitizeBody(content);
    const updated = docs.map(d =>
      d.id === id ? { ...d, content: sanitized, updatedAt: new Date().toISOString() } : d
    );
    setDocs(updated);
    AsyncStorage.setItem(DOCS_KEY, JSON.stringify(updated));
  };

  const deleteDoc = (id) => {
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated);
    AsyncStorage.setItem(DOCS_KEY, JSON.stringify(updated));
    if (editorDoc?.id === id) setEditorDoc(null);
  };

  const formatDate = iso => {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  // ── Document Editor ────────────────────────────────────────────────────
  if (editorDoc) {
    const doc = docs.find(d => d.id === editorDoc.id) || editorDoc;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D0D0F' : '#fff'} translucent={false} />

        {/* Editor navbar */}
        <View style={[styles.editorNav, { backgroundColor: card, borderBottomColor: bdr }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setEditorDoc(null)}>
            <Text style={[styles.backText, { color: sub }]}>← Docs</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.editorTitle, { color: txt, fontSize: fs(14) }]} numberOfLines={1}>{doc.name}</Text>
            <Text style={[styles.editorMeta, { color: sub, fontSize: fs(11) }]}>
              {doc.type} · Edited {formatDate(doc.updatedAt)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteDocBtn}
            onPress={() => {
              deleteDoc(doc.id);
            }}
          >
            <Text style={{ fontSize: 16 }}>🗑</Text>
          </TouchableOpacity>
        </View>

        {/* Toolbar */}
        <View style={[styles.toolbar, { backgroundColor: card, borderBottomColor: bdr }]}>
          {['Bold', 'Italic', 'List', 'H1', 'H2'].map(tool => (
            <TouchableOpacity key={tool} style={[styles.toolBtn, { borderColor: bdr }]}>
              <Text style={[styles.toolText, { color: sub, fontSize: fs(11) }]}>{tool}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content editor */}
        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={[styles.editor, { color: txt, fontSize: fs(15) }]}
            multiline
            autoFocus={!doc.content}
            textAlignVertical="top"
            placeholder="Start writing your document..."
            placeholderTextColor={sub}
            value={doc.content}
            onChangeText={text => saveDocContent(doc.id, text)}
          />
        </ScrollView>

        {/* Word count */}
        <View style={[styles.statusBar, { backgroundColor: card, borderTopColor: bdr }]}>
          <Text style={[styles.statusText, { color: sub, fontSize: fs(11) }]}>
            {(doc.content || '').trim().split(/\s+/).filter(Boolean).length} words ·{' '}
            {(doc.content || '').length} characters
          </Text>
          <View style={[styles.typePill, { backgroundColor: DOC_TYPES[doc.type] + '20' }]}>
            <Text style={[styles.typePillText, { color: DOC_TYPES[doc.type] }]}>{doc.type}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Document List ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D0D0F' : '#fff'} translucent={false} />

      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Docs" />
          <View style={styles.logoBox}><Text style={styles.logoText}>D</Text></View>
          <Text style={[styles.brandName, { color: txt }]}>Documents</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={[styles.navIconBtn, { borderColor: bdr }]} onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.navIcon}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navIconBtn, { borderColor: bdr }]}><Text style={styles.navIcon}>🔔</Text></TouchableOpacity>
        </View>
      </View>

      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View>
          <Text style={[styles.pageTitle, { color: txt, fontSize: fs(17) }]}>Documents</Text>
          <Text style={[styles.pageSub, { color: sub, fontSize: fs(12) }]}>{docs.length} document{docs.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={openModal}>
          <Text style={styles.newBtnText}>+ New Doc</Text>
        </TouchableOpacity>
      </View>

      {docs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, opacity: 0.3 }}>📄</Text>
          <Text style={[styles.emptyTitle, { color: txt }]}>No documents yet</Text>
          <Text style={[styles.emptySub, { color: sub }]}>Create your first document</Text>
          <TouchableOpacity style={[styles.newBtn, { marginTop: 12 }]} onPress={openModal}>
            <Text style={styles.newBtnText}>+ Create Document</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: card, borderColor: bdr }]}
              onPress={() => setEditorDoc(item)}
            >
              <View style={[styles.docIcon, { backgroundColor: DOC_TYPES[item.type] + '20' }]}>
                <Text style={{ fontSize: 18 }}>📄</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.docName, { color: txt, fontSize: fs(14) }]}>{item.name}</Text>
                <Text style={[styles.docMeta, { color: sub, fontSize: fs(12) }]}>
                  {item.content
                    ? item.content.slice(0, 50) + (item.content.length > 50 ? '…' : '')
                    : 'Empty document'}
                </Text>
                <Text style={[styles.docDate, { color: sub, fontSize: fs(11) }]}>{formatDate(item.updatedAt)}</Text>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: DOC_TYPES[item.type] + '20' }]}>
                <Text style={[styles.typeText, { color: DOC_TYPES[item.type] }]}>{item.type}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* New Doc Modal — slides from top */}
      {modalVisible && (
        <Modal visible transparent animationType="none" onRequestClose={closeModal}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.topPanel, { transform: [{ translateY: slideAnim }] }]}>
            <SafeAreaView>
              <View style={styles.handle} />
              <View style={styles.panelContent}>
                <View style={styles.panelHeader}>
                  <Text style={styles.modalTitle}>New Document</Text>
                  <TouchableOpacity style={styles.closeCircle} onPress={closeModal}>
                    <Text style={styles.closeCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Document Name *</Text>
                <TextInput
                  placeholder="Enter document name..."
                  placeholderTextColor="#AAAABC"
                  style={styles.input}
                  value={docName}
                  onChangeText={setDocName}
                  autoFocus
                  maxLength={200}
                />
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                  {Object.keys(DOC_TYPES).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, docType === t && { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' }]}
                      onPress={() => setDocType(t)}
                    >
                      <Text style={[styles.typeChipText, docType === t && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.newBtn} onPress={addDoc}>
                    <Text style={styles.newBtnText}>Create & Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navbar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },
  subHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontWeight: '700' },
  pageSub: { marginTop: 2 },
  newBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13 },
  card: { borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  docName: { fontWeight: '600', marginBottom: 2 },
  docMeta: { marginTop: 1 },
  docDate: { marginTop: 3 },
  typeBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '600' },
  // Editor styles
  editorNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  backBtn: { paddingRight: 8 },
  backText: { fontSize: 14, fontWeight: '500' },
  editorTitle: { fontWeight: '700' },
  editorMeta: { marginTop: 1 },
  deleteDocBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.08)', justifyContent: 'center', alignItems: 'center' },
  toolbar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, gap: 6 },
  toolBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  toolText: { fontWeight: '600' },
  editor: { flex: 1, lineHeight: 26, minHeight: 400 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
  statusText: { fontWeight: '400' },
  typePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  typePillText: { fontSize: 11, fontWeight: '600' },
  // Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' },
  topPanel: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 20 },
  handle: { width: 40, height: 4, backgroundColor: '#DEDEE8', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  panelContent: { paddingHorizontal: 20, paddingBottom: 24 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  closeCircleText: { color: '#888899', fontSize: 13, fontWeight: '600' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 8, letterSpacing: 0.3 },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 14, color: '#1A1A2E', marginBottom: 16, borderWidth: 1.5, borderColor: '#EBEBF0' },
  typeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0' },
  typeChipText: { fontSize: 13, color: '#888899', fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
});
