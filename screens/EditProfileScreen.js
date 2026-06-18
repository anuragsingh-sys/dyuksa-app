import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useContext, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken } from '../services/ApiService';
import { BASE_URL } from '../config';
import Svg, { Path, Polyline } from 'react-native-svg';

const ACCENT = '#3B72EE';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { user, updateUser } = useContext(AuthContext);
  const { theme }  = useContext(ThemeContext);
  const isDark = theme === 'Dark';

  const bg      = isDark ? '#0D0D0F' : '#F7F8FB';
  const card    = isDark ? '#1A1A20' : '#FFFFFF';
  const txt     = isDark ? '#FFFFFF' : '#0E1726';
  const sub     = isDark ? '#9898A6' : '#6B7588';
  const bdr     = isDark ? '#252530' : '#E6E9EF';
  const inputBg = isDark ? '#252538' : '#F5F6FA';

  const [firstName,  setFirstName]  = useState(user?.first_name || '');
  const [lastName,   setLastName]   = useState(user?.last_name  || '');
  const [username,   setUsername]   = useState(user?.username   || '');
  const [avatarUrl,  setAvatarUrl]  = useState(user?.avatarUrl || user?.avatar || null);
  const [loading,    setLoading]    = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState({});

  const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()
    || username?.[0]?.toUpperCase() || 'U';

  // ── Fetch /me/ + projects on focus ────────────────────────────────
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      const meRes = await fetch(`${BASE_URL}/auth/me/`, { headers });
      if (meRes.ok) {
        const me = await meRes.json();
        setFirstName(me.first_name || '');
        setLastName(me.last_name   || '');
        setUsername(me.username    || '');
        if (me.avatar) setAvatarUrl(me.avatar);
        await updateUser({
          first_name: me.first_name || '',
          last_name:  me.last_name  || '',
          email:      me.email      || '',
          role:       me.role       || 'member',
          username:   me.username   || '',
          avatarUrl:  me.avatar     || null,
          avatar:     me.avatar     || null,
        });
      }

    } catch (e) {
      console.warn('EditProfile fetch:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  // ── Avatar upload ──────────────────────────────────────────────────
  const changeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setUploading(true);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append('avatar', {
        uri: asset.uri, name: `avatar_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      const res = await fetch(`${BASE_URL}/auth/me/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const updated = await res.json();
      const newUrl  = updated.avatar || updated.avatar_url || null;
      if (newUrl) { setAvatarUrl(newUrl); await updateUser({ avatarUrl: newUrl }); }
      Alert.alert('Avatar updated', 'Your profile picture has been changed.');
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload avatar.');
    } finally {
      setUploading(false);
    }
  };

  // ── Save profile ───────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!firstName.trim()) e.firstName = 'First name is required.';
    if (!username.trim())  e.username  = 'Username is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
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
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36, justifyContent: 'center' }}>
          <Text style={{ color: txt, fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: txt }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={{ paddingHorizontal: 4 }}>
          {saving
            ? <ActivityIndicator size="small" color={ACCENT} />
            : <Text style={{ fontSize: 15, fontWeight: '600', color: ACCENT }}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={changeAvatar} disabled={uploading} activeOpacity={0.8} style={s.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
              ) : (
                <View style={[s.avatar, { backgroundColor: ACCENT }]}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={s.avatarEdit}>
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                }
              </View>
            </TouchableOpacity>
            <Text style={[s.avatarHint, { color: sub }]}>Tap to change photo</Text>
          </View>

          {/* Form */}
          <View style={[s.card, { backgroundColor: card, borderColor: bdr }]}>
            <Text style={[s.label, { color: sub }]}>First Name *</Text>
            <TextInput
              style={[s.input, { color: txt, backgroundColor: inputBg, borderColor: errors.firstName ? '#EF4444' : 'transparent' }]}
              value={firstName} onChangeText={t => { setFirstName(t); setErrors(e => ({ ...e, firstName: '' })); }}
              placeholder="First name" placeholderTextColor={sub}
            />
            {!!errors.firstName && <Text style={s.fieldError}>{errors.firstName}</Text>}

            <Text style={[s.label, { color: sub }]}>Last Name</Text>
            <TextInput
              style={[s.input, { color: txt, backgroundColor: inputBg, borderColor: 'transparent' }]}
              value={lastName} onChangeText={setLastName}
              placeholder="Last name" placeholderTextColor={sub}
            />

            <Text style={[s.label, { color: sub }]}>Username *</Text>
            <TextInput
              style={[s.input, { color: txt, backgroundColor: inputBg, borderColor: errors.username ? '#EF4444' : 'transparent' }]}
              value={username} onChangeText={t => { setUsername(t); setErrors(e => ({ ...e, username: '' })); }}
              placeholder="username" placeholderTextColor={sub} autoCapitalize="none"
            />
            {!!errors.username && <Text style={s.fieldError}>{errors.username}</Text>}

            <Text style={[s.label, { color: sub }]}>Email</Text>
            <View style={[s.input, { backgroundColor: isDark ? '#1E1E28' : '#F0F0F5', borderColor: 'transparent', justifyContent: 'center' }]}>
              <Text style={{ color: sub, fontSize: 14 }}>{user?.email || '—'}</Text>
            </View>
            <Text style={{ fontSize: 11, color: sub, marginTop: -10, marginBottom: 12 }}>Email cannot be changed here.</Text>

            <Text style={[s.label, { color: sub }]}>Role</Text>
            <View style={[s.input, { backgroundColor: isDark ? '#1E1E28' : '#F0F0F5', borderColor: 'transparent', justifyContent: 'center' }]}>
              <Text style={{ color: sub, fontSize: 14, textTransform: 'capitalize' }}>{user?.role || 'member'}</Text>
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: ACCENT, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave} disabled={saving} activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.saveBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>

          {/* Change Password */}
          <TouchableOpacity
            style={[s.changePwBtn, { backgroundColor: card, borderColor: bdr }]}
            onPress={() => navigation.navigate('ChangePassword')}
            activeOpacity={0.75}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z" stroke={sub} strokeWidth={2}/>
              <Path d="M7 11V7a5 5 0 0110 0v4" stroke={sub} strokeWidth={2} strokeLinecap="round"/>
            </Svg>
            <Text style={[s.changePwText, { color: txt }]}>Change Password</Text>
            <Text style={{ color: sub, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  avatarSection: { alignItems: 'center', marginVertical: 24, gap: 8 },
  avatarWrap:    { position: 'relative' },
  avatar:        { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
  avatarImage:   { width: 88, height: 88, borderRadius: 44 },
  avatarText:    { color: '#fff', fontSize: 32, fontWeight: '700' },
  avatarEdit:    { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarHint:    { fontSize: 12 },

  card:        { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14, overflow: 'hidden' },
  label:       { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  input:       { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 14, marginBottom: 14 },
  fieldError:  { fontSize: 11, color: '#EF4444', marginTop: -10, marginBottom: 10 },

  saveBtn:     { borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, paddingBottom: 12, marginBottom: 4, borderBottomWidth: 1 },
  sectionTitle:   { flex: 1, fontSize: 14, fontWeight: '700' },
  countBadge:     { minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  projectRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  projectDot:     { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  projectDotText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  projectName:    { flex: 1, fontSize: 14, fontWeight: '500' },

  emptySection: { alignItems: 'center', paddingVertical: 20 },

  changePwBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16 },
  changePwText: { flex: 1, fontSize: 15, fontWeight: '500' },
});
