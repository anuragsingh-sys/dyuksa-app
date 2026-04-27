import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  StatusBar, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import NavBar from '../components/NavBar';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken } from '../services/ApiService';

const API_BASE = 'http://192.168.1.164:8000';
const ROOMS_URL = `${API_BASE}/api/v1/chat/rooms/`;

const TABS = ['Chats', 'Projects', 'Teams', 'Unread'];

// ── Helpers ────────────────────────────────────────────────────────────────

// Strip HTML tags + decode common entities for last-message previews
const cleanPreview = (raw, max = 50) => {
  if (!raw) return '';
  const stripped = String(raw)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max).trimEnd() + '…';
};

// "10:30 AM" / "Yesterday" / "Mon" / "12 Apr"
const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    }
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

const roomInitial = (room) => {
  if (room.room_type === 'ai_bot') return '🤖';
  if (room.room_type === 'global') return '🌐';
  let n = String(room.name || '?');
  // Strip common decorations like "Chat: alice & bob" or "ZanFlow Chat"
  n = n.replace(/^Chat:\s*/i, '').replace(/\s*Chat$/i, '').trim();
  return (n.charAt(0) || '?').toUpperCase();
};

const roomTypeLabel = (room) => {
  switch (room.room_type) {
    case 'private': return 'DM';
    case 'project': return 'Project';
    case 'team':    return 'Team';
    case 'ai_bot':  return 'AI Bot';
    case 'global':  return 'Global';
    case 'thread':  return 'Thread';
    default:        return room.room_type || '';
  }
};

const roomTypeColor = (room) => {
  switch (room.room_type) {
    case 'private': return '#1A1A2E';
    case 'project': return '#7C3AED';
    case 'team':    return '#06B6D4';
    case 'ai_bot':  return '#A78BFA';
    case 'global':  return '#10B981';
    default:        return '#6B7280';
  }
};

