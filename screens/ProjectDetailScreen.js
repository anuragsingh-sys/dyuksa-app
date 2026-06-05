import React, { useState, useCallback, useContext, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { getAccessToken, getWorkspaceId, getTasks } from '../services/ApiService';
import { BASE_URL } from '../config';

// ── Token colours ─────────────────────────────────────────────────────────────
const T = {
  brand: '#2D6AE3', ink: '#0E1726', ink2: '#3B4658', ink3: '#6B7588', ink4: '#9AA3B2',
  hairline: '#E6E9EF', hairlineSoft: '#F0F2F6', surface: '#FFFFFF', surfaceAlt: '#F7F8FB',
  surfaceCool: '#F2F4F8',
  cBlue: '#2D6AE3', cBlueSoft: '#E6EEFC',
  cGreen: '#22A06B', cGreenSoft: '#E2F5EC',
  cYellow: '#E5A60E', cYellowSoft: '#FEF3CE',
  cPurple: '#7A5AF8', cPurpleSoft: '#EEEAFE',
  cRed: '#E5484D', cRedSoft: '#FBE3E3',
  r: 10, rMd: 14, rLg: 20,
};

const PROJECT_COLORS = [T.cBlue, T.cPurple, T.cGreen, T.cYellow, T.cRed];

// ── Auth headers ──────────────────────────────────────────────────────────────
const authHeaders = async () => {
  const token = await getAccessToken();
  const wsId  = await getWorkspaceId();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (wsId) h['X-Workspace-ID'] = wsId;
  return h;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const TASK_STATUS_COLORS = {
  pending: '#888899', in_progress: '#4ECDC4', completed: '#4ADE80',
  backlog: '#F472B6', deployed: '#3B82F6', deferred: '#FBBF24', review: '#A78BFA',
};
const TASK_STATUS_LABELS = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed',
  backlog: 'Backlog', deployed: 'Deployed', deferred: 'Deferred', review: 'Review',
};
const PRIORITY_COLORS = { low: '#4ADE80', medium: '#FBBF24', high: '#F97316', urgent: '#EF4444' };

const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso || '—'; }
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 7 ? `${d}d ago` : fmtDate(iso);
  } catch { return ''; }
};

const getProjectMembers = (project) => {
  if (!project) return [];
  if (Array.isArray(project.members)) return project.members;
  if (Array.isArray(project.assigned_members)) return project.assigned_members;
  return [];
};

// ── Mini components ───────────────────────────────────────────────────────────
function Progress({ value = 0, color = T.brand, h = 6 }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View style={{ height: h, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: h }}>
      <View style={{ height: h, width: `${pct}%`, backgroundColor: '#fff', borderRadius: h, opacity: 0.9 }} />
    </View>
  );
}

function ProgressLight({ value = 0, color = T.brand, h = 5 }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View style={{ height: h, backgroundColor: T.hairlineSoft, borderRadius: h }}>
      <View style={{ height: h, width: `${pct}%`, backgroundColor: color, borderRadius: h }} />
    </View>
  );
}

function Card({ children, style, padding = 16 }) {
  return (
    <View style={[{ backgroundColor: T.surface, borderRadius: T.rMd, borderWidth: 1, borderColor: T.hairline, padding }, style]}>
      {children}
    </View>
  );
}

