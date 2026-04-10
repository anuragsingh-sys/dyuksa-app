/**
 * DataService — Unified local data layer for DYUKSA
 *
 * Every record has sync-ready fields:
 *   id          — local UUID
 *   serverId    — null until synced with backend
 *   syncedAt    — ISO string of last successful sync, null if never synced
 *   isDirty     — true if changed locally since last sync
 *   isDeleted   — soft-delete flag for sync
 *   createdAt   — ISO string
 *   updatedAt   — ISO string
 *
 * Offline queue stores pending operations to replay when backend is available.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TASKS:    'DYUKSA_QUICK_TASKS',     // tasks + events (existing key kept for compat)
  PROJECTS: 'DYUKSA_PROJECTS',
  QUEUE:    'DYUKSA_OFFLINE_QUEUE',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

const makeId = () =>
  `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const syncMeta = () => ({
  serverId:  null,
  syncedAt:  null,
  isDirty:   true,
  isDeleted: false,
  updatedAt: now(),
});

// ─── Generic CRUD ────────────────────────────────────────────────────────────

async function getAll(key) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function saveAll(key, items) {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

async function createRecord(key, data) {
  const items = await getAll(key);
  const record = {
    id: makeId(),
    createdAt: now(),
    ...syncMeta(),
    ...data,
  };
  const updated = [record, ...items];
  await saveAll(key, updated);
  await enqueueOperation({ op: 'CREATE', key, id: record.id, data: record });
  return record;
}

async function updateRecord(key, id, changes) {
  const items = await getAll(key);
  let updated;
  const record = items.find(i => i.id === id);
  if (!record) return null;
  const newRecord = { ...record, ...changes, updatedAt: now(), isDirty: true };
  updated = items.map(i => i.id === id ? newRecord : i);
  await saveAll(key, updated);
  await enqueueOperation({ op: 'UPDATE', key, id, data: changes });
  return newRecord;
}

async function deleteRecord(key, id) {
  const items = await getAll(key);
  // Soft delete — mark isDeleted so sync can propagate to backend
  const updated = items.map(i => i.id === id ? { ...i, isDeleted: true, isDirty: true, updatedAt: now() } : i);
  await saveAll(key, updated);
  await enqueueOperation({ op: 'DELETE', key, id });
}

// ─── Offline Queue ───────────────────────────────────────────────────────────

async function enqueueOperation(operation) {
  const queue = await getAll(KEYS.QUEUE);
  const entry = {
    queueId:   makeId(),
    timestamp: now(),
    status:    'pending', // pending | failed
    retries:   0,
    ...operation,
  };
  await saveAll(KEYS.QUEUE, [...queue, entry]);
}

async function getQueue() {
  return getAll(KEYS.QUEUE);
}

async function clearQueueItem(queueId) {
  const queue = await getAll(KEYS.QUEUE);
  await saveAll(KEYS.QUEUE, queue.filter(q => q.queueId !== queueId));
}

async function markQueueFailed(queueId) {
  const queue = await getAll(KEYS.QUEUE);
  await saveAll(KEYS.QUEUE, queue.map(q =>
    q.queueId === queueId
      ? { ...q, status: 'failed', retries: q.retries + 1 }
      : q
  ));
}

// Replay queue against backend — call this when connectivity is restored
// Replace fetch() calls with your real API endpoints
async function flushQueue(authToken) {
  const queue = await getAll(KEYS.QUEUE);
  const pending = queue.filter(q => q.status === 'pending');

  for (const item of pending) {
    try {
      // ── REPLACE with real API calls ──────────────────────────────────────
      // const BASE = 'https://api.dyuksa.com';
      // const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` };
      // if (item.op === 'CREATE') await fetch(`${BASE}/${item.key}`, { method: 'POST', headers, body: JSON.stringify(item.data) });
      // if (item.op === 'UPDATE') await fetch(`${BASE}/${item.key}/${item.id}`, { method: 'PATCH', headers, body: JSON.stringify(item.data) });
      // if (item.op === 'DELETE') await fetch(`${BASE}/${item.key}/${item.id}`, { method: 'DELETE', headers });
      // ─────────────────────────────────────────────────────────────────────
      await clearQueueItem(item.queueId);
    } catch (e) {
      await markQueueFailed(item.queueId);
    }
  }
}

// ─── Tasks & Events API ──────────────────────────────────────────────────────

const Tasks = {
  getAll: async () => {
    const items = await getAll(KEYS.TASKS);
    return items.filter(i => !i.isDeleted);
  },

  create: (data) => createRecord(KEYS.TASKS, {
    type:        'task',
    name:        '',
    description: '',
    eventDate:   '',
    images:      [],
    status:      'Todo',
    ...data,
  }),

  update: (id, changes) => updateRecord(KEYS.TASKS, id, changes),

  delete: (id) => deleteRecord(KEYS.TASKS, id),

  // Migrate existing records to sync schema (run once on app start)
  migrate: async () => {
    const items = await getAll(KEYS.TASKS);
    let changed = false;
    const migrated = items.map(item => {
      if (item.isDirty !== undefined) return item; // already migrated
      changed = true;
      return {
        serverId:  null,
        syncedAt:  null,
        isDirty:   false, // existing data assumed clean
        isDeleted: false,
        updatedAt: item.createdAt || now(),
        ...item,
      };
    });
    if (changed) await saveAll(KEYS.TASKS, migrated);
  },
};

// ─── Projects API ────────────────────────────────────────────────────────────

const Projects = {
  getAll: async () => {
    const items = await getAll(KEYS.PROJECTS);
    return items.filter(i => !i.isDeleted);
  },

  create: (data) => createRecord(KEYS.PROJECTS, {
    name:      '',
    type:      'Internal',
    status:    'In Progress',
    documents: 0,
    members:   1,
    favourite: false,
    ...data,
  }),

  update: (id, changes) => updateRecord(KEYS.PROJECTS, id, changes),

  delete: (id) => deleteRecord(KEYS.PROJECTS, id),
};

// ─── Sync status helpers ─────────────────────────────────────────────────────

async function getDirtyCount() {
  const tasks    = await getAll(KEYS.TASKS);
  const projects = await getAll(KEYS.PROJECTS);
  const queue    = await getAll(KEYS.QUEUE);
  return {
    dirtyTasks:    tasks.filter(t => t.isDirty && !t.isDeleted).length,
    dirtyProjects: projects.filter(p => p.isDirty && !p.isDeleted).length,
    queuedOps:     queue.filter(q => q.status === 'pending').length,
    failedOps:     queue.filter(q => q.status === 'failed').length,
  };
}

// Mark all records as synced (call after successful backend sync)
async function markAllSynced() {
  const syncTime = now();
  for (const key of [KEYS.TASKS, KEYS.PROJECTS]) {
    const items = await getAll(key);
    await saveAll(key, items.map(i => ({ ...i, isDirty: false, syncedAt: syncTime })));
  }
  await saveAll(KEYS.QUEUE, []);
}

export const DataService = {
  Tasks,
  Projects,
  flushQueue,
  getQueue,
  getDirtyCount,
  markAllSynced,
  KEYS,
};

// ─── Conflict Resolution ─────────────────────────────────────────────────────
/**
 * Strategy: Last-Write-Wins with server authority on conflicts.
 *
 * When syncing:
 *   1. If local isDirty=true and server has newer updatedAt → server wins (take server version)
 *   2. If local isDirty=true and local has newer updatedAt  → local wins (push to server)
 *   3. If local isDirty=false → always take server version
 *
 * Call resolveConflicts() after fetching server data during sync.
 */
