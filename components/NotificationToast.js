/**
 * NotificationToast.js
 *
 * Renders real-time toast notifications on top of all screens.
 * - Same workspace → full toast with title + icon, tappable to navigate
 * - Different workspace → subtle badge showing workspace name + Switch button
 *
 * Mount inside NavigationContainer so navigation works.
 * Driven by WebSocketService directly so it's independent of screen focus.
 */

import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import WebSocketService from '../services/WebSocketService';
import { useWorkspace } from '../context/WorkspaceContext';
import { ThemeContext } from '../context/ThemeContext';
import { getWorkspaceId } from '../services/ApiService';

const { width: SCREEN_W } = Dimensions.get('window');
const TOAST_DURATION = 4000; // ms before auto-dismiss

const TYPE_META = {
  task:     { icon: '📋', color: '#4ECDC4' },
  project:  { icon: '🗂️', color: '#3B82F6' },
  event:    { icon: '📅', color: '#FBBF24' },
  document: { icon: '📄', color: '#A78BFA' },
  message:  { icon: '💬', color: '#F472B6' },
  system:   { icon: '🔔', color: '#9898A6' },
};
const metaFor = (type = '') => {
  const key = Object.keys(TYPE_META).find(k => type.toLowerCase().includes(k));
  return TYPE_META[key] || TYPE_META.system;
};

// ── Full toast (same workspace) ────────────────────────────────────────────────
function FullToast({ toast, onDismiss, isDark }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const meta = metaFor(toast.type);

  const slideIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const slideOut = useCallback((cb) => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: -120, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => cb?.());
  }, []);

  useEffect(() => {
    slideIn();
    timerRef.current = setTimeout(() => slideOut(onDismiss), TOAST_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [toast.id]);

  const handleTap = () => {
    clearTimeout(timerRef.current);
    slideOut(onDismiss);
    // Navigate based on related object type
    try {
      const type = toast.related_object?.type || toast.type || '';
      const id   = toast.related_object?.id;
      if (type === 'task' && id)    navigation.navigate('TaskDetail', { taskId: id });
      else if (type === 'project')  navigation.navigate('Main', { screen: 'Projects' });
      else if (type === 'document') navigation.navigate('Docs');
      else if (type === 'message')  navigation.navigate('Chat');
    } catch {}
  };

  const bg   = isDark ? '#1E1E2C' : '#FFFFFF';
  const txt  = isDark ? '#F0F0F8' : '#18182E';
  const sub  = isDark ? '#8080A0' : '#6B6B82';

  return (
    <Animated.View
      style={[
        styles.fullToast,
        {
          top: insets.top + 8,
          backgroundColor: bg,
          opacity,
          transform: [{ translateY: slideY }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.fullToastInner}
        onPress={handleTap}
        activeOpacity={0.85}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: meta.color }]} />

        {/* Icon */}
        <View style={[styles.toastIcon, { backgroundColor: meta.color + '20' }]}>
          <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.toastTitle, { color: txt }]} numberOfLines={1}>
            {toast.title}
          </Text>
          {!!toast.workspace_name && (
            <Text style={[styles.toastSub, { color: sub }]} numberOfLines={1}>
              {toast.workspace_name}
            </Text>
          )}
        </View>

        {/* Dismiss */}
        <TouchableOpacity
          onPress={() => { clearTimeout(timerRef.current); slideOut(onDismiss); }}
          style={styles.dismissBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ color: sub, fontSize: 14, fontWeight: '600' }}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Progress bar */}
      <ProgressBar duration={TOAST_DURATION} color={meta.color} />
    </Animated.View>
  );
}

