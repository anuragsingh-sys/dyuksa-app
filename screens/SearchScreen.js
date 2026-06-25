import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, Animated, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import { BASE_URL } from '../config';
import Svg, { Path, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform, DeviceEventEmitter } from 'react-native';

const startVoiceInput = (onResult, onError) => {
  if (Platform.OS !== 'android') {
    onError?.('Voice search is only available on Android devices.');
    return;
  }
  try {
    const IntentLauncher = require('expo-intent-launcher');
    IntentLauncher.startActivityAsync('android.speech.action.RECOGNIZE_SPEECH', {
      extra: {
        'android.speech.extra.LANGUAGE_MODEL': 'free_form',
        'android.speech.extra.LANGUAGE': 'en-US',
        'android.speech.extra.PROMPT': 'Speak to search...',
        'android.speech.extra.MAX_RESULTS': 1,
        // Keep listening for 6 seconds of silence before closing
        'android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS': 6000,
        'android.speech.extra.SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS': 4000,
        'android.speech.extra.SPEECH_INPUT_MINIMUM_LENGTH_MILLIS': 2000,
      },
    }).then((result) => {
      console.log('Voice result:', JSON.stringify(result));
      const extras = result?.data?.extras || result?.extra || {};
      const results = extras['android.speech.extra.RESULTS']
        || extras['results']
        || [];
      const text = Array.isArray(results) ? results[0] : (typeof results === 'string' ? results : '');
      if (text) {
        onResult?.(text);
      } else if (result?.resultCode === 0) {
        onError?.('Voice input cancelled');
      } else {
        onError?.('Could not understand. Please try again.');
      }
    }).catch(() => onError?.('Voice input cancelled'));
  } catch (e) {
    onError?.('Voice search not available');
  }
};

const ACCENT = '#3B72EE';
const RECENT_KEY = 'dyuksa_recent_searches';

const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

const STATUS_COLORS = {
  pending: '#F59E0B', in_progress: ACCENT, completed: '#22C55E',
  backlog: '#EF4444', deployed: '#22C55E', deferred: '#F97316', review: '#9370DB',
};
const STATUS_LABELS = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed',
  backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review',
};

const AVATAR_COLORS = [ACCENT, '#22C55E', '#F59E0B', '#EF4444', '#9370DB', '#F97316'];

const QUICK_FILTERS = [
  { label: 'Overdue'       },
  { label: 'Due this week' },
  { label: 'My tasks'      },
  { label: 'In progress'   },
  { label: 'Completed'     },
  { label: 'High priority' },
];

