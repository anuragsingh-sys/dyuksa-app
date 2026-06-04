import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Rect as SvgRect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/tokens';
import { PROJECTS, TEAMMATES } from '../constants/data';
import { Icons } from '../components/Icons';
import {
  TopBar,
  Card,
  SectionHeader,
  Progress,
  Donut,
  Avatar,
} from '../components/SharedUI';

/* ── static data ─────────────────────────────────────── */

const PERIODS = ['7 days', '30 days', '90 days', 'YTD'];

const KPI = [
  { label: 'Tasks completed', value: '142', delta: '+18%', up: true,  color: T.cGreen,  soft: T.cGreenSoft,  icon: Icons.task   },
  { label: 'Cycle time',      value: '2.4d', delta: '-12%', up: false, color: T.cBlue,   soft: T.cBlueSoft,   icon: Icons.trend  },
  { label: 'Throughput',      value: '24/w', delta: '+9%',  up: true,  color: T.cPurple, soft: T.cPurpleSoft, icon: Icons.chart  },
  { label: 'Overdue',         value: '12',   delta: '+4%',  up: true,  color: T.cRed,    soft: T.cRedSoft,    icon: Icons.flag   },
];

const WEEKLY_BARS = [
  { label: 'W1', value: 24 },
  { label: 'W2', value: 32 },
  { label: 'W3', value: 28 },
  { label: 'W4', value: 36 },
  { label: 'W5', value: 22 },
];

const DONUT_DATA = [
  { label: 'In Progress', value: 24, color: T.cBlue   },
  { label: 'Pending',     value: 44, color: T.cYellow },
  { label: 'Completed',   value: 48, color: T.cGreen  },
  { label: 'Overdue',     value: 12, color: T.cRed    },
];

const CONTRIBUTORS = [
  { name: 'Harshit S.',   tasks: 38, color: T.cBlue   },
  { name: 'Aanya Verma',  tasks: 32, color: T.cPurple },
  { name: 'Kabir Mehta',  tasks: 28, color: T.cGreen  },
  { name: 'Sara Iyer',    tasks: 24, color: T.cYellow },
  { name: 'Devon Park',   tasks: 19, color: T.cRed    },
];

const BAR_MAX = Math.max(...WEEKLY_BARS.map(b => b.value));
const BAR_HEIGHT = 130;
const CONTRIB_MAX = Math.max(...CONTRIBUTORS.map(c => c.tasks));

/* ── bar chart component ─────────────────────────────── */

