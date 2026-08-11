import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCache, invalidateCache } from '../../../hooks/useAppCache';
import { authApi } from '../../../api';

export const invalidateTeamCache = () => {
  invalidateCache('team_members');
};

export default function useTeam() {
  // ── Team members 
  const fetchMembersFn = useCallback(async () => {
    const list = await authApi.getUsers();
    list.sort((a, b) => {
      const nameA = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.username || '';
      const nameB = [b.first_name, b.last_name].filter(Boolean).join(' ') || b.username || '';
      return nameA.localeCompare(nameB);
    });
    return list;
  }, []);

  const {
    data: members,
    isLoading,
    isValidating,
    fetchData: fetchMembers,
    setData: setMembers,
  } = useCache('team_members', fetchMembersFn, { staleTime: 3 * 60 * 1000 });

  // ── Refresh on focus 
  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  return {
    members: members || [],
    isLoading,
    isValidating,
    fetchMembers,
    setMembers,
  };
}