import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../constants/tokens';
import { PROJECTS, TASKS, DOCS } from '../constants/data';
import { Icons } from '../components/Icons';
import { StatusPill, Progress, Card, FileTile } from '../components/SharedUI';

const { width: SCREEN_W } = Dimensions.get('window');

/* ── slide data ─────────────────────────────────────── */
const SLIDES = [
  {
    tag: 'PROJECTS',
    tagColor: T.cBlue,
    tagBg: T.cBlueSoft,
    title: 'Manage projects\nwith clarity',
    desc: 'Track progress, assign tasks, and keep every project on schedule — all in one place.',
    gradientFrom: '#EAF1FE',
    gradientTo: '#D7E3FB',
  },
  {
    tag: 'TASKS',
    tagColor: T.cPurple,
    tagBg: T.cPurpleSoft,
    title: 'Stay on top of\nevery task',
    desc: 'Prioritize, delegate, and track tasks across teams so nothing slips through the cracks.',
    gradientFrom: '#EEEAFE',
    gradientTo: '#DDD4FC',
  },
  {
    tag: 'DOCUMENTS',
    tagColor: T.cGreen,
    tagBg: T.cGreenSoft,
    title: 'All your docs,\none workspace',
    desc: 'Store, share, and collaborate on documents — from contracts to specs — in a single hub.',
    gradientFrom: '#E2F5EC',
    gradientTo: '#C8EBD8',
  },
];

/* ── floating hero cards ────────────────────────────── */

function ProjectHeroCard({ project, style }) {
  return (
    <View style={[styles.heroCard, style]}>
      <View style={styles.heroCardHeader}>
        <View style={[styles.heroCardDot, { backgroundColor: project.color }]} />
        <Text style={styles.heroCardTitle} numberOfLines={1}>{project.name}</Text>
      </View>
      <Text style={styles.heroCardDesc} numberOfLines={1}>{project.desc}</Text>
      <View style={styles.heroCardFooter}>
        <Progress value={project.progress} color={project.color} h={5} />
        <Text style={styles.heroCardMeta}>{project.progress}% complete</Text>
      </View>
    </View>
  );
}

function TaskHeroCard({ task, style }) {
  const done = task.status === 'Completed';
  return (
    <View style={[styles.heroCard, style]}>
      <View style={styles.heroCardHeader}>
        <View style={[styles.taskCheck, done && { backgroundColor: T.cGreen, borderColor: T.cGreen }]}>
          {done && Icons.check({ color: '#fff', size: 9, sw: 3 })}
        </View>
        <Text style={[styles.heroCardTitle, done && { textDecorationLine: 'line-through', opacity: 0.55 }]} numberOfLines={1}>{task.title}</Text>
      </View>
      <View style={styles.heroCardFooter}>
        <Text style={styles.heroCardMeta}>{task.project}</Text>
        <StatusPill status={task.status} size="sm" />
      </View>
    </View>
  );
}

function DocHeroCard({ doc, style }) {
  return (
    <View style={[styles.heroCard, { flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>
      <FileTile kind={doc.kind} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={styles.heroCardTitle} numberOfLines={1}>{doc.name}</Text>
        <Text style={styles.heroCardMeta}>{doc.folder}  ·  {doc.size}</Text>
      </View>
    </View>
  );
}

function HeroArt({ index }) {
  const slide = SLIDES[index];
  return (
    <View style={styles.heroContainer}>
      <LinearGradient
        colors={[slide.gradientFrom, slide.gradientTo]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.heroGradient}
      >
        {index === 0 && (
          <>
            <ProjectHeroCard project={PROJECTS[0]} style={{ top: 28, left: 24, right: 40, transform: [{ rotate: '-2deg' }] }} />
            <ProjectHeroCard project={PROJECTS[1]} style={{ top: 116, left: 40, right: 24, transform: [{ rotate: '1.5deg' }] }} />
            <ProjectHeroCard project={PROJECTS[2]} style={{ top: 204, left: 30, right: 34, transform: [{ rotate: '-0.5deg' }] }} />
          </>
        )}
        {index === 1 && (
          <>
            <TaskHeroCard task={TASKS[0]} style={{ top: 24, left: 24, right: 36, transform: [{ rotate: '-1.5deg' }] }} />
            <TaskHeroCard task={TASKS[1]} style={{ top: 100, left: 36, right: 24, transform: [{ rotate: '2deg' }] }} />
            <TaskHeroCard task={TASKS[2]} style={{ top: 176, left: 28, right: 32, transform: [{ rotate: '-0.5deg' }] }} />
            <TaskHeroCard task={TASKS[3]} style={{ top: 252, left: 34, right: 28, transform: [{ rotate: '1deg' }] }} />
          </>
        )}
        {index === 2 && (
          <>
            <DocHeroCard doc={DOCS[0]} style={{ top: 32, left: 24, right: 36, transform: [{ rotate: '-1deg' }] }} />
            <DocHeroCard doc={DOCS[1]} style={{ top: 108, left: 36, right: 24, transform: [{ rotate: '1.5deg' }] }} />
            <DocHeroCard doc={DOCS[2]} style={{ top: 184, left: 28, right: 32, transform: [{ rotate: '-2deg' }] }} />
            <DocHeroCard doc={DOCS[3]} style={{ top: 260, left: 32, right: 28, transform: [{ rotate: '0.5deg' }] }} />
          </>
        )}
      </LinearGradient>
    </View>
  );
}

/* ── main component ─────────────────────────────────── */

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const flatListRef = useRef(null);

  const goNext = () => {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrent(next);
    } else {
      navigation.navigate('Login');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrent(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const isLast = current === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Slide carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <View style={{ width: SCREEN_W }}>
            {/* Hero art area */}
            <HeroArt index={index} />

            {/* Tag */}
            <View style={styles.tagRow}>
              <View style={[styles.tag, { backgroundColor: item.tagBg }]}>
                <Text style={[styles.tagText, { color: item.tagColor }]}>{item.tag}</Text>
              </View>
            </View>

            {/* Title & description */}
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDesc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Bottom area */}
      <View style={styles.bottomArea}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === current ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Continue / Get Started button */}
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={goNext}
          activeOpacity={0.8}
        >
          <Text style={styles.continueBtnText}>
            {isLast ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>

        {/* Already have an account */}
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.7}
        >
          <Text style={styles.loginLinkText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── styles ─────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surface,
  },

  /* hero */
  heroContainer: {
    height: 330,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: T.rLg,
    overflow: 'hidden',
  },
  heroGradient: {
    flex: 1,
    position: 'relative',
  },
  heroCard: {
    position: 'absolute',
    backgroundColor: T.surface,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 8,
  },
  heroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heroCardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: T.ink,
  },
  heroCardDesc: {
    fontSize: 11,
    color: T.ink3,
  },
  heroCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroCardMeta: {
    fontSize: 11,
    color: T.ink3,
    marginTop: 2,
  },
  taskCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* tag */
  tagRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 24,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* text */
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.4,
    lineHeight: 36,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  slideDesc: {
    fontSize: 15,
    color: T.ink3,
    lineHeight: 22,
    paddingHorizontal: 24,
    marginTop: 10,
  },

  /* bottom */
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 14,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: T.brand,
  },
  dotInactive: {
    width: 8,
    backgroundColor: T.hairline,
  },
  continueBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '650',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  loginLink: {
    paddingVertical: 6,
  },
  loginLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.ink3,
  },
});
