import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [show,     setShow]     = useState({ current: false, next: false, confirm: false });
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});

  const validate = () => {
    const e = {};
    if (!current)          e.current = 'Current password is required.';
    if (!next)             e.next = 'New password is required.';
    else if (next.length < 8)             e.next = 'At least 8 characters.';
    else if (!/[A-Z]/.test(next))         e.next = 'At least 1 uppercase letter.';
    else if (!/\d/.test(next))            e.next = 'At least 1 number.';
    else if (!/[!@#$%^&*]/.test(next))    e.next = 'At least 1 special character.';
    if (next && confirm !== next)         e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    // MOCK — replace with real API: await fetch('/api/auth/change-password', { ... })
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    Alert.alert('✅ Password Changed', 'Your password has been updated successfully.', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  const Field = ({ label, field, value, onChange, placeholder }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: sub, fontSize: fs(12) }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: errors[field] ? '#EF4444' : bdr, backgroundColor: bg }]}>
        <TextInput
          style={[styles.input, { color: txt }]}
          value={value}
          onChangeText={t => { onChange(t); setErrors(e => ({ ...e, [field]: '' })); }}
          placeholder={placeholder}
          placeholderTextColor={sub}
          secureTextEntry={!show[field]}
        />
        <TouchableOpacity onPress={() => setShow(s => ({ ...s, [field]: !s[field] }))} style={{ padding: 4 }}>
          <Text style={{ fontSize: 16 }}>{show[field] ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
      {!!errors[field] && <Text style={styles.fieldError}>{errors[field]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: sub }}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt, fontSize: fs(17) }]}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: 16 }}>
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <Field label="Current Password"  field="current" value={current} onChange={setCurrent} placeholder="Your current password" />
          <Field label="New Password"       field="next"    value={next}    onChange={setNext}    placeholder="Min. 8 chars, uppercase, number, special" />
          <Field label="Confirm New Password" field="confirm" value={confirm} onChange={setConfirm} placeholder="Re-enter new password" />
        </View>

        <View style={[styles.infoBox, { borderColor: 'rgba(78,205,196,0.25)' }]}>
          <Text style={styles.infoText}>🔒  Your password is stored securely. After changing, you'll stay logged in.</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontWeight: '700' },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  label: { fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48 },
  input: { flex: 1, fontSize: 14 },
  fieldError: { fontSize: 11, color: '#EF4444', marginTop: 4 },
  infoBox: { backgroundColor: 'rgba(78,205,196,0.08)', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  infoText: { fontSize: 12, color: '#4ECDC4', lineHeight: 18 },
  saveBtn: { backgroundColor: '#1A1A2E', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
