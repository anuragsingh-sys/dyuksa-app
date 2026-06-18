import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getWorkspaces, switchWorkspace, getWorkspaceId, setWorkspaceId } from '../services/ApiService';
import { invalidateTasksCache } from '../hooks/useTasksCache';

export const WorkspaceContext = createContext({
  currentWorkspace:  null,
  workspaces:        [],
  loadingWorkspaces: false,
  switchingId:       null,
  fetchWorkspaces:   async () => {},
  handleSwitch:      async () => {},
  switchWorkspace:   async () => {},
});

export function WorkspaceProvider({ children }) {
  const [workspaces,        setWorkspaces]        = useState([]);
  const [currentWorkspace,  setCurrentWorkspace]  = useState(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [switchingId,       setSwitchingId]       = useState(null);

  // On mount — restore saved workspace ID from AsyncStorage
  // AsyncStorage is ALWAYS the source of truth, never server flags
  useEffect(() => {
    (async () => {
      try {
        const savedId = await getWorkspaceId();
        const list    = await getWorkspaces().catch(() => []);
        if (!list.length) return;
        setWorkspaces(list);

        if (savedId) {
          const saved = list.find(w => String(w.id) === String(savedId));
          setCurrentWorkspace(saved || list[0]);
        } else {
          // First launch — pick server's active or first
          const serverActive = list.find(w =>
            w.is_current === true || w.is_active === true || w.active === true
          ) || list[0];
          setCurrentWorkspace(serverActive);
          await setWorkspaceId(serverActive.id);
        }
      } catch (e) {
        console.warn('WorkspaceProvider mount:', e.message);
      }
    })();
  }, []);

  // Called when sidebar opens — reload list but keep AsyncStorage value as current
  const fetchWorkspaces = useCallback(async () => {
    if (loadingWorkspaces) return;
    setLoadingWorkspaces(true);
    try {
      const [list, savedId] = await Promise.all([getWorkspaces(), getWorkspaceId()]);
      setWorkspaces(list);

      if (savedId) {
        // ✅ Always restore from AsyncStorage — ignore server is_current
        const saved = list.find(w => String(w.id) === String(savedId));
        if (saved) setCurrentWorkspace(saved);
      } else if (list.length > 0) {
        setCurrentWorkspace(list[0]);
        await setWorkspaceId(list[0].id);
      }
    } catch (e) {
      console.warn('fetchWorkspaces:', e.message);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  // Switch workspace:
  // 1. POST to switch API (which saves X-Workspace-ID to AsyncStorage via ApiService)
  // 2. Update context state
  // 3. Caller (SidebarMenu) does navigation.reset() — this remounts all tab screens
  //    so useFocusEffect fires fresh and every screen refetches with new header
  const handleSwitch = useCallback(async (workspace) => {
    if (!workspace?.id) return;
    if (String(workspace.id) === String(currentWorkspace?.id)) return;

    setSwitchingId(workspace.id);
    try {
      await switchWorkspace(workspace.id); // saves X-Workspace-ID to AsyncStorage

      // ── Invalidate all workspace-scoped caches ────────────────────
      // This ensures remounted screens always fetch fresh data for the
      // new workspace instead of showing stale cached data
      invalidateTasksCache();

      setCurrentWorkspace(workspace);
      setWorkspaces(prev => prev.map(w => ({
        ...w,
        is_current: String(w.id) === String(workspace.id),
        is_active:  String(w.id) === String(workspace.id),
      })));
    } catch (e) {
      throw e;
    } finally {
      setSwitchingId(null);
    }
  }, [currentWorkspace]);

  return (
    <WorkspaceContext.Provider value={{
      currentWorkspace,
      workspaces,
      loadingWorkspaces,
      switchingId,
      fetchWorkspaces,
      handleSwitch,
      switchWorkspace: handleSwitch, // alias for components that call switchWorkspace directly
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
