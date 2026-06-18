import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken } from '../services/ApiService';
import { BASE_URL } from '../config';
import Svg, { Path } from 'react-native-svg';

const ACCENT = '#3B72EE';

const EyeIcon = ({ visible, color }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    {visible ? (
      <>
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" stroke={color} strokeWidth={2}/>
      </>
    ) : (
      <>
        <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      </>
    )}
  </Svg>
);

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const isDark = theme === 'Dark';

  const bg      = isDark ? '#0D0D0F' : '#F7F8FB';
  const card    = isDark ? '#1A1A20' : '#FFFFFF';
  const txt     = isDark ? '#FFFFFF' : '#0E1726';
  const sub     = isDark ? '#9898A6' : '#6B7588';
  const bdr     = isDark ? '#252530' : '#E6E9EF';
  const inputBg = isDark ? '#252538' : '#F5F6FA';

  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [show,    setShow]    = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const validate = () => {
    const e = {};
    if (!current)                       e.current = 'Current password is required.';
    if (!next)                          e.next    = 'New password is required.';
    else if (next.length < 8)           e.next    = 'At least 8 characters.';
    else if (!/[A-Z]/.test(next))       e.next    = 'Include at least 1 uppercase letter.';
    else if (!/\d/.test(next))          e.next    = 'Include at least 1 number.';
    else if (!/[!@#$%^&*]/.test(next))  e.next    = 'Include at least 1 special character.';
    if (next && confirm !== next)        e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/auth/change-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ old_password: current, new_password: next, confirm_password: confirm }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.old_password?.[0] || data.new_password?.[0] || 'Failed to change password.');
      }
      Alert.alert('Password Changed', 'Your password has been updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not change password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, field, value, onChange, placeholder }) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: sub }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: errors[field] ? '#EF4444' : 'transparent' }]}>
        <TextInput
          style={[styles.input, { color: txt }]}
          value={value}
          onChangeText={t => { onChange(t); setErrors(e => ({ ...e, [field]: '' })); }}
          placeholder={placeholder}
          placeholderTextColor={sub}
          secureTextEntry={!show[field]}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShow(s => ({ ...s, [field]: !s[field] }))} style={{ padding: 4 }}>
          <EyeIcon visible={show[field]} color={sub} />
        </TouchableOpacity>
      </View>
      {!!errors[field] && <Text style={styles.fieldError}>{errors[field]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36, justifyContent: 'center' }}>
          <Text style={{ color: txt, fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt }]}>Change Password</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Form card */}
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <Field label="Current Password"     field="current" value={current} onChange={setCurrent} placeholder="Enter current password" />
          <Field label="New Password"          field="next"    value={next}    onChange={setNext}    placeholder="Min. 8 chars, uppercase, number, special" />
          <Field label="Confirm New Password"  field="confirm" value={confirm} onChange={setConfirm} placeholder="Re-enter new password" />
        </View>

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '30' }]}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginTop: 1 }}>
            <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
          <Text style={[styles.infoText, { color: ACCENT }]}>Your password is stored securely. After changing, you'll stay logged in.</Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: ACCENT, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Update Password</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  card:        { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  label:       { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48 },
  input:       { flex: 1, fontSize: 14 },
  fieldError:  { fontSize: 11, color: '#EF4444', marginTop: 4 },

  infoBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  infoText:    { flex: 1, fontSize: 12, lineHeight: 18 },

  saveBtn:     { borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
