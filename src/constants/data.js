import { T } from './tokens';

function makeAvatar(initials, baseHex) {
  const n = parseInt(baseHex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 32);
  const g = Math.max(0, ((n >> 8)  & 255) - 32);
  const b = Math.max(0, (n & 255) - 32);
  const darker = '#' + ((1<<24) | (r<<16) | (g<<8) | b).toString(16).slice(1);
  return { initials, baseHex, darker };
}

export const USER = {
  name: 'Rohit Singh',
  email: 'rohit@dyuksa.com',
  role: 'Admin',
  avatar: makeAvatar('RS', '#2D6AE3'),
};

export const TEAMMATES = [
  { name: 'Harshit S.',   role: 'Product',     avatar: makeAvatar('HS', '#2D6AE3'), initials: 'HS', color: T.cBlue   },
  { name: 'Aanya Verma',  role: 'Design',      avatar: makeAvatar('AV', '#7A5AF8'), initials: 'AV', color: T.cPurple },
  { name: 'Kabir Mehta',  role: 'Engineering', avatar: makeAvatar('KM', '#22A06B'), initials: 'KM', color: T.cGreen  },
  { name: 'Sara Iyer',    role: 'Engineering', avatar: makeAvatar('SI', '#E5A60E'), initials: 'SI', color: T.cYellow },
  { name: 'Devon Park',   role: 'Marketing',   avatar: makeAvatar('DP', '#E5484D'), initials: 'DP', color: T.cRed    },
  { name: 'Maya Chen',    role: 'Operations',  avatar: makeAvatar('MC', '#0EA5E9'), initials: 'MC', color: T.cBlue   },
  { name: 'Omar Khalid',  role: 'Engineering', avatar: makeAvatar('OK', '#10B981'), initials: 'OK', color: T.cGreen  },
];

export const PROJECTS = [
  { id: 'alpha', name: 'Alpha Project', tasks: 45, progress: 75, status: 'In Progress', color: T.cBlue,   desc: 'New checkout & billing flow',     members: 6 },
  { id: 'beta',  name: 'Beta Project',  tasks: 32, progress: 50, status: 'In Progress', color: T.cPurple, desc: 'Mobile app launch readiness',     members: 5 },
  { id: 'gamma', name: 'Gamma Project', tasks: 16, progress: 80, status: 'In Progress', color: T.cGreen,  desc: 'Analytics & reporting overhaul',  members: 4 },
  { id: 'delta', name: 'Delta Project', tasks: 12, progress: 25, status: 'In Progress', color: T.cYellow, desc: 'Partner integrations',            members: 3 },
  { id: 'arch',  name: 'Archive',       tasks: 15, progress: 100,status: 'Completed',   color: T.cRed,    desc: 'Q4 cleanup & migration',          members: 2 },
];

export const TASKS = [
  { id: 1, title: 'AI Inaccuracy in Suggested Event Time Slots', project: 'DYUKSA', date: 'May 6, 2026',  priority: 'Medium',   status: 'In Progress', assignee: 'Harshit S.' },
  { id: 2, title: 'Issue in Deployment side in document preview', project: 'DYUKSA', date: 'May 6, 2026',  priority: 'Critical', status: 'In Progress', assignee: 'Kabir Mehta' },
  { id: 3, title: 'Must have Calendar Sharing Feature with the team', project: 'DYUKSA', date: 'May 4, 2026',  priority: 'Medium',   status: 'Completed',   assignee: 'Aanya Verma' },
  { id: 4, title: 'Update pricing page with new plan',          project: 'DYUKSA', date: 'May 10, 2026', priority: 'Medium',   status: 'Pending',     assignee: 'Devon Park' },
  { id: 5, title: 'Fix alignment on mobile view',               project: 'DYUKSA', date: 'May 12, 2026', priority: 'Low',      status: 'Pending',     assignee: 'Sara Iyer' },
  { id: 6, title: 'Migrate legacy auth to v2',                  project: 'Alpha',  date: 'May 14, 2026', priority: 'Critical', status: 'In Progress', assignee: 'Kabir Mehta' },
  { id: 7, title: 'QA pass on onboarding flow',                 project: 'Beta',   date: 'May 9, 2026',  priority: 'Medium',   status: 'In Progress', assignee: 'Sara Iyer' },
  { id: 8, title: 'Draft Q2 OKRs',                              project: 'Gamma',  date: 'May 3, 2026',  priority: 'Low',      status: 'Completed',   assignee: 'Maya Chen' },
  { id: 9, title: 'Investigate spike in 5xx errors',            project: 'Alpha',  date: 'May 2, 2026',  priority: 'Critical', status: 'Overdue',     assignee: 'Omar Khalid' },
  { id: 10,title: 'Refresh marketing site hero copy',           project: 'Beta',   date: 'May 16, 2026', priority: 'Low',      status: 'Pending',     assignee: 'Devon Park' },
];

