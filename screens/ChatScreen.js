import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, RefreshControl, Alert, Image, Modal, ScrollView,
} from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
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

// ── SVG Icons ─────────────────────────────────────────────────────────────────
// Pin icon — rounded pushpin matching the uploaded image (diagonal, rounded head)
function PinIcon({ size = 20, color = '#888', filled = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 3l-6 6-4 1 9 9 1-4 6-6-6-6z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M9 9l6 6M3 21l4-4" stroke={color} strokeWidth={2} strokeLinecap="round"/>
    </Svg>
  );
}

// Users / group icon — two people silhouette
function UsersIcon({ size = 20, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}


const stripHtml = (str) => (str || '').replace(/<[^>]*>/g, '').trim();

const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
};

const fmtCompact = (iso) => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yest';
    if (days < 7)  return `${days}d`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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

  // Private chat: "Chat: harshit & ravi" or "Chat: shifalig & harshit" → show the other person
  if (room.room_type === 'private') {
    if (name.toLowerCase().startsWith('chat:')) {
      const parts = name.replace(/^Chat:\s*/i, '').split(/\s*&\s*/);
      const other = parts.find(p => p.trim().toLowerCase() !== (myUsername || '').toLowerCase());
      if (other) return other.trim();
    }
    return name;
  }

  // All other types: strip trailing " Chat" suffix
  return name.replace(/\s+Chat$/i, '').trim() || name;
};

