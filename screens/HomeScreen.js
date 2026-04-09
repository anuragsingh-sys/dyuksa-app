import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, SafeAreaView,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

const FeatureCard = ({ icon, title, description, delay }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.featureCard, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <View style={styles.featureIconBox}>
        <Text style={styles.featureIcon}>{icon}</Text>
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{description}</Text>
    </Animated.View>
  );
};

const features = [
  { icon: '📋', title: 'Task Management', description: 'Kanban boards, sprints, and smart task tracking with AI-powered prioritization.' },
  { icon: '📄', title: 'Document Management', description: 'Rich-text docs, version history, and real-time co-editing — all in one place.' },
  { icon: '🤖', title: 'AI Assistant', description: 'Your intelligent copilot for drafting, summarizing, and automating repetitive work.' },
  { icon: '👥', title: 'Team Collaboration', description: 'Threaded chats, @mentions, and presence indicators so your team stays in sync.' },
  { icon: '⚡', title: 'Quick Notes', description: 'Capture ideas instantly. Smart tagging links notes to tasks and projects automatically.' },
];

export default function HomeScreen({ navigation }) {
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Navbar */}
        <View style={styles.navbar}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>D</Text>
            </View>
            <Text style={styles.logoText}>DYUKSA</Text>
          </View>
          <View style={styles.navBtns}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signUpBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signUpText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ALL-IN-ONE WORKSPACE</Text>
          </View>
          <Text style={styles.heroTitle}>
            The workspace your{'\n'}<Text style={styles.accent}>team</Text> actually loves.
          </Text>
          <Text style={styles.heroSub}>
            Tasks, documents, AI assistance, and team chat — unified in DYUKSA.
          </Text>
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.primaryBtnText}>Create Project →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Explore Templates</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Collab Banner */}
        <View style={styles.collabCard}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>TEAM COLLABORATION</Text>
          </View>
          <Text style={styles.collabTitle}>Everyone on{'\n'}the same page.</Text>
          <Text style={styles.collabSub}>Real-time presence, threaded chats, and instant notifications.</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Everything your team needs</Text>
          <Text style={styles.sectionSub}>Built for speed, designed for clarity.</Text>
          {features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} description={f.description} delay={i * 100} />
          ))}
        </View>

        {/* Bottom CTA */}
        <View style={styles.bottomCTA}>
          <Text style={styles.bottomCTATitle}>Ready to get started?</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.primaryBtnText}>Sign Up Free →</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgPrimary },
  scroll: { flex: 1 },

  navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  logoLetter: { color: COLORS.bgPrimary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  logoText: { color: COLORS.textPrimary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, letterSpacing: 1.5 },
  navBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  signInText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium },
  signUpBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.md },
  signUpText: { color: COLORS.bgPrimary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },

  hero: { alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xxl, paddingBottom: SPACING.xl },
  badge: { backgroundColor: 'rgba(78,205,196,0.12)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.3)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 5, marginBottom: SPACING.lg },
  badgeText: { color: COLORS.accent, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold, letterSpacing: 1.5 },
  heroTitle: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.extrabold, color: COLORS.textPrimary, textAlign: 'center', lineHeight: 44, marginBottom: SPACING.md },
  accent: { color: COLORS.accent },
  heroSub: { color: COLORS.textSecondary, fontSize: FONTS.sizes.md, textAlign: 'center', lineHeight: 24, marginBottom: SPACING.xl, paddingHorizontal: SPACING.md },
  ctaRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', justifyContent: 'center' },
  primaryBtn: { backgroundColor: COLORS.accent, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  primaryBtnText: { color: COLORS.bgPrimary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  secondaryBtn: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  secondaryBtnText: { color: COLORS.textPrimary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium },

  collabCard: { backgroundColor: COLORS.bgSecondary, marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.xl, borderWidth: 1, borderColor: COLORS.border },
  collabTitle: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, textAlign: 'center', lineHeight: 36, marginBottom: SPACING.sm },
  collabSub: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, textAlign: 'center', lineHeight: 22 },

  featuresSection: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl, gap: SPACING.md },
  sectionTitle: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, textAlign: 'center' },
  sectionSub: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, textAlign: 'center', marginBottom: SPACING.sm },
  featureCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  featureIconBox: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: 'rgba(78,205,196,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  featureIcon: { fontSize: 22 },
  featureTitle: { color: COLORS.textPrimary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, marginBottom: 4 },
  featureDesc: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, lineHeight: 20 },

  bottomCTA: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.lg },
  bottomCTATitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
});
