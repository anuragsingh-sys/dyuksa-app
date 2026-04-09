import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, SafeAreaView, StatusBar, Platform, ScrollView } from 'react-native';
import NavBar from '../components/NavBar';
import { ThemeContext } from '../context/ThemeContext';

const TABS = ['Chats', 'Projects', 'Teams', 'Unread'];
const CONTACTS = [
  { id: '1', name: 'Rahul Sharma',  role: 'Developer',   avatar: 'R', online: true,  lastMsg: 'Sure, I will check the PR.',  time: '10:30 AM', unread: 2 },
  { id: '2', name: 'Priya Mehta',   role: 'Designer',    avatar: 'P', online: true,  lastMsg: 'The new designs are ready!',  time: '9:45 AM',  unread: 0 },
  { id: '3', name: 'Arjun Kapoor',  role: 'Manager',     avatar: 'A', online: false, lastMsg: 'Meeting at 3 PM today.',      time: 'Yesterday', unread: 1 },
  { id: '4', name: 'Sneha Patel',   role: 'QA Engineer', avatar: 'S', online: true,  lastMsg: 'All test cases passed ✅',     time: 'Yesterday', unread: 0 },
  { id: '5', name: 'Vikram Singh',  role: 'DevOps',      avatar: 'V', online: false, lastMsg: 'Server is back online.',      time: 'Mon',       unread: 0 },
  { id: '6', name: 'Neha Gupta',    role: 'Product',     avatar: 'N', online: true,  lastMsg: 'Can you review the roadmap?', time: 'Mon',       unread: 3 },
];

function ChatConversation({ contact, onBack, isDark, txt, sub, bdr, card, bg, fs }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hey! How are you?', from: 'them', time: '10:00 AM' },
    { id: '2', text: 'I am good, thanks! What about you?', from: 'me', time: '10:02 AM' },
    { id: '3', text: contact.lastMsg, from: 'them', time: contact.time },
  ]);

  const send = () => {
    if (!message.trim()) return;
    setMessages(p => [...p, { id: Date.now().toString(), text: message.trim(), from: 'me', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }]);
    setMessage('');
  };

  return (
    <View style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <View style={[styles.chatHeader, { backgroundColor: card, borderBottomColor: bdr }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={[styles.backBtnText, { color: txt }]}>‹</Text>
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: '#1A1A2E' }]}>
          <Text style={styles.avatarText}>{contact.avatar}</Text>
          {contact.online && <View style={styles.onlineDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[{ fontSize: fs(14), fontWeight: '700', color: txt }]}>{contact.name}</Text>
          <Text style={[{ fontSize: fs(11), color: sub }]}>{contact.online ? '🟢 Online' : '⚫ Offline'}</Text>
        </View>
      </View>
      <FlatList data={messages} keyExtractor={i => i.id} contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.from === 'me' ? styles.bubbleMe : [styles.bubbleThem, { backgroundColor: card, borderColor: bdr }]]}>
            <Text style={[{ fontSize: fs(14), lineHeight: 20 }, item.from === 'me' ? { color: '#fff' } : { color: txt }]}>{item.text}</Text>
            <Text style={[{ fontSize: fs(10), marginTop: 4, alignSelf: 'flex-end' }, item.from === 'me' ? { color: 'rgba(255,255,255,0.5)' } : { color: sub }]}>{item.time}</Text>
          </View>
        )}
      />
      <View style={[styles.inputBar, { backgroundColor: card, borderTopColor: bdr }]}>
        <TextInput style={[styles.msgInput, { backgroundColor: bg, color: txt, borderColor: bdr }]} placeholder="Type a message..." placeholderTextColor="#AAAABC" value={message} onChangeText={setMessage} multiline />
        <TouchableOpacity style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { theme, fontScale } = useContext(ThemeContext);
  const isDark = theme === 'Dark';
  const bg   = isDark ? '#0D0D0F' : '#F5F5F7';
  const card = isDark ? '#1A1A20' : '#FFFFFF';
  const txt  = isDark ? '#FFFFFF' : '#1A1A2E';
  const sub  = isDark ? '#9898A6' : '#888899';
  const bdr  = isDark ? '#252530' : '#EBEBF0';
  const fs   = s => s * fontScale;

  const [activeTab, setActiveTab] = useState('Chats');
  const [search, setSearch] = useState('');
  const [openChat, setOpenChat] = useState(null);

  const unreadContacts = CONTACTS.filter(c => c.unread > 0);

  if (openChat) return <ChatConversation contact={openChat} onBack={() => setOpenChat(null)} isDark={isDark} txt={txt} sub={sub} bdr={bdr} card={card} bg={bg} fs={fs} />;

  const listData = activeTab === 'Unread' ? unreadContacts : activeTab !== 'Chats' ? [] : CONTACTS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <NavBar title="Chat" activeScreen="Chat" />
      <View style={[styles.searchWrap, { backgroundColor: card, borderColor: bdr }]}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput style={[styles.searchInput, { color: txt }]} placeholder="Search" placeholderTextColor="#AAAABC" value={search} onChangeText={setSearch} />
      </View>
      <View style={[styles.tabsRow, { backgroundColor: card, borderBottomColor: bdr }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, activeTab === t && { borderBottomColor: '#1A1A2E' }]} onPress={() => setActiveTab(t)}>
            <Text style={[{ fontSize: fs(13), fontWeight: activeTab === t ? '700' : '500' }, activeTab === t ? { color: txt } : { color: sub }]}>{t}</Text>
            {t === 'Unread' && unreadContacts.length > 0 && (
              <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{unreadContacts.reduce((n, c) => n + c.unread, 0)}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {listData.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyCircle, { backgroundColor: isDark ? '#1A1A20' : 'rgba(78,205,196,0.1)' }]}>
            <Text style={{ fontSize: 36 }}>💬</Text>
          </View>
          <Text style={[{ fontSize: fs(18), fontWeight: '700', color: txt }]}>{activeTab === 'Unread' ? 'No unread messages' : 'Welcome to Chat'}</Text>
          <Text style={[{ fontSize: fs(13), color: sub }]}>{activeTab === 'Chats' ? `${CONTACTS.length} users available` : 'Start a conversation'}</Text>
        </View>
      ) : (
        <FlatList data={listData} keyExtractor={i => i.id} showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.contactRow, { backgroundColor: card, borderBottomColor: bdr }]} onPress={() => setOpenChat(item)}>
              <View style={[styles.avatar, { backgroundColor: '#1A1A2E' }]}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
                {item.online && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={[{ fontSize: fs(14), fontWeight: '600', color: txt }]}>{item.name}</Text>
                  <Text style={[{ fontSize: fs(11), color: sub }]}>{item.time}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[{ fontSize: fs(12), color: sub, flex: 1 }]} numberOfLines={1}>{item.lastMsg}</Text>
                  {item.unread > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{item.unread}</Text></View>}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', margin: 12, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 12 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBadge: { backgroundColor: '#4ECDC4', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarText: { color: '#4ECDC4', fontSize: 18, fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ADE80', borderWidth: 2, borderColor: '#fff' },
  unreadBadge: { backgroundColor: '#1A1A2E', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  unreadBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, gap: 10, elevation: 2 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 28 },
  bubble: { maxWidth: '75%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: '#1A1A2E', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, gap: 8 },
  msgInput: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: '#4ECDC4', fontSize: 18, fontWeight: '700' },
});