const ROOM_COLORS = {
  private: '#3B72EE',
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
const CHANNEL_COLORS = ['#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];
const AVATAR_COLORS  = ['#3B82F6', '#8B5CF6', '#22A06B', '#F59E0B', '#E5484D', '#0EA5E9', '#EC4899'];

function RoomItem({ room, onPress, isDark, card, txt, sub, bdr, myUsername, allUsers }) {
  const isDirect  = room.room_type === 'private';
  const isChannel = room.room_type === 'project' || room.room_type === 'thread';
  const isAiBot   = room.room_type === 'ai_bot';

  const displayName = getRoomDisplayName(room, myUsername);
  const preview     = stripHtml(room.last_message?.content_preview || '');
  const rawSender   = room.last_message?.sender_username;
  const senderUser  = typeof rawSender === 'object' ? (rawSender?.username || '') : (rawSender || '');
  const isMe        = senderUser === myUsername;
  const senderLabel = isMe ? 'You' : senderUser;
  const timeLabel   = fmtCompact(room.last_message?.created_at);

  // Channel color based on name hash
  const colorIdx = (displayName || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const channelColor = CHANNEL_COLORS[colorIdx % CHANNEL_COLORS.length];
  const avatarColor  = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];

  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr, backgroundColor: card }}
      onPress={() => onPress(room)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {isAiBot ? (
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 22 }}>🤖</Text>
        </View>
      ) : room.room_type === 'team' ? (
        /* Team — rounded square with users icon, indigo bg */
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' }}>
          <UsersIcon size={22} color="#fff" />
        </View>
      ) : isChannel ? (
        /* Channel — colored square with # */
        <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: channelColor + '22', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: channelColor }}>#</Text>
        </View>
      ) : (
        /* Direct — show real avatar photo if available, else colored circle with initials + online dot */
        <View style={{ position: 'relative' }}>
          {(() => {
            const peerUser = allUsers?.find(u =>
              (u.username || '').toLowerCase() === (displayName || '').toLowerCase() ||
              (`${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase()) === (displayName || '').toLowerCase()
            );
            const avatarUri = peerUser?.avatar || null;
            return avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: 46, height: 46, borderRadius: 23 }} />
            ) : (
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: avatarColor, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{getInitials(displayName)}</Text>
              </View>
            );
          })()}
          {isDirect && (
            <View style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: card }} />
          )}
        </View>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: txt, flex: 1, marginRight: 8 }} numberOfLines={1}>
            {displayName || room.name}
          </Text>
          {timeLabel ? <Text style={{ fontSize: 11, color: sub }}>{timeLabel}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: sub, flex: 1, marginRight: 8 }} numberOfLines={1}>
            {preview
              ? (senderLabel ? `${senderLabel}: ${preview}` : preview)
              : 'No messages yet'}
          </Text>
          {room.unread_count > 0 && (
            <View style={{ backgroundColor: '#3B82F6', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{room.unread_count > 99 ? '99+' : room.unread_count}</Text>
            </View>
          )}
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

function MessageBubble({ msg, isMine, isDark, sub, allUsers }) {
  const bg       = isMine ? '#5B8FF5' : (isDark ? '#252530' : '#FFFFFF');
  const txtColor = isMine ? '#fff' : (isDark ? '#fff' : '#1A1A2E');
  const content  = stripHtml(msg.content || msg.content_preview || '');
  const senderUsername = getSenderUsername(msg);
  const senderUser = allUsers?.find(u => (u.username || '').toLowerCase() === (senderUsername || '').toLowerCase());

  return (
    <View style={[styles.bubbleWrap, isMine && styles.bubbleWrapMine]}>
      {!isMine && (
        senderUser?.avatar ? (
          <Image source={{ uri: senderUser.avatar }} style={[styles.bubbleAvatar, { borderRadius: 16 }]} />
        ) : (
          <View style={[styles.bubbleAvatar, { backgroundColor: '#6366F1' }]}>
            <Text style={styles.bubbleAvatarTxt}>{getInitials(getSenderName(msg))}</Text>
          </View>
        )
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

  useFocusEffect(useCallback(() => { fetchRooms(); fetchUsersForModal(); }, [fetchRooms, fetchUsersForModal]));

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

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'channels' | 'teams' | 'direct'

  // ── New Group Chat Modal state ─────────────────────────────────────
  const [showNewChat,    setShowNewChat]    = useState(false);
  const [allUsers,       setAllUsers]       = useState([]);
  const [selectedUsers,  setSelectedUsers]  = useState([]);
  const [groupName,      setGroupName]      = useState('');
  const [userSearch,     setUserSearch]     = useState('');
  const [loadingUsers,   setLoadingUsers]   = useState(false);
  const [creating,       setCreating]       = useState(false);

  const fetchUsersForModal = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/auth/users/`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      setAllUsers(list); // keep all users including self for avatar matching
    } catch (e) {
      console.warn('fetchUsersForModal:', e.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [myUsername, user]);

  const openNewChatModal = () => {
    setSelectedUsers([]);
    setGroupName('');
    setUserSearch('');
    setShowNewChat(true);
    fetchUsersForModal();
  };

  const toggleSelectUser = (u) => {
    setSelectedUsers(prev =>
      prev.some(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]
    );
  };

  const createGroupChat = async () => {
    if (selectedUsers.length < 2) {
      Alert.alert('Add more members', 'A group chat needs at least 2 other members.');
      return;
    }
    const name = groupName.trim() || selectedUsers.map(u => u.username || u.full_name).join(', ');
    setCreating(true);
    try {
      const headers = await authHeaders();
      const body = {
        name,
        room_type: 'team',
        participants: selectedUsers.map(u => u.id),
      };
      const res = await fetch(`${BASE_URL}/chat/rooms/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Could not create group', err?.detail || err?.name?.[0] || 'Please try again.');
        return;
      }
      const newRoom = await res.json();
      setShowNewChat(false);
      await fetchRooms();
      openRoom(newRoom);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Pin / Unpin current room ───────────────────────────────────────
  const [pinLoading, setPinLoading] = useState(false);

  const togglePin = async () => {
    if (!activeRoom || pinLoading) return;
    const isPinned = activeRoom.is_favourite;
    setPinLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/chat/rooms/${activeRoom.id}/settings/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_favourite: !isPinned }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = { ...activeRoom, is_favourite: data.is_favourite ?? !isPinned };
        setActiveRoom(updated);
        setRooms(prev => prev.map(r => r.id === activeRoom.id ? updated : r));
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert(isPinned ? 'Unpin failed' : 'Pin failed', err?.detail || 'Could not update pin status.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPinLoading(false);
    }
  };

  // ── Filter rooms by tab ────────────────────────────────────────────
  const tabRooms = useCallback((tab) => {
    const base = search.trim()
      ? rooms.filter(r => (r.name || '').toLowerCase().includes(search.toLowerCase()))
      : rooms;
    switch (tab) {
      case 'channels': return base.filter(r => r.room_type === 'project' || r.room_type === 'thread');
      case 'teams':    return base.filter(r => r.room_type === 'team');
      case 'direct':   return base.filter(r => r.room_type === 'private');
      default:         return base;
    }
  }, [rooms, search]);

  const myUsername    = user?.username || user?.name || '';
  const favourites    = rooms.filter(r => r.is_favourite);
  const displayedRooms = tabRooms(activeTab);
  const totalUnread   = rooms.reduce((s, r) => s + (r.unread_count || 0), 0);

  const allCount      = rooms.length;
  const channelsCount = rooms.filter(r => r.room_type === 'project' || r.room_type === 'thread').length;
  const teamsCount    = rooms.filter(r => r.room_type === 'team').length;
  const directCount   = rooms.filter(r => r.room_type === 'private').length;

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
    const roomColor = ROOM_COLORS[activeRoom.room_type] || '#3B72EE';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={card} />

        {/* Chat header */}
        <View style={[styles.chatHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
          <TouchableOpacity onPress={() => setView('rooms')} style={styles.backBtn}>
            <Text style={{ color: '#3B72EE', fontSize: 24 }}>‹</Text>
          </TouchableOpacity>
          {/* Header avatar — show real photo for DMs */}
          {(() => {
            const isDM = activeRoom.room_type === 'private';
            const displayName = getRoomDisplayName(activeRoom, myUsername);
            const peerUser = isDM ? allUsers.find(u =>
              (u.username || '').toLowerCase() === (displayName || '').toLowerCase() ||
              (`${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase()) === (displayName || '').toLowerCase()
            ) : null;
            return peerUser?.avatar ? (
              <Image source={{ uri: peerUser.avatar }} style={[styles.chatHeaderAvatar, { borderRadius: 22 }]} />
            ) : (
              <View style={[styles.chatHeaderAvatar, { backgroundColor: roomColor }]}>
                <Text style={styles.chatHeaderAvatarTxt}>{getInitials(displayName || activeRoom.name)}</Text>
              </View>
            );
          })()}
          <View style={{ flex: 1 }}>
            <Text style={[styles.chatHeaderName, { color: txt }]} numberOfLines={1}>{getRoomDisplayName(activeRoom, myUsername) || activeRoom.name}</Text>
            <Text style={[styles.chatHeaderMeta, { color: sub }]}>
              {activeRoom.participant_count} participant{activeRoom.participant_count !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={{ padding: 6 }}
            onPress={togglePin}
            disabled={pinLoading}
          >
            {pinLoading
              ? <ActivityIndicator size="small" color="#6366F1" />
              : <PinIcon size={22} color={activeRoom.is_favourite ? '#6366F1' : sub} filled={activeRoom.is_favourite} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={{ padding: 6 }}
            onPress={() => fetchMessages(activeRoom.id)}
          >
            <Text style={{ fontSize: 18, color: sub }}>↻</Text>
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
              <ActivityIndicator color="#3B72EE" size="large" />
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
                        allUsers={allUsers}
                      />
                    );
                  })}
                </View>
              )}
            />
          )}

          {/* Input bar */}
          <SafeAreaView edges={['bottom']} style={[styles.inputBar, { backgroundColor: card, borderTopColor: bdr }]}>
            {/* Attachment button */}
            <TouchableOpacity style={{ padding: 6 }} onPress={() => {}}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke={sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#252530' : '#F5F5F7', color: txt, borderColor: bdr }]}
              placeholder={`Message ${getRoomDisplayName(activeRoom, myUsername) || 'here'}…`}
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
              style={[styles.sendBtn, { backgroundColor: input.trim() ? '#5B8FF5' : isDark ? '#252530' : '#E8EDF5' }]}
              onPress={sendMessage}
              disabled={!input.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color={input.trim() ? '#fff' : sub} size="small" />
                : <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" stroke={input.trim() ? '#fff' : sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                  </Svg>
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
          <View>
            <Text style={[styles.brandName, { color: txt }]}>Chats</Text>
            <Text style={{ fontSize: 11, color: sub, marginTop: 1 }}>
              {totalUnread > 0 ? `${totalUnread} unread message${totalUnread !== 1 ? 's' : ''}` : `${rooms.length} conversations`}
            </Text>
          </View>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={{ padding: 6 }} onPress={openNewChatModal}>
            <Text style={{ fontSize: 32, color: '#3B82F6', fontWeight: '300' }}>+</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <View style={[styles.searchWrap, { backgroundColor: card, borderColor: bdr }]}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}><Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Path d="M21 21L16.65 16.65" stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></Svg>
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

      {/* Tabs — segmented control style matching mockup */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: isDark ? '#0D0D0F' : '#F2F3F7', borderBottomWidth: 1, borderBottomColor: bdr }}>
        <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#252530' : '#E8E8EE', borderRadius: 22, padding: 3 }}>
          {[
            { key: 'all',      label: 'All',      count: allCount },
            { key: 'channels', label: 'Channels', count: null },
            { key: 'teams',    label: 'Teams',    count: null },
            { key: 'direct',   label: 'Direct',   count: null },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 5, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: isActive ? (isDark ? '#1A1A20' : '#fff') : 'transparent',
                  shadowColor: isActive ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isActive ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: isActive ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: isActive ? '700' : '500', color: isActive ? (isDark ? '#fff' : '#1A1A2E') : sub }}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <Text style={{ fontSize: 12, fontWeight: '500', color: isActive ? (isDark ? '#9898A6' : '#888') : sub }}>
                    {tab.count}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Rooms list + FAB */}
      <View style={{ flex: 1 }}>
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#3B82F6" size="large" />
          <Text style={[{ color: sub, marginTop: 10 }]}>Loading chats…</Text>
        </View>
      ) : (
        <FlatList
          data={(() => {
            const favouriteIds = new Set(favourites.map(r => r.id));
            const nonFavTabRooms = displayedRooms.filter(r => !favouriteIds.has(r.id));
            const pinnedInTab    = displayedRooms.filter(r => favouriteIds.has(r.id));
            return [
              ...(pinnedInTab.length > 0 ? [
                { _type: 'section', label: 'PINNED', _key: 'sec_fav' },
                ...pinnedInTab.map(r => ({ ...r, _type: 'room' })),
              ] : []),
              ...(nonFavTabRooms.length > 0 ? [
                { _type: 'section', label: activeTab === 'all' ? 'RECENT' : activeTab === 'channels' ? 'ALL CHANNELS' : activeTab === 'teams' ? 'ALL TEAMS' : 'ALL DIRECT', _key: `sec_${activeTab}` },
                ...nonFavTabRooms.map(r => ({ ...r, _type: 'room' })),
              ] : []),
            ];
          })()}
          keyExtractor={(item) => item._type === 'section' ? item._key : item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRooms(); }} tintColor="#3B72EE" />}
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
              return (
                <View style={{ backgroundColor: isDark ? '#141418' : '#F2F3F7', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: sub, letterSpacing: 0.3 }}>{item.label}</Text>
                </View>
              );
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
                allUsers={allUsers}
              />
            );
          }}
        />
      )}
      </View>

      {/* ── New Team Chat Modal ──────────────────────────────────────── */}
      <Modal
        visible={showNewChat}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewChat(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, maxHeight: '85%' }}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: txt }}>New Group Chat</Text>
              <TouchableOpacity onPress={() => setShowNewChat(false)}>
                <Text style={{ fontSize: 20, color: sub }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Group name input */}
            <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
              <TextInput
                style={{ backgroundColor: isDark ? '#252530' : '#F2F3F7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: txt, borderWidth: StyleSheet.hairlineWidth, borderColor: bdr }}
                placeholder="Group name (optional)"
                placeholderTextColor={sub}
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>

            {/* Selected members chips */}
            {selectedUsers.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}>
                {selectedUsers.map(u => {
                  const colorIdx = (u.username || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                  const chipColor = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => toggleSelectUser(u)}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: chipColor, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, gap: 6 }}
                    >
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{getInitials(u.full_name || u.username)}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{u.full_name || u.username}</Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* User search */}
            <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#252530' : '#F2F3F7', borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: StyleSheet.hairlineWidth, borderColor: bdr }}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}><Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Path d="M21 21L16.65 16.65" stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></Svg>
                <TextInput
                  style={{ flex: 1, fontSize: 13, color: txt }}
                  placeholder="Search people…"
                  placeholderTextColor={sub}
                  value={userSearch}
                  onChangeText={setUserSearch}
                />
                {userSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setUserSearch('')}>
                    <Text style={{ color: sub, paddingHorizontal: 4 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* User list */}
            {loadingUsers ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator color="#3B82F6" size="large" />
                <Text style={{ color: sub, marginTop: 10, fontSize: 13 }}>Loading people…</Text>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" style={{ paddingHorizontal: 14 }}>
                {allUsers
                  .filter(u => u.username !== myUsername && u.id !== user?.id)
                  .filter(u => !userSearch.trim() ||
                    (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                    (u.username  || '').toLowerCase().includes(userSearch.toLowerCase()))
                  .map(u => {
                    const isSelected = selectedUsers.some(x => x.id === u.id);
                    const colorIdx   = (u.username || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                    const avatarColor = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: bdr, gap: 12 }}
                        onPress={() => toggleSelectUser(u)}
                        activeOpacity={0.7}
                      >
                        <View style={{ position: 'relative' }}>
                          {u.avatar ? (
                            <Image source={{ uri: u.avatar }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                          ) : (
                            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: avatarColor, justifyContent: 'center', alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{getInitials(u.full_name || u.username)}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: txt }}>{u.full_name || u.username}</Text>
                          {u.full_name ? <Text style={{ fontSize: 12, color: sub, marginTop: 1 }}>@{u.username}</Text> : null}
                        </View>
                        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? '#3B82F6' : bdr, backgroundColor: isSelected ? '#3B82F6' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                          {isSelected && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                {allUsers.filter(u => u.username !== myUsername && u.id !== user?.id).filter(u => !userSearch.trim() ||
                  (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                  (u.username  || '').toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                  <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                    <Text style={{ fontSize: 32, opacity: 0.2 }}>👤</Text>
                    <Text style={{ color: sub, marginTop: 8, fontSize: 13 }}>No people found</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Create button */}
            <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
              <TouchableOpacity
                style={{ backgroundColor: selectedUsers.length >= 2 ? '#3B82F6' : bdr, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                onPress={createGroupChat}
                disabled={selectedUsers.length < 2 || creating}
              >
                {creating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: selectedUsers.length >= 2 ? '#fff' : sub, fontSize: 15, fontWeight: '700' }}>
                      {selectedUsers.length < 2 ? `Select at least 2 people (${selectedUsers.length} selected)` : `Create Group · ${selectedUsers.length} members`}
                    </Text>
                }
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
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
  logoText: { color: '#3B72EE', fontSize: 15, fontWeight: '800' },
  brandName: { fontWeight: '700', fontSize: 15 },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },

  // Tabs
  tabs: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 16, marginTop: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 6, marginRight: 20, position: 'relative' },
  tabActive: {},
  tabTxt: { fontSize: 13, fontWeight: '600' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#3B72EE', borderRadius: 1 },
  tabBadge: { backgroundColor: '#EF4444', borderRadius: 9, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  tabBadgeTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },

  // Section header
  sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 8 },

  roomRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  roomAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', position: 'relative', flexShrink: 0 },
  roomAvatarTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  roomTypeBadge: { position: 'absolute', bottom: -1, right: -1, width: 17, height: 17, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  roomName: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  roomTime: { fontSize: 11 },
  roomPreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomPreview: { fontSize: 12, flex: 1 },
  unreadBadge: { backgroundColor: '#3B72EE', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
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
