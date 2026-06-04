import React from 'react';
import Svg, { Path, Circle, Rect, Line, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const Icon = ({ d, size = 22, color = 'currentColor', sw = 1.7, fill = 'none', children, vb = '0 0 24 24' }) => (
  <Svg width={size} height={size} viewBox={vb} fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d && <Path d={d} />}
    {children}
  </Svg>
);

export const Icons = {
  menu:    (p={}) => <Icon {...p} d="M4 7h16M4 12h16M4 17h16"/>,
  bell:    (p={}) => <Icon {...p} d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6zM10 19a2 2 0 0 0 4 0"/>,
  search:  (p={}) => <Icon {...p}><Circle cx="11" cy="11" r="7" fill="none"/><Path d="m20 20-3.5-3.5"/></Icon>,
  back:    (p={}) => <Icon {...p} d="M15 5l-7 7 7 7"/>,
  chevR:   (p={}) => <Icon {...p} d="M9 6l6 6-6 6"/>,
  chevD:   (p={}) => <Icon {...p} d="M6 9l6 6 6-6"/>,
  plus:    (p={}) => <Icon {...p} d="M12 5v14M5 12h14"/>,
  close:   (p={}) => <Icon {...p} d="M6 6l12 12M18 6L6 18"/>,
  check:   (p={}) => <Icon {...p} d="M5 12l5 5L20 7"/>,
  more:    (p={}) => <Icon {...p} fill="none" sw={0}><Circle cx="5" cy="12" r="1.4" fill={p?.color || '#3B4658'} stroke="none"/><Circle cx="12" cy="12" r="1.4" fill={p?.color || '#3B4658'} stroke="none"/><Circle cx="19" cy="12" r="1.4" fill={p?.color || '#3B4658'} stroke="none"/></Icon>,
  filter:  (p={}) => <Icon {...p} d="M3 6h18M6 12h12M10 18h4"/>,
  home:    (p={}) => <Icon {...p} d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>,
  folder:  (p={}) => <Icon {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  doc:     (p={}) => <Icon {...p} d="M7 3h8l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v6h6"/>,
  task:    (p={}) => <Icon {...p}><Rect x="4" y="4" width="16" height="16" rx="3" fill="none"/><Path d="m8 12 3 3 5-6"/></Icon>,
  cal:     (p={}) => <Icon {...p}><Rect x="3" y="5" width="18" height="16" rx="2" fill="none"/><Path d="M8 3v4M16 3v4M3 10h18"/></Icon>,
  work:    (p={}) => <Icon {...p}><Rect x="3" y="7" width="18" height="13" rx="2" fill="none"/><Path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Icon>,
  chart:   (p={}) => <Icon {...p} d="M4 20V8M10 20v-7M16 20V4M22 20H2"/>,
  team:    (p={}) => <Icon {...p}><Circle cx="9" cy="8" r="3.2" fill="none"/><Path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><Circle cx="17" cy="7" r="2.5" fill="none"/><Path d="M21 18c0-2-1.5-3.5-4-3.5"/></Icon>,
  settings:(p={}) => <Icon {...p}><Circle cx="12" cy="12" r="3" fill="none"/><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>,
  logout:  (p={}) => <Icon {...p} d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>,
  star:    (p={}) => <Icon {...p} d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18l-5.9 3.1L7.3 14.5 2.5 9.9 9.1 9z"/>,
  pin:     (p={}) => <Icon {...p} d="M12 21v-7M9 4h6l1 6-4 4-4-4z"/>,
  flag:    (p={}) => <Icon {...p} d="M5 21V4M5 5h13l-2 4 2 4H5"/>,
  user:    (p={}) => <Icon {...p}><Circle cx="12" cy="8" r="4" fill="none"/><Path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></Icon>,
  link:    (p={}) => <Icon {...p} d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>,
  attach:  (p={}) => <Icon {...p} d="M21 12.5l-9 9a5.5 5.5 0 1 1-7.78-7.78l9-9a3.5 3.5 0 1 1 4.95 4.95l-9 9a1.5 1.5 0 1 1-2.12-2.12l8-8"/>,
  upload:  (p={}) => <Icon {...p} d="M12 16V4M6 10l6-6 6 6M4 20h16"/>,
  download:(p={}) => <Icon {...p} d="M12 4v12M6 14l6 6 6-6M4 20h16"/>,
  trend:   (p={}) => <Icon {...p} d="M3 17l6-6 4 4 8-9M14 6h7v7"/>,
  trendDn: (p={}) => <Icon {...p} d="M3 7l6 6 4-4 8 9M14 18h7v-7"/>,
  comment: (p={}) => <Icon {...p} d="M21 12a8 8 0 1 1-3-6.2V3l1 5-5-1h3a6 6 0 1 0 2 4z"/>,
  logo: ({ size = 30 } = {}) => (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Defs>
        <LinearGradient id="lgo" x1="0" y1="0" x2="32" y2="32">
          <Stop offset="0" stopColor="#3D7CF0"/>
          <Stop offset="1" stopColor="#1E4FB8"/>
        </LinearGradient>
      </Defs>
      <Path d="M6 4 C 6 4, 22 4, 22 14 C 22 20, 14 20, 14 20 C 14 20, 26 20, 26 24 C 26 30, 6 30, 6 30 Z"
        fill="url(#lgo)" stroke="none"/>
      <Circle cx="9" cy="9" r="1.6" fill="#fff" opacity="0.85" stroke="none"/>
    </Svg>
  ),
};
