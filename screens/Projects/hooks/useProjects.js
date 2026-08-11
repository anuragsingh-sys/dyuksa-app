import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCache, invalidateCache, getCached } from '../../../hooks/useAppCache';
import { projectsApi, tasksApi, authApi } from '../../../api';

// ── Module-level invalidator ────────────────────────────────────────────────
export const invalidateProjectsCache = () => {
  invalidateCache('projects');
  invalidateCache('projects_tasks');
  invalidateCache('projects_users');
};

// ── Hook ────────────────────────────────────────────────────────────────────
export default function useProjects() {
  const [refreshing, setRefreshing] = useState(false);

  // ── Projects ──────────────────────────────────────────────────────────────
  const fetchProjectsFn = useCallback(async () => {
    return projectsApi.getAll();
  }, []);

  const {
    data: projects,
    isLoading: projectsLoading,
    isValidating,
    fetchData: fetchProjects,
    setData: setProjectsCached,
  } = useCache('projects', fetchProjectsFn, { staleTime: 2 * 60 * 1000 });

  // ── Task counts per project ───────────────────────────────────────────────
  const fetchTaskCountsFn = useCallback(async () => {
    const tasks = await tasksApi.getAll();
    const map = {};
    (Array.isArray(tasks) ? tasks : []).forEach(t => {
      const pid = t.project || t.project_id;
      if (pid) map[pid] = (map[pid] || 0) + 1;
    });
    return map;
  }, []);

  const { data: taskCountMap } = useCache('projects_tasks', fetchTaskCountsFn, { staleTime: 5 * 60 * 1000 });

  // ── Users (for member assignment) ─────────────────────────────────────────
  const fetchUsersFn = useCallback(async () => {
    return authApi.getUsers();
  }, []);

  const { data: users } = useCache('projects_users', fetchUsersFn, { staleTime: 5 * 60 * 1000 });

  // ── Refresh on focus ──────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => { fetchProjects(); }, [fetchProjects]));

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateProjectsCache();
    try {
      await fetchProjects(true);
    } catch {}
    setRefreshing(false);
  }, [fetchProjects]);

  // ── Optimistic favourite toggle ───────────────────────────────────────────
  const toggleFavouriteOptimistic = useCallback((projectId, favKey, newValue) => {
    setProjectsCached(prev =>
      (prev || []).map(p =>
        p.id === projectId ? { ...p, [favKey]: newValue } : p
      )
    );
  }, [setProjectsCached]);

  // ── Public setProjects 
  const setProjects = setProjectsCached;

  return {
    projects: projects || [],
    taskCountMap: taskCountMap || {},
    users: users || [],
    isLoading: projectsLoading,
    isValidating,
    refreshing,
    onRefresh,
    toggleFavouriteOptimistic,
    setProjects,
  };
}