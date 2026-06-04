import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/tokens';
import { USER } from '../constants/data';
import { Icons } from '../components/Icons';
import { Avatar } from '../components/SharedUI';

const NAV_ITEMS = [
  { id: 'Dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'Projects', label: 'Projects', icon: 'folder' },
  { id: 'Documents', label: 'Documents', icon: 'doc' },
  { id: 'Tasks', label: 'Tasks', icon: 'task' },
  { id: 'Calendar', label: 'Calendar', icon: 'cal' },
  { id: 'MyWork', label: 'My Work', icon: 'work' },
  { id: 'Reports', label: 'Reports', icon: 'chart' },
  { id: 'Team', label: 'Team', icon: 'team' },
  { id: 'Settings', label: 'Settings', icon: 'settings' },
];

const MY_VIEWS = [
  { label: 'My Tasks', color: T.cBlue },
  { label: 'Tasks Assigned to Me', color: T.cPurple },
  { label: 'Overdue Tasks', color: T.cRed },
  { label: 'Completed Tasks', color: T.cGreen },
];

export default function DrawerContent({ navigation, state }) {
  const insets = useSafeAreaInsets();
  const activeRoute = state?.routes?.[state.index]?.name || 'Dashboard';

  const handleNav = (id) => {
    navigation.navigate(id);
    navigation.closeDrawer();
  };

  const handleLogout = () => {
    navigation.closeDrawer();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.surface }}>
      <View style={{ height: insets.top + 10 }} />

      {/* Header */}
      <View style={{ padding: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {Icons.logo({ size: 32 })}
        <Text style={{ fontSize: 22, fontWeight: '700', color: T.ink, letterSpacing: -0.3 }}>Dyuksa</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => navigation.closeDrawer()} style={styles.iconBtn}>
          {Icons.close({ color: T.ink2, size: 20 })}
        </TouchableOpacity>
      </View>

      {/* User card */}
      <TouchableOpacity onPress={() => handleNav('Settings')} style={{ marginHorizontal: 14, marginBottom: 14, padding: 10, paddingHorizontal: 12, backgroundColor: T.brandSoft, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={USER.name} size={40} color={T.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '650', color: T.ink }}>{USER.name}</Text>
          <Text style={{ fontSize: 11.5, color: T.brand, fontWeight: '600' }}>{USER.role}</Text>
        </View>
        {Icons.chevR({ color: T.brand, size: 18 })}
      </TouchableOpacity>

      <ScrollView style={{ flex: 1, paddingHorizontal: 10 }}>
        {NAV_ITEMS.map(it => {
          const isActive = activeRoute === it.id;
          const IconFn = Icons[it.icon];
          return (
            <TouchableOpacity key={it.id} onPress={() => handleNav(it.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: isActive ? T.brandSoft : 'transparent', marginBottom: 2 }}>
              {IconFn({ color: isActive ? T.brand : T.ink2, size: 20 })}
              <Text style={{ fontSize: 15, fontWeight: isActive ? '650' : '500', color: isActive ? T.brand : T.ink2 }}>{it.label}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 1, backgroundColor: T.hairline, marginVertical: 14, marginHorizontal: 8 }} />

        <Text style={{ paddingHorizontal: 12, paddingBottom: 6, fontSize: 11, color: T.ink4, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' }}>My Views</Text>
        {MY_VIEWS.map((v, i) => (
          <TouchableOpacity key={v.label} onPress={() => handleNav('Tasks')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v.color }} />
            <Text style={{ fontSize: 14, color: T.ink2 }}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity onPress={handleLogout} style={{ margin: 14, marginBottom: insets.bottom + 18, padding: 12, paddingHorizontal: 14, backgroundColor: T.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: T.hairline, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {Icons.logout({ color: T.ink2, size: 18 })}
        <Text style={{ fontSize: 14, fontWeight: '600', color: T.ink2 }}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
