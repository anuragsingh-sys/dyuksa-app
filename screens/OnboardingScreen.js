import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
export const ONBOARDING_KEY = 'DYUKSA_ONBOARDING_DONE';

const SLIDES = [
  {
    id: '1',
    icon: '⊞',
    title: 'Your Workspace,\nAll in One Place',
    subtitle: 'Manage tasks, projects, events and documents — everything your team needs, unified in DYUKSA.',
    bg: '#1A1A2E',
    accent: '#4ECDC4',
  },
  {
    id: '2',
    icon: '⚡',
    title: 'Capture Ideas\nInstantly',
    subtitle: 'Use Quick Notes to save thoughts on the fly. They stay synced across your workspace.',
    bg: '#0F2A2A',
    accent: '#4ECDC4',
  },
  {
    id: '3',
    icon: '📅',
    title: 'Never Miss\nan Event',
    subtitle: 'Get reminders the day before and 2 hours before every event you schedule.',
    bg: '#1A1A2E',
    accent: '#A78BFA',
  },
  {
    id: '4',
    icon: '🗂️',
    title: 'Built for\nTeams',
    subtitle: 'Projects, tasks, and documents — assign, track, and collaborate with your whole organisation.',
    bg: '#0F1A2E',
    accent: '#4ECDC4',
  },
];

export default function OnboardingScreen({ onDone }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef(null);
  const dotAnim = useRef(SLIDES.map(() => new Animated.Value(0))).current;

  const animateDots = (index) => {
    SLIDES.forEach((_, i) => {
      Animated.spring(dotAnim[i], {
        toValue: i === index ? 1 : 0,
        useNativeDriver: false,
        tension: 80, friction: 10,
      }).start();
    });
  };

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
      animateDots(next);
    } else {
      handleDone();
    }
  };

  const handleDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  };

  const onScroll = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
      animateDots(index);
    }
  };

  const slide = SLIDES[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: slide.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Skip */}
        <TouchableOpacity style={styles.skipBtn} onPress={handleDone}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Slides */}
        <FlatList
          ref={flatRef}
          data={SLIDES}
          keyExtractor={i => i.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              {/* Icon circle */}
              <View style={[styles.iconCircle, { borderColor: item.accent }]}>
                <Text style={styles.iconText}>{item.icon}</Text>
              </View>

              {/* DYUKSA wordmark */}
              <Text style={[styles.brand, { color: item.accent }]}>DYUKSA</Text>

              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          )}
        />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const dotWidth = dotAnim[i].interpolate({
              inputRange: [0, 1],
              outputRange: [8, 28],
            });
            const dotOpacity = dotAnim[i].interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 1],
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: slide.accent,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Next / Get Started */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.accent }]}
          onPress={goNext}
        >
          <Text style={[styles.nextText, { color: slide.bg }]}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started →' : 'Next →'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  skipText: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '500' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 40 },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
    marginBottom: 28, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconText: { fontSize: 52 },
  brand: { fontSize: 13, fontWeight: '800', letterSpacing: 3, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 36, marginBottom: 16 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 24 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 28 },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: {
    marginHorizontal: 24, height: 54, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  nextText: { fontSize: 16, fontWeight: '700' },
});
