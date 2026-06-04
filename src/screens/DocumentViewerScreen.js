import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../constants/tokens';
import { DOCS } from '../constants/data';
import { Icons } from '../components/Icons';

/* ── dark theme tokens ─────────────────────────────── */

const DK = {
  bg:     '#202329',
  bar:    '#2A2D34',
  ink:    '#FFFFFF',
  ink2:   'rgba(255,255,255,0.55)',
  ink3:   'rgba(255,255,255,0.35)',
  border: 'rgba(255,255,255,0.08)',
};

/* ── preview content per kind ──────────────────────── */

function PdfPreview() {
  return (
    <View style={styles.previewCard}>
      {/* header */}
      <Text style={styles.confidential}>DYUKSA, INC. — CONFIDENTIAL</Text>
      <View style={styles.previewDivider} />

      <Text style={styles.docTitle}>Master Service Agreement</Text>
      <Text style={styles.docSubtext}>Effective Date: May 1, 2026</Text>

      <View style={{ gap: 16, marginTop: 18 }}>
        <View>
          <Text style={styles.sectionHead}>1. SCOPE OF SERVICES</Text>
          <Text style={styles.sectionBody}>
            Dyuksa, Inc. ("Provider") agrees to provide the Client with the
            software services described in Exhibit A, including maintenance,
            updates, and technical support during the term of this Agreement.
          </Text>
        </View>
        <View>
          <Text style={styles.sectionHead}>2. TERM AND TERMINATION</Text>
          <Text style={styles.sectionBody}>
            This Agreement shall commence on the Effective Date and continue
            for a period of twelve (12) months, unless earlier terminated in
            accordance with the provisions herein.
          </Text>
        </View>
        <View>
          <Text style={styles.sectionHead}>3. COMPENSATION</Text>
          <Text style={styles.sectionBody}>
            Client agrees to pay Provider a monthly fee as outlined in Exhibit
            B. All payments are due within thirty (30) days of invoice.
          </Text>
        </View>
      </View>

      <Text style={styles.pageNum}>1 / 24</Text>
    </View>
  );
}

