import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/tokens';
import { PROJECTS, TEAMMATES } from '../constants/data';
import { Icons } from '../components/Icons';
import { NavBar, Card, Avatar } from '../components/SharedUI';

/* ── static data ─────────────────────────────────────── */

const PRIORITIES = [
  { label: 'Low',      key: 'Low',      color: T.pLow      },
  { label: 'Medium',   key: 'Medium',   color: T.pMed      },
  { label: 'High',     key: 'High',     color: T.cRed      },
  { label: 'Critical', key: 'Critical', color: T.pCritical  },
];

const SUBTASKS = [
  'Write acceptance criteria',
  'Create wireframes for review',
  'Prepare API contract document',
];

/* ── meta row ────────────────────────────────────────── */

function MetaRow({ icon, label, children, isLast }) {
  return (
    <View
      style={[
        styles.metaRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
      ]}
    >
      <View style={styles.metaLeft}>
        {icon}
        <Text style={styles.metaLabel}>{label}</Text>
      </View>
      <View style={styles.metaRight}>
        {children}
      </View>
    </View>
  );
}

/* ── main screen ─────────────────────────────────────── */

export default function CreateTaskScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activePriority, setActivePriority] = useState('Medium');

  const selectedProject = PROJECTS[0];
  const selectedAssignee = TEAMMATES[0];

  return (
    <View style={styles.container}>
      <NavBar
        title="New Task"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity>
            <Text style={styles.saveLink}>Save</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title input */}
        <TextInput
          style={styles.titleInput}
          placeholder="Task title"
          placeholderTextColor={T.ink4}
          value={title}
          onChangeText={setTitle}
          multiline={false}
        />

        {/* Description */}
        <View style={styles.descWrap}>
          <TextInput
            style={styles.descInput}
            placeholder="Add a description..."
            placeholderTextColor={T.ink4}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Meta card */}
        <Card style={styles.metaCard} padding={0}>
          {/* Project */}
          <MetaRow
            icon={Icons.folder({ color: T.ink3, size: 18 })}
            label="Project"
          >
            <TouchableOpacity style={styles.pickerRow} activeOpacity={0.7}>
              <View style={[styles.projectDot, { backgroundColor: selectedProject.color }]} />
              <Text style={styles.pickerText}>{selectedProject.name}</Text>
              {Icons.chevR({ color: T.ink4, size: 14 })}
            </TouchableOpacity>
          </MetaRow>

          {/* Assignee */}
          <MetaRow
            icon={Icons.user({ color: T.ink3, size: 18 })}
            label="Assignee"
          >
            <TouchableOpacity style={styles.pickerRow} activeOpacity={0.7}>
              <Avatar name={selectedAssignee.name} color={selectedAssignee.color} size={22} />
              <Text style={styles.pickerText}>{selectedAssignee.name}</Text>
              {Icons.chevR({ color: T.ink4, size: 14 })}
            </TouchableOpacity>
          </MetaRow>

          {/* Due date */}
          <MetaRow
            icon={Icons.cal({ color: T.ink3, size: 18 })}
            label="Due date"
          >
            <TouchableOpacity style={styles.pickerRow} activeOpacity={0.7}>
              <Text style={styles.pickerText}>Jun 10, 2026</Text>
              {Icons.chevR({ color: T.ink4, size: 14 })}
            </TouchableOpacity>
          </MetaRow>

          {/* Priority */}
          <MetaRow
            icon={Icons.flag({ color: T.ink3, size: 18 })}
            label="Priority"
            isLast
          >
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => {
                const active = p.key === activePriority;
                return (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setActivePriority(p.key)}
                    style={[
                      styles.priorityChip,
                      active && { backgroundColor: T.brandSoft, borderColor: T.brand },
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.priorityLabel, active && { color: T.brand, fontWeight: '650' }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </MetaRow>
        </Card>

        {/* Subtasks */}
        <Text style={styles.sectionTitle}>Subtasks</Text>
        <Card style={styles.subtaskCard} padding={0}>
          {SUBTASKS.map((sub, idx) => (
            <View
              key={idx}
              style={[
                styles.subtaskRow,
                idx < SUBTASKS.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
              ]}
            >
              <View style={styles.subtaskCheck}>
                {/* empty checkbox */}
              </View>
              <Text style={styles.subtaskText}>{sub}</Text>
            </View>
          ))}
        </Card>

        {/* Attachments */}
        <Text style={styles.sectionTitle}>Attachments</Text>
        <TouchableOpacity style={styles.uploadArea} activeOpacity={0.7}>
          {Icons.upload({ color: T.ink4, size: 24 })}
          <Text style={styles.uploadText}>Tap to upload files</Text>
          <Text style={styles.uploadHint}>PDF, DOC, PNG up to 10 MB</Text>
        </TouchableOpacity>

        {/* Create button */}
        <TouchableOpacity style={styles.createBtn} activeOpacity={0.8}>
          <Text style={styles.createBtnText}>Create Task</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ── styles ───────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
  },
  scroll: {
    padding: 16,
  },
  saveLink: {
    fontSize: 15,
    fontWeight: '650',
    color: T.brand,
  },

  /* Title input */
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: T.ink,
    paddingVertical: 12,
    paddingHorizontal: 4,
    letterSpacing: -0.3,
  },

  /* Description */
  descWrap: {
    backgroundColor: T.surfaceAlt,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    marginBottom: 18,
    minHeight: 100,
  },
  descInput: {
    fontSize: 14,
    color: T.ink,
    padding: 14,
    minHeight: 100,
    lineHeight: 20,
  },

  /* Meta card */
  metaCard: {
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink3,
  },
  metaRight: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink,
  },

  /* Priority chips */
  priorityRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.surface,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: T.ink2,
  },

  /* Section title */
  sectionTitle: {
    fontSize: 15,
    fontWeight: '650',
    color: T.ink,
    letterSpacing: -0.2,
    marginBottom: 8,
    marginTop: 4,
  },

  /* Subtasks */
  subtaskCard: {
    marginBottom: 18,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  subtaskCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: T.hairline,
    backgroundColor: '#fff',
  },
  subtaskText: {
    fontSize: 13,
    fontWeight: '500',
    color: T.ink,
    flex: 1,
  },

  /* Upload area */
  uploadArea: {
    borderWidth: 1.5,
    borderColor: T.hairline,
    borderStyle: 'dashed',
    borderRadius: T.rMd,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    backgroundColor: T.surface,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink2,
    marginTop: 4,
  },
  uploadHint: {
    fontSize: 11,
    color: T.ink4,
  },

  /* Create button */
  createBtn: {
    backgroundColor: T.brand,
    borderRadius: T.rMd,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: T.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
