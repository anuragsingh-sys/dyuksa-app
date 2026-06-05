import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { T } from '../constants/tokens';
import { TEAMMATES, PROJECTS } from '../constants/data';
import { Icons } from '../components/Icons';
import { NavBar, Card, SectionHeader, TextLink, Avatar, Progress } from '../components/SharedUI';

export default function CreateProjectScreen({ navigation }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(T.cBlue);
  const [privacy, setPrivacy] = useState('workspace');
  const colors = [T.cBlue, T.cGreen, T.cYellow, T.cPurple, T.cRed, '#FF6B6B', '#0EA5E9', '#10B981'];

  return (
    <View style={{ flex: 1, backgroundColor: T.surface }}>
      <NavBar title="New Project" onBack={() => navigation.goBack()}
        right={<TouchableOpacity onPress={() => navigation.navigate('Projects')}><Text style={{ color: T.brand, fontSize: 12, fontWeight: '650' }}>Save</Text></TouchableOpacity>} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        {/* Big icon */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color, fontSize: 40, fontWeight: '700' }}>{(name[0] || 'P').toUpperCase()}</Text>
            <View style={{ position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, backgroundColor: T.surface, borderRadius: 16, borderWidth: 2, borderColor: T.surface, shadowColor: '#0D172E', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
              {Icons.plus({ color: T.ink2, size: 16 })}
            </View>
          </View>
        </View>

        {/* Color swatches */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
          {colors.map(c => (
            <TouchableOpacity key={c} onPress={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: c === color ? 3 : 0, borderColor: '#fff', ...(c === color && { shadowColor: c, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 }) }} />
          ))}
        </View>

        {/* Project name */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 12, color: T.ink3, fontWeight: '600', marginBottom: 6 }}>Project name</Text>
          <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: T.hairline, justifyContent: 'center' }}>
            <TextInput value={name} onChangeText={setName} placeholder="Enter project name" placeholderTextColor={T.ink4} style={{ fontSize: 15, color: T.ink }} />
          </View>
        </View>

        {/* Description */}
        <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: T.hairline, marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: T.ink3, fontWeight: '600', marginBottom: 6 }}>Description</Text>
          <TextInput placeholder="What's this project about?" placeholderTextColor={T.ink4} multiline style={{ minHeight: 70, fontSize: 14, color: T.ink, lineHeight: 20, textAlignVertical: 'top' }} />
        </View>

        {/* Members */}
        <View style={{ marginTop: 4 }}>
          <SectionHeader right={<TextLink>+ Add</TextLink>}>Members</SectionHeader>
        </View>
        <Card style={{ padding: 12, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {TEAMMATES.slice(0, 4).map((m, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.surfaceCool, borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 10 }}>
                <Avatar name={m.name} size={20} color={m.color} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: T.ink2 }}>{m.name.split(' ')[0]}</Text>
              </View>
            ))}
            <TouchableOpacity style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: T.hairline, borderStyle: 'dashed' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: T.ink3 }}>+ Invite</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Privacy */}
        <SectionHeader>Privacy</SectionHeader>
        <Card style={{ padding: 0, marginBottom: 22 }}>
          {[
            { id: 'workspace', l: 'Workspace', d: 'Everyone in Dyuksa can see and join' },
            { id: 'private', l: 'Private', d: 'Only invited members have access' },
          ].map((p, i) => (
            <TouchableOpacity key={p.id} onPress={() => setPrivacy(p.id)} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: i < 1 ? 1 : 0, borderBottomColor: T.hairlineSoft }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: privacy === p.id ? T.brand : T.hairline, alignItems: 'center', justifyContent: 'center' }}>
                {privacy === p.id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.brand }} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '650', color: T.ink }}>{p.l}</Text>
                <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>{p.d}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        <TouchableOpacity onPress={() => navigation.navigate('Projects')} style={{ height: 52, borderRadius: 14, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', shadowColor: T.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 8 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '650' }}>Create Project</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
