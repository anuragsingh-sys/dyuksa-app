import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle, Polyline, Line } from 'react-native-svg';
import { T } from '../constants/tokens';
import { Icons } from './Icons';
import { TEAMMATES } from '../constants/data';

export function TopBar({ title, subtitle, onMenu, onSearch, onBell, unread = 0, right }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: 10, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.hairlineSoft, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {onMenu ? (
        <TouchableOpacity onPress={onMenu} style={styles.iconBtn}>
          {Icons.menu({ color: T.ink, size: 22 })}
        </TouchableOpacity>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '650', color: T.ink, letterSpacing: -0.2 }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right || (
        <>
          {onSearch && <TouchableOpacity onPress={onSearch} style={styles.iconBtn}>{Icons.search({ color: T.ink, size: 20 })}</TouchableOpacity>}
          {onBell && (
            <TouchableOpacity onPress={onBell} style={[styles.iconBtn, { position: 'relative' }]}>
              {Icons.bell({ color: T.ink, size: 20 })}
              {unread > 0 && (
                <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, backgroundColor: T.cRed, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

export function NavBar({ title, onBack, right }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 10, paddingLeft: 8, paddingRight: 12, paddingBottom: 10, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.hairlineSoft, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <TouchableOpacity onPress={onBack} style={[styles.iconBtn, { width: 44 }]}>
        {Icons.back({ color: T.ink, size: 24 })}
      </TouchableOpacity>
      <Text style={{ flex: 1, fontSize: 17, fontWeight: '650', color: T.ink, textAlign: 'center', letterSpacing: -0.2 }}>{title}</Text>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function StatusPill({ status, size = 'sm' }) {
  const map = {
    'In Progress': { bg: T.inProgressBg, fg: T.inProgressFg },
    'Completed':   { bg: T.completedBg,  fg: T.completedFg  },
    'Pending':     { bg: T.pendingBg,    fg: T.pendingFg    },
    'Overdue':     { bg: T.overdueBg,    fg: T.overdueFg    },
  };
  const m = map[status] || map['In Progress'];
  const isSm = size === 'sm';
  return (
    <View style={{ paddingHorizontal: isSm ? 8 : 10, paddingVertical: isSm ? 3 : 5, backgroundColor: m.bg, borderRadius: 999 }}>
      <Text style={{ fontSize: isSm ? 11 : 12, fontWeight: '600', color: m.fg }}>{status}</Text>
    </View>
  );
}

export function PriorityDot({ priority }) {
  const c = priority === 'Critical' ? T.pCritical : priority === 'High' ? T.pHigh : priority === 'Medium' ? T.pMed : T.pLow;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
      <Text style={{ fontSize: 12, color: T.ink2 }}>{priority}</Text>
    </View>
  );
}

export function Avatar({ name, size = 28, color }) {
  const initials = (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color || T.brand, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '650' }}>{initials}</Text>
    </View>
  );
}

export function AvatarStack({ members = TEAMMATES, max = 4, size = 26 }) {
  const shown = members.slice(0, max);
  const rest = Math.max(0, members.length - max);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((m, i) => (
        <View key={i} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 2, borderColor: '#fff', borderRadius: size / 2 + 1, backgroundColor: '#fff' }}>
          <Avatar name={m.name} color={m.color} size={size} />
        </View>
      ))}
      {rest > 0 && (
        <View style={{ marginLeft: -8, width: size, height: size, borderRadius: size / 2, backgroundColor: T.surfaceCool, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
          <Text style={{ fontSize: 11, fontWeight: '650', color: T.ink2 }}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

export function Card({ children, style, onPress, padding = 14 }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.7} style={[{ backgroundColor: T.surface, borderRadius: T.rMd, borderWidth: 1, borderColor: T.hairline, padding }, style]}>
      {children}
    </Wrapper>
  );
}

export function Progress({ value, color = T.brand, h = 6 }) {
  return (
    <View style={{ width: '100%', height: h, backgroundColor: T.hairlineSoft, borderRadius: h / 2, overflow: 'hidden' }}>
      <View style={{ width: `${value}%`, height: '100%', backgroundColor: color, borderRadius: h / 2 }} />
    </View>
  );
}

export function SectionHeader({ children, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '650', color: T.ink, letterSpacing: -0.2 }}>{children}</Text>
      {right}
    </View>
  );
}

export function TextLink({ children, onPress }) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={{ color: T.brand, fontSize: 12, fontWeight: '650' }}>{children}</Text>
    </TouchableOpacity>
  );
}

export function DropdownChip({ label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: T.ink2 }}>{label}</Text>
      {Icons.chevD({ color: T.ink3, size: 12 })}
    </View>
  );
}