async function resolveConflicts(key, serverItems) {
  const localItems = await getAll(key);
  const localMap   = Object.fromEntries(localItems.map(i => [i.serverId || i.id, i]));
  const merged     = [];
  const now        = () => new Date().toISOString();

  for (const serverItem of serverItems) {
    const localItem = localMap[serverItem.id];

    if (!localItem) {
      // New from server — take it
      merged.push({ ...serverItem, isDirty: false, syncedAt: now() });
      continue;
    }

    if (!localItem.isDirty) {
      // Local untouched — always take server
      merged.push({ ...serverItem, isDirty: false, syncedAt: now() });
      continue;
    }

    const serverTime = new Date(serverItem.updatedAt).getTime();
    const localTime  = new Date(localItem.updatedAt).getTime();

    if (serverTime >= localTime) {
      // Server is newer — server wins
      merged.push({ ...serverItem, isDirty: false, syncedAt: now() });
    } else {
      // Local is newer — keep local, still dirty (will push to server)
      merged.push({ ...localItem, serverId: serverItem.id });
    }

    delete localMap[serverItem.id]; // mark as handled
  }

  // Remaining local-only items (not on server yet or deleted on server)
  for (const localItem of Object.values(localMap)) {
    if (localItem.isDirty && !localItem.isDeleted) {
      merged.push(localItem); // still needs pushing
    }
    // Soft-deleted or clean items not on server → drop
  }

  await saveAll(key, merged);
  return merged;
}

// Expose on DataService
DataService.resolveConflicts = resolveConflicts;
