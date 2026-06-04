import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../constants/tokens';
import { DOCS } from '../constants/data';
import { Icons } from '../components/Icons';
import {
  TopBar,
  Card,
  SectionHeader,
  TextLink,
  DropdownChip,
  FileTile,
} from '../components/SharedUI';

const { width: SCREEN_W } = Dimensions.get('window');

/* ── folder data ───────────────────────────────────── */

const FOLDERS = [
  { name: 'Alpha',     count: 24, color: T.cBlue,   soft: T.cBlueSoft   },
  { name: 'Beta',      count: 12, color: T.cPurple,  soft: T.cPurpleSoft },
  { name: 'Gamma',     count: 8,  color: T.cGreen,   soft: T.cGreenSoft  },
  { name: 'Contracts', count: 18, color: T.cYellow,  soft: T.cYellowSoft },
];

/* ── storage card ──────────────────────────────────── */

function StorageCard() {
  const used = 12.4;
  const total = 50;
  const pct = (used / total) * 100;

  return (
    <LinearGradient
      colors={[T.brandDark, T.brand]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.storageCard}
    >
      <View style={styles.storageTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.storageLabel}>Storage</Text>
          <Text style={styles.storageValue}>{used} / {total} GB used</Text>
        </View>
        <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.7}>
          <Text style={styles.upgradeBtnText}>Upgrade</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.storageTrack}>
        <View style={[styles.storageBar, { width: `${pct}%` }]} />
      </View>
    </LinearGradient>
  );
}

/* ── folder card ───────────────────────────────────── */

function FolderCard({ folder, onPress }) {
  return (
    <Card style={styles.folderCard} onPress={onPress} padding={12}>
      <View style={styles.folderTop}>
        <View style={[styles.folderIcon, { backgroundColor: folder.soft }]}>
          {Icons.folder({ color: folder.color, size: 20 })}
        </View>
        <TouchableOpacity style={styles.folderMore} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {Icons.more({ color: T.ink4, size: 16 })}
        </TouchableOpacity>
      </View>
      <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
      <Text style={styles.folderCount}>{folder.count} files</Text>
    </Card>
  );
}

/* ── list row ──────────────────────────────────────── */

function FileListRow({ doc, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.fileRow} activeOpacity={0.6}>
      <FileTile kind={doc.kind} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.fileName} numberOfLines={1}>{doc.name}</Text>
        <View style={styles.fileMeta}>
          <Text style={styles.fileMetaText}>{doc.folder}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.fileMetaText}>{doc.modified}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.fileMetaText}>{doc.size}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ── grid card ─────────────────────────────────────── */

function FileGridCard({ doc, onPress }) {
  return (
    <Card style={styles.gridCard} onPress={onPress} padding={12}>
      <FileTile kind={doc.kind} size={42} />
      <Text style={styles.gridName} numberOfLines={2}>{doc.name}</Text>
      <View style={styles.gridFooter}>
        <Text style={styles.gridMeta}>{doc.size}</Text>
        <View style={styles.metaDot} />
        <Text style={styles.gridMeta}>{doc.modified}</Text>
      </View>
    </Card>
  );
}

/* ── view toggle ───────────────────────────────────── */

function ViewToggle({ isGrid, onToggle }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={styles.toggleBtn}
      activeOpacity={0.7}
    >
      {isGrid ? (
        /* list icon */
        <View style={{ gap: 3 }}>
          <View style={[styles.toggleLine, { width: 14 }]} />
          <View style={[styles.toggleLine, { width: 14 }]} />
          <View style={[styles.toggleLine, { width: 14 }]} />
        </View>
      ) : (
        /* grid icon */
        <View style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap', width: 15 }}>
          <View style={styles.toggleDot} />
          <View style={styles.toggleDot} />
          <View style={styles.toggleDot} />
          <View style={styles.toggleDot} />
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ── main component ────────────────────────────────── */

export default function DocumentsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [gridView, setGridView] = useState(false);
  const colW = (SCREEN_W - 18 * 2 - 10) / 2;

  return (
    <View style={styles.container}>
      <TopBar
        title="Documents"
        subtitle="7 files"
        onMenu={() => {}}
        onSearch={() => navigation.navigate('Search')}
        onBell={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Storage */}
        <StorageCard />

        {/* Folders */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader right={<TextLink onPress={() => {}}>See All</TextLink>}>
            Folders
          </SectionHeader>

          <View style={styles.foldersGrid}>
            {FOLDERS.map((f, i) => (
              <FolderCard key={i} folder={f} onPress={() => {}} />
            ))}
          </View>
        </View>

        {/* All Files */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <DropdownChip label="Recent" />
                <ViewToggle isGrid={gridView} onToggle={() => setGridView(v => !v)} />
              </View>
            }
          >
            All Files
          </SectionHeader>

          {gridView ? (
            /* Grid view */
            <View style={styles.filesGrid}>
              {DOCS.map((doc) => (
                <FileGridCard
                  key={doc.id}
                  doc={doc}
                  onPress={() => navigation.navigate('DocumentViewer', { id: doc.id })}
                />
              ))}
            </View>
          ) : (
            /* List view */
            <Card style={{ padding: 0 }} padding={0}>
              {DOCS.map((doc, i) => (
                <View key={doc.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <FileListRow
                    doc={doc}
                    onPress={() => navigation.navigate('DocumentViewer', { id: doc.id })}
                  />
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ── styles ────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
  },

  /* storage */
  storageCard: {
    borderRadius: T.rLg,
    padding: 18,
    gap: 14,
  },
  storageTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  storageValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  upgradeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  upgradeBtnText: {
    fontSize: 13,
    fontWeight: '650',
    color: '#fff',
  },
  storageTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  storageBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },

  /* folders */
  foldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  folderCard: {
    width: (Dimensions.get('window').width - 18 * 2 - 10) / 2,
    gap: 8,
  },
  folderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderMore: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderName: {
    fontSize: 14,
    fontWeight: '650',
    color: T.ink,
    letterSpacing: -0.1,
  },
  folderCount: {
    fontSize: 12,
    color: T.ink3,
  },

  /* file list */
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  fileName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: T.ink,
    letterSpacing: -0.1,
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  fileMetaText: {
    fontSize: 11,
    color: T.ink3,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: T.ink4,
  },
  divider: {
    height: 1,
    backgroundColor: T.hairlineSoft,
    marginHorizontal: 14,
  },

  /* file grid */
  filesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    width: (Dimensions.get('window').width - 18 * 2 - 10) / 2,
    gap: 8,
  },
  gridName: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink,
    letterSpacing: -0.1,
  },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gridMeta: {
    fontSize: 11,
    color: T.ink3,
  },

  /* toggle */
  toggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: T.ink3,
  },
  toggleDot: {
    width: 6,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: T.ink3,
  },
});