export const DOCS = [
  { id: 1, name: 'Master Service Agreement.pdf',   kind: 'pdf',  folder: 'Alpha / Contracts',  modified: '2 hours ago',  size: '1.2 MB' },
  { id: 2, name: 'NDA_John_Doe.docx',              kind: 'doc',  folder: 'Alpha / Legal',      modified: '5 hours ago',  size: '342 KB' },
  { id: 3, name: 'Q1_Financial_Report.xlsx',       kind: 'xls',  folder: 'Alpha / Finance',    modified: '2 days ago',   size: '2.4 MB' },
  { id: 4, name: 'Project_Overview.pptx',          kind: 'ppt',  folder: 'Beta / Presentation',modified: '3 days ago',   size: '8.1 MB' },
  { id: 5, name: 'Brand Guidelines v3.pdf',        kind: 'pdf',  folder: 'Brand',              modified: '1 week ago',   size: '12.4 MB' },
  { id: 6, name: 'Q2 Roadmap.docx',                kind: 'doc',  folder: 'Gamma',              modified: '1 week ago',   size: '512 KB' },
  { id: 7, name: 'User Research — May.pdf',        kind: 'pdf',  folder: 'Beta / Research',    modified: '2 weeks ago',  size: '4.8 MB' },
];

export const ACTIVITY = [
  { kind: 'pdf', title: 'Master Service Agreement.pdf', sub: 'Uploaded in Alpha / Contracts', when: '2 hours ago' },
  { kind: 'doc', title: 'NDA_John_Doe.docx',           sub: 'Uploaded in Alpha / Legal',     when: '5 hours ago' },
  { kind: 'xls', title: 'Q1_Financial_Report.xlsx',    sub: 'Uploaded in Alpha / Finance',   when: '2 days ago'  },
  { kind: 'ppt', title: 'Project_Overview.pptx',       sub: 'Updated in Beta / Presentation',when: '3 days ago'  },
  { kind: 'task',title: 'AI Inaccuracy in Suggested Event Time Slots', sub: 'Task updated by Harshit S.', when: '4 days ago' },
];

export const NOTIFS = [
  { id: 1, unread: true,  kind: 'mention',  who: 'Harshit S.', msg: 'mentioned you in "AI Inaccuracy in Suggested Event Time Slots"', when: '12m ago' },
  { id: 2, unread: true,  kind: 'assign',   who: 'Aanya Verma',msg: 'assigned you a task in Beta Project', when: '1h ago' },
  { id: 3, unread: true,  kind: 'comment',  who: 'Kabir Mehta',msg: 'commented on "Issue in Deployment side in document preview"', when: '3h ago' },
  { id: 4, unread: false, kind: 'due',      who: 'System',     msg: '"Update pricing page with new plan" is due in 2 days', when: 'Yesterday' },
  { id: 5, unread: false, kind: 'upload',   who: 'Sara Iyer',  msg: 'uploaded Q1_Financial_Report.xlsx', when: '2 days ago' },
  { id: 6, unread: false, kind: 'project',  who: 'Maya Chen',  msg: 'created the Delta Project workspace', when: '3 days ago' },
];

