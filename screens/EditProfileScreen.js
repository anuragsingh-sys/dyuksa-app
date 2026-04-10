import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { user, updateUser } = useContext(AuthContext);
  const { theme, fontScale }  = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const [name,    setName]    = useState(user?.name  || '');
  const [role,    setRole]    = useState(user?.role  || '');
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim())         e.name = 'Name is required.';
    else if (name.length < 2) e.name = 'Name must be at least 2 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    await updateUser({
      name:   name.trim(),
      role:   role.trim(),
      avatar: name.trim()[0].toUpperCase(),
    });
    setLoading(false);
    Alert.alert('✅ Saved', 'Your profile has been updated.', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[{ fontSize: 14, fontWeight: '500' }, { color: sub }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt, fontSize: fs(17) }]}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: 16 }}>
        {/* Avatar preview */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]?.toUpperCase() || user?.avatar || 'U'}</Text>
          </View>
          <Text style={[styles.avatarHint, { color: sub, fontSize: fs(12) }]}>
            Avatar uses your name initial
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
          <Text style={[styles.label, { color: sub, fontSize: fs(12) }]}>Full Name *</Text>
          <TextInput
            style={[styles.input, { color: txt, borderColor: errors.name ? '#EF4444' : bdr, backgroundColor: bg }]}
            value={name}
            onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: '' })); }}
            placeholder="Your full name"
            placeholderTextColor={sub}
          />
          {!!errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}

          <Text style={[styles.label, { color: sub, fontSize: fs(12) }]}>Role</Text>
          <TextInput
            style={[styles.input, { color: txt, borderColor: bdr, backgroundColor: bg }]}
            value={role}
            onChangeText={setRole}
            placeholder="e.g. Manager, Developer..."
            placeholderTextColor={sub}
          />

          <Text style={[styles.label, { color: sub, fontSize: fs(12) }]}>Email</Text>
          <View style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr, justifyContent: 'center' }]}>
            <Text style={{ color: sub, fontSize: 14 }}>{user?.email}</Text>
          </View>
          <Text style={[{ fontSize: fs(11), color: sub, marginBottom: 8 }]}>Email cannot be changed here.</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontWeight: '700' },
  avatarSection: { alignItems: 'center', marginVertical: 20, gap: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#4ECDC4', fontSize: 28, fontWeight: '800' },
  avatarHint: { fontWeight: '400' },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  label: { fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 14, marginBottom: 14 },
  fieldError: { fontSize: 11, color: '#EF4444', marginTop: -10, marginBottom: 10 },
  saveBtn: { backgroundColor: '#1A1A2E', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
