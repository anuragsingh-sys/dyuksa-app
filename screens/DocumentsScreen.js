import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NavBar from '../components/NavBar';
import { ThemeContext } from '../context/ThemeContext';

const DOC_TYPES = { Doc: '#4ECDC4', Report: '#FBBF24', Note: '#A78BFA' };

export default function DocumentsScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub = isDark ? '#9898A6' : '#888899';
  const bdr = isDark ? '#252530' : '#EBEBF0';
  const fs = s => s * fontScale;

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
    <SafeAreaView style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <NavBar title="Documents" activeScreen="Docs" />
      <View style={[styles.subHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View>
          <Text style={[styles.pageTitle, { color: txt, fontSize: fs(18) }]}>Documents</Text>
          <Text style={[{ fontSize: fs(12), color: sub, marginTop: 2 }]}>{docs.length} document{docs.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.newBtnText}>+ New Doc</Text>
        </TouchableOpacity>
      </View>
      {docs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, opacity: 0.3 }}>📄</Text>
          <Text style={[styles.emptyTitle, { color: txt, fontSize: fs(16) }]}>No documents yet</Text>
          <Text style={[{ fontSize: fs(13), color: sub }]}>Create your first document</Text>
        </View>
      ) : (
        <FlatList data={docs} keyExtractor={i => i.id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
              <View style={[styles.docIcon, { backgroundColor: DOC_TYPES[item.type] + '20' }]}>
                <Text style={{ fontSize: 18 }}>📄</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.docName, { color: txt, fontSize: fs(14) }]}>{item.name}</Text>
                <Text style={[{ fontSize: fs(12), color: sub, marginTop: 2 }]}>{item.date}</Text>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: DOC_TYPES[item.type] + '20' }]}>
                <Text style={[styles.typeText, { color: DOC_TYPES[item.type], fontSize: fs(11) }]}>{item.type}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: card }]}>
            <Text style={[styles.modalTitle, { color: txt, fontSize: fs(18) }]}>New Document</Text>
            <TextInput placeholder="Document name..." placeholderTextColor="#5C5C6E" style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F0F0F5', color: txt, borderColor: '#4ECDC4' }]} value={docName} onChangeText={setDocName} autoFocus />
            <Text style={[{ fontSize: fs(13), fontWeight: '500', color: sub, marginBottom: 8 }]}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {Object.keys(DOC_TYPES).map(t => (
                <TouchableOpacity key={t} style={[styles.typeChip, { borderColor: bdr }, docType === t && { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' }]} onPress={() => setDocType(t)}>
                  <Text style={[{ fontSize: fs(13), fontWeight: '500' }, docType === t ? { color: '#fff' } : { color: sub }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: bdr }]} onPress={() => setModalVisible(false)}>
                <Text style={{ color: sub, fontSize: fs(14), fontWeight: '500' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.newBtn} onPress={addDoc}>
                <Text style={styles.newBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  subHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontWeight: '700' },
  newBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  docName: { fontWeight: '600' },
  typeBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  typeText: { fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontWeight: '700', marginBottom: 16 },
  input: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, height: 50, fontSize: 15, marginBottom: 16 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
});
