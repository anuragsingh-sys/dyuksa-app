import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';

const DOC_TYPES = { 'Doc': '#4ECDC4', 'Report': '#FBBF24', 'Note': '#A78BFA' };

export default function DocumentsScreen() {
  const navigation = useNavigation();
  const [docs, setDocs] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('Doc');

  const addDoc = () => {
    if (!docName.trim()) return;
    setDocs([{ id: Date.now().toString(), name: docName.trim(), type: docType, date: new Date().toLocaleDateString() }, ...docs]);
    setDocName(''); setDocType('Doc'); setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <TouchableOpacity style={styles.logoBox} onPress={() => navigation.navigate('Dashboard')} activeOpacity={0.75}>
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={styles.brandName}>Documents</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn}><Text style={styles.navIcon}>💬</Text></TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn}><Text style={styles.navIcon}>🔔</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.subHeader}>
        <View>
          <Text style={styles.headerTitle}>Documents</Text>
          <Text style={styles.headerSub}>{docs.length} document{docs.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.createBtnText}>+ New Doc</Text>
        </TouchableOpacity>
      </View>
      {docs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📄</Text>
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptySubtitle}>Create your first document</Text>
        </View>
      ) : (
        <FlatList data={docs} keyExtractor={i => i.id} contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card}>
              <View style={[styles.docIcon, { backgroundColor: DOC_TYPES[item.type] + '20' }]}>
                <Text style={styles.docIconText}>📄</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docName}>{item.name}</Text>
                <Text style={styles.docMeta}>{item.date}</Text>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: DOC_TYPES[item.type] + '20' }]}>
                <Text style={[styles.typeText, { color: DOC_TYPES[item.type] }]}>{item.type}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Document</Text>
            <TextInput placeholder="Document name..." placeholderTextColor="#5C5C6E" style={styles.modalInput} value={docName} onChangeText={setDocName} autoFocus />
            <Text style={styles.modalLabel}>Type</Text>
            <View style={styles.typeRow}>
              {Object.keys(DOC_TYPES).map(t => (
                <TouchableOpacity key={t} style={[styles.typeOption, docType === t && { backgroundColor: '#1A1A2E' }]} onPress={() => setDocType(t)}>
                  <Text style={[styles.typeOptionText, docType === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={addDoc}>
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', elevation: 2 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  navIconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  navIcon: { fontSize: 16 },
  subHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  headerSub: { fontSize: 12, color: '#888899', marginTop: 2 },
  createBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  list: { padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EBEBF0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  docIconText: { fontSize: 18 },
  docName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  docMeta: { fontSize: 12, color: '#888899', marginTop: 2 },
  typeBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 48, opacity: 0.3 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  emptySubtitle: { fontSize: 13, color: '#888899' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '500', color: '#888899', marginBottom: 8 },
  modalInput: { backgroundColor: '#F0F0F5', borderRadius: 10, paddingHorizontal: 14, height: 50, fontSize: 15, color: '#1A1A2E', marginBottom: 16, borderWidth: 1.5, borderColor: '#4ECDC4' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBF0' },
  typeOptionText: { fontSize: 13, color: '#888899', fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EBEBF0', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#888899', fontSize: 14, fontWeight: '500' },
});
