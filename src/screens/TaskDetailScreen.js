import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/tokens';
import { TASKS, TEAMMATES, DOCS } from '../constants/data';
import { Icons } from '../components/Icons';
import {
  NavBar,
  Card,
  StatusPill,
  PriorityDot,
  Avatar,
  SectionHeader,
  FileTile,
} from '../components/SharedUI';

/* ── mock detail data ─────────────────────────────────── */

const SUBTASKS = [
  { id: 1, title: 'Reproduce the issue on staging', done: true },
  { id: 2, title: 'Identify root cause in scheduler module', done: true },
  { id: 3, title: 'Write unit tests for edge cases', done: false },
  { id: 4, title: 'Apply fix and verify on staging', done: false },
  { id: 5, title: 'Update documentation with new behavior', done: false },
];

const ATTACHMENTS = [DOCS[0], DOCS[1], DOCS[2]];

const COMMENTS = [
  {
    id: 1,
    name: 'Harshit S.',
    color: T.cBlue,
    time: '2 hours ago',
    text: 'I looked into this and it seems related to the timezone offset we apply during slot generation. The scheduler does not account for DST transitions.',
  },
  {
    id: 2,
    name: 'Kabir Mehta',
    color: T.cGreen,
    time: '1 hour ago',
    text: 'Confirmed. The Luxon library we use silently falls back to UTC when the zone string is malformed. I have a patch ready for review.',
  },
  {
    id: 3,
    name: 'Aanya Verma',
    color: T.cPurple,
    time: '30 min ago',
    text: 'Can we also add a visual indicator in the calendar view so users know when AI-suggested slots might be approximate?',
  },
];

const DESCRIPTION =
  'The AI-powered scheduling assistant occasionally suggests incorrect time slots for events, particularly when users are in different time zones or when daylight saving transitions occur. This causes confusion and missed meetings for cross-timezone teams. We need to audit the slot-generation pipeline and ensure all timezone conversions are handled correctly.';

/* ── helpers ──────────────────────────────────────────── */

const findTeammate = (name) =>
  TEAMMATES.find((t) => t.name === name) || TEAMMATES[0];

/* ── main screen ──────────────────────────────────────── */

