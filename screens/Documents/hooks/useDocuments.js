import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCache, invalidateCache } from '../../../hooks/useAppCache';
import { documentsApi, projectsApi } from '../../../api';

export const invalidateDocumentsCache = () => {
  invalidateCache('documents');
  invalidateCache('documents_projects');
};

export default function useDocuments(projectId = null) {
  const [refreshing, setRefreshing] = useState(false);

  // ── Documents ─────────────────────────────────────────────────────
  const fetchDocsFn = useCallback(async () => {
    if (projectId) {
      const data = await documentsApi.getByProject(projectId);
      return Array.isArray(data) ? data : (data?.results || []);
    }
    const { data } = await documentsApi.getAll('?page_size=200');
    return data;
  }, [projectId]);

  const {
    data: docs,
    isLoading,
    isValidating,
    fetchData: fetchDocs,
    setData: setDocs,
  } = useCache(
    projectId ? `documents_project_${projectId}` : 'documents',
    fetchDocsFn,
    { staleTime: 2 * 60 * 1000 }
  );

  // ── Project map (for showing project name on each doc) ────────────
  const fetchProjectsFn = useCallback(async () => {
    const list = await projectsApi.getAll();
    const map = {};
    (Array.isArray(list) ? list : []).forEach(p => {
      map[p.id] = p;
    });
    return map;
  }, []);

  const { data: projectMap } = useCache('documents_projects', fetchProjectsFn, { staleTime: 5 * 60 * 1000 });

  // ── Refresh on focus ──────────────────────────────────────────────
  useFocusEffect(useCallback(() => { fetchDocs(); }, [fetchDocs]));

  // ── Pull-to-refresh ───────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateDocumentsCache();
    try {
      await fetchDocs(true);
    } catch {}
    setRefreshing(false);
  }, [fetchDocs]);

  return {
    docs: docs || [],
    projectMap: projectMap || {},
    isLoading,
    isValidating,
    refreshing,
    onRefresh,
    setDocs,
  };
}