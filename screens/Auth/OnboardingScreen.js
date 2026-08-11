import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  FlatList, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle, Polyline } from 'react-native-svg';

export const ONBOARDING_KEY = 'dyuksa_onboarding_done';

const { width: W, height: H } = Dimensions.get('window');
const ACCENT = '#3B72EE';

// ── Slide illustrations ───────────────────────────────────────────────────────
function ProjectsIllustration() {
  const cards = [
    { letter: 'A', name: 'Alpha Project', tasks: '45 tasks', color: '#8B5CF6', bg: '#F5F3FF', progress: 0.75 },
    { letter: 'B', name: 'Beta Project',  tasks: '32 tasks', color: ACCENT,    bg: '#EEF3FF', progress: 0.50 },
    { letter: 'G', name: 'Gamma Project', tasks: '16 tasks', color: '#22C55E', bg: '#F0FDF4', progress: 0.85, showBar: true },
  ];
  return (
    <View style={ill.wrap}>
      {cards.map((card, i) => (
        <View key={i} style={[ill.card, { top: i * 40, left: i * 10, zIndex: 3 - i, shadowOpacity: 0.06 + i * 0.02 }]}>
          <View style={[ill.avatar, { backgroundColor: card.bg }]}>
            <Text style={[ill.avatarTxt, { color: card.color }]}>{card.letter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ill.cardName}>{card.name}</Text>
            <Text style={ill.cardSub}>{card.tasks}</Text>
            {card.showBar && (
              <View style={ill.barTrack}>
                <View style={[ill.barFill, { width: `${card.progress * 100}%`, backgroundColor: card.color }]} />
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function TasksIllustration() {
  const tasks = [
    { label: 'Design review',     status: 'In Progress', color: ACCENT,    dot: ACCENT },
    { label: 'API integration',   status: 'Pending',     color: '#F59E0B', dot: '#F59E0B' },
    { label: 'Write tests',       status: 'Completed',   color: '#22C55E', dot: '#22C55E' },
    { label: 'Deploy to staging', status: 'Overdue',     color: '#EF4444', dot: '#EF4444' },
  ];
  return (
    <View style={ill.wrap}>
      <View style={[ill.taskCard, { top: 0 }]}>
        {tasks.map((t, i) => (
          <View key={i} style={[ill.taskRow, i < tasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F0F2F6' }]}>
            <View style={[ill.taskDot, { backgroundColor: t.dot }]} />
            <Text style={ill.taskLabel} numberOfLines={1}>{t.label}</Text>
            <View style={[ill.taskPill, { backgroundColor: t.color + '18' }]}>
              <Text style={[ill.taskPillTxt, { color: t.color }]}>{t.status}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function TeamIllustration() {
  const members = [
    { letter: 'HS', color: ACCENT },
    { letter: 'AV', color: '#22C55E' },
    { letter: 'KM', color: '#F59E0B' },
    { letter: 'SG', color: '#8B5CF6' },
    { letter: 'RV', color: '#EF4444' },
  ];
  return (
    <View style={ill.wrap}>
      <View style={[ill.teamCard, { top: 0 }]}>
        <Text style={ill.teamTitle}>Your Team</Text>
        <Text style={ill.teamSub}>5 members active</Text>
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
          {members.map((m, i) => (
            <View key={i} style={[ill.teamAvatar, { backgroundColor: m.color }]}>
              <Text style={ill.teamAvatarTxt}>{m.letter}</Text>
            </View>
          ))}
        </View>
        <View style={[ill.teamProgressWrap]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={ill.teamProgressLabel}>Sprint progress</Text>
              <Text style={[ill.teamProgressLabel, { color: ACCENT }]}>68%</Text>
            </View>
            <View style={ill.barTrack}>
              <View style={[ill.barFill, { width: '68%', backgroundColor: ACCENT }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Slides data ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    tag:       'PROJECTS',
    title:     'All your projects,\none tap away.',
    subtitle:  'Track Alpha, Beta, Gamma and beyond — progress, tasks and team in a single feed.',
    Illustration: ProjectsIllustration,
  },
  {
    tag:       'TASKS',
    title:     'Stay on top of\nevery task.',
    subtitle:  'Upcoming, overdue or completed — filter and find any task instantly across all projects.',
    Illustration: TasksIllustration,
  },
  {
    tag:       'TEAM',
    title:     'Collaborate with\nyour team.',
    subtitle:  'Assign tasks, track progress and communicate with your whole team in one place.',
    Illustration: TeamIllustration,
  },
];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation, onDone }) {
  const insets  = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const flatRef = useRef(null);

  const finish = () => {
    if (onDone) { onDone(); return; }
    navigation?.replace('Login');
  };

  const goNext = () => {
    if (idx < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: idx + 1 });
      setIdx(idx + 1);
    } else {
      finish();
    }
  };

  const { tag, title, subtitle, Illustration } = SLIDES[idx];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      {/* Illustration carousel */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={{ width: W, height: H * 0.48, justifyContent: 'center', alignItems: 'center' }}>
            <item.Illustration />
          </View>
        )}
        onMomentumScrollEnd={e => {
          setIdx(Math.round(e.nativeEvent.contentOffset.x / W));
        }}
        scrollEnabled
        style={{ flexGrow: 0 }}
      />

      {/* Text content */}
      <View style={[s.content, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={s.tag}>{tag}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>

        {/* Dots */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === idx && s.dotActive]} />
          ))}
        </View>

        {/* Continue */}
        <TouchableOpacity style={s.continueBtn} onPress={goNext} activeOpacity={0.88}>
          <Text style={s.continueTxt}>{idx === SLIDES.length - 1 ? 'Get Started' : 'Continue'}</Text>
        </TouchableOpacity>

        {/* Already have account */}
        <TouchableOpacity onPress={finish} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={s.loginLink}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F0F2F8' },
  content:     { flex: 1, paddingHorizontal: 28, paddingTop: 8 },
  tag:         { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: ACCENT, marginBottom: 10 },
  title:       { fontSize: 30, fontWeight: '800', color: '#0E1726', lineHeight: 36, marginBottom: 10, letterSpacing: -0.5 },
  subtitle:    { fontSize: 14, color: '#6B7588', lineHeight: 22 },
  dotsRow:     { flexDirection: 'row', gap: 6, marginTop: 20, marginBottom: 20 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D0D5E8' },
  dotActive:   { width: 24, backgroundColor: ACCENT, borderRadius: 4 },
  continueBtn: { backgroundColor: ACCENT, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  continueTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink:   { fontSize: 14, color: '#6B7588', fontWeight: '500' },
});

// ── Illustration styles ───────────────────────────────────────────────────────
const ill = StyleSheet.create({
  wrap:     { width: W * 0.85, alignItems: 'center', position: 'relative', height: 180 },

  // Project cards
  card:     { position: 'absolute', width: W * 0.72, backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 },
  avatar:   { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  avatarTxt:{ fontSize: 15, fontWeight: '700' },
  cardName: { fontSize: 13, fontWeight: '700', color: '#0E1726' },
  cardSub:  { fontSize: 11, color: '#9AA3B2', marginTop: 1 },
  barTrack: { height: 5, backgroundColor: '#F0F2F6', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill:  { height: '100%', borderRadius: 3 },

  // Task card
  taskCard: { position: 'absolute', width: W * 0.82, backgroundColor: '#fff', borderRadius: 16, padding: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  taskRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8 },
  taskDot:  { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  taskLabel:{ flex: 1, fontSize: 13, fontWeight: '600', color: '#0E1726' },
  taskPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  taskPillTxt:{ fontSize: 10, fontWeight: '700' },

  // Team card
  teamCard:       { position: 'absolute', width: W * 0.82, backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  teamTitle:      { fontSize: 15, fontWeight: '700', color: '#0E1726' },
  teamSub:        { fontSize: 12, color: '#9AA3B2', marginTop: 2 },
  teamAvatar:     { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  teamAvatarTxt:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  teamProgressWrap:{ marginTop: 16 },
  teamProgressLabel:{ fontSize: 11, color: '#9AA3B2', fontWeight: '500' },
});