export default function TaskDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const taskId = route.params?.id ?? 1;
  const task = TASKS.find((t) => t.id === taskId) || TASKS[0];
  const teammate = findTeammate(task.assignee);

  const [subtasks, setSubtasks] = useState(SUBTASKS);
  const [comment, setComment] = useState('');

  const doneCount = subtasks.filter((s) => s.done).length;
  const isDone = task.status === 'Completed';

  const toggleSubtask = (id) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    );
  };

  return (
    <View style={styles.container}>
      {/* nav bar */}
      <NavBar
        title={task.project}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity style={styles.iconBtn}>
            {Icons.more({ color: T.ink2, size: 20 })}
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + 90,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── title block ──────────────────────────────── */}
        <View style={styles.titleBlock}>
          <View
            style={[
              styles.titleCheckbox,
              isDone && { backgroundColor: T.cGreen, borderColor: T.cGreen },
            ]}
          >
            {isDone && Icons.check({ color: '#fff', size: 16, sw: 3 })}
          </View>
          <Text
            style={[
              styles.titleText,
              isDone && { textDecorationLine: 'line-through', opacity: 0.55 },
            ]}
          >
            {task.title}
          </Text>
        </View>

        {/* ── meta grid ────────────────────────────────── */}
        <Card style={{ marginTop: 16, padding: 0 }}>
          {/* status */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status</Text>
            <StatusPill status={task.status} size="md" />
          </View>
          <View style={styles.metaDivider} />

          {/* priority */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Priority</Text>
            <PriorityDot priority={task.priority} />
          </View>
          <View style={styles.metaDivider} />

          {/* due date */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <View style={styles.metaValue}>
              {Icons.cal({ color: T.ink3, size: 14, sw: 1.5 })}
              <Text style={styles.metaValueText}>{task.date}</Text>
            </View>
          </View>
          <View style={styles.metaDivider} />

          {/* project */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Project</Text>
            <View style={styles.projectChip}>
              <Text style={styles.projectChipText}>{task.project}</Text>
            </View>
          </View>
          <View style={styles.metaDivider} />

          {/* assignee */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Assignee</Text>
            <View style={styles.metaValue}>
              <Avatar name={teammate.name} color={teammate.color} size={24} />
              <Text style={styles.metaValueText}>{teammate.name}</Text>
            </View>
          </View>
        </Card>

        {/* ── description ──────────────────────────────── */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader>Description</SectionHeader>
          <Card>
            <Text style={styles.descText}>{DESCRIPTION}</Text>
          </Card>
        </View>

        {/* ── subtasks ─────────────────────────────────── */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader
            right={
              <View style={styles.subtaskCount}>
                <Text style={styles.subtaskCountText}>
                  {doneCount}/{subtasks.length}
                </Text>
              </View>
            }
          >
            Subtasks
          </SectionHeader>
          <Card style={{ padding: 0 }}>
            {subtasks.map((st, idx) => (
              <React.Fragment key={st.id}>
                <TouchableOpacity
                  onPress={() => toggleSubtask(st.id)}
                  style={styles.subtaskRow}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.subtaskCheck,
                      st.done && {
                        backgroundColor: T.cGreen,
                        borderColor: T.cGreen,
                      },
                    ]}
                  >
                    {st.done && Icons.check({ color: '#fff', size: 11, sw: 3 })}
                  </View>
                  <Text
                    style={[
                      styles.subtaskText,
                      st.done && {
                        textDecorationLine: 'line-through',
                        opacity: 0.5,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {st.title}
                  </Text>
                </TouchableOpacity>
                {idx < subtasks.length - 1 && (
                  <View style={styles.subtaskDivider} />
                )}
              </React.Fragment>
            ))}
          </Card>
        </View>

        {/* ── attachments ──────────────────────────────── */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader>Attachments</SectionHeader>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {ATTACHMENTS.map((doc) => (
              <Card
                key={doc.id}
                style={styles.attachCard}
                padding={12}
              >
                <FileTile kind={doc.kind} size={36} />
                <Text style={styles.attachName} numberOfLines={2}>
                  {doc.name}
                </Text>
                <Text style={styles.attachMeta}>{doc.size}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* ── activity / comments ──────────────────────── */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader>Activity</SectionHeader>
          <View style={{ gap: 16 }}>
            {COMMENTS.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <Avatar name={c.name} color={c.color} size={32} />
                <View style={{ flex: 1 }}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentName}>{c.name}</Text>
                    <Text style={styles.commentTime}>{c.time}</Text>
                  </View>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ── bottom composer ─────────────────────────────── */}
      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, 30) },
        ]}
      >
        <TouchableOpacity style={styles.composerAttach}>
          {Icons.attach({ color: T.ink3, size: 20, sw: 1.6 })}
        </TouchableOpacity>
        <View style={styles.composerInputWrap}>
          <TextInput
            style={styles.composerInput}
            placeholder="Add a comment..."
            placeholderTextColor={T.ink4}
            value={comment}
            onChangeText={setComment}
            multiline={false}
          />
        </View>
        <TouchableOpacity style={styles.composerSend} activeOpacity={0.75}>
          {Icons.chevR({ color: '#fff', size: 20, sw: 2.5 })}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── styles ───────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* title block */
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: T.hairline,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  titleText: {
    flex: 1,
    fontSize: 21,
    fontWeight: '700',
    color: T.ink,
    lineHeight: 28,
    letterSpacing: -0.3,
  },

  /* meta grid */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: T.ink3,
  },
  metaValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink2,
  },
  metaDivider: {
    height: 1,
    backgroundColor: T.hairline,
    marginHorizontal: 14,
  },
  projectChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: T.surfaceCool,
  },
  projectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.ink2,
  },

  /* description */
  descText: {
    fontSize: 14,
    lineHeight: 22,
    color: T.ink2,
    letterSpacing: -0.05,
  },

  /* subtasks */
  subtaskCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: T.surfaceCool,
  },
  subtaskCountText: {
    fontSize: 12,
    fontWeight: '650',
    color: T.ink3,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  subtaskCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: T.hairline,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: T.ink,
  },
  subtaskDivider: {
    height: 1,
    backgroundColor: T.hairlineSoft,
    marginLeft: 44,
  },

  /* attachments */
  attachCard: {
    width: 140,
    gap: 8,
  },
  attachName: {
    fontSize: 12,
    fontWeight: '600',
    color: T.ink,
    lineHeight: 17,
  },
  attachMeta: {
    fontSize: 11,
    color: T.ink3,
  },

  /* comments */
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentName: {
    fontSize: 13,
    fontWeight: '650',
    color: T.ink,
  },
  commentTime: {
    fontSize: 11,
    color: T.ink4,
  },
  commentBubble: {
    backgroundColor: T.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 19,
    color: T.ink2,
  },

  /* bottom composer */
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: T.surface,
    borderTopWidth: 1,
    borderTopColor: T.hairlineSoft,
  },
  composerAttach: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInputWrap: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.surfaceAlt,
    borderWidth: 1,
    borderColor: T.hairline,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  composerInput: {
    fontSize: 14,
    color: T.ink,
  },
  composerSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
