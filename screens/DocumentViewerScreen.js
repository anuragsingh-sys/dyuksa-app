import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, StatusBar, Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import { BASE_URL, API_BASE } from '../config';

// ── Light viewer tokens ───────────────────────────────────────────────────────
const DK = {
  bg:     '#FFFFFF',
  bar:    '#FFFFFF',
  ink:    '#1A1A2E',
  ink2:   'rgba(26,26,46,0.55)',
  ink3:   'rgba(26,26,46,0.35)',
  border: 'rgba(0,0,0,0.08)',
};

const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

const getExt = (name = '') => name.split('.').pop().toLowerCase();
const isImage = (ext) => ['png','jpg','jpeg','gif','webp','heic','bmp','svg'].includes(ext);
const isPdf   = (ext) => ext === 'pdf';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

const fmtSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function ActionBtn({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} activeOpacity={0.65}>
      <View style={[s.actionIcon, active && { backgroundColor: 'rgba(78,205,196,0.2)' }]}>
        <Text style={{ fontSize: 18, color: active ? '#4ECDC4' : DK.ink }}>{icon}</Text>
      </View>
      <Text style={[s.actionLabel, active && { color: '#4ECDC4' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DocumentViewerScreen() {
  const navigation = useNavigation();
  const route      = useRoute();

  // Accept doc object directly or fetch by ID
  const docId      = route?.params?.id || route?.params?.docId;
  const passedDoc  = route?.params?.doc;

  const [doc,        setDoc]        = useState(passedDoc || null);
  const [loading,    setLoading]    = useState(!passedDoc);
  const [showViewer, setShowViewer] = useState(false);
  const [showInfo,   setShowInfo]   = useState(false);
  const [webLoading, setWebLoading] = useState(true);

  // Fetch doc if not passed
  useEffect(() => {
    if (passedDoc || !docId) { setLoading(false); return; }
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${BASE_URL}/documents/${docId}/`, { headers });
        if (res.ok) setDoc(await res.json());
      } catch (e) { console.warn('fetchDoc:', e.message); }
      finally { setLoading(false); }
    })();
  }, [docId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: DK.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={{ flex: 1, backgroundColor: DK.bg, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 36, opacity: 0.4 }}>📄</Text>
        <Text style={{ color: DK.ink, fontSize: 16, fontWeight: '600' }}>Document not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: '#4ECDC4', fontSize: 14, fontWeight: '600' }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name    = doc.name || doc.file_name || 'Document';
  const fileUrl = doc.source_file || doc.source_file_url || doc.file_url || '';
  const ext     = getExt(name);
  const imgFile = isImage(ext);
  const pdfFile = isPdf(ext);

  // Build viewer URL
  // - PDFs: load the file directly — iOS/Android WebView renders PDF natively, full width
  // - Office docs (docx/xlsx/pptx): use Google Docs viewer (can't render natively)
  const isOffice = ['doc','docx','ppt','pptx','xls','xlsx'].includes(ext);
  const viewerUrl = imgFile
    ? fileUrl
    : pdfFile && fileUrl
      ? fileUrl  // direct PDF — native full-width render
      : isOffice && fileUrl
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
        : null;

  const openInBrowser = () => {
    if (fileUrl) Linking.openURL(fileUrl).catch(() => Alert.alert('Error', 'Could not open URL'));
    else Alert.alert('Unavailable', 'No URL for this document');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DK.bg }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={DK.bar} translucent={false} />

      {/* ── Nav bar — title only ── */}
      <View style={s.navBar}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.navTitle} numberOfLines={1}>{name}</Text>
          <Text style={s.navSub}>
            {ext.toUpperCase()}{doc.file_size ? `  ·  ${fmtSize(doc.file_size)}` : ''}
          </Text>
        </View>
      </View>

      {/* ── Content area ── */}
      <View style={{ flex: 1 }}>
        {showViewer ? (
          imgFile ? (
            // Image viewer
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
              <Image
                source={{ uri: fileUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>
          ) : viewerUrl ? (
            // WebView for PDF/Office docs
            <View style={{ flex: 1 }}>
              {webLoading && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: DK.bg, zIndex: 10 }}>
                  <ActivityIndicator size="large" color="#4ECDC4" />
                  <Text style={{ color: DK.ink2, marginTop: 12, fontSize: 13 }}>Loading document…</Text>
                </View>
              )}
              <WebView
                source={{ uri: viewerUrl }}
                style={{ flex: 1, backgroundColor: DK.bg }}
                originWhitelist={['*']}
                startInLoadingState={false}
                onLoadStart={() => setWebLoading(true)}
                onLoadEnd={() => setWebLoading(false)}
                scalesPageToFit={true}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
                onError={() => {
                  setWebLoading(false);
                  Alert.alert('Could not load', 'Try opening in browser instead.', [
                    { text: 'Open in Browser', onPress: openInBrowser },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
              />
            </View>
          ) : (
            // Unsupported file type — clean fallback
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 52, opacity: 0.4 }}>
                {isOffice ? (ext.includes('xl') ? '📊' : ext.includes('pp') ? '📊' : '📝') : '📄'}
              </Text>
              <Text style={{ color: DK.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>
                Preview not available
              </Text>
              <Text style={{ color: DK.ink2, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                {`${ext.toUpperCase()} files cannot be previewed in-app. Open in browser to view or download.`}
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#4ECDC4', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 }}
                onPress={openInBrowser}
              >
                <Text style={{ color: '#1A1A2E', fontSize: 14, fontWeight: '700' }}>Open in Browser</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          // ── Detail info view ──
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* File icon card */}
            <View style={[s.infoCard]}>
              <View style={[s.fileIconBox, { backgroundColor: '#4ECDC420' }]}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#4ECDC4', letterSpacing: 0.5 }}>
                  {ext.toUpperCase().slice(0, 4)}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[s.docName]}>{name}</Text>
                <Text style={[s.docMeta]}>{ext.toUpperCase()} file</Text>
              </View>
            </View>

            {/* Metadata rows */}
            <View style={[s.metaCard]}>
              {[
                { label: 'Type',    value: ext.toUpperCase() },
                { label: 'Status',  value: doc.status ? doc.status.replace('_', ' ').toUpperCase() : 'DRAFT' },
                { label: 'Owner',   value: doc.created_by?.full_name || doc.created_by?.username || '—' },
                { label: 'Created', value: fmtDate(doc.created_at) },
                { label: 'Updated', value: fmtDate(doc.updated_at) },
                { label: 'Size',    value: doc.file_size ? fmtSize(doc.file_size) : '—' },
              ].filter(r => r.value && r.value !== '—').map(({ label, value }) => (
                <View key={label} style={[s.metaRow]}>
                  <Text style={s.metaLabel}>{label}</Text>
                  <Text style={s.metaValue} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Tags */}
            {(doc.tags || []).length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {doc.tags.map((tag, i) => (
                  <View key={i} style={[s.tagPill, { backgroundColor: (tag.color || '#4ECDC4') + '20' }]}>
                    <Text style={[s.tagPillText, { color: tag.color || '#4ECDC4' }]}>{tag.name || tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Open button */}
            {viewerUrl && (
              <TouchableOpacity
                style={[s.openBtn]}
                onPress={() => setShowViewer(true)}
              >
                <Text style={s.openBtnText}>⬡  Open Document</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[s.openBtnOutline]} onPress={openInBrowser}>
              <Text style={s.openBtnOutlineText}>🌐  Open in Browser</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Info panel slide-up (dev_1 style) ── */}
        {showInfo && (
          <View style={s.infoPanel}>
            <View style={s.infoPanelHandle} />
            <Text style={s.infoPanelTitle} numberOfLines={1}>{name}</Text>
            {[
              { label: 'Type',    value: ext.toUpperCase() },
              { label: 'Status',  value: (doc.status || 'draft').replace('_', ' ').toUpperCase() },
              { label: 'Owner',   value: doc.created_by?.full_name || doc.created_by?.username || '—' },
              { label: 'Created', value: fmtDate(doc.created_at) },
              { label: 'Updated', value: fmtDate(doc.updated_at) },
            ].map(({ label, value }) => (
              <View key={label} style={s.infoPanelRow}>
                <Text style={s.infoPanelLabel}>{label}</Text>
                <Text style={s.infoPanelValue} numberOfLines={1}>{value}</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => setShowInfo(false)} style={s.infoDoneBtn}>
              <Text style={{ color: '#4ECDC4', fontSize: 14, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Bottom action bar ── */}
      <SafeAreaView edges={['bottom']} style={s.bottomBar}>
        <ActionBtn icon="←" label="Back"    onPress={() => navigation.goBack()} />
        <ActionBtn icon="ⓘ" label="Info"    onPress={() => setShowInfo(v => !v)} active={showInfo} />
        {!showViewer
          ? <ActionBtn icon="⬡" label="View"    onPress={() => setShowViewer(true)} />
          : <ActionBtn icon="☰" label="Details" onPress={() => setShowViewer(false)} />
        }
        <ActionBtn icon="⬆" label="Browser" onPress={openInBrowser} />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // Nav bar
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: DK.bar, borderBottomWidth: 1, borderBottomColor: DK.border },
  navBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 15, fontWeight: '700', color: DK.ink, letterSpacing: -0.2, textAlign: 'center' },
  navSub: { fontSize: 11.5, color: DK.ink2, marginTop: 1, textAlign: 'center' },

  // Detail info
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12 },
  fileIconBox: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 15, fontWeight: '700', color: DK.ink, marginBottom: 4 },
  docMeta: { fontSize: 12, color: DK.ink2 },

  metaCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DK.border },
  metaLabel: { fontSize: 13, color: DK.ink2 },
  metaValue: { fontSize: 13, fontWeight: '600', color: DK.ink, flex: 1, textAlign: 'right' },

  tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagPillText: { fontSize: 11, fontWeight: '700' },

  openBtn: { backgroundColor: '#1A1A2E', borderRadius: 12, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  openBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  openBtnOutline: { borderRadius: 12, height: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: DK.border },
  openBtnOutlineText: { color: DK.ink2, fontSize: 13, fontWeight: '600' },

  // Info panel
  infoPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: DK.bar, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: DK.border, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 20 },
  infoPanelHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  infoPanelTitle: { fontSize: 15, fontWeight: '700', color: DK.ink, marginBottom: 14 },
  infoPanelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DK.border },
  infoPanelLabel: { fontSize: 13, color: DK.ink2 },
  infoPanelValue: { fontSize: 13, fontWeight: '600', color: DK.ink, flex: 1, textAlign: 'right' },
  infoDoneBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },

  // Bottom action bar
  bottomBar: { flexDirection: 'row', backgroundColor: DK.bar, borderTopWidth: 1, borderTopColor: DK.border, paddingTop: 12, paddingHorizontal: 12, justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center', gap: 5, minWidth: 60, paddingBottom: 8 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600', color: DK.ink2 },
});
