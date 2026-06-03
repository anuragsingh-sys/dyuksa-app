// ─────────────────────────────────────────────────────────────────────────────
// permissions.js — Role-based access control helpers
//
// Roles: 'admin' | 'manager' | 'developer' | 'member'
//
// Developer rules:
//   ✅ Can create projects and tasks
//   ✅ Can edit/delete only items they created (assigned_by / created_by)
//   ❌ Cannot create new workspaces
//   ❌ Cannot manage members / invite users
//
// Admin + Manager: full access
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_DEVELOPER = 'developer';
const ROLE_ADMIN     = 'admin';
const ROLE_MANAGER   = 'manager';

/** True if the user is admin or manager (full access) */
export const isAdminOrManager = (role) => {
  const r = (role || '').toLowerCase();
  return r === ROLE_ADMIN || r === ROLE_MANAGER;
};

/** True if the user is a developer (limited edit/delete) */
export const isDeveloper = (role) => {
  return (role || '').toLowerCase() === ROLE_DEVELOPER;
};

/** Can create new workspaces — admin/manager only */
export const canCreateWorkspace = (role) => isAdminOrManager(role);

/** Can manage team members / invite users — admin/manager only */
export const canManageMembers = (role) => isAdminOrManager(role);

/** Can create projects — everyone except restricted member */
export const canCreateProject = (role) => {
  const r = (role || '').toLowerCase();
  return r === ROLE_ADMIN || r === ROLE_MANAGER || r === ROLE_DEVELOPER;
};

/** Can create tasks — everyone */
export const canCreateTask = (_role) => true;

/**
 * Can edit or delete a specific item (task/project)
 * Admins/Managers: always yes
 * Developers: only if they created it
 * Others: no
 */
export const canEditItem = (role, item, userId) => {
  if (isAdminOrManager(role)) return true;
  if (isDeveloper(role)) {
    const createdBy  = item?.created_by  || item?.created_by_id;
    const assignedBy = item?.assigned_by || item?.assigned_by_id;
    return (
      String(createdBy)  === String(userId) ||
      String(assignedBy) === String(userId)
    );
  }
  return false;
};

export const canDeleteItem = canEditItem;
