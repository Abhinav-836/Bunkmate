import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { addDays, format, isToday, isYesterday } from 'date-fns';
import { Button, Card, Empty, Icon, ProgressBar, Row, Screen, SectionTitle } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, Type } from '@/constants/theme';
import { formatPercent, overallStats, planSkipDay, statsFor, verdictFor } from '@/lib/attendance';
import { dateKey, formatTime12, fromDateKey, isoWeekday, relativeDue, safeParse } from '@/lib/dates';
import type { AttendanceStatus } from '@/lib/types';

const STATUS: { key: AttendanceStatus; label: string; spoken: string }[] = [
  { key: 'present', label: 'Present', spoken: 'Present' },
  { key: 'absent', label: 'Absent', spoken: 'Absent' },
  { key: 'od', label: 'OD', spoken: 'On duty' },
  { key: 'cancelled', label: 'Cancelled', spoken: 'Cancelled' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const router = useRouter();
  const { data, colors, markClass, markDay, toggleDeadline } = useApp();
  const od = data.settings.odCountsPresent;
  const [day, setDay] = useState(dateKey());
  const date = fromDateKey(day);

  const subjects = useMemo(() => new Map(data.subjects.map((s) => [s.id, s])), [data.subjects]);
  const overall = overallStats(data.subjects, data.records, od);
  const target = data.settings.defaultTarget;

  const atRisk = data.subjects.filter((s) => verdictFor(statsFor(s, data.records, od), s.target).kind === 'danger');

  const classes = data.slots
    .filter((s) => s.day === isoWeekday(date) && subjects.has(s.subjectId))
    .sort((a, b) => a.start.localeCompare(b.start));

  const dayMarks = classes.map((slot) => data.records.find((r) => r.date === day && r.slotId === slot.id)?.status);
  const isHoliday = classes.length > 0 && dayMarks.every((m) => m === 'cancelled');
  const allPresent = classes.length > 0 && dayMarks.every((m) => m === 'present');

  // "Can I skip tomorrow?" always looks at the real tomorrow, whatever day is being viewed
  const tomorrow = addDays(new Date(), 1);
  const tomorrowSlots = data.slots.filter((s) => s.day === isoWeekday(tomorrow) && subjects.has(s.subjectId));
  const skipPlan = planSkipDay(data.subjects, data.records, tomorrowSlots, od);

  const now = Date.now();
  const soon = data.deadlines
    .filter((d) => !d.done)
    .filter((d) => {
      const due = safeParse(d.due);
      return due ? due.getTime() < now + 7 * 864e5 : false;
    })
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 4);

  const studiedToday = data.sessions.filter((s) => s.date === dateKey()).reduce((a, s) => a + s.minutes, 0);

  const dayLabel = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEE, d MMM');

  if (data.subjects.length === 0) {
    return (
      <Screen title="Bunkmate" subtitle="Attendance, timetable and deadlines in one place">
        <Card>
          <Empty
            icon="school"
            title="Set up in two minutes"
            body="Add your subjects first, then your weekly timetable. After that, marking attendance is one tap per class."
            action={<Button title="Add your subjects" icon="add" onPress={() => router.push('/attendance')} />}
          />
        </Card>
        <Card>
          <Row>
            <Icon name="lightbulb" color={colors.warning} />
            <Text style={[Type.body, { color: colors.text, flex: 1 }]}>
              Started mid-semester? When adding a subject, enter the attended and held counts from your college portal.
            </Text>
          </Row>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={greeting()} subtitle={format(new Date(), 'EEEE, d MMMM')}>
      {/* Overall attendance */}
      <Card onPress={() => router.push('/attendance')}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={[Type.small, { color: colors.textSecondary }]}>Overall attendance</Text>
            <Text style={[Type.stat, { color: overall.percent !== null && overall.percent < target ? colors.danger : colors.text }]}>
              {formatPercent(overall.percent)}
            </Text>
            <Text style={[Type.small, { color: colors.textSecondary }]}>
              {overall.attended} of {overall.total} classes
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: atRisk.length ? colors.dangerSoft : colors.successSoft },
            ]}>
            <Icon name={atRisk.length ? 'warning' : 'verified'} size={16} color={atRisk.length ? colors.danger : colors.success} />
            <Text style={[Type.small, { color: atRisk.length ? colors.danger : colors.success, fontWeight: '700' }]}>
              {atRisk.length ? `${atRisk.length} below target` : 'All on track'}
            </Text>
          </View>
        </Row>
        <View style={{ marginTop: Spacing.md }}>
          <ProgressBar
            value={overall.percent ?? 0}
            color={overall.percent !== null && overall.percent < target ? colors.danger : colors.success}
            track={colors.surfaceAlt}
          />
        </View>
        {atRisk.length ? (
          <Text style={[Type.small, { color: colors.danger, marginTop: Spacing.sm }]}>
            {atRisk.map((s) => s.code || s.name).join(', ')}: tap to see how many classes you need.
          </Text>
        ) : null}
      </Card>

      {/* Classes */}
      <SectionTitle
        action={
          <Row>
            <Pressable accessibilityLabel="Previous day" onPress={() => setDay(dateKey(addDays(date, -1)))} hitSlop={8}>
              <Icon name="chevron-left" color={colors.primary} />
            </Pressable>
            <Text style={[Type.small, { color: colors.text, fontWeight: '600', minWidth: 80, textAlign: 'center' }]}>{dayLabel}</Text>
            <Pressable
              accessibilityLabel="Next day"
              disabled={isToday(date)}
              onPress={() => setDay(dateKey(addDays(date, 1)))}
              hitSlop={8}
              style={{ opacity: isToday(date) ? 0.3 : 1 }}>
              <Icon name="chevron-right" color={colors.primary} />
            </Pressable>
          </Row>
        }>
        Classes
      </SectionTitle>

      {classes.length > 0 ? (
        <Row style={{ marginBottom: Spacing.md }}>
          {isHoliday ? (
            <Button title="Holiday · Undo" icon="undo" kind="secondary" compact style={{ flex: 1 }} onPress={() => markDay(day, classes, null)} />
          ) : (
            <Button title="Holiday" icon="beach-access" kind="secondary" compact style={{ flex: 1 }} onPress={() => markDay(day, classes, 'cancelled')} />
          )}
          {allPresent ? (
            <Button title="All present · Undo" icon="undo" kind="secondary" compact style={{ flex: 1 }} onPress={() => markDay(day, classes, null)} />
          ) : (
            <Button title="All present" icon="done-all" kind="secondary" compact style={{ flex: 1 }} onPress={() => markDay(day, classes, 'present')} />
          )}
        </Row>
      ) : null}

      {classes.length === 0 ? (
        <Card>
          <Text style={[Type.body, { color: colors.textSecondary }]}>
            {data.slots.length === 0 ? 'Your timetable is empty. ' : `No classes on ${format(date, 'EEEE')}. `}
            {data.slots.length === 0 ? (
              <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => router.push('/timetable')}>
                Add your timetable
              </Text>
            ) : null}
          </Text>
        </Card>
      ) : (
        classes.map((slot) => {
          const subject = subjects.get(slot.subjectId)!;
          const mark = data.records.find((r) => r.subjectId === slot.subjectId && r.date === day && r.slotId === slot.id);
          const stats = statsFor(subject, data.records, od);
          const verdict = verdictFor(stats, subject.target);
          return (
            <Card key={slot.id} style={{ paddingVertical: Spacing.md }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={[styles.stripe, { backgroundColor: subject.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[Type.h3, { color: colors.text }]} numberOfLines={1}>
                    {subject.name}
                  </Text>
                  <Text style={[Type.small, { color: colors.textSecondary }]}>
                    {formatTime12(slot.start)} - {formatTime12(slot.end)}
                    {slot.room ? ` · ${slot.room}` : ''}
                    {slot.kind !== 'lecture' ? ` · ${slot.kind}` : ''}
                  </Text>
                  <Text
                    style={[
                      Type.small,
                      { marginTop: 2, color: verdict.kind === 'danger' ? colors.danger : verdict.kind === 'edge' ? colors.warning : colors.textTertiary },
                    ]}>
                    {formatPercent(stats.percent)} · {verdict.text}
                  </Text>
                </View>
              </Row>
              <Row style={{ marginTop: Spacing.md }}>
                {STATUS.map((s) => {
                  const active = mark?.status === s.key;
                  const tint =
                    s.key === 'present' ? colors.success : s.key === 'absent' ? colors.danger : s.key === 'od' ? colors.primary : colors.textSecondary;
                  return (
                    <Pressable
                      key={s.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${subject.name} ${s.spoken}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => markClass(slot.subjectId, day, slot.id, s.key)}
                      style={[
                        styles.mark,
                        { borderColor: active ? tint : colors.border, backgroundColor: active ? tint : colors.surface },
                      ]}>
                      <Text style={[Type.small, { fontSize: 12, fontWeight: '700', color: active ? (s.key === 'od' ? colors.onPrimary : '#fff') : colors.text }]} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </Row>
            </Card>
          );
        })
      )}

      {/* Can I skip tomorrow? */}
      {data.slots.length > 0 ? (
        <>
          <SectionTitle>Can I skip tomorrow?</SectionTitle>
          <Card>
            {skipPlan.rows.length === 0 ? (
              <Text style={[Type.body, { color: colors.textSecondary }]}>No classes tomorrow ({format(tomorrow, 'EEEE')}).</Text>
            ) : (
              <>
                <Row>
                  <View style={[styles.round, { backgroundColor: skipPlan.safe ? colors.successSoft : colors.dangerSoft }]}>
                    <Icon name={skipPlan.safe ? 'check' : 'close'} color={skipPlan.safe ? colors.success : colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.h3, { color: skipPlan.safe ? colors.success : colors.danger }]}>
                      {skipPlan.safe ? 'Yes, you can skip tomorrow' : 'Better not skip tomorrow'}
                    </Text>
                    <Text style={[Type.small, { color: colors.textSecondary }]}>
                      {skipPlan.safe
                        ? `Every subject stays above its target (${tomorrowSlots.length} class${tomorrowSlots.length === 1 ? '' : 'es'}).`
                        : `${skipPlan.rows.filter((r) => !r.ok).map((r) => r.subject.code || r.subject.name).join(', ')} would drop below target.`}
                    </Text>
                  </View>
                </Row>
                <View style={{ marginTop: Spacing.md }}>
                  {skipPlan.rows.map((r) => (
                    <Row key={r.subject.id} style={{ paddingVertical: 4 }}>
                      <View style={[styles.dot, { backgroundColor: r.subject.color }]} />
                      <Text style={[Type.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                        {r.subject.code || r.subject.name}
                        <Text style={{ color: colors.textTertiary }}> · {r.classes} class{r.classes === 1 ? '' : 'es'}</Text>
                      </Text>
                      <Text style={[Type.small, { color: colors.textSecondary }]}>
                        {formatPercent(r.before)} →{' '}
                        <Text style={{ fontWeight: '700', color: r.ok ? colors.success : colors.danger }}>{formatPercent(r.after)}</Text>
                      </Text>
                    </Row>
                  ))}
                </View>
              </>
            )}
          </Card>
        </>
      ) : null}

      {/* Deadlines */}
      <SectionTitle
        action={
          <Text style={[Type.small, { color: colors.primary, fontWeight: '600' }]} onPress={() => router.push('/deadlines')}>
            See all
          </Text>
        }>
        Due this week
      </SectionTitle>
      {soon.length === 0 ? (
        <Card>
          <Text style={[Type.body, { color: colors.textSecondary }]}>Nothing due in the next 7 days.</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: Spacing.sm }}>
          {soon.map((d, i) => {
            const overdue = (safeParse(d.due)?.getTime() ?? 0) < now;
            const subject = d.subjectId ? subjects.get(d.subjectId) : undefined;
            return (
              <Row key={d.id} style={[styles.dlRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`Mark ${d.title} done`} onPress={() => toggleDeadline(d.id)} hitSlop={8}>
                  <Icon name="radio-button-unchecked" color={colors.textTertiary} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={[Type.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={[Type.small, { color: overdue ? colors.danger : colors.textSecondary }]}>
                    {subject ? `${subject.code || subject.name} · ` : ''}
                    {d.type} · {relativeDue(d.due)}
                  </Text>
                </View>
              </Row>
            );
          })}
        </Card>
      )}

      {/* Study */}
      <SectionTitle>Study</SectionTitle>
      <Card onPress={() => router.push('/study')}>
        <Row>
          <View style={[styles.round, { backgroundColor: colors.primarySoft }]}>
            <Icon name="timer" color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.h3, { color: colors.text }]}>
              {studiedToday ? `${studiedToday} min studied today` : 'Start a study session'}
            </Text>
            <Text style={[Type.small, { color: colors.textSecondary }]}>
              {data.timer.endsAt || data.timer.pausedRemaining !== null ? 'A session is in progress' : 'Focus timer that keeps running when your phone is locked'}
            </Text>
          </View>
          <Icon name="chevron-right" color={colors.textTertiary} />
        </Row>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.round },
  stripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  mark: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  dlRow: { paddingVertical: Spacing.md },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});