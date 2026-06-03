import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';

const BASE_URL = 'http://192.168.1.164:8000/api/v1';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const { user, updateUser } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const [projects,     setProjects]     = useState([]);
  const [skills,       setSkills]       = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [avatarUrl,    setAvatarUrl]    = useState(user?.avatarUrl || null);
  const [profileData,  setProfileData]  = useState(null);

  // ── Fetch /me/ + projects ─────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const wsId  = await getWorkspaceId();

      const baseHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      };

      // GET /api/v1/auth/me/
      const meUrl = `${BASE_URL}/auth/me/`;
      console.log("🔍 Fetching:", meUrl);
      const meRes = await fetch(meUrl, { method: 'GET', headers: baseHeaders });
      console.log("📡 Status:", meRes.status);

      if (meRes.ok) {
        const me = await meRes.json();
        console.log("✅ ME DATA:", JSON.stringify(me).slice(0,300)); setProfileData(me);
        if (me.avatar)                setAvatarUrl(me.avatar);
        if (Array.isArray(me.skills)) setSkills(me.skills);
        // Sync AuthContext so sidebar/other screens see updated data
        await updateUser({
          name:      [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username || '',
          email:     me.email || '',
          role:      me.role  || 'Member',
          username:  me.username || '',
          avatarUrl: me.avatar || null,
          skills:    me.skills || [],
        });
      } else {
        const errBody = await meRes.text().catch(() => '');
        console.log("❌ FAILED status:", meRes.status); console.warn(`GET ${meUrl} → ${meRes.status}:`, errBody);
      }

      // GET /projects/ — workspace-scoped
      const projHeaders = { ...baseHeaders };
      if (wsId) projHeaders['X-Workspace-ID'] = wsId;
      const projRes = await fetch(`${BASE_URL}/projects/`, { method: 'GET', headers: projHeaders });
      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(Array.isArray(data) ? data : (data.results || []));
      }

    } catch (e) {
      console.warn('fetchProfile error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  // ── Avatar upload — PATCH /me/ with FormData ─────────────────
  const changeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setUploading(true);
    try {
      const token = await getAccessToken();

      const formData = new FormData();
      formData.append('avatar', {
        uri:  asset.uri,
        name: `avatar_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });

      // ✅ No Content-Type header — FormData sets multipart/form-data + boundary automatically
      const res = await fetch(`${BASE_URL}/auth/me/`, {
        method:  'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body:    formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `Upload failed (${res.status})`);
      }

      const updated = await res.json();
      const newUrl  = updated.avatar || updated.avatar_url || null;

      if (newUrl) {
        setAvatarUrl(newUrl);
        await updateUser({ avatarUrl: newUrl });
      }

      Alert.alert('✅ Avatar updated', 'Your profile picture has been changed.');
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload avatar. Try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Derived display values ────────────────────────────────────────
  const firstName  = profileData?.first_name || user?.name?.split(' ')[0] || '';
  const lastName   = profileData?.last_name  || user?.name?.split(' ')[1] || '';
  const userName   = [firstName, lastName].filter(Boolean).join(' ') || user?.name || 'User';
  const userEmail  = profileData?.email  || user?.email  || '';
  const userRole   = profileData?.role   || user?.role   || 'Member';
  const userInitial = userName[0]?.toUpperCase() || 'U';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0D0D0F' : '#fff'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: sub }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt, fontSize: fs(16) }]}>Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#4ECDC4" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

          {/* ── Profile Card ── */}
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
            <View style={styles.profileRow}>

              {/* Avatar */}
              <TouchableOpacity style={styles.avatarWrap} onPress={changeAvatar} disabled={uploading} activeOpacity={0.8}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: '#4ECDC4' }]}>
                    <Text style={styles.avatarText}>{userInitial}</Text>
                  </View>
                )}
                <View style={styles.avatarEdit}>
                  {uploading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ fontSize: 11, color: '#fff' }}>⬆</Text>
                  }
                </View>
              </TouchableOpacity>

              {/* Info */}
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: txt, fontSize: fs(18) }]}>{userName}</Text>

                <View style={styles.infoRow}>
                  <Text style={{ fontSize: 11, marginRight: 4 }}>🏷</Text>
                  <Text style={[styles.infoLabel, { color: sub, fontSize: fs(11) }]}>Designation</Text>
                </View>
                <Text style={[styles.infoValue, { color: txt, fontSize: fs(13) }]}>{userRole}</Text>

                <View style={[styles.infoRow, { marginTop: 8 }]}>
                  <Text style={{ fontSize: 11, marginRight: 4 }}>✉️</Text>
                  <Text style={[styles.infoLabel, { color: sub, fontSize: fs(11) }]}>Email</Text>
                </View>
                <Text style={[styles.infoValue, { color: txt, fontSize: fs(13) }]} numberOfLines={1}>{userEmail}</Text>
              </View>
            </View>

            {/* Reset Password */}
            <TouchableOpacity
              style={[styles.resetBtn, { borderColor: bdr, backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
              onPress={() => navigation.navigate('ChangePassword')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, marginRight: 6 }}>🔒</Text>
              <Text style={[styles.resetBtnText, { color: txt, fontSize: fs(13) }]}>Reset Password</Text>
            </TouchableOpacity>
          </View>

          {/* ── Enrolled Projects ── */}
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr, marginTop: 14 }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: bdr }]}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>📋</Text>
              <Text style={[styles.sectionTitle, { color: txt, fontSize: fs(15) }]}>Enrolled Projects</Text>
              <View style={[styles.countBadge, { backgroundColor: '#4ECDC4' }]}>
                <Text style={styles.countBadgeText}>{projects.length}</Text>
              </View>
            </View>
            {projects.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: sub }]}>No projects enrolled yet</Text>
              </View>
            ) : (
              projects.map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.projectRow, { borderBottomColor: bdr }, i === projects.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => { navigation.goBack(); setTimeout(() => { try { navigation.jumpTo('Projects'); } catch { navigation.navigate('Main', { screen: 'Projects' }); } }, 300); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.projectDot, { backgroundColor: p.color || '#4ECDC4' }]}>
                    <Text style={styles.projectDotText}>{(p.name || 'P')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.projectName, { color: txt, fontSize: fs(13) }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.projectArrow, { color: sub }]}>›</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* ── Skills ── */}
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr, marginTop: 14 }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: bdr }]}>
              <Text style={[styles.sectionTitle, { color: txt, fontSize: fs(15) }]}>Skills</Text>
              <TouchableOpacity
                style={[styles.editBtn, { borderColor: bdr }]}
                onPress={() => Alert.alert('Coming soon', 'Skill editing will be available once the API is connected.')}
              >
                <Text style={{ fontSize: 12, marginRight: 4 }}>✏️</Text>
                <Text style={[styles.editBtnText, { color: sub, fontSize: fs(12) }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            {skills.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: sub }]}>No skills added yet</Text>
              </View>
            ) : (
              <View style={styles.skillsWrap}>
                {skills.map((s, i) => (
                  <View key={i} style={[styles.skillPill, { backgroundColor: isDark ? '#252530' : '#EFF6FF', borderColor: isDark ? '#333340' : '#BFDBFE' }]}>
                    <Text style={[styles.skillText, { color: isDark ? '#93C5FD' : '#1D4ED8', fontSize: fs(12) }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Certificates ── */}
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr, marginTop: 14 }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: bdr }]}>
              <Text style={[styles.sectionTitle, { color: txt, fontSize: fs(15) }]}>Certificates</Text>
              <TouchableOpacity
                style={[styles.editBtn, { borderColor: bdr }]}
                onPress={() => Alert.alert('Coming soon', 'Certificate upload will be available once the API is connected.')}
              >
                <Text style={{ fontSize: 12, marginRight: 4 }}>⬆️</Text>
                <Text style={[styles.editBtnText, { color: sub, fontSize: fs(12) }]}>Upload</Text>
              </TouchableOpacity>
            </View>
            {certificates.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={{ fontSize: 32, opacity: 0.2, marginBottom: 8 }}>⬇️</Text>
                <Text style={[styles.emptySectionText, { color: sub }]}>No certificates uploaded yet</Text>
              </View>
            ) : (
              certificates.map((c, i) => (
                <View key={i} style={[styles.certRow, { borderBottomColor: bdr }, i === certificates.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>📜</Text>
                  <Text style={[{ flex: 1, color: txt, fontSize: fs(13) }]} numberOfLines={1}>{c.name}</Text>
                </View>
              ))
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { width: 60 },
  backText: { fontSize: 14, fontWeight: '500' },
  headerTitle: { fontWeight: '700', textAlign: 'center' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },

  profileRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 16 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { color: '#1A1A2E', fontSize: 32, fontWeight: '800' },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontWeight: '700', marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  infoLabel: { fontWeight: '500' },
  infoValue: { fontWeight: '600' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginBottom: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  resetBtnText: { fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  sectionTitle: { flex: 1, fontWeight: '700' },
  countBadge: { minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  countBadgeText: { color: '#1A1A2E', fontSize: 11, fontWeight: '800' },
  editBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  editBtnText: { fontWeight: '600' },

  projectRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  projectDot: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  projectDotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  projectName: { flex: 1, fontWeight: '500' },
  projectArrow: { fontSize: 18 },

  emptySection: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptySectionText: { fontSize: 13 },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, gap: 8 },
  skillPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  skillText: { fontWeight: '600' },

  certRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
});