// ── Conversation view (placeholder until /messages/ endpoint is wired) ─────
function ChatConversation({ room, onBack, user, isDark, txt, sub, bdr, card, bg, fs }) {
  const [message, setMessage]       = useState('');
  const [messages, setMessages]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const listRef = useRef(null);

  const headerSubtitle = (() => {
    if (room.room_type === 'private') return 'Direct message';
    if (room.participant_count != null) {
      return `${room.participant_count} member${room.participant_count !== 1 ? 's' : ''}`;
    }
    return roomTypeLabel(room);
  })();

  // Fetch messages from the backend.
  // Best-guess endpoint: GET /api/v1/chat/rooms/{id}/messages/
  // Accepts both array responses and DRF-paginated { results: [...], next, ... }.
  // Each message expected to have: id, sender_username (and/or sender_full_name),
  // content (HTML) or content_preview, created_at.
  const fetchMessages = useCallback(async () => {
    if (!room?.id) return;
    setError(null);
    try {
      const token = await getAccessToken();
      const url = `${API_BASE}/api/v1/chat/rooms/${room.id}/messages/`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
      });
      if (!res.ok) {
        // Try to surface a useful backend error
        let detail = `${res.status}`;
        try {
          const errBody = await res.json();
          detail = errBody.detail || errBody.message || detail;
        } catch {}
        throw new Error(`Couldn't load messages (${detail})`);
      }
      const data = await res.json();
      let list = Array.isArray(data) ? data : (data.results || data.messages || []);

      // Normalise into a render-friendly shape
      list = list.map((m) => ({
        id:        m.id || `${m.created_at}-${Math.random()}`,
        text:      cleanPreview(m.content || m.content_preview || '', 10000),
        senderUsername: m.sender_username || m.sender?.username || null,
        senderName:     m.sender_full_name || m.sender?.full_name
                        || m.sender_username || m.sender?.username || 'User',
        createdAt: m.created_at,
        isEdited:  !!m.is_edited,
      }));

      // Display oldest first (chat convention). If backend returns newest-first,
      // we just reverse it; otherwise this is a no-op for already-sorted data.
      list.sort((a, b) => {
        const da = new Date(a.createdAt).getTime() || 0;
        const db = new Date(b.createdAt).getTime() || 0;
        return da - db;
      });

      setMessages(list);
    } catch (e) {
      setError(e.message || 'Could not load messages.');
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [room?.id]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll to bottom when messages first arrive
  useEffect(() => {
    if (!loading && messages.length > 0) {
      // Defer so layout has happened
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: false }), 50);
    }
  }, [loading, messages.length]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  // Determine if a message was sent by the logged-in user
  const isMine = (m) => {
    if (!m.senderUsername) return false;
    return m.senderUsername === user?.username || m.senderUsername === user?.name;
  };

  // Group messages by date for separators (Today / Yesterday / 12 Apr)
  const dateLabel = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const msgTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };

  // Build a flat list with date separators interleaved
  const renderItems = (() => {
    const out = [];
    let lastDate = null;
    for (const m of messages) {
      const dKey = m.createdAt ? new Date(m.createdAt).toDateString() : '';
      if (dKey !== lastDate) {
        out.push({ kind: 'sep', id: `sep-${dKey}`, label: dateLabel(m.createdAt) });
        lastDate = dKey;
      }
      out.push({ kind: 'msg', ...m });
    }
    return out;
  })();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}
      edges={['top', 'bottom']}
    >
      <View style={[styles.chatHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={[styles.backBtnText, { color: txt }]}>‹</Text>
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: roomTypeColor(room) }]}>
          <Text style={styles.avatarText}>{roomInitial(room)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[{ fontSize: fs(14), fontWeight: '700', color: txt }]} numberOfLines={1}>
            {room.name}
          </Text>
          <Text style={[{ fontSize: fs(11), color: sub }]} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={[{ fontSize: fs(13), color: sub }]}>Loading messages…</Text>
        </View>
      ) : error ? (
        <View style={[styles.emptyState, { paddingHorizontal: 24 }]}>
          <Text style={{ fontSize: 36 }}>⚠️</Text>
          <Text style={[{ fontSize: fs(15), fontWeight: '700', color: txt, textAlign: 'center' }]}>
            Couldn't load messages
          </Text>
          <Text style={[{ fontSize: fs(12), color: sub, textAlign: 'center' }]}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={[styles.retryBtn, { borderColor: bdr }]}>
            <Text style={[{ color: txt, fontSize: fs(13), fontWeight: '600' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyCircle, { backgroundColor: isDark ? '#1A1A20' : 'rgba(78,205,196,0.1)' }]}>
            <Text style={{ fontSize: 36 }}>💬</Text>
          </View>
          <Text style={[{ fontSize: fs(16), fontWeight: '700', color: txt }]}>
            No messages yet
          </Text>
          <Text style={[{ fontSize: fs(12), color: sub, textAlign: 'center', paddingHorizontal: 32 }]}>
            Start the conversation when sending is wired up.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={renderItems}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 14, gap: 6 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
          renderItem={({ item }) => {
            if (item.kind === 'sep') {
              return (
                <View style={styles.dateSepWrap}>
                  <View style={[styles.dateSepLine, { backgroundColor: bdr }]} />
                  <Text style={[styles.dateSepText, { color: sub, backgroundColor: bg }]}>{item.label}</Text>
                  <View style={[styles.dateSepLine, { backgroundColor: bdr }]} />
                </View>
              );
            }
            const mine = isMine(item);
            // Show sender name for non-DM rooms when it's not me (group context)
            const showSender = !mine && room.room_type !== 'private';
            return (
              <View style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : null]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? styles.bubbleMe
                      : [styles.bubbleThem, { backgroundColor: card, borderColor: bdr }],
                  ]}
                >
                  {showSender && (
                    <Text style={[{ fontSize: fs(10), fontWeight: '700', color: '#7C3AED', marginBottom: 2 }]}>
                      {item.senderName}
                    </Text>
                  )}
                  <Text
                    style={[
                      { fontSize: fs(14), lineHeight: 20 },
                      mine ? { color: '#fff' } : { color: txt },
                    ]}
                  >
                    {item.text || ' '}
                  </Text>
                  <Text
                    style={[
                      { fontSize: fs(10), marginTop: 4, alignSelf: 'flex-end' },
                      mine ? { color: 'rgba(255,255,255,0.55)' } : { color: sub },
                    ]}
                  >
                    {msgTime(item.createdAt)}{item.isEdited ? ' · edited' : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.inputBar, { backgroundColor: card, borderTopColor: bdr }]}>
        <TextInput
          style={[styles.msgInput, { backgroundColor: bg, color: txt, borderColor: bdr }]}
          placeholder="Sending will be wired next"
          placeholderTextColor="#AAAABC"
          value={message}
          onChangeText={setMessage}
          editable={false}
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, { opacity: 0.4 }]} disabled>
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { theme, fontScale } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = (s) => s * fontScale;

  const [activeTab, setActiveTab] = useState('Chats');
  const [search, setSearch]       = useState('');
  const [openChat, setOpenChat]   = useState(null);
  const [rooms, setRooms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  // Fetch rooms from backend
  const fetchRooms = useCallback(async () => {
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(ROOMS_URL, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
      });
      if (!res.ok) throw new Error(`Couldn't load chats (${res.status})`);
      const data = await res.json();
      // Endpoint returns either a plain array OR a paginated { results: [...] }
      const list = Array.isArray(data) ? data : (data.results || []);
      // Sort by most-recently-updated first
      list.sort((a, b) => {
        const da = new Date(a.updated_at || a.created_at).getTime();
        const db = new Date(b.updated_at || b.created_at).getTime();
        return db - da;
      });
      setRooms(list);
    } catch (e) {
      setError(e.message || 'Could not load chats.');
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRooms();
    }, [fetchRooms])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRooms();
  };

  // Filter logic — matches the tab buckets we agreed on:
  //   Chats    → private + ai_bot + global
  //   Projects → project
  //   Teams    → team
  //   Unread   → any room with unread_count > 0 (excluding threads)
  // Threads are hidden from all tabs for now.
  const filteredByTab = (() => {
    if (activeTab === 'Unread') {
      return rooms.filter((r) => (r.unread_count || 0) > 0 && r.room_type !== 'thread');
    }
    if (activeTab === 'Projects') {
      return rooms.filter((r) => r.room_type === 'project');
    }
    if (activeTab === 'Teams') {
      return rooms.filter((r) => r.room_type === 'team');
    }
    // Chats tab
    return rooms.filter((r) => ['private', 'ai_bot', 'global'].includes(r.room_type));
  })();

  // Apply search on top of the active tab
  const q = search.trim().toLowerCase();
  const visible = q
    ? filteredByTab.filter((r) => {
        const name = String(r.name || '').toLowerCase();
        const lastFrom = String(r.last_message?.sender_username || '').toLowerCase();
        const lastText = cleanPreview(r.last_message?.content_preview || '').toLowerCase();
        return name.includes(q) || lastFrom.includes(q) || lastText.includes(q);
      })
    : filteredByTab;

  // Pin favourites to the top within the current tab
  const sortedVisible = [...visible].sort((a, b) => {
    if (a.is_favourite && !b.is_favourite) return -1;
    if (!a.is_favourite && b.is_favourite) return 1;
    return 0;
  });

  // Unread tab badge count (sum across all rooms)
  const totalUnread = rooms.reduce((n, r) => n + (r.unread_count || 0), 0);

  if (openChat) {
    return (
      <ChatConversation
        room={openChat}
        user={user}
        onBack={() => setOpenChat(null)}
        isDark={isDark} txt={txt} sub={sub} bdr={bdr} card={card} bg={bg} fs={fs}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}
    >
      <NavBar title="Chat" activeScreen="Chat" />

      <View style={[styles.searchWrap, { backgroundColor: card, borderColor: bdr }]}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: txt }]}
          placeholder="Search chats, projects, teams"
          placeholderTextColor="#AAAABC"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={[styles.tabsRow, { backgroundColor: card, borderBottomColor: bdr }]}>
        {TABS.map((t) => {
          const tabUnread = t === 'Unread'
            ? totalUnread
            : rooms
                .filter((r) => {
                  if (t === 'Chats')    return ['private', 'ai_bot', 'global'].includes(r.room_type);
                  if (t === 'Projects') return r.room_type === 'project';
                  if (t === 'Teams')    return r.room_type === 'team';
                  return false;
                })
                .reduce((n, r) => n + (r.unread_count || 0), 0);

          return (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, activeTab === t && { borderBottomColor: '#1A1A2E' }]}
              onPress={() => setActiveTab(t)}
            >
              <Text
                style={[
                  { fontSize: fs(13), fontWeight: activeTab === t ? '700' : '500' },
                  activeTab === t ? { color: txt } : { color: sub },
                ]}
              >
                {t}
              </Text>
              {tabUnread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{tabUnread > 99 ? '99+' : tabUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={[{ fontSize: fs(13), color: sub }]}>Loading chats…</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 36 }}>⚠️</Text>
          <Text style={[{ fontSize: fs(15), fontWeight: '700', color: txt }]}>Couldn't load chats</Text>
          <Text style={[{ fontSize: fs(12), color: sub, textAlign: 'center', paddingHorizontal: 24 }]}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={[styles.retryBtn, { borderColor: bdr }]}>
            <Text style={[{ color: txt, fontSize: fs(13), fontWeight: '600' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sortedVisible.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyCircle, { backgroundColor: isDark ? '#1A1A20' : 'rgba(78,205,196,0.1)' }]}>
            <Text style={{ fontSize: 36 }}>💬</Text>
          </View>
          <Text style={[{ fontSize: fs(18), fontWeight: '700', color: txt }]}>
            {activeTab === 'Unread' ? 'No unread messages' : `No ${activeTab.toLowerCase()} yet`}
          </Text>
          <Text style={[{ fontSize: fs(13), color: sub, textAlign: 'center', paddingHorizontal: 32 }]}>
            {q ? 'Try a different search term.' : 'Conversations will appear here once they exist.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedVisible}
          keyExtractor={(i) => i.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />
          }
          renderItem={({ item }) => {
            const lastMsg = item.last_message;
            const previewSender = lastMsg?.sender_username
              ? (lastMsg.sender_username === user?.name || lastMsg.sender_username === user?.username ? 'You' : lastMsg.sender_username)
              : null;
            const previewText = lastMsg ? cleanPreview(lastMsg.content_preview) : '';
            const fullPreview = lastMsg
              ? (previewSender ? `${previewSender}: ${previewText}` : previewText)
              : 'No messages yet';
            const timeText = lastMsg ? fmtTime(lastMsg.created_at) : fmtTime(item.created_at);

            return (
              <TouchableOpacity
                style={[styles.contactRow, { backgroundColor: card, borderBottomColor: bdr }]}
                onPress={() => setOpenChat(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: roomTypeColor(item) }]}>
                  <Text style={styles.avatarText}>{roomInitial(item)}</Text>
                  {item.is_favourite && (
                    <View style={styles.starDot}>
                      <Text style={{ fontSize: 9 }}>⭐</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text
                      style={[{ fontSize: fs(14), fontWeight: '600', color: txt, flex: 1, marginRight: 8 }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={[{ fontSize: fs(11), color: sub }]}>{timeText}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={styles.typePill}>
                        <Text style={styles.typePillText}>{roomTypeLabel(item)}</Text>
                      </View>
                      <Text
                        style={[
                          {
                            fontSize: fs(12),
                            color: lastMsg ? sub : '#AAAABC',
                            flex: 1,
                            fontStyle: lastMsg ? 'normal' : 'italic',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {fullPreview}
                      </Text>
                    </View>
                    {item.unread_count > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {item.unread_count > 99 ? '99+' : item.unread_count}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },

  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 12 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, gap: 6,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBadge: {
    backgroundColor: '#4ECDC4',
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 12, borderBottomWidth: 1,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  starDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  typePill: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 4,
  },
  typePillText: { color: '#7C3AED', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  unreadBadge: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 5,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  unreadBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, marginTop: 4,
  },

  // Conversation view
  chatHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, gap: 10, elevation: 2,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 28 },
  previewBox: {
    marginTop: 16, padding: 12,
    borderRadius: 10, borderWidth: 1,
    width: '100%',
  },

  // Message bubbles
  bubbleRow: { flexDirection: 'row', width: '100%', marginVertical: 2 },
  bubble: {
    maxWidth: '78%',
    borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  bubbleMe: {
    backgroundColor: '#1A1A2E',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },

  // Date separator (Today / Yesterday / 12 Apr)
  dateSepWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 8,
  },
  dateSepLine: { flex: 1, height: 1 },
  dateSepText: {
    fontSize: 11, fontWeight: '600',
    paddingHorizontal: 10, paddingVertical: 2,
    marginHorizontal: 8,
  },

  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, gap: 8,
  },
  msgInput: {
    flex: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, maxHeight: 100, borderWidth: 1,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnText: { color: '#4ECDC4', fontSize: 18, fontWeight: '700' },
});
