import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCache, invalidateCache } from '../../../hooks/useAppCache';
import { chatApi, authApi } from '../../../api';

export const invalidateChatCache = () => {
  invalidateCache('chat_rooms');
  invalidateCache('chat_users');
};

export default function useChat() {
  const [refreshing, setRefreshing] = useState(false);

  // ── Chat rooms ────────────────────────────────────────────────────
  const fetchRoomsFn = useCallback(async () => {
    const data = await chatApi.getRooms();
    const list = Array.isArray(data) ? data : (data?.results || []);
    // Sort: most recent message first
    list.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.updated_at || '';
      const bTime = b.last_message?.created_at || b.updated_at || '';
      return bTime.localeCompare(aTime);
    });
    return list;
  }, []);

  const {
    data: rooms,
    isLoading,
    isValidating,
    fetchData: fetchRooms,
    setData: setRooms,
  } = useCache('chat_rooms', fetchRoomsFn, { staleTime: 60 * 1000 });

  // ── Users (for new chat / group creation) ─────────────────────────
  const fetchUsersFn = useCallback(async () => {
    return authApi.getUsers();
  }, []);

  const { data: allUsers } = useCache('chat_users', fetchUsersFn, { staleTime: 5 * 60 * 1000 });

  // ── Refresh on focus ──────────────────────────────────────────────
  useFocusEffect(useCallback(() => { fetchRooms(); }, [fetchRooms]));

  // ── Pull-to-refresh ───────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateChatCache();
    try {
      await fetchRooms(true);
    } catch {}
    setRefreshing(false);
  }, [fetchRooms]);

  return {
    rooms: rooms || [],
    allUsers: allUsers || [],
    isLoading,
    isValidating,
    refreshing,
    onRefresh,
    setRooms,
  };
}