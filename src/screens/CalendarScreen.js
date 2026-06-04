import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { T } from '../constants/tokens';
import {
  CAL_MONTH,
  CAL_FIRST_DOW,
  CAL_DAYS,
  TASKS,
  TEAMMATES,
  getDayEvents,
  fmtTime,
  weekdayOf,
  sundayOf,
} from '../constants/data';
import { Icons } from '../components/Icons';
import {
  TopBar,
  Card,
  SectionHeader,
  TextLink,
  AvatarStack,
  StatusPill,
  EmptyState,
} from '../components/SharedUI';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const VIEW_MODES = ['Month', 'Week', 'Day'];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TODAY = 12;

const KIND_TAG_COLORS = {
  meeting: { bg: T.cPurpleSoft, fg: T.cPurple },
  task:    { bg: T.cBlueSoft,   fg: T.cBlue   },
};

/* ------------------------------------------------------------------ */
/*  Segmented Control                                                  */
/* ------------------------------------------------------------------ */

function SegmentedControl({ items, active, onChange }) {
  return (
    <View style={s.segWrap}>
      {items.map((item) => {
        const isActive = item === active;
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onChange(item)}
            style={[s.segBtn, isActive && s.segBtnActive]}
          >
            <Text style={[s.segText, isActive && s.segTextActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Month View                                                         */
/* ------------------------------------------------------------------ */

function MonthView({ selectedDay, onSelectDay, navigation }) {
  const blanks = CAL_FIRST_DOW;
  const days = [];
  for (let i = 0; i < blanks; i++) days.push(null);
  for (let d = 1; d <= CAL_DAYS; d++) days.push(d);

  const events = getDayEvents(selectedDay);

  return (
    <>
      {/* Calendar grid */}
      <Card style={{ marginBottom: 14 }} padding={12}>
        {/* Month header */}
        <View style={s.monthHeader}>
          <TouchableOpacity style={s.navArrow}>
            {Icons.back({ color: T.ink3, size: 18 })}
          </TouchableOpacity>
          <Text style={s.monthTitle}>{CAL_MONTH}</Text>
          <TouchableOpacity style={s.navArrow}>
            {Icons.chevR({ color: T.ink3, size: 18 })}
          </TouchableOpacity>
        </View>

        {/* Weekday labels */}
        <View style={s.weekdayRow}>
          {WEEKDAY_LABELS.map((l, i) => (
            <View key={i} style={s.weekdayCell}>
              <Text style={s.weekdayLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Day grid */}
        <View style={s.dayGrid}>
          {days.map((d, i) => {
            if (d === null) {
              return <View key={`b${i}`} style={s.dayCell} />;
            }
            const isSelected = d === selectedDay;
            const isToday = d === TODAY;
            const dayEvents = getDayEvents(d);
            const dotColors = dayEvents.slice(0, 3).map((e) => e.color);

            return (
              <TouchableOpacity
                key={d}
                style={s.dayCell}
                onPress={() => onSelectDay(d)}
              >
                <View
                  style={[
                    s.dayCircle,
                    isSelected && { backgroundColor: T.brand },
                    !isSelected && isToday && { backgroundColor: T.brandSoft },
                  ]}
                >
                  <Text
                    style={[
                      s.dayText,
                      isSelected && { color: '#fff', fontWeight: '700' },
                      !isSelected && isToday && { color: T.brand, fontWeight: '700' },
                    ]}
                  >
                    {d}
                  </Text>
                </View>
                {/* Event dots */}
                <View style={s.dotRow}>
                  {dotColors.map((c, di) => (
                    <View
                      key={di}
                      style={[s.eventDot, { backgroundColor: c }]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Selected day events */}
      <SectionHeader
        right={
          <TextLink onPress={() => navigation.navigate('TaskDetail', { id: 1 })}>
            Open day &rarr;
          </TextLink>
        }
      >
        May {selectedDay} Events
      </SectionHeader>

      {events.length === 0 ? (
        <EmptyState
          title="No events"
          subtitle="Nothing scheduled for this day"
          icon={Icons.cal({ color: T.ink4, size: 28 })}
        />
      ) : (
        events.map((ev, idx) => {
          const tagStyle = KIND_TAG_COLORS[ev.kind] || KIND_TAG_COLORS.task;
          return (
            <Card
              key={idx}
              style={[s.eventCard, { borderLeftColor: ev.color }]}
              padding={12}
              onPress={() => navigation.navigate('TaskDetail', { id: 1 })}
            >
              <View style={s.eventTop}>
                <Text style={s.eventTime}>
                  {fmtTime(ev.start)} - {fmtTime(ev.start + ev.dur)}
                </Text>
                <View style={[s.kindTag, { backgroundColor: tagStyle.bg }]}>
                  <Text style={[s.kindTagText, { color: tagStyle.fg }]}>
                    {ev.kind === 'meeting' ? 'Meeting' : 'Task'}
                  </Text>
                </View>
              </View>
              <Text style={s.eventTitle}>{ev.title}</Text>
              {ev.kind === 'meeting' && (
                <View style={{ marginTop: 8 }}>
                  <AvatarStack members={TEAMMATES.slice(0, 3)} max={3} size={22} />
                </View>
              )}
            </Card>
          );
        })
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Week View                                                          */
/* ------------------------------------------------------------------ */

function WeekView({ selectedDay, onSelectDay, navigation }) {
  const sun = sundayOf(selectedDay);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = sun + i;
    if (d >= 1 && d <= CAL_DAYS) weekDays.push(d);
  }

  const HOUR_START = 8;
  const HOUR_END = 19;
  const HOUR_HEIGHT = 56;
  const TOTAL_HOURS = HOUR_END - HOUR_START;
  const COL_WIDTH = 42;

  const rangeStart = weekDays[0] || 1;
  const rangeEnd = weekDays[weekDays.length - 1] || CAL_DAYS;

  // Current time indicator at 11:24 AM on day 12
  const nowHour = 11.4;

  return (
    <>
      {/* Range header */}
      <View style={s.rangeHeader}>
        <TouchableOpacity style={s.navArrow}>
          {Icons.back({ color: T.ink3, size: 18 })}
        </TouchableOpacity>
        <Text style={s.rangeTitle}>May {rangeStart} - {rangeEnd}</Text>
        <TouchableOpacity style={s.navArrow}>
          {Icons.chevR({ color: T.ink3, size: 18 })}
        </TouchableOpacity>
      </View>

      {/* Day strip */}
      <Card style={{ marginBottom: 14 }} padding={10}>
        <View style={s.dayStripRow}>
          {weekDays.map((d) => {
            const isSelected = d === selectedDay;
            const dow = weekdayOf(d);
            return (
              <TouchableOpacity
                key={d}
                style={[s.dayStripCell, isSelected && { backgroundColor: T.brand, borderRadius: 10 }]}
                onPress={() => onSelectDay(d)}
              >
                <Text
                  style={[
                    s.dayStripDow,
                    isSelected && { color: 'rgba(255,255,255,0.7)' },
                  ]}
                >
                  {WEEKDAY_LABELS[dow]}
                </Text>
                <Text
                  style={[
                    s.dayStripNum,
                    isSelected && { color: '#fff' },
                  ]}
                >
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Week timeline grid */}
      <Card style={{ marginBottom: 14, padding: 0 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 10 }}
        >
          <View style={{ flexDirection: 'row' }}>
            {/* Hours column */}
            <View style={s.hoursCol}>
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <View key={i} style={[s.hourLabel, { height: HOUR_HEIGHT }]}>
                  <Text style={s.hourText}>{fmtTime(HOUR_START + i)}</Text>
                </View>
              ))}
            </View>

            {/* Day columns */}
            {weekDays.map((d) => {
              const events = getDayEvents(d);
              const isToday = d === TODAY;
              return (
                <View
                  key={d}
                  style={[
                    s.dayCol,
                    { height: TOTAL_HOURS * HOUR_HEIGHT, width: COL_WIDTH },
                  ]}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <View
                      key={i}
                      style={[
                        s.hourGridLine,
                        { top: i * HOUR_HEIGHT, width: COL_WIDTH },
                      ]}
                    />
                  ))}

                  {/* Events */}
                  {events.map((ev, ei) => {
                    const top = (ev.start - HOUR_START) * HOUR_HEIGHT;
                    const height = ev.dur * HOUR_HEIGHT;
                    if (top < 0) return null;
                    return (
                      <TouchableOpacity
                        key={ei}
                        onPress={() => navigation.navigate('TaskDetail', { id: 1 })}
                        style={[
                          s.weekEvent,
                          {
                            top,
                            height: height - 2,
                            backgroundColor: ev.color + '22',
                            borderLeftColor: ev.color,
                            width: COL_WIDTH - 4,
                          },
                        ]}
                      >
                        <Text
                          style={s.weekEventText}
                          numberOfLines={2}
                        >
                          {ev.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Current time indicator */}
                  {isToday && (
                    <View
                      style={[
                        s.nowLine,
                        { top: (nowHour - HOUR_START) * HOUR_HEIGHT, width: COL_WIDTH },
                      ]}
                    >
                      <View style={s.nowDot} />
                      <View style={s.nowRule} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Day View                                                           */
/* ------------------------------------------------------------------ */

function DayView({ selectedDay, onSelectDay, navigation }) {
  const sun = sundayOf(selectedDay);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = sun + i;
    if (d >= 1 && d <= CAL_DAYS) weekDays.push(d);
  }

  const events = getDayEvents(selectedDay);

  const HOUR_START = 7;
  const HOUR_END = 21;
  const TOTAL_HOURS = HOUR_END - HOUR_START;
  const HOUR_HEIGHT = 60;

  // Summary
  const meetings = events.filter((e) => e.kind === 'meeting').length;
  const totalHours = events.reduce((sum, e) => sum + e.dur, 0);

  // NOW indicator at 11:24 AM on day 12
  const nowHour = 11.4;
  const isToday = selectedDay === TODAY;

  const dow = weekdayOf(selectedDay);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <>
      {/* Date header */}
      <View style={s.dayViewHeader}>
        <TouchableOpacity style={s.navArrow} onPress={() => onSelectDay(Math.max(1, selectedDay - 1))}>
          {Icons.back({ color: T.ink3, size: 18 })}
        </TouchableOpacity>
        <Text style={s.dayViewTitle}>
          {dayNames[dow]}, May {selectedDay}
        </Text>
        <TouchableOpacity style={s.navArrow} onPress={() => onSelectDay(Math.min(CAL_DAYS, selectedDay + 1))}>
          {Icons.chevR({ color: T.ink3, size: 18 })}
        </TouchableOpacity>
      </View>

      {/* Week pill strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillRow}
      >
        {weekDays.map((d) => {
          const isActive = d === selectedDay;
          const wd = weekdayOf(d);
          return (
            <TouchableOpacity
              key={d}
              onPress={() => onSelectDay(d)}
              style={[s.weekPill, isActive && { backgroundColor: T.ink }]}
            >
              <Text
                style={[
                  s.weekPillDow,
                  isActive && { color: 'rgba(255,255,255,0.7)' },
                ]}
              >
                {WEEKDAY_LABELS[wd]}
              </Text>
              <Text
                style={[
                  s.weekPillNum,
                  isActive && { color: '#fff' },
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Summary chips */}
      <View style={s.summaryChipRow}>
        <View style={[s.summaryChip, { backgroundColor: T.cBlueSoft }]}>
          <Text style={[s.summaryChipText, { color: T.cBlue }]}>
            {events.length} events
          </Text>
        </View>
        <View style={[s.summaryChip, { backgroundColor: T.cPurpleSoft }]}>
          <Text style={[s.summaryChipText, { color: T.cPurple }]}>
            {meetings} meetings
          </Text>
        </View>
        <View style={[s.summaryChip, { backgroundColor: T.cGreenSoft }]}>
          <Text style={[s.summaryChipText, { color: T.cGreen }]}>
            {totalHours}h total
          </Text>
        </View>
      </View>

      {/* Timeline */}
      <Card style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
        <View style={{ position: 'relative', height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Hour rows */}
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <View key={i} style={[s.dayTimeRow, { top: i * HOUR_HEIGHT }]}>
              <Text style={s.dayTimeLabel}>{fmtTime(HOUR_START + i)}</Text>
              <View style={s.dayTimeLine} />
            </View>
          ))}

          {/* Events */}
          {events.map((ev, idx) => {
            const top = (ev.start - HOUR_START) * HOUR_HEIGHT;
            const height = ev.dur * HOUR_HEIGHT;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => navigation.navigate('TaskDetail', { id: 1 })}
                style={[
                  s.dayEvent,
                  {
                    top: top + 1,
                    height: height - 2,
                    borderLeftColor: ev.color,
                    backgroundColor: ev.color + '15',
                  },
                ]}
              >
                <Text style={s.dayEventTitle} numberOfLines={1}>
                  {ev.title}
                </Text>
                <Text style={s.dayEventTime}>
                  {fmtTime(ev.start)} - {fmtTime(ev.start + ev.dur)}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* NOW indicator */}
          {isToday && (
            <View
              style={[
                s.dayNowLine,
                { top: (nowHour - HOUR_START) * HOUR_HEIGHT },
              ]}
            >
              <View style={s.dayNowBadge}>
                <Text style={s.dayNowText}>
                  {fmtTime(nowHour)}
                </Text>
              </View>
              <View style={s.dayNowRule} />
            </View>
          )}
        </View>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar Screen                                                    */
/* ------------------------------------------------------------------ */

export default function CalendarScreen({ navigation }) {
  const [viewMode, setViewMode] = useState('Month');
  const [selectedDay, setSelectedDay] = useState(TODAY);

  return (
    <View style={s.container}>
      <TopBar
        title="Calendar"
        subtitle="May 2026"
        onMenu={() => navigation.openDrawer()}
        onSearch={() => navigation.navigate('Search')}
        onBell={() => navigation.navigate('CreateTask')}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* View switcher */}
        <SegmentedControl
          items={VIEW_MODES}
          active={viewMode}
          onChange={setViewMode}
        />

        {viewMode === 'Month' && (
          <MonthView
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            navigation={navigation}
          />
        )}

        {viewMode === 'Week' && (
          <WeekView
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            navigation={navigation}
          />
        )}

        {viewMode === 'Day' && (
          <DayView
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            navigation={navigation}
          />
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
  },
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 100,
  },

  /* Segmented control */
  segWrap: {
    flexDirection: 'row',
    backgroundColor: T.surfaceCool,
    borderRadius: T.rMd,
    padding: 4,
    marginBottom: 16,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: T.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink3,
  },
  segTextActive: {
    color: T.ink,
    fontWeight: '700',
  },

  /* Month header */
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.2,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Weekday labels */
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: T.ink4,
    textTransform: 'uppercase',
  },

  /* Day grid */
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 44,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: T.ink,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
    height: 6,
    alignItems: 'center',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  /* Event card (month view) */
  eventCard: {
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 11,
    fontWeight: '600',
    color: T.ink3,
  },
  kindTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  kindTagText: {
    fontSize: 10,
    fontWeight: '650',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '650',
    color: T.ink,
  },

  /* Range header (week view) */
  rangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rangeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.2,
  },

  /* Day strip (week view) */
  dayStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayStripCell: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  dayStripDow: {
    fontSize: 10,
    fontWeight: '600',
    color: T.ink4,
    marginBottom: 2,
  },
  dayStripNum: {
    fontSize: 14,
    fontWeight: '700',
    color: T.ink,
  },

  /* Week timeline */
  hoursCol: {
    width: 56,
    paddingTop: 0,
  },
  hourLabel: {
    justifyContent: 'flex-start',
    paddingRight: 8,
    alignItems: 'flex-end',
  },
  hourText: {
    fontSize: 10,
    color: T.ink4,
    fontWeight: '500',
  },
  dayCol: {
    position: 'relative',
    borderLeftWidth: 1,
    borderLeftColor: T.hairlineSoft,
  },
  hourGridLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: T.hairlineSoft,
  },
  weekEvent: {
    position: 'absolute',
    left: 2,
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  weekEventText: {
    fontSize: 9,
    fontWeight: '600',
    color: T.ink2,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.cRed,
    marginLeft: -4,
  },
  nowRule: {
    flex: 1,
    height: 2,
    backgroundColor: T.cRed,
  },

  /* Day view header */
  dayViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayViewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.2,
  },

  /* Week pill strip (day view) */
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  weekPill: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.hairline,
  },
  weekPillDow: {
    fontSize: 10,
    fontWeight: '600',
    color: T.ink4,
    marginBottom: 2,
  },
  weekPillNum: {
    fontSize: 14,
    fontWeight: '700',
    color: T.ink,
  },

  /* Summary chips */
  summaryChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  summaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  summaryChipText: {
    fontSize: 11,
    fontWeight: '650',
  },

  /* Day timeline */
  dayTimeRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: 60,
  },
  dayTimeLabel: {
    width: 64,
    fontSize: 11,
    color: T.ink4,
    fontWeight: '500',
    textAlign: 'right',
    paddingRight: 10,
    marginTop: -6,
  },
  dayTimeLine: {
    flex: 1,
    height: 1,
    backgroundColor: T.hairlineSoft,
  },

  /* Day events */
  dayEvent: {
    position: 'absolute',
    left: 72,
    right: 12,
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  dayEventTitle: {
    fontSize: 13,
    fontWeight: '650',
    color: T.ink,
    marginBottom: 2,
  },
  dayEventTime: {
    fontSize: 11,
    color: T.ink3,
    fontWeight: '500',
  },

  /* NOW indicator (day view) */
  dayNowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  dayNowBadge: {
    backgroundColor: T.cRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  dayNowText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  dayNowRule: {
    flex: 1,
    height: 2,
    backgroundColor: T.cRed,
  },
});
