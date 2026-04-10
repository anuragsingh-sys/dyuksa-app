import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export default function TeamManagementScreen() {
  const navigation = useNavigation();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg  = isDark ? '#0D0D0F' : '#F5F5F7';
  const txt = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub = isDark ? '#9898A6' : '#888899';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: sub }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: txt }]}>Team Management</Text>
      </View>
      <View style={styles.body}>
        <Text style={{ fontSize: 48, opacity: 0.3 }}>👥</Text>
        <Text style={[styles.comingSoon, { color: txt }]}>Coming Soon</Text>
        <Text style={[styles.desc, { color: sub }]}>
          Team management features will be available once the backend is connected.
          You'll be able to invite members, assign roles, and manage permissions.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 20, fontWeight: '700' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 14 },
  comingSoon: { fontSize: 22, fontWeight: '700' },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
