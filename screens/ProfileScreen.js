import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';

const MenuItem = ({ icon, label, value, onPress, danger }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Text style={styles.menuIcon}>{icon}</Text>
    <Text style={[styles.menuLabel, danger && { color: '#F87171' }]}>{label}</Text>
    {value ? <Text style={styles.menuValue}>{value}</Text> : <Text style={styles.menuArrow}>›</Text>}
  </TouchableOpacity>
);

export default function ProfileScreen({ navigation }) {
  const handleSignOut = () => {
    navigation?.getParent()?.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <Text style={styles.userName}>Anurag Singh</Text>
          <Text style={styles.userEmail}>anuragsingh@lensvox.com</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>Pro Plan</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Projects</Text>
          </View>
          <View style={[styles.statBox, styles.statBorder]}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Tasks</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Docs</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="👤" label="Edit Profile" />
            <MenuItem icon="🔔" label="Notifications" />
            <MenuItem icon="🔒" label="Change Password" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workspace</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="🌙" label="Theme" value="Light" />
            <MenuItem icon="🌐" label="Language" value="English" />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem icon="🚪" label="Sign Out" onPress={handleSignOut} danger />
          </View>
        </View>

        <Text style={styles.version}>DYUKSA v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },

  avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#4ECDC4', fontSize: 32, fontWeight: '800' },
  userName: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  userEmail: { fontSize: 13, color: '#888899', marginTop: 4 },
  planBadge: { marginTop: 10, backgroundColor: 'rgba(78,205,196,0.12)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  planText: { color: '#4ECDC4', fontSize: 12, fontWeight: '600' },

  statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EBEBF0' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#EBEBF0' },
  statNum: { fontSize: 22, fontWeight: '700', color: '#1A1A2E' },
  statLabel: { fontSize: 12, color: '#888899', marginTop: 2 },

  section: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 8, letterSpacing: 0.5 },
  menuCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EBEBF0', overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EBEBF0', gap: 12 },
  menuIcon: { fontSize: 18, width: 24 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1A1A2E' },
  menuValue: { fontSize: 13, color: '#888899' },
  menuArrow: { fontSize: 18, color: '#DEDEE8' },

  version: { textAlign: 'center', color: '#AAAABC', fontSize: 12, paddingVertical: 24 },
});
