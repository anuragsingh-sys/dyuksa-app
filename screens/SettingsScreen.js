import React, { useContext } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NavBar from '../components/NavBar';
import { ThemeContext } from '../context/ThemeContext';

const SegmentControl = ({ options, value, onChange, isDark }) => (
  <View style={[styles.segment, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}>
    {options.map(opt => (
      <TouchableOpacity
        key={opt}
        style={[styles.segmentBtn, value === opt && styles.segmentBtnActive]}
        onPress={() => onChange(opt)}
      >
        <Text style={[styles.segmentText, value === opt && styles.segmentTextActive]}>{opt}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { theme, setTheme, fontSize, setFontSize, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';

  const [dataMode,       setDataMode]       = React.useState('Local');
  const [projectView,    setProjectView]    = React.useState('Grid');
  const [collapseSidebar,setCollapseSidebar]= React.useState(false);
  const [desktopNotif,   setDesktopNotif]   = React.useState(true);
  const [emailNotif,     setEmailNotif]     = React.useState(false);
  const [chatMention,    setChatMention]    = React.useState(true);
  const [taskAssign,     setTaskAssign]     = React.useState(true);
  const [notifSound,     setNotifSound]     = React.useState(true);
  const [sessionAlerts,  setSessionAlerts]  = React.useState(true);

  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = (s) => s * fontScale;

  const SectionHeader = ({ title }) => (
    <Text style={[styles.sectionHeader, { color: sub, fontSize: fs(12) }]}>{title}</Text>
  );

  const SettingRow = ({ icon, label, subtitle, right }) => (
    <View style={[styles.settingRow, { borderBottomColor: bdr }]}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingLabel, { color: txt, fontSize: fs(14) }]}>{label}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: sub, fontSize: fs(11) }]}>{subtitle}</Text>}
        </View>
      </View>
      {right}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <NavBar title="Settings" activeScreen="Settings" />

      <View style={[styles.pageHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <Text style={[styles.pageTitle, { color: txt, fontSize: fs(18) }]}>⚙️  Settings</Text>
        <Text style={[styles.pageSubtitle, { color: sub, fontSize: fs(12) }]}>
          Manage your preferences and account configuration
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: bg }}>
        <View style={{ paddingHorizontal: 12 }}>

          {/* CONFIGURATION */}
          <SectionHeader title="Configuration" />
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
            <SettingRow icon="💾" label="Data Mode" subtitle="Where your data is stored and synced"
              right={<SegmentControl options={['Local','Cloud']} value={dataMode} onChange={setDataMode} isDark={isDark} />}
            />
            <SettingRow icon="⊞" label="Default Project View" subtitle="How projects are displayed"
              right={<SegmentControl options={['Grid','Table']} value={projectView} onChange={setProjectView} isDark={isDark} />}
            />
            <SettingRow icon="☰" label="Collapsed Sidebar by Default" subtitle="Start with sidebar minimized"
              right={<Switch value={collapseSidebar} onValueChange={setCollapseSidebar} trackColor={{ false: bdr, true: '#1A1A2E' }} thumbColor="#fff" />}
            />
          </View>

          {/* APPEARANCE — theme and font actually work globally */}
          <SectionHeader title="Appearance" />
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>

            <SettingRow icon="🎨" label="Theme" subtitle="Currently: Light applies white backgrounds, Dark applies dark backgrounds everywhere"
              right={<SegmentControl options={['Light','Dark']} value={theme} onChange={setTheme} isDark={isDark} />}
            />

            <SettingRow icon="T" label="Font Size" subtitle="Applies to all text in the app"
              right={<SegmentControl options={['Small','Medium','Large']} value={fontSize} onChange={setFontSize} isDark={isDark} />}
            />

            <SettingRow icon="☰" label="Collapsed Sidebar" subtitle="Start with sidebar minimized on load"
              right={<Switch value={collapseSidebar} onValueChange={setCollapseSidebar} trackColor={{ false: bdr, true: '#1A1A2E' }} thumbColor="#fff" />}
            />
          </View>

          {/* NOTIFICATIONS */}
          <SectionHeader title="Notifications" />
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
            {[
              { icon: '🖥', label: 'Desktop Notifications',  sub: 'Push alerts in your browser',                   val: desktopNotif, set: setDesktopNotif },
              { icon: '✉️', label: 'Email Notifications',    sub: 'Receive updates to your inbox',                  val: emailNotif,   set: setEmailNotif },
              { icon: '💬', label: 'Chat Mention Alerts',    sub: 'Notify when someone @mentions you in chat',      val: chatMention,  set: setChatMention },
              { icon: '📋', label: 'Task Assignment Alerts', sub: 'Notify when a task is assigned to you',          val: taskAssign,   set: setTaskAssign },
              { icon: '🔊', label: 'Notification Sound',     sub: 'Play a sound for incoming notifications',        val: notifSound,   set: setNotifSound },
            ].map(item => (
              <SettingRow
                key={item.label}
                icon={item.icon} label={item.label} subtitle={item.sub}
                right={<Switch value={item.val} onValueChange={item.set} trackColor={{ false: bdr, true: '#1A1A2E' }} thumbColor="#fff" />}
              />
            ))}
          </View>

          {/* SECURITY */}
          <SectionHeader title="Security" />
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
            <SettingRow icon="⏱" label="Auto-logout Timeout" subtitle="Sign out automatically after inactivity"
              right={<View style={[styles.dropdownBox, { backgroundColor: isDark ? '#252530' : '#F5F5F7', borderColor: bdr }]}>
                <Text style={[styles.dropdownText, { color: txt }]}>30 min</Text>
                <Text style={{ color: sub, fontSize: 10 }}>▾</Text>
              </View>}
            />
            <SettingRow icon="🔔" label="Active Session Alerts" subtitle="Get notified when a new device logs in"
              right={<Switch value={sessionAlerts} onValueChange={setSessionAlerts} trackColor={{ false: bdr, true: '#1A1A2E' }} thumbColor="#fff" />}
            />
          </View>

          {/* ACCOUNT */}
          <SectionHeader title="Account" />
          <View style={[styles.card, { backgroundColor: card, borderColor: bdr }]}>
            {[
              { icon: '👤', label: 'Edit Profile',     sub: 'Update your name and avatar' },
              { icon: '🔒', label: 'Change Password',  sub: 'Update your account password' },
            ].map(item => (
              <TouchableOpacity key={item.label} style={[styles.settingRow, { borderBottomColor: bdr }]}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: txt, fontSize: fs(14) }]}>{item.label}</Text>
                    <Text style={[styles.settingSubtitle, { color: sub, fontSize: fs(11) }]}>{item.sub}</Text>
                  </View>
                </View>
                <Text style={[styles.chevron, { color: bdr }]}>›</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: 'transparent' }]}
              onPress={() => navigation.navigate('Login')}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>🚪</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: '#F87171', fontSize: fs(14) }]}>Logout</Text>
                  <Text style={[styles.settingSubtitle, { color: sub, fontSize: fs(11) }]}>Sign out of your account</Text>
                </View>
              </View>
              <Text style={[styles.chevron, { color: bdr }]}>›</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.version, { color: sub, fontSize: fs(12) }]}>DYUKSA v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pageHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  pageTitle: { fontWeight: '700' },
  pageSubtitle: { marginTop: 2 },
  sectionHeader: { fontWeight: '700', marginTop: 20, marginBottom: 8, letterSpacing: 0.5, paddingHorizontal: 4 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 4, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  settingLabel: { fontWeight: '500' },
  settingSubtitle: { marginTop: 2 },
  chevron: { fontSize: 20, marginLeft: 8 },
  segment: { flexDirection: 'row', borderRadius: 8, padding: 3 },
  segmentBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  segmentBtnActive: { backgroundColor: '#1A1A2E' },
  segmentText: { fontSize: 12, color: '#888899', fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  dropdownBox: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  dropdownText: { fontSize: 12, fontWeight: '500' },
  version: { textAlign: 'center', paddingVertical: 24 },
});
