import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, RefreshControl, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { getAccessToken, getWorkspaceId } from '../services/ApiService';
import WebSocketService from '../services/WebSocketService';
import SidebarMenu from '../components/SidebarMenu';
import NotificationBell from '../components/NotificationBell';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
// const BASE_URL → imported from config

const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const stripHtml = (str) => (str || '').replace(/<[^>]*>/g, '').trim();

const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
};

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Get clean display name — for private chats show other person's name only
const getRoomDisplayName = (room, myUsername) => {
  if (!room) return '';
  const name = room.name || '';
  // Private chat: "Chat: harshit & ravi" → show the other person
  if (room.room_type === 'private' && name.toLowerCase().includes('chat:')) {
    const parts = name.replace(/^Chat:\s*/i, '').split(/\s*&\s*/);
    // Find the part that isn't the current user
    const other = parts.find(p => p.trim().toLowerCase() !== (myUsername || '').toLowerCase());
    if (other) return other.trim();
  }
  // Project/team chats: "ZanFlow Chat" → "ZanFlow"
  if (room.room_type === 'project' || room.room_type === 'team') {
    return name.replace(/\s+Chat$/i, '').trim();
  }
  // Thread: keep as-is
  return name;
};

const ROOM_COLORS = {
  private: '#4ECDC4',
  project: '#6366F1',
  team:    '#F59E0B',
  thread:  '#10B981',
  global:  '#3B82F6',
  ai_bot:  '#8B5CF6',
};

const ROOM_ICONS = {
  private: '💬',
  project: '📁',
  team:    '👥',
  thread:  '🧵',
  global:  '🌐',
  ai_bot:  '🤖',
};

