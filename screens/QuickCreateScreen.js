import React, { useRef, useEffect, useContext, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, Dimensions, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Option config ────────────────────────────────────────────────────────────
const OPTIONS = [
  {
    id: 'task',
    label: 'New Task',
    desc: 'Add to any project',
    subLabel: 'AI-powered',
    ai: true,
    icon: TaskIcon,
    accent: '#4F46E5',
    accentLight: 'rgba(79,70,229,0.10)',
    accentDark: 'rgba(79,70,229,0.20)',
    navigate: (nav) => nav.navigate('CreateTask', { aiMode: true }),
  },
  {
    id: 'event',
    label: 'New Event',
    desc: 'Meeting or focus block',
    subLabel: 'AI-powered',
    ai: true,
    icon: EventIcon,
    accent: '#0EA5E9',
    accentLight: 'rgba(14,165,233,0.10)',
    accentDark: 'rgba(14,165,233,0.20)',
    navigate: (nav) => nav.navigate('Calendar', { openCreateModalAI: true }),
  },
  {
    id: 'project',
    label: 'New Project',
    desc: 'Start a workspace',
    subLabel: null,
    ai: false,
    selfNavigate: true,
    icon: ProjectIcon,
    accent: '#10B981',
    accentLight: 'rgba(16,185,129,0.10)',
    accentDark: 'rgba(16,185,129,0.20)',
    navigate: (nav) => {
      nav.goBack();
      setTimeout(() => nav.navigate('CreateProject'), 300);
    },
  },
  {
    id: 'doc',
    label: 'Upload Document',
    desc: 'PDF, Word, Sheet, Slide',
    subLabel: null,
    ai: false,
    selfNavigate: true,
    icon: DocIcon,
    accent: '#F59E0B',
    accentLight: 'rgba(245,158,11,0.10)',
    accentDark: 'rgba(245,158,11,0.20)',
    navigate: (nav) => {
      nav.goBack();
      setTimeout(() => nav.navigate('Docs', { openUpload: true }), 300);
    },
  },
  {
    id: 'member',
    label: 'Invite Member',
    desc: 'By email or link',
    subLabel: null,
    ai: false,
    selfNavigate: true,
    icon: MemberIcon,
    accent: '#8B5CF6',
    accentLight: 'rgba(139,92,246,0.10)',
    accentDark: 'rgba(139,92,246,0.20)',
    navigate: (nav) => {
      nav.goBack();
      setTimeout(() => nav.navigate('InviteUser'), 300);
    },
  },
];

// ─── Inline SVG-style icons via View/Text primitives ─────────────────────────
function TaskIcon({ color, size = 22 }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: size - 2, height: size - 2, borderRadius: 4, borderWidth: 2, borderColor: color }}>
        <View style={{ position: 'absolute', bottom: 1, left: 3, right: 3 }}>
          <View style={{ height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 2, width: '70%' }} />
          <View style={{ height: 2, backgroundColor: color, borderRadius: 1, width: '50%' }} />
        </View>
        <View style={{
          position: 'absolute', top: -4, right: -4,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: color, justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 7, fontWeight: '800', lineHeight: 10 }}>✓</Text>
        </View>
      </View>
    </View>
  );
}

function EventIcon({ color, size = 22 }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: size - 2, height: size - 2, borderRadius: 4, borderWidth: 2, borderColor: color }}>
        <View style={{
          position: 'absolute', top: -1, left: 3, right: 3,
          height: 2, borderRadius: 1, backgroundColor: color,
        }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 3, gap: 1, marginTop: 4 }}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={{
              width: 4, height: 4, borderRadius: 1,
              backgroundColor: i === 1 ? color : `${color}44`,
            }} />
          ))}
        </View>
      </View>
    </View>
  );
}

function ProjectIcon({ color, size = 22 }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ position: 'relative', width: size, height: size }}>
        <View style={{
          position: 'absolute', bottom: 0, left: 0,
          width: size - 4, height: size - 5,
          borderRadius: 3, borderWidth: 2, borderColor: color,
        }} />
        <View style={{
          position: 'absolute', top: 0, left: 3,
          width: size - 7, height: 6,
          borderTopLeftRadius: 3, borderTopRightRadius: 3,
          backgroundColor: color,
        }} />
      </View>
    </View>
  );
}

function DocIcon({ color, size = 22 }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: size - 4, height: size - 2,
        borderRadius: 3, borderWidth: 2, borderColor: color,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <View style={{ width: '65%', height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 3 }} />
        <View style={{ width: '65%', height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 3 }} />
        <View style={{ width: '45%', height: 2, backgroundColor: color, borderRadius: 1, alignSelf: 'flex-start', marginLeft: '17%' }} />
        {/* Upload arrow */}
        <View style={{ position: 'absolute', top: -7, right: -7, width: 12, height: 12, borderRadius: 6, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 8, lineHeight: 12 }}>↑</Text>
        </View>
      </View>
    </View>
  );
}

function MemberIcon({ color, size = 22 }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Two person silhouettes */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ alignItems: 'center', marginRight: -4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: color }} />
          <View style={{ width: 10, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: color, marginTop: 1 }} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 9, height: 9, borderRadius: 4.5, borderWidth: 2, borderColor: color, backgroundColor: `${color}22` }} />
          <View style={{ width: 12, height: 7, borderRadius: 4, borderWidth: 2, borderColor: color, marginTop: 1, backgroundColor: `${color}22` }} />
        </View>
      </View>
      {/* Plus badge */}
      <View style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 4.5, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 7, lineHeight: 9, fontWeight: '800' }}>+</Text>
      </View>
    </View>
  );
}

