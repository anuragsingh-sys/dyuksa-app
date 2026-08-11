import { View, Animated, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';

const SkeletonBlock = ({ width = '100%', height = 14, borderRadius = 6, style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#E5E7EB', opacity },
        style,
      ]}
    />
  );
};

const SkeletonRow = () => (
  <View style={s.row}>
    <SkeletonBlock width={40} height={40} borderRadius={20} />
    <View style={s.rowText}>
      <SkeletonBlock width="60%" height={14} />
      <SkeletonBlock width="40%" height={10} style={{ marginTop: 8 }} />
    </View>
  </View>
);

export const SkeletonList = ({ count = 6 }) => (
  <View style={s.container}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonRow key={i} />
    ))}
  </View>
);

const s = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText:   { flex: 1, gap: 0 },
});

export default { SkeletonList };