import { documentsApi } from '../api/index';

export {
  getAccessToken,
  getWorkspaceId,
  setWorkspaceId,
  setCachedToken,
  clearTokenCache,
  getWorkspaces,
  switchWorkspace,
  getUsers,
  getProjects,
  createProject,
  getTasks,
  createTask,
  refineTextAI,
} from '../api/index';

// getDocuments — used by useDashboard
export const getDocuments = async (params = {}) => {
  const query = params.pageSize ? `?page_size=${params.pageSize}` : '';
  const { data, count, raw } = await documentsApi.getAll(query);
  return { results: data, count, ...raw };
};