function BarChart() {
  const barWidth = 36;
  return (
    <View style={styles.barChartWrap}>
      <View style={styles.barChartInner}>
        {WEEKLY_BARS.map((bar, i) => {
          const h = (bar.value / BAR_MAX) * BAR_HEIGHT;
          return (
            <View key={i} style={styles.barCol}>
              <Text style={styles.barValue}>{bar.value}</Text>
              <View style={[styles.barTrack, { height: BAR_HEIGHT }]}>
                <View style={{ flex: 1 }} />
                <Svg width={barWidth} height={h}>
                  <Defs>
                    <LinearGradient id={`bg${i}`} x1="0" y1="0" x2="0" y2={h}>
                      <Stop offset="0" stopColor={T.cBlue} stopOpacity="1" />
                      <Stop offset="1" stopColor={T.cBlue} stopOpacity="0.5" />
                    </LinearGradient>
                  </Defs>
                  <SvgRect x="0" y="0" width={barWidth} height={h} rx="6" fill={`url(#bg${i})`} />
                </Svg>
              </View>
              <Text style={styles.barLabel}>{bar.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ── main screen ─────────────────────────────────────── */

export default function ReportsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState('30 days');

  return (
    <View style={styles.container}>
      <TopBar
        title="Reports"
        subtitle="Performance & analytics"
        onMenu={() => navigation.openDrawer()}
        onSearch={() => navigation.navigate('Search')}
        onBell={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Period segmented control */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => {
            const active = p === period;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.periodChip, active && styles.periodChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>{p}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          {KPI.map((k, idx) => (
            <Card key={idx} style={styles.kpiCard} padding={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={[styles.kpiIcon, { backgroundColor: k.soft }]}>
                  {k.icon({ color: k.color, size: 16 })}
                </View>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View>
                  <Text style={styles.kpiValue}>{k.value}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                    {k.up ? Icons.trend({ color: k.color, size: 13, sw: 1.5 }) : Icons.trendDn({ color: k.color, size: 13, sw: 1.5 })}
                    <Text style={[styles.kpiDelta, { color: k.color }]}>{k.delta}</Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Weekly throughput bar chart */}
        <SectionHeader>Weekly Throughput</SectionHeader>
        <Card style={{ marginBottom: 22 }}>
          <BarChart />
        </Card>

        {/* Status distribution donut */}
        <SectionHeader>Status Distribution</SectionHeader>
        <Card style={{ marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Donut data={DONUT_DATA} size={120} thick={18} />
            <View style={{ flex: 1, marginLeft: 20, gap: 10 }}>
              {DONUT_DATA.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
                  <Text style={{ flex: 1, fontSize: 12, color: T.ink2, fontWeight: '500' }}>{d.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '650', color: T.ink }}>{d.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* By project */}
        <SectionHeader>By Project</SectionHeader>
        <Card style={{ marginBottom: 22, padding: 0 }}>
          {PROJECTS.map((proj, idx) => (
            <View
              key={proj.id}
              style={[
                styles.projectRow,
                idx < PROJECTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
              ]}
            >
              <View style={[styles.projectDot, { backgroundColor: proj.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.projectName}>{proj.name}</Text>
                <Text style={styles.projectTasks}>{proj.tasks} tasks</Text>
              </View>
              <View style={{ width: 80, marginRight: 10 }}>
                <Progress value={proj.progress} color={proj.color} h={5} />
              </View>
              <Text style={styles.projectPercent}>{proj.progress}%</Text>
            </View>
          ))}
        </Card>

        {/* Top contributors */}
        <SectionHeader>Top Contributors</SectionHeader>
        <Card style={{ marginBottom: 22, padding: 0 }}>
          {CONTRIBUTORS.map((c, idx) => {
            const teammate = TEAMMATES.find(t => t.name === c.name) || TEAMMATES[0];
            return (
              <View
                key={idx}
                style={[
                  styles.contribRow,
                  idx < CONTRIBUTORS.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairlineSoft },
                ]}
              >
                <Text style={styles.contribRank}>{idx + 1}</Text>
                <Avatar name={c.name} color={teammate.color} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contribName}>{c.name}</Text>
                  <View style={{ marginTop: 4 }}>
                    <Progress value={(c.tasks / CONTRIB_MAX) * 100} color={c.color} h={4} />
                  </View>
                </View>
                <Text style={styles.contribCount}>{c.tasks}</Text>
              </View>
            );
          })}
        </Card>
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

  /* Period control */
  periodRow: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.hairline,
    padding: 3,
    marginBottom: 18,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
  },
  periodChipActive: {
    backgroundColor: T.brand,
  },
  periodText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.ink3,
  },
  periodTextActive: {
    color: '#fff',
  },

  /* KPI grid */
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: T.ink3,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.4,
  },
  kpiDelta: {
    fontSize: 11,
    fontWeight: '650',
  },

  /* Bar chart */
  barChartWrap: {
    paddingTop: 4,
  },
  barChartInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  barCol: {
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barValue: {
    fontSize: 11,
    fontWeight: '650',
    color: T.ink2,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: T.ink3,
    marginTop: 4,
  },

  /* By project */
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  projectDot: {
    width: 8,
    height: 36,
    borderRadius: 4,
  },
  projectName: {
    fontSize: 13,
    fontWeight: '650',
    color: T.ink,
  },
  projectTasks: {
    fontSize: 11,
    color: T.ink3,
    marginTop: 2,
  },
  projectPercent: {
    fontSize: 12,
    fontWeight: '650',
    color: T.ink2,
    minWidth: 34,
    textAlign: 'right',
  },

  /* Contributors */
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  contribRank: {
    fontSize: 14,
    fontWeight: '700',
    color: T.ink4,
    width: 18,
    textAlign: 'center',
  },
  contribName: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink,
  },
  contribCount: {
    fontSize: 14,
    fontWeight: '700',
    color: T.ink,
    minWidth: 28,
    textAlign: 'right',
  },
});