const SearchIcon = ({ size = 18, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

export default function SearchScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const isDark = theme === 'Dark';

  const bg      = isDark ? '#0D0D0F' : '#FFFFFF';
  const card    = isDark ? '#1A1A20' : '#FFFFFF';
  const txt     = isDark ? '#FFFFFF' : '#0E1726';
  const sub     = isDark ? '#9898A6' : '#6B7588';
  const bdr     = isDark ? '#252530' : '#E6E9EF';
  const inputBg = isDark ? '#252530' : '#F2F3F7';

  const inputRef = useRef(null);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [results,    setResults]    = useState(null);
  const [aiResult,   setAiResult]   = useState(null);  // AI agent response
  const [aiLoading,  setAiLoading]  = useState(false);  // AI thinking indicator
  const aiAbortRef = useRef(null);  // cancel in-flight AI call on new query
  const [recent,  setRecent]  = useState([]);
  const [isListening, setIsListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const handleVoicePress = () => {
    setIsListening(true);
    startVoiceInput(
      (text) => {
        setIsListening(false);
        if (text) {
          setQuery(text);
          search(text); // immediately trigger search, no debounce wait
        }
      },
      (err) => {
        setIsListening(false);
        if (err && err !== 'Voice input cancelled') Alert.alert('Voice Search', err);
      }
    );
  };

  useEffect(() => {
    if (route.params?.voiceTrigger) {
      handleVoicePress();
    }
  }, [route.params?.voiceTrigger]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then(val => {
      if (val) setRecent(JSON.parse(val));
    }).catch(() => {});
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  const saveRecent = async (q) => {
    if (!q.trim()) return;
    const updated = [q, ...recent.filter(r => r !== q)].slice(0, 6);
    setRecent(updated);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
  };

  const clearRecent = async () => {
    setRecent([]);
    await AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  };

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); setAiResult(null); return; }
    setLoading(true);

    // ── Cancel any previous AI call ──────────────────────────────────
    if (aiAbortRef.current) aiAbortRef.current.abort();
    const aiAbort = new AbortController();
    aiAbortRef.current = aiAbort;
    setAiResult(null);
    setAiLoading(true);

    // ── PATH A: Search APIs (fast, immediate results) ─────────────────
    const searchPromise = (async () => {
      try {
        const headers = await authHeaders();
        const [tasksRes, projectsRes, docsRes, usersRes] = await Promise.all([
          fetch(`${BASE_URL}/tasksite/?search=${encodeURIComponent(q)}`, { headers }),
          fetch(`${BASE_URL}/projects/?search=${encodeURIComponent(q)}`, { headers }),
          fetch(`${BASE_URL}/documents/?search=${encodeURIComponent(q)}`, { headers }),
          fetch(`${BASE_URL}/auth/users/?search=${encodeURIComponent(q)}`, { headers }),
        ]);
        const parse = async (res) => {
          if (!res.ok) return [];
          const data = await res.json().catch(() => ({}));
          return Array.isArray(data) ? data : (data.results || []);
        };
        const [tasks, projects, docs, users] = await Promise.all([
          parse(tasksRes), parse(projectsRes), parse(docsRes), parse(usersRes),
        ]);
        setResults({ tasks, projects, docs, users });
      } catch { setResults({ tasks: [], projects: [], docs: [], users: [] }); }
      finally { setLoading(false); }
    })();

    // ── PATH B: AI Agent (slower, auto-updates when ready) ───────────
    // Endpoint will be set once backend is ready — placeholder for now
    const AI_ENDPOINT = null; // TODO: replace with actual endpoint e.g. `${BASE_URL}/task-ai/chat/agent/`
    if (AI_ENDPOINT) {
      (async () => {
        try {
          const headers = await authHeaders();
          const res = await fetch(AI_ENDPOINT, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: q }),
            signal: aiAbort.signal,
          });
          if (!res.ok || aiAbort.signal.aborted) return;
          const data = await res.json();
          // Auto-update results list with AI response
          if (!aiAbort.signal.aborted) setAiResult(data);
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('[AI Agent]', e.message);
        } finally {
          if (!aiAbort.signal.aborted) setAiLoading(false);
        }
      })();
    } else {
      setAiLoading(false);
    }

    await searchPromise;
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 400);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleSubmit    = () => { saveRecent(query); };
  const handleRecentTap = (r) => { setQuery(r); search(r); };

  const hasResults = results && (
    results.tasks.length + results.projects.length +
    results.docs.length + results.users.length > 0
  );

  const getDocExt   = (name = '') => name.split('.').pop().toUpperCase().slice(0, 4);
  const getInitial  = (u) => {
    const n = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || '?';
    return n.charAt(0).toUpperCase();
  };
  const getUserName = (u) => u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'User';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Search navbar ── */}
      <View style={[s.searchNav, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ color: txt, fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
        </TouchableOpacity>
        <View style={[s.searchInputWrap, { backgroundColor: inputBg }]}>
          <SearchIcon size={16} color={sub} />
          <TextInput
            ref={inputRef}
            style={[s.searchInput, { color: txt }]}
            placeholder="Search tasks, projects, docs, people"
            placeholderTextColor={sub}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults(null); setAiResult(null); setAiLoading(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: sub, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          )}
          {loading && <ActivityIndicator size="small" color={ACCENT} style={{ marginLeft: 6 }} />}
          {aiLoading && !loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 }}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={{ fontSize: 10, color: ACCENT, fontWeight: '600' }}>AI</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleVoicePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingRight: 6 }}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 19v3" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              <Path d="M19 10v2a7 7 0 01-14 0v-2" stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              <Rect x={9} y={2} width={6} height={13} rx={3} stroke="#3B72EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── No query: Recent + Quick Filters ── */}
        {!query.trim() && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>

            {/* Recent */}
            {recent.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={[s.sectionTitle, { color: txt }]}>Recent</Text>
                  <TouchableOpacity onPress={clearRecent}>
                    <Text style={{ fontSize: 12, color: sub }}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                {recent.map((r, i) => (
                  <TouchableOpacity key={i} style={s.recentRow} onPress={() => handleRecentTap(r)} activeOpacity={0.7}>
                    <SearchIcon size={15} color={sub} />
                    <Text style={[s.recentText, { color: txt }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {isListening && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT, transform: [{ scale: pulseAnim }] }} />
                <Text style={{ fontSize: 13, color: ACCENT, fontWeight: '600' }}>Listening… speak now</Text>
              </View>
            )}

            {/* Quick filters */}
            <Text style={[s.sectionTitle, { color: txt, marginBottom: 10 }]}>Quick filters</Text>
            <View style={s.quickRow}>
              {QUICK_FILTERS.map((f, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.quickChip, { backgroundColor: isDark ? '#252530' : '#F2F3F7', borderColor: isDark ? '#303048' : '#E6E9EF' }]}
                  onPress={() => { setQuery(f.label); search(f.label); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.quickLabel, { color: txt }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Results ── */}
        {hasResults && (
          <View style={{ paddingHorizontal: 16 }}>

            {/* ── AI Agent result — fires in parallel, auto-appears when ready ── */}
            {(aiLoading || aiResult) && (
              <View style={{
                marginBottom: 16,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: aiResult ? ACCENT : (isDark ? '#252530' : '#DBEAFE'),
                backgroundColor: isDark ? '#0D1229' : '#EEF4FF',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: aiResult ? 1 : 0, borderBottomColor: isDark ? '#252530' : '#DBEAFE' }}>
                  {aiLoading && !aiResult ? (
                    <>
                      <ActivityIndicator size="small" color={ACCENT} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT }}>AI Agent thinking…</Text>
                      <Text style={{ fontSize: 11, color: isDark ? '#6B7588' : '#9AA3B2', marginLeft: 'auto' }}>results shown below</Text>
                    </>
                  ) : (
                    <>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>AI</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: ACCENT }}>AI Suggestion</Text>
                      {aiResult.intent && (
                        <View style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: ACCENT + '22' }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: ACCENT }}>{(aiResult.intent || '').toUpperCase()}</Text>
                        </View>
                      )}
                    </>
                  )}
                </View>

                {/* AI content — auto-renders when agent responds */}
                {aiResult && (
                  <View style={{ padding: 14 }}>
                    {(aiResult.message || aiResult.response || aiResult.summary) && (
                      <Text style={{ fontSize: 13, color: isDark ? '#E0E0FF' : '#1A1A2E', lineHeight: 20, marginBottom: aiResult.action ? 12 : 0 }}>
                        {aiResult.message || aiResult.response || aiResult.summary}
                      </Text>
                    )}
                    {aiResult.action && (
                      <TouchableOpacity
                        style={{ height: 40, borderRadius: 10, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => {
                          if (aiResult.action === 'create_task')    navigation.navigate('QuickCreate',    { aiData: aiResult });
                          else if (aiResult.action === 'create_event')   navigation.navigate('Calendar',       { aiData: aiResult, openCreateModal: true });
                          else if (aiResult.action === 'create_project') navigation.navigate('CreateProject',  { aiData: aiResult });
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                          {aiResult.action_label || 'Create Now'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Tasks */}
            {results.tasks.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>Tasks ({results.tasks.length})</Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {results.tasks.slice(0, 6).map((t, i) => {
                    const sc = STATUS_COLORS[t.status] || '#888';
                    const sl = STATUS_LABELS[t.status] || t.status;
                    return (
                      <TouchableOpacity
                        key={t.id || i}
                        onPress={() => { saveRecent(query); navigation.navigate('TaskDetail', { taskId: t.id, task: t }); }}
                        style={[s.resultRow, i < Math.min(results.tasks.length, 6) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                        activeOpacity={0.7}
                      >
                        <View style={[s.resultIcon, { backgroundColor: ACCENT + '18' }]}>
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Path d="M9 11l3 3L22 4" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                            <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                          </Svg>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.resultTitle, { color: txt }]} numberOfLines={1}>{t.heading || t.title || 'Untitled'}</Text>
                          <Text style={[s.resultSub, { color: sub }]} numberOfLines={1}>{t.project_details?.name || ''}</Text>
                        </View>
                        <View style={[s.statusPill, { backgroundColor: sc + '18' }]}>
                          <Text style={[s.statusPillText, { color: sc }]}>{sl}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Projects */}
            {results.projects.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>Projects ({results.projects.length})</Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {results.projects.slice(0, 4).map((p, i) => (
                    <TouchableOpacity
                      key={p.id || i}
                      onPress={() => { saveRecent(query); navigation.navigate('ProjectDetail', { id: p.id, project: p }); }}
                      style={[s.resultRow, i < Math.min(results.projects.length, 4) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}
                      activeOpacity={0.7}
                    >
                      <View style={[s.resultIcon, { backgroundColor: ACCENT + '18' }]}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round"/>
                        </Svg>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.resultTitle, { color: txt }]} numberOfLines={1}>{p.name || 'Project'}</Text>
                        <Text style={[s.resultSub, { color: sub }]} numberOfLines={1}>{p.description || p.task_type || ''}</Text>
                      </View>
                      <Text style={{ color: sub, fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Documents */}
            {results.docs.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>Documents ({results.docs.length})</Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {results.docs.slice(0, 4).map((d, i) => {
                    const name = d.name || d.file_name || 'Untitled';
                    const ext  = getDocExt(name);
                    return (
                      <View key={d.id || i} style={[s.resultRow, i < Math.min(results.docs.length, 4) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}>
                        <View style={[s.resultIcon, { backgroundColor: '#F59E0B18' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#F59E0B' }}>{ext}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.resultTitle, { color: txt }]} numberOfLines={1}>{name}</Text>
                          <Text style={[s.resultSub, { color: sub }]} numberOfLines={1}>{d.created_by?.full_name || d.created_by?.username || ''}</Text>
                        </View>
                        <Text style={{ color: sub, fontSize: 18 }}>›</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* People */}
            {results.users.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: txt }]}>People ({results.users.length})</Text>
                <View style={[s.groupCard, { backgroundColor: card, borderColor: bdr }]}>
                  {results.users.slice(0, 4).map((u, i) => (
                    <View key={u.id || i} style={[s.resultRow, i < Math.min(results.users.length, 4) - 1 && { borderBottomWidth: 1, borderBottomColor: bdr }]}>
                      <View style={[s.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] + '22' }]}>
                        <Text style={[s.avatarText, { color: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>{getInitial(u)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.resultTitle, { color: txt }]}>{getUserName(u)}</Text>
                        <Text style={[s.resultSub, { color: sub }]}>@{u.username || '—'} · {u.role || 'Member'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── No results ── */}
        {results && !hasResults && !loading && (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
            <SearchIcon size={48} color={isDark ? '#3A3A50' : '#D0D5E8'} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: txt, marginTop: 8 }}>No results found</Text>
            <Text style={{ fontSize: 13, color: sub }}>Try a different search term</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1 },
  searchNav:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, height: 42, paddingHorizontal: 12 },
  searchInput:     { flex: 1, fontSize: 14, paddingVertical: 0 },
  sectionTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  recentRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  recentText:      { fontSize: 14 },
  quickRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  quickChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  quickLabel:      { fontSize: 13, fontWeight: '500' },
  groupCard:       { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  resultRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  resultIcon:      { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resultTitle:     { fontSize: 14, fontWeight: '600' },
  resultSub:       { fontSize: 12, marginTop: 2 },
  statusPill:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPillText:  { fontSize: 10, fontWeight: '700' },
  avatar:          { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:      { fontSize: 14, fontWeight: '700' },
});