function XlsPreview() {
  const cols = ['', 'Q1', 'Jan', 'Feb', 'Mar'];
  const rows = [
    ['Revenue',    '$1.2M', '$380K', '$420K', '$400K'],
    ['Expenses',   '$840K', '$260K', '$290K', '$290K'],
    ['Net Income', '$360K', '$120K', '$130K', '$110K'],
    ['Margin',     '30%',   '31.6%', '31.0%', '27.5%'],
    ['Headcount',  '48',    '45',    '47',    '48'],
    ['Hires',      '6',     '2',     '2',     '2'],
  ];

  return (
    <View style={styles.previewCard}>
      <Text style={styles.docTitle}>Q1 Financial Report</Text>
      <View style={{ marginTop: 16 }}>
        {/* header row */}
        <View style={styles.gridRow}>
          {cols.map((c, i) => (
            <View key={i} style={[styles.gridCell, i === 0 && styles.gridCellLabel, i === 0 && { borderLeftWidth: 0 }]}>
              <Text style={[styles.gridHeaderText, i === 0 && { textAlign: 'left' }]}>{c}</Text>
            </View>
          ))}
        </View>
        {/* data rows */}
        {rows.map((row, ri) => (
          <View key={ri} style={[styles.gridRow, ri % 2 === 0 && { backgroundColor: '#F8F9FB' }]}>
            {row.map((cell, ci) => (
              <View key={ci} style={[styles.gridCell, ci === 0 && styles.gridCellLabel, ci === 0 && { borderLeftWidth: 0 }]}>
                <Text style={[styles.gridText, ci === 0 && styles.gridLabelText]}>{cell}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function PptPreview() {
  return (
    <View style={styles.previewCard}>
      {/* main slide */}
      <LinearGradient
        colors={[T.brand, T.cPurple]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.slideMain}
      >
        <Text style={styles.slideTag}>BETA  ·  PRESENTATION</Text>
        <Text style={styles.slideTitle}>Project Overview</Text>
        <Text style={styles.slideSub}>Q2 milestones</Text>
      </LinearGradient>

      {/* thumbnail strip */}
      <View style={styles.thumbStrip}>
        <LinearGradient
          colors={[T.brand, T.cPurple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.thumb, styles.thumbActive]}
        >
          <Text style={styles.thumbLabel}>1</Text>
        </LinearGradient>
        <View style={styles.thumb}>
          <Text style={styles.thumbLabelDark}>2</Text>
        </View>
        <View style={styles.thumb}>
          <Text style={styles.thumbLabelDark}>3</Text>
        </View>
        <View style={styles.thumb}>
          <Text style={styles.thumbLabelDark}>4</Text>
        </View>
        <View style={styles.thumb}>
          <Text style={styles.thumbLabelDark}>5</Text>
        </View>
      </View>
    </View>
  );
}

function DocPreview() {
  return (
    <View style={styles.previewCard}>
      <Text style={styles.confidential}>DRAFT — CONFIDENTIAL</Text>
      <View style={styles.previewDivider} />

      <Text style={styles.docTitle}>Non-Disclosure Agreement</Text>

      <View style={{ gap: 16, marginTop: 18 }}>
        <View>
          <Text style={styles.sectionHead}>1. DEFINITION OF CONFIDENTIAL INFORMATION</Text>
          <Text style={styles.sectionBody}>
            "Confidential Information" means any data or information, oral or
            written, that is treated as confidential by the Disclosing Party,
            including but not limited to trade secrets, business plans, and
            technical specifications.
          </Text>
        </View>
        <View>
          <Text style={styles.sectionHead}>2. OBLIGATIONS OF THE RECEIVING PARTY</Text>
          <Text style={styles.sectionBody}>
            The Receiving Party agrees to hold and maintain the Confidential
            Information in strict confidence and to not disclose it to any
            third parties without prior written consent.
          </Text>
        </View>
        <View>
          <Text style={styles.sectionHead}>3. TERM</Text>
          <Text style={styles.sectionBody}>
            This Agreement shall remain in effect for a period of two (2)
            years from the date of execution. The obligations of
            confidentiality shall survive termination.
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ── action bar button ─────────────────────────────── */

function ActionBtn({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── main component ────────────────────────────────── */

export default function DocumentViewerScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const docId = route.params?.id ?? 1;
  const doc = DOCS.find(d => d.id === docId) || DOCS[0];

  const previewMap = {
    pdf: PdfPreview,
    xls: XlsPreview,
    ppt: PptPreview,
    doc: DocPreview,
  };
  const Preview = previewMap[doc.kind] || PdfPreview;

  return (
    <View style={styles.container}>
      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.navBtn}
          activeOpacity={0.6}
        >
          {Icons.back({ color: DK.ink, size: 24 })}
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle} numberOfLines={1}>{doc.name}</Text>
          <Text style={styles.navSub}>{doc.folder}  ·  {doc.size}</Text>
        </View>

        <TouchableOpacity style={styles.navBtn} activeOpacity={0.6}>
          {Icons.star({ color: DK.ink, size: 20 })}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} activeOpacity={0.6}>
          {Icons.download({ color: DK.ink, size: 20 })}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} activeOpacity={0.6}>
          {Icons.more({ color: DK.ink, size: 20 })}
        </TouchableOpacity>
      </View>

      {/* Preview content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.previewContainer}
        showsVerticalScrollIndicator={false}
      >
        <Preview />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <ActionBtn
          icon={Icons.comment({ color: DK.ink, size: 20 })}
          label="Comment"
        />
        <ActionBtn
          icon={Icons.upload({ color: DK.ink, size: 20 })}
          label="Share"
        />
        <ActionBtn
          icon={Icons.link({ color: DK.ink, size: 20 })}
          label="Copy link"
        />
        <ActionBtn
          icon={Icons.star({ color: DK.ink, size: 20 })}
          label="Star"
        />
      </View>
    </View>
  );
}

/* ── styles ────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DK.bg,
  },

  /* nav bar */
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: DK.bar,
    borderBottomWidth: 1,
    borderBottomColor: DK.border,
    gap: 2,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '650',
    color: DK.ink,
    letterSpacing: -0.2,
  },
  navSub: {
    fontSize: 11.5,
    color: DK.ink2,
    marginTop: 1,
  },

  /* preview area */
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  previewCard: {
    maxWidth: 340,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 28,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },

  /* shared doc text */
  confidential: {
    fontSize: 9.5,
    fontWeight: '700',
    color: T.ink4,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  previewDivider: {
    height: 1,
    backgroundColor: T.hairline,
    marginVertical: 14,
  },
  docTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: T.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  docSubtext: {
    fontSize: 12,
    color: T.ink3,
    textAlign: 'center',
    marginTop: 4,
  },
  sectionHead: {
    fontSize: 10.5,
    fontWeight: '700',
    color: T.ink2,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 12,
    lineHeight: 18,
    color: T.ink3,
  },
  pageNum: {
    fontSize: 11,
    color: T.ink4,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },

  /* xls grid */
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: T.hairlineSoft,
  },
  gridCell: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderLeftWidth: 1,
    borderLeftColor: T.hairlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellLabel: {
    flex: 1.2,
    alignItems: 'flex-start',
  },
  gridHeaderText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: T.ink2,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  gridText: {
    fontSize: 10.5,
    color: T.ink2,
    textAlign: 'center',
  },
  gridLabelText: {
    fontWeight: '600',
    color: T.ink,
    textAlign: 'left',
  },

  /* ppt slide */
  slideMain: {
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    gap: 8,
  },
  slideTag: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  slideSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  thumbStrip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
  },
  thumb: {
    width: 46,
    height: 32,
    borderRadius: 5,
    backgroundColor: T.hairlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbActive: {
    borderWidth: 2,
    borderColor: T.brand,
  },
  thumbLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  thumbLabelDark: {
    fontSize: 10,
    fontWeight: '600',
    color: T.ink4,
  },

  /* bottom bar */
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: DK.bar,
    borderTopWidth: 1,
    borderTopColor: DK.border,
    paddingTop: 12,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
  },
  actionBtn: {
    alignItems: 'center',
    gap: 5,
    minWidth: 60,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: DK.ink2,
  },
});