// ─── AI Sparkle badge ─────────────────────────────────────────────────────────
function AIBadge({ color }) {
  return (
    <View style={[styles.aiBadge, { borderColor: color, backgroundColor: `${color}15` }]}>
      <Text style={{ fontSize: 9, marginRight: 2 }}>✦</Text>
      <Text style={[styles.aiBadgeText, { color }]}>AI</Text>
    </View>
  );
}

// ─── Single option row ────────────────────────────────────────────────────────
function OptionRow({ opt, index, isDark, onPress, animVal }) {
  const bg       = isDark ? opt.accentDark : opt.accentLight;
  const labelClr = isDark ? '#F0F0F8' : '#18182E';
  const descClr  = isDark ? '#9090A8' : '#6B6B82';
  const chevClr  = isDark ? '#3A3A50' : '#D4D4E0';
  const rowBg    = isDark ? '#1E1E2C' : '#FFFFFF';
  const borderClr = isDark ? '#252538' : '#EBEBF3';

  const scale = animVal.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const opacity = animVal.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const translateY = animVal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { translateY }] }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[styles.optionRow, { backgroundColor: rowBg, borderColor: borderClr }]}
      >
        {/* Icon container */}
        <View style={[styles.optionIconWrap, { backgroundColor: bg }]}>
          <opt.icon color={opt.accent} size={22} />
        </View>

        {/* Text */}
        <View style={styles.optionTextWrap}>
          <View style={styles.optionLabelRow}>
            <Text style={[styles.optionLabel, { color: labelClr }]}>{opt.label}</Text>
            {opt.ai && <AIBadge color={opt.accent} />}
          </View>
          <Text style={[styles.optionDesc, { color: descClr }]}>{opt.desc}</Text>
        </View>

        {/* Chevron */}
        <Text style={[styles.chevron, { color: chevClr }]}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function QuickCreateScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';

  // Per-item stagger animations
  const itemAnims = useRef(OPTIONS.map(() => new Animated.Value(0))).current;
  // Sheet slide-up
  const sheetAnim = useRef(new Animated.Value(60)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  // Header fade
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sheet slides up
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 14 }),
      Animated.timing(sheetOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(headerAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Stagger each row
    Animated.stagger(
      60,
      itemAnims.map(a =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 90, friction: 14 })
      )
    ).start();
  }, []);

  const handleClose = () => navigation.goBack();

  const handleOption = (opt) => {
    // Options that need to dismiss first then navigate handle it themselves
    // (e.g. CreateProject needs goBack before pushing a stack screen)
    if (opt.selfNavigate) {
      opt.navigate(navigation);
    } else {
      handleClose();
      setTimeout(() => opt.navigate(navigation), 220);
    }
  };

  // Theme colors
  const bgColor    = isDark ? '#12121C' : '#F5F5FA';
  const cardBg     = isDark ? '#1A1A28' : '#FFFFFF';
  const titleClr   = isDark ? '#F2F2FF' : '#12121C';
  const subtitleClr = isDark ? '#7070A0' : '#8888A8';

  return (
    <View style={[styles.root, { backgroundColor: bgColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, opacity: headerAnim },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: titleClr }]}>Create</Text>
          <Text style={[styles.headerSub, { color: subtitleClr }]}>
            What would you like to add?
          </Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: isDark ? '#252535' : '#EAEAF2' }]} activeOpacity={0.7}>
          <Text style={[styles.closeBtnText, { color: isDark ? '#9090B8' : '#7070A0' }]}>✕</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── AI info strip ── */}
      <Animated.View style={[styles.aiStrip, {
        backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)',
        borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.18)',
        opacity: headerAnim,
      }]}>
        <Text style={styles.aiStripIcon}>✦</Text>
        <Text style={[styles.aiStripText, { color: isDark ? '#A5A8FF' : '#4F46E5' }]}>
          Tasks & Events are AI-assisted — just describe what you need
        </Text>
      </Animated.View>

      {/* ── Options ── */}
      <Animated.ScrollView
        style={{ flex: 1, transform: [{ translateY: sheetAnim }], opacity: sheetOpacity }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: AI-powered */}
        <Text style={[styles.sectionLabel, { color: subtitleClr }]}>AI-POWERED</Text>
        {OPTIONS.filter(o => o.ai).map((opt, i) => (
          <OptionRow
            key={opt.id}
            opt={opt}
            index={i}
            isDark={isDark}
            onPress={() => handleOption(opt)}
            animVal={itemAnims[OPTIONS.indexOf(opt)]}
          />
        ))}

        {/* Section: Quick Actions */}
        <Text style={[styles.sectionLabel, { color: subtitleClr, marginTop: 20 }]}>QUICK ACTIONS</Text>
        {OPTIONS.filter(o => !o.ai).map((opt) => (
          <OptionRow
            key={opt.id}
            opt={opt}
            index={OPTIONS.indexOf(opt)}
            isDark={isDark}
            onPress={() => handleOption(opt)}
            animVal={itemAnims[OPTIONS.indexOf(opt)]}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // AI strip
  aiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiStripIcon: {
    fontSize: 13,
    marginRight: 8,
    color: '#6366F1',
  },
  aiStripText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Option row
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  optionDesc: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
    marginLeft: 8,
  },

  // AI badge
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
