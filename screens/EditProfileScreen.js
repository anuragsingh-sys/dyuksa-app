import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import Svg, { Path } from 'react-native-svg';

const ACCENT = '#3B72EE';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { user, updateUser } = useContext(AuthContext);
  const { theme }  = useContext(ThemeContext);
  const isDark = theme === 'Dark';

  const bg   = isDark ? '#0D0D0F' : '#F7F8FB';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#0E1726';
  const sub  = isDark ? '#9898A6' : '#6B7588';
  const bdr  = isDark ? '#252530' : '#E6E9EF';
  const inputBg = isDark ? '#252538' : '#F5F6FA';

  const fullName = user ? (`${user.first_name || ''} ${user.last_name || ''}`).trim() || user.username || '' : '';

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName,  setLastName]  = useState(user?.last_name  || '');
  const [username,  setUsername]  = useState(user?.username   || '');
  const [loading,   setLoading]   = useState(false);
  const [errors,    setErrors]    = useState({});

  const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || username?.[0]?.toUpperCase() || 'U';

  const validate = () => {
    const e = {};
    if (!firstName.trim()) e.firstName = 'First name is required.';
    if (!username.trim())  e.username  = 'Username is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await updateUser({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        username:   username.trim(),
      });
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: txt, fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={{ paddingHorizontal: 4 }}>
          {loading
            ? <ActivityIndicator size="small" color={ACCENT} />
            : <Text style={{ fontSize: 15, fontWeight: '600', color: ACCENT }}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: ACCENT }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={[styles.avatarHint, { color: sub }]}>Avatar uses your name initials</Text>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>

          {/* First name */}
          <Text style={[styles.label, { color: sub }]}>First Name *</Text>
          <TextInput
            style={[styles.input, { color: txt, backgroundColor: inputBg, borderColor: errors.firstName ? '#EF4444' : 'transparent' }]}
            value={firstName}
            onChangeText={t => { setFirstName(t); setErrors(e => ({ ...e, firstName: '' })); }}
            placeholder="First name"
            placeholderTextColor={sub}
          />
          {!!errors.firstName && <Text style={styles.fieldError}>{errors.firstName}</Text>}

          {/* Last name */}
          <Text style={[styles.label, { color: sub }]}>Last Name</Text>
          <TextInput
            style={[styles.input, { color: txt, backgroundColor: inputBg, borderColor: 'transparent' }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={sub}
          />

          {/* Username */}
          <Text style={[styles.label, { color: sub }]}>Username *</Text>
          <TextInput
            style={[styles.input, { color: txt, backgroundColor: inputBg, borderColor: errors.username ? '#EF4444' : 'transparent' }]}
            value={username}
            onChangeText={t => { setUsername(t); setErrors(e => ({ ...e, username: '' })); }}
            placeholder="username"
            placeholderTextColor={sub}
            autoCapitalize="none"
          />
          {!!errors.username && <Text style={styles.fieldError}>{errors.username}</Text>}

          {/* Email — read only */}
          <Text style={[styles.label, { color: sub }]}>Email</Text>
          <View style={[styles.input, { backgroundColor: isDark ? '#1E1E28' : '#F0F0F5', borderColor: 'transparent', justifyContent: 'center' }]}>
            <Text style={{ color: sub, fontSize: 14 }}>{user?.email || '—'}</Text>
          </View>
          <Text style={{ fontSize: 11, color: sub, marginTop: -8, marginBottom: 4 }}>Email cannot be changed here.</Text>

          {/* Role — read only */}
          <Text style={[styles.label, { color: sub, marginTop: 8 }]}>Role</Text>
          <View style={[styles.input, { backgroundColor: isDark ? '#1E1E28' : '#F0F0F5', borderColor: 'transparent', justifyContent: 'center' }]}>
            <Text style={{ color: sub, fontSize: 14, textTransform: 'capitalize' }}>{user?.role || 'member'}</Text>
          </View>
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
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn:      { width: 36, height: 36, justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700' },

  avatarSection:{ alignItems: 'center', marginVertical: 24, gap: 8 },
  avatar:       { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { color: '#fff', fontSize: 30, fontWeight: '700' },
  avatarHint:   { fontSize: 12 },

  card:         { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  label:        { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  input:        { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 14, marginBottom: 14 },
  fieldError:   { fontSize: 11, color: '#EF4444', marginTop: -10, marginBottom: 10 },

  saveBtn:      { borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
});