// ── Room List Item ────────────────────────────────────────────────────────────
function RoomItem({ room, onPress, isDark, card, txt, sub, bdr, myUsername }) {
  const color       = ROOM_COLORS[room.room_type] || '#9898A6';
  const icon        = ROOM_ICONS[room.room_type] || '💬';
  const preview     = stripHtml(room.last_message?.content_preview || '');
  const displayName = getRoomDisplayName(room, myUsername);
  const initial     = getInitials(displayName || room.name);

  return (
    <TouchableOpacity
      style={[styles.roomRow, { backgroundColor: card, borderBottomColor: bdr }]}
      onPress={() => onPress(room)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={[styles.roomAvatar, { backgroundColor: color }]}>
        {room.room_type === 'ai_bot'
          ? <Text style={{ fontSize: 20 }}>🤖</Text>
          : <Text style={styles.roomAvatarTxt}>{initial}</Text>
        }
        <View style={[styles.roomTypeBadge, { backgroundColor: isDark ? '#1A1A20' : '#fff' }]}>
          <Text style={{ fontSize: 8 }}>{icon}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={styles.roomNameRow}>
          <Text style={[styles.roomName, { color: txt }]} numberOfLines={1}>{displayName || room.name}</Text>
          {room.last_message?.created_at && (
            <Text style={[styles.roomTime, { color: sub }]}>
              {fmtTime(room.last_message.created_at)}
            </Text>
          )}
        </View>
        <View style={styles.roomPreviewRow}>
          <Text style={[styles.roomPreview, { color: sub }]} numberOfLines={1}>
            {preview || 'No messages yet'}
          </Text>
          {room.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeTxt}>{room.unread_count}</Text>
            </View>
          )}
          {room.is_favourite && <Text style={{ fontSize: 11 }}>⭐</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
// sender can be string OR object {id, username, full_name}
const getSenderName = (msg) => {
  // Try all possible sender fields
  const s = msg.sender_username || msg.sender || msg.sender_name || msg.created_by;
  if (!s) return '?';
  if (typeof s === 'object') return s.full_name || s.username || '?';
  return String(s);
};

const getSenderUsername = (msg) => {
  const s = msg.sender_username || msg.sender || msg.created_by;
  if (!s) return '';
  if (typeof s === 'object') return s.username || '';
  return String(s);
};

function MessageBubble({ msg, isMine, isDark, sub }) {
  const bg       = isMine ? '#4ECDC4' : (isDark ? '#252530' : '#F3F4F6');
  const txtColor = isMine ? '#fff' : (isDark ? '#fff' : '#1A1A2E');
  const content  = stripHtml(msg.content || msg.content_preview || '');

  return (
    <View style={[styles.bubbleWrap, isMine && styles.bubbleWrapMine]}>
      {!isMine && (
        <View style={[styles.bubbleAvatar, { backgroundColor: '#6366F1' }]}>
          <Text style={styles.bubbleAvatarTxt}>{getInitials(getSenderName(msg))}</Text>
        </View>
      )}
      <View style={{ maxWidth: '75%' }}>
        {!isMine && getSenderName(msg) !== '?' && (
          <Text style={[styles.bubbleSender, { color: sub }]}>
            {getSenderName(msg)}
          </Text>
        )}
        <View style={[styles.bubble, { backgroundColor: bg }]}>
          <Text style={[styles.bubbleTxt, { color: txtColor }]}>{content}</Text>
        </View>
        <Text style={[styles.bubbleTime, { color: sub }, isMine && { textAlign: 'right' }]}>
          {fmtTime(msg.created_at)}
          {isMine && msg.is_read ? ' ✓✓' : isMine ? ' ✓' : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ChatScreen({ route }) {
  const navigation = useNavigation();
  const { theme, fontScale } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';

  // ── State ──────────────────────────────────────────────────────────
  const [view,       setView]       = useState('rooms'); // 'rooms' | 'messages'
  const [rooms,      setRooms]      = useState([]);
  const [messages,   setMessages]   = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [search,     setSearch]     = useState('');
  const flatRef = useRef(null);

  // ── Handle navigation params (from notification tap) ──────────────
  useEffect(() => {
    if (route?.params?.roomId) {
      const room = rooms.find(r => r.id === route.params.roomId);
      if (room) openRoom(room);
    }
  }, [route?.params?.roomId, rooms]);

  // ── Fetch rooms ────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/chat/rooms/`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      // Sort: unread first, then by last_message date
      list.sort((a, b) => {
        if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
        const aTime = a.last_message?.created_at || a.updated_at || '';
        const bTime = b.last_message?.created_at || b.updated_at || '';
        return bTime.localeCompare(aTime);
      });
      setRooms(list);
    } catch (e) {
      console.warn('fetchRooms:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchRooms(); }, [fetchRooms]));

  // ── Fetch messages for a room ──────────────────────────────────────
  const fetchMessages = useCallback(async (roomId) => {
    setMsgLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/chat/rooms/${roomId}/messages/`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.results || data.messages || []);
      const myUser = user?.username || user?.name || '';
      // Mark is_mine and reverse to oldest first
      const list = raw.map(m => {
        const senderUser = typeof m.sender_username === 'object'
          ? m.sender_username?.username
          : (m.sender_username || m.sender || '');
        return {
          ...m,
          is_mine: senderUser === myUser || m.sender_id === user?.id ||
            (typeof m.sender_username === 'object' && m.sender_username?.id === user?.id),
        };
      });
      setMessages(list.reverse ? list.reverse() : list);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e) {
      console.warn('fetchMessages:', e.message);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  // ── Open a room ────────────────────────────────────────────────────
  const openRoom = (room) => {
    setActiveRoom(room);
    setMessages([]);
    setInput('');
    setView('messages');
    fetchMessages(room.id);
    // Mark room as read locally
    setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread_count: 0 } : r));
  };

  // ── Send message via WebSocket ────────────────────────────────────
  const sendMessage = () => {
    const text = input.trim();
    if (!text || !activeRoom || sending) return;

    // Check WebSocket is connected
    if (!WebSocketService.isConnected) {
      Alert.alert('Not connected', 'Reconnecting… please try again in a moment.');
      return;
    }

    // Optimistic UI — show immediately
    const optimisticId = `opt_${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      content: text,
      sender_username: user?.username || user?.name,
      sender_name: user?.name || user?.username,
      created_at: new Date().toISOString(),
      is_mine: true,
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);

    // Send via WebSocket
    WebSocketService.send({
      command: 'send_message',
      room_id: activeRoom.id,
      content: text,
    });

    // Update room preview optimistically
    setRooms(prev => prev.map(r => r.id === activeRoom.id
      ? { ...r, last_message: { content_preview: text, created_at: new Date().toISOString() } }
      : r
    ));
  };

  // ── WebSocket — real-time chat messages ────────────────────────────
  useEffect(() => {
    const unsubscribe = WebSocketService.subscribe((message) => {
      // Accept chat_message, new_message, or any payload with room_id
      const isChat = message?.type === 'chat_message' ||
                     message?.type === 'new_message' ||
                     message?.type === 'message' ||
                     message?.data?.room_id || message?.room_id;
      if (!isChat) return;

      const d       = message?.data || message;
      const roomId  = d?.room_id || d?.room;
      const content = d?.content || d?.message || '';
      const sender  = d?.sender_username || d?.sender || '';
      const msgId   = String(d?.id || d?.message_id || `ws_${Date.now()}`);
      const myUser  = user?.username || user?.name || '';
      const getUserStr = (s) => typeof s === 'object' ? (s?.username || '') : String(s || '');

      if (!roomId || !content) return;

      // Update room list preview + unread count
      setRooms(prev => prev.map(r => r.id === roomId
        ? {
            ...r,
            last_message: {
              content_preview: content,
              created_at: d?.created_at || new Date().toISOString(),
              sender_username: sender,
            },
            unread_count: r.id !== activeRoom?.id ? (r.unread_count || 0) + 1 : 0,
          }
        : r
      ));

      // Add to messages if viewing this room
      if (activeRoom?.id === roomId) {
        const isMine = getUserStr(sender) === myUser || sender?.id === user?.id;
        const newMsg = {
          id: msgId,
          content,
          sender_username: sender,
          sender_name: d?.sender_name || d?.sender_full_name || sender,
          created_at: d?.created_at || new Date().toISOString(),
          is_mine: isMine,
        };

        setMessages(prev => {
          // Deduplicate — skip if id already exists
          if (prev.some(m => m.id === msgId)) return prev;
          // Replace matching optimistic message (same content + mine)
          const optIdx = prev.findIndex(m => m._optimistic && m.content === content && isMine);
          if (optIdx !== -1) {
            const next = [...prev];
            next[optIdx] = newMsg;
            return next;
          }
          return [...prev, newMsg];
        });

        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
      }
    });
    return () => unsubscribe();
  }, [activeRoom, user]);

  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'projects' | 'teams' | 'unread'

  // ── Filter rooms by tab ────────────────────────────────────────────
  const tabRooms = useCallback((tab) => {
    const base = search.trim()
      ? rooms.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
      : rooms;
    switch (tab) {
      case 'projects': return base.filter(r => r.room_type === 'project' || r.room_type === 'thread');
      case 'teams':    return base.filter(r => r.room_type === 'team');
      case 'unread':   return base.filter(r => r.unread_count > 0);
      default:         return base.filter(r => r.room_type === 'private' || r.room_type === 'global' || r.room_type === 'ai_bot');
    }
  }, [rooms, search]);

  const myUsername    = user?.username || user?.name || '';
  const favourites    = rooms.filter(r => r.is_favourite);
  const displayedRooms = tabRooms(activeTab);
  const totalUnread    = rooms.reduce((s, r) => s + (r.unread_count || 0), 0);

  // ── Group messages by date ─────────────────────────────────────────
  const groupedMessages = messages.reduce((acc, msg) => {
    const dateLabel = fmtDate(msg.created_at);
    if (!acc.length || acc[acc.length - 1].date !== dateLabel) {
      acc.push({ date: dateLabel, messages: [msg] });
    } else {
      acc[acc.length - 1].messages.push(msg);
    }
    return acc;
  }, []);


  // ── MESSAGES VIEW ──────────────────────────────────────────────────
  if (view === 'messages' && activeRoom) {
    const roomColor = ROOM_COLORS[activeRoom.room_type] || '#4ECDC4';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />

        {/* Chat header */}
        <View style={[styles.chatHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
          <TouchableOpacity onPress={() => setView('rooms')} style={styles.backBtn}>
            <Text style={{ color: '#4ECDC4', fontSize: 24 }}>‹</Text>
          </TouchableOpacity>
          <View style={[styles.chatHeaderAvatar, { backgroundColor: roomColor }]}>
            <Text style={styles.chatHeaderAvatarTxt}>{getInitials(activeRoom.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.chatHeaderName, { color: txt }]} numberOfLines={1}>{getRoomDisplayName(activeRoom, myUsername) || activeRoom.name}</Text>
            <Text style={[styles.chatHeaderMeta, { color: sub }]}>
              {activeRoom.participant_count} participant{activeRoom.participant_count !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.chatHeaderBtn, { backgroundColor: isDark ? '#252530' : '#F5F5F7' }]}
            onPress={() => fetchMessages(activeRoom.id)}
          >
            <Text style={{ fontSize: 16 }}>↻</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          {msgLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#4ECDC4" size="large" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={{ fontSize: 40, opacity: 0.2 }}>💬</Text>
              <Text style={[{ fontSize: 15, fontWeight: '600', color: txt }]}>No messages yet</Text>
              <Text style={[{ fontSize: 12, color: sub }]}>Say something to get started!</Text>
            </View>
          ) : (
            <FlatList
              ref={flatRef}
              data={groupedMessages}
              keyExtractor={(item, i) => item.date + i}
              contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item: group }) => (
                <View>
                  {/* Date separator */}
                  <View style={styles.dateSep}>
                    <View style={[styles.dateSepLine, { backgroundColor: bdr }]} />
                    <Text style={[styles.dateSepTxt, { color: sub, backgroundColor: bg }]}>{group.date}</Text>
                    <View style={[styles.dateSepLine, { backgroundColor: bdr }]} />
                  </View>
                  {group.messages.map(msg => {
                    const isMine = msg.is_mine === true ||
                      getSenderUsername(msg) === myUsername ||
                      msg.sender_id === user?.id ||
                      (typeof msg.sender_username === 'object' && msg.sender_username?.id === user?.id) ||
                      (typeof msg.sender === 'object' && msg.sender?.id === user?.id);
                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isMine={isMine}
                        isDark={isDark}
                        sub={sub}
                      />
                    );
                  })}
                </View>
              )}
            />
          )}

          {/* Input bar */}
          <SafeAreaView edges={['bottom']} style={[styles.inputBar, { backgroundColor: card, borderTopColor: bdr }]}>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', color: txt, borderColor: bdr }]}
              placeholder="Type a message…"
              placeholderTextColor={sub}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() ? '#4ECDC4' : bdr }]}
              onPress={sendMessage}
              disabled={!input.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontSize: 18 }}>➤</Text>
              }
            </TouchableOpacity>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── ROOMS LIST VIEW ────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />

      {/* Navbar */}
      <View style={[styles.navbar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <View style={styles.navLeft}>
          <SidebarMenu activeScreen="Chat" />
          <TouchableOpacity
            style={styles.logoBox}
            onPress={() => { try { navigation.jumpTo('Dashboard'); } catch { navigation.navigate('Main', { screen: 'Dashboard' }); } }}
          >
            <Text style={styles.logoText}>D</Text>
          </TouchableOpacity>
          <Text style={[styles.brandName, { color: txt }]}>Team Chat</Text>
        </View>
        <View style={styles.navRight}>
          <NotificationBell />
        </View>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <View style={[styles.searchWrap, { backgroundColor: card, borderColor: bdr }]}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: txt }]}
            placeholder="Search conversations…"
            placeholderTextColor={sub}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: sub, fontSize: 14, paddingHorizontal: 6 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs: Chats | Projects | Teams | Unread */}
      <View style={[styles.tabs, { backgroundColor: card, borderBottomColor: bdr }]}>
        {[
          { key: 'chats',    label: 'Chats' },
          { key: 'projects', label: 'Projects' },
          { key: 'teams',    label: 'Teams' },
          { key: 'unread',   label: 'Unread', badge: totalUnread },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.tabTxt, { color: activeTab === tab.key ? '#4ECDC4' : sub }]}>
                {tab.label}
              </Text>
              {tab.badge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeTxt}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                </View>
              )}
            </View>
            {activeTab === tab.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Rooms */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#4ECDC4" size="large" />
          <Text style={[{ color: sub, marginTop: 10 }]}>Loading chats…</Text>
        </View>
      ) : (
        <FlatList
          data={(() => {
            const favouriteIds = new Set(favourites.map(r => r.id));
            // Exclude favourites from tab rooms to prevent duplicate keys
            const nonFavTabRooms = displayedRooms.filter(r => !favouriteIds.has(r.id));
            return [
              // Favourites section
              ...(favourites.length > 0 ? [{ _type: 'section', label: '⭐ Favourites', _key: 'sec_fav' }, ...favourites.map(r => ({ ...r, _type: 'room' }))] : []),
              // Tab section header
              { _type: 'section', label: activeTab === 'chats' ? '💬 Direct Messages' : activeTab === 'projects' ? '📁 Projects & Threads' : activeTab === 'teams' ? '👥 Teams' : '🔴 Unread', _key: `sec_${activeTab}` },
              // Tab rooms (excluding favourites already shown above)
              ...nonFavTabRooms.map(r => ({ ...r, _type: 'room' })),
            ];
          })()}
          keyExtractor={(item) => item._type === 'section' ? item._key : item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRooms(); }} tintColor="#4ECDC4" />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={{ fontSize: 36, opacity: 0.2 }}>💬</Text>
              <Text style={[{ fontSize: 15, fontWeight: '600', color: txt }]}>No conversations</Text>
              <Text style={[{ fontSize: 12, color: sub, textAlign: 'center' }]}>
                {activeTab === 'unread' ? 'All caught up! No unread messages.' : 'No chats in this section yet.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item._type === 'section') {
              return <Text style={[styles.sectionHeader, { color: sub, backgroundColor: bg }]}>{item.label}</Text>;
            }
            return (
              <RoomItem
                room={item}
                onPress={openRoom}
                isDark={isDark}
                card={card}
                txt={txt}
                sub={sub}
                bdr={bdr}
                myUsername={myUsername}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Navbar
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#4ECDC4', fontSize: 15, fontWeight: '800' },
  brandName: { fontWeight: '700', fontSize: 15 },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },

  // Tabs
  tabs: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 16, marginTop: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 6, marginRight: 20, position: 'relative' },
  tabActive: {},
  tabTxt: { fontSize: 13, fontWeight: '600' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#4ECDC4', borderRadius: 1 },
  tabBadge: { backgroundColor: '#EF4444', borderRadius: 9, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  tabBadgeTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },

  // Section header
  sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 8 },

  // Room row
  roomRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  roomAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', position: 'relative', flexShrink: 0 },
  roomAvatarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  roomTypeBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  roomName: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  roomTime: { fontSize: 11 },
  roomPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomPreview: { fontSize: 12, flex: 1 },
  unreadBadge: { backgroundColor: '#4ECDC4', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  unreadBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Chat header
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  chatHeaderAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  chatHeaderAvatarTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  chatHeaderName: { fontSize: 15, fontWeight: '700' },
  chatHeaderMeta: { fontSize: 11, marginTop: 1 },
  chatHeaderBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },

  // Messages
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 20 },
  dateSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  dateSepLine: { flex: 1, height: 1 },
  dateSepTxt: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8 },

  // Bubble
  bubbleWrap: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 8 },
  bubbleWrapMine: { flexDirection: 'row-reverse' },
  bubbleAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginBottom: 14 },
  bubbleAvatarTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bubbleSender: { fontSize: 10, fontWeight: '600', marginBottom: 3, marginLeft: 4 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  bubbleTxt: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 3, marginHorizontal: 4 },

  // Input
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 100, minHeight: 40 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
});