export const CAL_MONTH  = 'May 2026';
export const CAL_FIRST_DOW = 5;
export const CAL_DAYS = 31;
export const CAL_EVENTS = {
  3:  [{ title: 'Draft Q2 OKRs',                  color: T.cGreen  }],
  4:  [{ title: 'Calendar sharing review',        color: T.cBlue   }],
  6:  [{ title: 'AI Inaccuracy bug',              color: T.cBlue   }, { title: 'Document preview',     color: T.cRed }],
  9:  [{ title: 'QA pass — onboarding',           color: T.cBlue   }],
  10: [{ title: 'Pricing page update',            color: T.cYellow }],
  12: [{ title: 'Mobile alignment fix',           color: T.cYellow }],
  14: [{ title: 'Auth v2 migration',              color: T.cBlue   }],
  16: [{ title: 'Hero copy refresh',              color: T.cYellow }],
  20: [{ title: 'Sprint review',                  color: T.cPurple }],
  22: [{ title: 'Design review',                  color: T.cPurple }],
  27: [{ title: 'Launch readiness',               color: T.cBlue   }],
};

export const TIMED_EVENTS = {
  3:  [
    { title: 'Draft Q2 OKRs',       color: T.cGreen,  start: 10,    dur: 1.5, kind: 'meeting' },
    { title: 'Lunch w/ Maya',       color: T.cPurple, start: 12.5,  dur: 1,   kind: 'meeting' },
  ],
  4:  [
    { title: 'Calendar sharing review', color: T.cBlue, start: 9.5, dur: 1, kind: 'meeting' },
    { title: 'Deep work: docs',     color: T.cYellow, start: 14,    dur: 2, kind: 'task' },
  ],
  6:  [
    { title: 'AI Inaccuracy bug',   color: T.cBlue,   start: 9,     dur: 2, kind: 'task' },
    { title: 'Design crit',         color: T.cPurple, start: 11.5,  dur: 0.75, kind: 'meeting' },
    { title: 'Document preview',    color: T.cRed,    start: 14,    dur: 1.5, kind: 'task' },
    { title: '1:1 w/ Harshit',      color: T.cGreen,  start: 16,    dur: 0.5, kind: 'meeting' },
  ],
  9:  [
    { title: 'QA pass — onboarding', color: T.cBlue,  start: 9.5,   dur: 2.5, kind: 'task' },
    { title: 'Customer call',        color: T.cPurple, start: 14,    dur: 1,   kind: 'meeting' },
  ],
  10: [
    { title: 'Pricing page update', color: T.cYellow, start: 10,    dur: 3, kind: 'task' },
  ],
  12: [
    { title: 'Daily standup',       color: T.cPurple, start: 9,     dur: 0.25, kind: 'meeting' },
    { title: 'AI bug investigation', color: T.cBlue,   start: 10,    dur: 2,    kind: 'task' },
    { title: 'Design review',       color: T.cPurple, start: 13,    dur: 0.75, kind: 'meeting' },
    { title: 'Mobile alignment fix', color: T.cYellow, start: 14.5,  dur: 1.5,  kind: 'task' },
    { title: 'Sync — auth v2',      color: T.cGreen,  start: 16.5,  dur: 0.5,  kind: 'meeting' },
  ],
  14: [
    { title: 'Auth v2 migration',   color: T.cBlue,   start: 9,     dur: 4, kind: 'task' },
    { title: 'Team lunch',          color: T.cGreen,  start: 12.5,  dur: 1, kind: 'meeting' },
  ],
  16: [
    { title: 'Hero copy refresh',   color: T.cYellow, start: 11,    dur: 2, kind: 'task' },
  ],
  20: [
    { title: 'Sprint review',       color: T.cPurple, start: 14,    dur: 1.5, kind: 'meeting' },
    { title: 'Retrospective',       color: T.cBlue,   start: 16,    dur: 1, kind: 'meeting' },
  ],
  22: [
    { title: 'Design review',       color: T.cPurple, start: 10,    dur: 1, kind: 'meeting' },
    { title: 'Customer interview',  color: T.cGreen,  start: 15,    dur: 1, kind: 'meeting' },
  ],
  27: [
    { title: 'Launch readiness',    color: T.cBlue,   start: 11,    dur: 2,   kind: 'meeting' },
    { title: 'Marketing sync',      color: T.cPurple, start: 14.5,  dur: 0.75, kind: 'meeting' },
  ],
};

export const getDayEvents = (d) => TIMED_EVENTS[d] || [];

export const fmtTime = (h) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${mm.toString().padStart(2,'0')} ${ampm}`;
};

export const weekdayOf = (d) => (d + 4) % 7;
export const sundayOf = (d) => d - weekdayOf(d);