export function FileTile({ kind, size = 36 }) {
  const map = {
    pdf:  { bg: '#FCE9EA', fg: '#D14343', label: 'PDF' },
    doc:  { bg: '#E5EEFD', fg: '#2D6AE3', label: 'DOC' },
    xls:  { bg: '#E2F5EC', fg: '#22A06B', label: 'XLS' },
    ppt:  { bg: '#FDECD9', fg: '#D17B1B', label: 'PPT' },
    task: { bg: '#EEEAFE', fg: '#7A5AF8', label: '✓' },
  };
  const m = map[kind] || map.doc;
  return (
    <View style={{ width: size, height: size, borderRadius: 9, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: m.fg, fontWeight: '700', fontSize: size >= 36 ? 11 : 10, letterSpacing: 0.4 }}>{m.label}</Text>
    </View>
  );
}

export function FAB({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ position: 'absolute', right: 18, bottom: 36, width: 56, height: 56, borderRadius: 28, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', shadowColor: T.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.42, shadowRadius: 12, elevation: 8, zIndex: 30 }}>
      {Icons.plus({ color: '#fff', size: 24, sw: 2.2 })}
    </TouchableOpacity>
  );
}

export function EmptyState({ title, subtitle, icon }) {
  return (
    <View style={{ padding: 40, alignItems: 'center', gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: T.surfaceCool, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        {icon || Icons.task({ color: T.ink4, size: 28 })}
      </View>
      <Text style={{ fontSize: 15, fontWeight: '650', color: T.ink }}>{title}</Text>
      <Text style={{ fontSize: 13, color: T.ink3, textAlign: 'center' }}>{subtitle}</Text>
    </View>
  );
}

export function Sparkline({ color, data, w = 120, h = 32 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = (max - min) || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4) - 2]);
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={area} fill={color} opacity="0.13" stroke="none"/>
      <Path d={d} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

export function Donut({ data, size = 120, thick = 18 }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const r = (size - thick) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        <SvgCircle cx={cx} cy={cy} r={r} fill="none" stroke={T.hairlineSoft} strokeWidth={thick}/>
        {data.map((d, i) => {
          const len = (d.value / total) * C;
          const node = (
            <SvgCircle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color} strokeWidth={thick}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return node;
        })}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: T.ink, letterSpacing: -0.4 }}>{total}</Text>
        <Text style={{ fontSize: 10, color: T.ink3, fontWeight: '600' }}>Total Tasks</Text>
      </View>
    </View>
  );
}

export function MultiLine({ series, labels, w = 310, h = 140 }) {
  const allMax = Math.max(...series.flatMap(s => s.data));
  const step = w / (series[0].data.length - 1);
  const px = i => i * step;
  const py = v => h - (v / allMax) * (h - 20) - 16;
  return (
    <View>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
          <Line key={i} x1="0" x2={w} y1={py(allMax * g)} y2={py(allMax * g)} stroke={T.hairlineSoft} strokeWidth="1"/>
        ))}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => `${px(i)},${py(v)}`).join(' ');
          return <Polyline key={si} fill="none" stroke={s.color} strokeWidth="2" points={pts} strokeLinecap="round" strokeLinejoin="round"/>;
        })}
        {series.map((s, si) => s.data.map((v, i) => (
          <SvgCircle key={si + '-' + i} cx={px(i)} cy={py(v)} r="2.5" fill={s.color} stroke="none"/>
        )))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, paddingHorizontal: 2 }}>
        {labels.map((l, i) => <Text key={i} style={{ fontSize: 10, color: T.ink3 }}>{l}</Text>)}
      </View>
    </View>
  );
}

export function TaskRow({ task, onPress }) {
  const done = task.status === 'Completed';
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: done ? T.cGreen : T.hairline, backgroundColor: done ? T.cGreen : '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {done && Icons.check({ color: '#fff', size: 11, sw: 3 })}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: T.ink, textDecorationLine: done ? 'line-through' : 'none', opacity: done ? 0.55 : 1 }} numberOfLines={1}>{task.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <Text style={{ fontSize: 10.5, color: T.ink3 }}>{task.project}</Text>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: T.ink4 }} />
          <Text style={{ fontSize: 10.5, color: T.ink3 }}>{task.date}</Text>
        </View>
      </View>
      <StatusPill status={task.status} />
    </TouchableOpacity>
  );
}

export function Tabs({ tabs, children }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <Card style={{ padding: 0, marginBottom: 22 }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: T.hairlineSoft, paddingHorizontal: 10, paddingTop: 4 }}>
        {tabs.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setActive(t.id)} style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: active === t.id ? T.brand : 'transparent', marginBottom: -1 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '650', color: active === t.id ? T.brand : T.ink3 }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ padding: 4, paddingBottom: 8 }}>{children(active)}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