function StatItem({ label, value }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 2 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

const TABS = ['Overview', 'Tasks', 'Members', 'Docs'];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProjectDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { theme }  = useContext(ThemeContext);
  const isDark     = theme === 'Dark';

  const projectId = route?.params?.id || route?.params?.projectId;

  // ── State ──────────────────────────────────────────────────────────────────
  const [project,     setProject]     = useState(route?.params?.project || null);
  const [tasks,       setTasks]       = useState([]);
  const [docs,        setDocs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('Overview');

  // Pick a color based on project index or id
  const projectColor = project?.color ||
    PROJECT_COLORS[(parseInt(String(projectId || '0').replace(/\D/g, '') || '0') % PROJECT_COLORS.length)];

  // ── Fetch project details ─────────────────────────────────────────────────
  const fetchProject = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    // If project was passed via route params, use it directly
    if (route?.params?.project) { setProject(route.params.project); return; }
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/projects/${projectId}/`, { headers });
      if (res.ok) setProject(await res.json());
    } catch (e) { console.warn('fetchProject:', e.message); }
  }, [projectId]);

  // ── Fetch tasks for this project ──────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const all = await getTasks();
      const forThis = (all || []).filter(t => {
        const pid = t.project_details?.id ?? t.project ?? t.project_id;
        return String(pid) === String(projectId);
      });
      setTasks(forThis);
    } catch (e) { console.warn('fetchTasks:', e.message); }
  }, [projectId]);

  // ── Fetch docs for this project ───────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    if (!projectId) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/documents/?project=${projectId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDocs(Array.isArray(data) ? data : (data.results || []));
      }
      // Non-ok silently ignored — docs tab shows empty state
    } catch (e) {
      // Network error — docs tab shows empty state, app continues normally
    }
  }, [projectId]);

  useEffect(() => {
    Promise.all([fetchProject(), fetchTasks(), fetchDocs()])
      .finally(() => setLoading(false));
  }, [projectId]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalTasks     = tasks.length;
  const completedTasks = tasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
  const inProgressTasks= tasks.filter(t => (t.status || '').toLowerCase() === 'in_progress').length;
  const memberList     = getProjectMembers(project);
  const progress       = project?.progress || project?.completion_percentage ||
    (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

  const projectName = project?.name || 'Project';

  // ── Tab content ───────────────────────────────────────────────────────────

  const OverviewTab = () => (
    <View style={{ gap: 14 }}>
      {/* About */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ink, marginBottom: 6 }}>About</Text>
        <Text style={{ fontSize: 13, color: T.ink2, lineHeight: 20, marginBottom: 10 }}>
          {project?.description || project?.desc || 'No description provided.'}
        </Text>
        {/* Task type pill */}
        {(project?.task_type) && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: T.surfaceCool, borderRadius: 999 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: T.ink2 }}>
                {project.task_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Text>
            </View>
            {project?.status && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: T.cBlueSoft, borderRadius: 999 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: T.cBlue }}>{project.status}</Text>
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Task breakdown */}
      <Card>
        <Text style={{ fontSize: 13, fontWeight: '700', color: T.ink2, marginBottom: 12 }}>Task Breakdown</Text>
        {[
          { label: 'Completed',   value: completedTasks,  color: T.cGreen },
          { label: 'In Progress', value: inProgressTasks, color: T.cBlue },
          { label: 'Pending',     value: Math.max(0, totalTasks - completedTasks - inProgressTasks), color: T.cYellow },
        ].map(item => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: 100 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
              <Text style={{ fontSize: 12, color: T.ink2, fontWeight: '500' }}>{item.label}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <ProgressLight value={totalTasks > 0 ? (item.value / totalTasks) * 100 : 0} color={item.color} h={6} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: T.ink, width: 28, textAlign: 'right' }}>{item.value}</Text>
          </View>
        ))}
      </Card>

      {/* Meta info */}
      <Card padding={0}>
        {[
          { label: 'Created',   value: fmtDate(project?.created_at) },
          { label: 'Updated',   value: fmtRelative(project?.updated_at) },
          { label: 'Members',   value: `${memberList.length} member${memberList.length !== 1 ? 's' : ''}` },
          { label: 'Documents', value: `${docs.length} file${docs.length !== 1 ? 's' : ''}` },
        ].map(({ label, value }, i, arr) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.hairlineSoft }}>
            <Text style={{ fontSize: 13, color: T.ink3 }}>{label}</Text>
            <Text style={{ fontSize: 13, color: T.ink, fontWeight: '600' }}>{value || '—'}</Text>
          </View>
        ))}
      </Card>
    </View>
  );

  const TasksTab = () => (
    <View style={{ gap: 8 }}>
      <TouchableOpacity
        style={{ backgroundColor: '#1A1A2E', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 4 }}
        onPress={() => navigation.navigate('Main', { screen: 'Tasks', params: { openCreateModal: true, presetProjectId: projectId } })}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>+ Create Task</Text>
      </TouchableOpacity>

      {tasks.length === 0 ? (
        <Card>
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <Text style={{ fontSize: 36, opacity: 0.3 }}>📋</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: T.ink }}>No tasks yet</Text>
            <Text style={{ fontSize: 12, color: T.ink3 }}>Tap + Create Task to add one</Text>
          </View>
        </Card>
      ) : tasks.map((t, i) => {
        const statusKey    = (t.status || 'pending').toLowerCase();
        const statusColor  = TASK_STATUS_COLORS[statusKey] || '#888';
        const statusLabel  = TASK_STATUS_LABELS[statusKey] || statusKey;
        const priorityKey  = (t.priority || 'medium').toLowerCase();
        const priorityColor= PRIORITY_COLORS[priorityKey] || '#888';
        const dueDate      = t.end_date || t.due_date;
        const rawAssignees = Array.isArray(t.assigned_to_user_details) && t.assigned_to_user_details.length > 0
          ? t.assigned_to_user_details
          : (Array.isArray(t.assigned_to) ? t.assigned_to : []);

        return (
          <Card key={t.id || i} padding={12} style={{ marginBottom: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <Text style={{ flex: 1, fontSize: 14, color: T.ink, fontWeight: '600', lineHeight: 19 }} numberOfLines={2}>
                {t.heading || t.title || 'Untitled'}
              </Text>
              <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              {rawAssignees.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {rawAssignees.slice(0, 3).map((u, idx) => {
                    const name = (typeof u === 'object') ? (u.first_name || u.username || '?') : '?';
                    return (
                      <View key={idx} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff', marginLeft: idx === 0 ? 0 : -6 }}>
                        <Text style={{ color: '#7C3AED', fontSize: 9, fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontSize: 11, color: T.ink4 }}>Unassigned</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: priorityColor }} />
                <Text style={{ fontSize: 11, color: priorityColor, fontWeight: '600' }}>
                  {priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1)}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: dueDate ? T.ink3 : T.ink4 }}>
                📅 {dueDate ? fmtDate(dueDate) : '—'}
              </Text>
            </View>
          </Card>
        );
      })}
    </View>
  );

  const MembersTab = () => (
    <View style={{ gap: 8 }}>
      {memberList.length === 0 ? (
        <Card>
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <Text style={{ fontSize: 36, opacity: 0.3 }}>👥</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: T.ink }}>No members</Text>
          </View>
        </Card>
      ) : memberList.map((m, i) => {
        const u = m.user || m.user_details || {};
        const name = u.full_name || (`${u.first_name || ''} ${u.last_name || ''}`).trim() || u.username || 'Unknown';
        const initial = name.charAt(0).toUpperCase();
        const role = (m.role || 'member');
        return (
          <Card key={m.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#7C3AED', fontSize: 17, fontWeight: '700' }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.ink }}>{name}</Text>
              <Text style={{ fontSize: 12, color: T.ink3, marginTop: 1 }}>@{u.username || '—'}</Text>
              {u.email && <Text style={{ fontSize: 11, color: T.ink4, marginTop: 1 }}>{u.email}</Text>}
            </View>
            <View style={{ backgroundColor: '#E9D5FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </Text>
            </View>
          </Card>
        );
      })}
    </View>
  );

  const DocsTab = () => {
    const getExt = (name = '') => name.split('.').pop().toLowerCase();
    const DOC_COLORS = { pdf: T.cRed, doc: T.cBlue, docx: T.cBlue, xls: T.cGreen, xlsx: T.cGreen, ppt: T.cYellow, pptx: T.cYellow };
    return (
      <View style={{ gap: 8 }}>
        {docs.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <Text style={{ fontSize: 36, opacity: 0.3 }}>📄</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: T.ink }}>No documents</Text>
              <Text style={{ fontSize: 12, color: T.ink3 }}>Files uploaded to this project appear here</Text>
            </View>
          </Card>
        ) : docs.map((doc, i) => {
          const name = doc.name || doc.file_name || 'Untitled';
          const ext  = getExt(name);
          const color= DOC_COLORS[ext] || T.ink3;
          const uploader = doc.created_by?.full_name || doc.created_by?.username || '';
          return (
            <Card key={doc.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: color + '22', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color, letterSpacing: 0.4 }}>{ext.toUpperCase().slice(0, 4)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: T.ink, marginBottom: 4 }} numberOfLines={1}>{name}</Text>
                <Text style={{ fontSize: 11, color: T.ink3 }}>
                  {uploader ? `${uploader} · ` : ''}{fmtRelative(doc.created_at || doc.updated_at)}
                </Text>
              </View>
              <Text style={{ fontSize: 20, color: T.ink4 }}>›</Text>
            </Card>
          );
        })}
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.surfaceAlt }}>
        <ActivityIndicator size="large" color={T.brand} />
        <Text style={{ color: T.ink3, marginTop: 12 }}>Loading project…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.surfaceAlt }}>
      <StatusBar barStyle="light-content" backgroundColor={projectColor} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ── Hero section ── */}
        <View style={[s.hero, { backgroundColor: projectColor, paddingTop: insets.top + 10 }]}>
          {/* Nav row */}
          <View style={s.heroActions}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.heroBtn}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={s.heroBtn}>
              <Text style={{ color: '#fff', fontSize: 18 }}>⋯</Text>
            </TouchableOpacity>
          </View>

          {/* Project icon + name */}
          <View style={s.heroInfo}>
            <View style={s.heroIcon}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>
                {projectName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={s.heroName}>{projectName}</Text>
            {project?.description || project?.desc ? (
              <Text style={s.heroDesc} numberOfLines={2}>
                {project.description || project.desc}
              </Text>
            ) : null}
          </View>

          {/* Glass progress card */}
          <View style={s.glassCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Progress</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{progress}%</Text>
            </View>
            <Progress value={progress} color="#fff" h={6} />
            <View style={s.statsRow}>
              <StatItem label="Tasks"   value={totalTasks} />
              <StatItem label="Done"    value={completedTasks} />
              <StatItem label="Members" value={memberList.length} />
              <StatItem label="Docs"    value={docs.length} />
            </View>
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={s.body}>
          <View style={s.tabBar}>
            {TABS.map(tab => {
              const active = tab === activeTab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[s.tab, active && s.tabActive]}
                >
                  <Text style={[s.tabText, active && s.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Tab content ── */}
          {activeTab === 'Overview' && <OverviewTab />}
          {activeTab === 'Tasks'    && <TasksTab />}
          {activeTab === 'Members'  && <MembersTab />}
          {activeTab === 'Docs'     && <DocsTab />}
        </View>
      </ScrollView>

      {/* FAB for creating tasks */}
      {activeTab === 'Tasks' && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Main', { screen: 'Tasks', params: { openCreateModal: true, presetProjectId: projectId } })}
          style={[s.fab, { backgroundColor: projectColor }]}
        >
          <Text style={s.fabPlus}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  hero: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  heroBtn: {
    width: 38, height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroInfo: {
    alignItems: 'center',
    marginBottom: 18,
  },
  heroIcon: {
    width: 56, height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 18,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: T.rLg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    justifyContent: 'space-between',
  },
  body: {
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: T.r || 10,
  },
  tabActive: {
    backgroundColor: T.ink,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.ink3,
  },
  tabTextActive: {
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 36,
    width: 56, height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 30,
  },
  fabPlus: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '400',
    marginTop: -2,
  },
});