// ── Badge toast (different workspace) ─────────────────────────────────────────
function BadgeToast({ toast, onDismiss, onSwitch, isDark }) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideY, { toValue: -80, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(onDismiss);
    }, TOAST_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [toast.id]);

  const bg  = isDark ? '#1A1A28' : '#F0F4FF';
  const txt = isDark ? '#C0C0E0' : '#3B3B6B';

  return (
    <Animated.View
      style={[
        styles.badgeToast,
        { top: insets.top + 8, backgroundColor: bg, opacity, transform: [{ translateY: slideY }] },
      ]}
    >
      <Text style={{ fontSize: 14, marginRight: 6 }}>🔔</Text>
      <Text style={[styles.badgeText, { color: txt, flex: 1 }]} numberOfLines={1}>
        New notification in <Text style={{ fontWeight: '700' }}>'{toast.workspace_name}'</Text>
      </Text>
      <TouchableOpacity
        style={[styles.switchBtn, { borderColor: '#4ECDC4' }]}
        onPress={() => { clearTimeout(timerRef.current); onSwitch(); onDismiss(); }}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#4ECDC4', fontSize: 11, fontWeight: '700' }}>Switch</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────
function ProgressBar({ duration, color }) {
  const width = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: 0, duration, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressBar, { backgroundColor: color, flex: width }]} />
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NotificationToast() {
  const { currentWorkspace, handleSwitch, workspaces } = useWorkspace();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const [toasts, setToasts] = useState([]);
  const currentWsIdRef = useRef(null);

  // Keep ref in sync with context
  useEffect(() => {
    currentWsIdRef.current = currentWorkspace?.id
      ? String(currentWorkspace.id)
      : null;
  }, [currentWorkspace?.id]);

  // On mount, also read from ApiService as fallback
  useEffect(() => {
    getWorkspaceId().then(id => {
      if (id && !currentWsIdRef.current) currentWsIdRef.current = String(id);
    }).catch(() => {});
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleSwitchWs = useCallback((wsId) => {
    const target = workspaces?.find(w => String(w.id) === String(wsId));
    if (target) handleSwitch(target).catch(() => {});
  }, [workspaces, handleSwitch]);

  useEffect(() => {
    const unsubscribe = WebSocketService.subscribe((message) => {
      // Only handle NEW_NOTIFICATION signals
      if (message?.type !== 'SIGNAL' || message?.event !== 'NEW_NOTIFICATION') return;

      const data = message.data || {};
      const notifWsId   = String(data.workspace_id || '');
      const currentWsId = currentWsIdRef.current || '';
      const isSameWs    = notifWsId === currentWsId;
      const toastId     = `toast_${data.id || Date.now()}`;

      const newToast = {
        id:             toastId,
        notifId:        data.id,
        title:          data.title || 'New notification',
        type:           data.related_object?.type || 'system',
        related_object: data.related_object || {},
        workspace_id:   data.workspace_id,
        workspace_name: data.workspace_name || '',
        isSameWs,
      };

      // Max 2 toasts at a time — drop oldest
      setToasts(prev => [newToast, ...prev].slice(0, 2));
    });

    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast, i) => (
        toast.isSameWs ? (
          <FullToast
            key={toast.id}
            toast={toast}
            isDark={isDark}
            onDismiss={() => dismiss(toast.id)}
          />
        ) : (
          <BadgeToast
            key={toast.id}
            toast={toast}
            isDark={isDark}
            onDismiss={() => dismiss(toast.id)}
            onSwitch={() => handleSwitchWs(toast.workspace_id)}
          />
        )
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 99999, pointerEvents: 'box-none',
  },

  // Full toast
  fullToast: {
    position: 'absolute', left: 12, right: 12,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 20,
  },
  fullToastInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingRight: 14, gap: 12,
  },
  accentBar: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  toastIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  toastTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  toastSub:   { fontSize: 11, marginTop: 2 },
  dismissBtn: { padding: 4 },

  // Progress bar
  progressTrack: { height: 3, backgroundColor: 'rgba(0,0,0,0.06)', flexDirection: 'row' },
  progressBar:   { height: 3 },

  // Badge toast
  badgeToast: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, gap: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '500' },
  switchBtn: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
});
