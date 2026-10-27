import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { SubjectForm } from '@/components/SubjectForm';
import { Button, Card, Chip, Icon, ProgressBar, Row, SectionTitle, Stepper } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, Type } from '@/constants/theme';
import { formatPercent, percentOf, statsFor, verdictFor } from '@/lib/attendance';
import { WEEKDAY_SHORT, dateKey, formatTime12, fromDateKey } from '@/lib/dates';
import { confirmAction } from '@/lib/confirm';
import type { AttendanceStatus } from '@/lib/types';

export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, colors, addExtraClass, deleteRecord, deleteSubject } = useApp();
  const [editing, setEditing] = useState(false);
  const [planN, setPlanN] = useState(3);
  const [planMode, setPlanMode] = useState<'skip' | 'attend'>('skip');
  const [showAll, setShowAll] = useState(false);

  const subject = data.subjects.find((s) => s.id === id);
  if (!subject) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Subject' }} />
        <Text style={[Type.body, { color: colors.textSecondary }]}>This subject was deleted.</Text>
      </View>
    );
  }

  const stats = statsFor(subject, data.records, data.settings.odCountsPresent);
  const verdict = verdictFor(stats, subject.target);
  const tone = verdict.kind === 'danger' ? colors.danger : verdict.kind === 'edge' ? colors.warning : verdict.kind === 'safe' ? colors.success : colors.textTertiary;

  const planned =
    planMode === 'skip'
      ? percentOf(stats.attended, stats.total + planN)
      : percentOf(stats.attended + planN, stats.total + planN);

  const history = data.records
    .filter((r) => r.subjectId === subject.id)
    .sort((a, b) => (b.date === a.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  const shown = showAll ? history : history.slice(0, 15);
  const slots = data.slots.filter((s) => s.subjectId === subject.id).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

  const extra = (status: AttendanceStatus) => addExtraClass(subject.id, dateKey(), status);

  const remove = () =>
    confirmAction(
      'Delete subject?',
      `${subject.name}, its attendance history and its timetable slots will be deleted. Deadlines stay but lose the subject tag.`,
      'Delete',
      () => {
        deleteSubject(subject.id);
        router.back();
      },
    );

  const pill = (status: AttendanceStatus) =>
    status === 'present'
      ? { bg: colors.successSoft, fg: colors.success, label: 'Present' }
      : status === 'absent'
        ? { bg: colors.dangerSoft, fg: colors.danger, label: 'Absent' }
        : status === 'od'
          ? { bg: colors.primarySoft, fg: colors.primary, label: 'OD' }
          : { bg: colors.surfaceAlt, fg: colors.textSecondary, label: 'Cancelled' };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
      <Stack.Screen options={{ title: subject.code || subject.name }} />

      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={[Type.h2, { color: colors.text }]}>{subject.name}</Text>
            <Text style={[Type.small, { color: colors.textSecondary }]}>
              Target {subject.target}%{stats.od ? ` · ${stats.od} OD` : ''}{stats.cancelled ? ` · ${stats.cancelled} cancelled` : ''}
            </Text>
          </View>
          <View style={[styles.swatch, { backgroundColor: subject.color }]} />
        </Row>
        <Row style={{ marginTop: Spacing.lg, alignItems: 'flex-end' }}>
          <Text style={[Type.stat, { color: verdict.kind === 'danger' ? colors.danger : colors.text }]}>{formatPercent(stats.percent)}</Text>
          <Text style={[Type.body, { color: colors.textSecondary, marginBottom: 6 }]}>
            {stats.attended} / {stats.total} attended
          </Text>
        </Row>
        <View style={{ marginVertical: Spacing.md }}>
          <ProgressBar value={stats.percent ?? 0} color={tone} track={colors.surfaceAlt} />
        </View>
        <View style={[styles.verdict, { backgroundColor: tone + '1A' }]}>
          <Text style={[Type.body, { color: tone, fontWeight: '700' }]}>{verdict.text}</Text>
        </View>
      </Card>

      <SectionTitle>What if</SectionTitle>
      <Card>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="I skip" selected={planMode === 'skip'} onPress={() => setPlanMode('skip')} />
          <Chip label="I attend" selected={planMode === 'attend'} onPress={() => setPlanMode('attend')} />
          <Text style={[Type.body, { color: colors.textSecondary }]}>the next</Text>
          <Stepper label="Number of classes" value={planN} min={1} max={60} onChange={setPlanN} />
          <Text style={[Type.body, { color: colors.textSecondary }]}>classes</Text>
        </Row>
        <Text style={[Type.body, { color: colors.text, marginTop: Spacing.md }]}>
          You would be at{' '}
          <Text style={{ fontWeight: '800', color: planned !== null && planned < subject.target ? colors.danger : colors.success }}>
            {formatPercent(planned)}
          </Text>
          {planned !== null && planned < subject.target ? `, below ${subject.target}%.` : '.'}
        </Text>
      </Card>

      <SectionTitle>Extra class today</SectionTitle>
      <Card>
        <Text style={[Type.small, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
          For classes that aren’t on your timetable, like an extra lecture or a makeup lab.
        </Text>
        <Row>
          <Button title="Present" icon="check" compact kind="secondary" style={{ flex: 1 }} onPress={() => extra('present')} />
          <Button title="Absent" icon="close" compact kind="secondary" style={{ flex: 1 }} onPress={() => extra('absent')} />
          <Button title="OD" icon="badge" compact kind="secondary" style={{ flex: 1 }} onPress={() => extra('od')} />
        </Row>
      </Card>

      <SectionTitle>Timetable</SectionTitle>
      <Card>
        {slots.length === 0 ? (
          <Text style={[Type.body, { color: colors.textSecondary }]}>Not on your timetable yet.</Text>
        ) : (
          slots.map((s) => (
            <Row key={s.id} style={{ paddingVertical: 4 }}>
              <Text style={[Type.body, { color: colors.text, fontWeight: '600', width: 44 }]}>{WEEKDAY_SHORT[s.day]}</Text>
              <Text style={[Type.body, { color: colors.textSecondary, flex: 1 }]}>
                {formatTime12(s.start)} - {formatTime12(s.end)}
                {s.room ? ` · ${s.room}` : ''}
                {s.kind !== 'lecture' ? ` · ${s.kind}` : ''}
              </Text>
            </Row>
          ))
        )}
      </Card>

      <SectionTitle>History</SectionTitle>
      <Card style={{ paddingVertical: Spacing.sm }}>
        {history.length === 0 ? (
          <Text style={[Type.body, { color: colors.textSecondary, paddingVertical: Spacing.sm }]}>
            No classes marked yet{subject.baseTotal ? ` (plus ${subject.baseAttended}/${subject.baseTotal} from before)` : ''}.
          </Text>
        ) : (
          <>
            {shown.map((r, i) => {
              const p = pill(r.status);
              return (
                <Row key={r.id} style={[styles.histRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <Text style={[Type.body, { color: colors.text, flex: 1 }]}>
                    {format(fromDateKey(r.date), 'EEE, d MMM')}
                    {r.slotId === null ? <Text style={{ color: colors.textTertiary }}> · extra</Text> : null}
                  </Text>
                  <View style={[styles.pill, { backgroundColor: p.bg }]}>
                    <Text style={[Type.tiny, { color: p.fg }]}>{p.label}</Text>
                  </View>
                  <Pressable accessibilityLabel="Delete this mark" onPress={() => deleteRecord(r.id)} hitSlop={8}>
                    <Icon name="delete-outline" size={20} color={colors.textTertiary} />
                  </Pressable>
                </Row>
              );
            })}
            {history.length > 15 && !showAll ? (
              <Text style={[Type.small, { color: colors.primary, fontWeight: '600', paddingVertical: Spacing.sm }]} onPress={() => setShowAll(true)}>
                Show all {history.length}
              </Text>
            ) : null}
          </>
        )}
        {subject.baseTotal ? (
          <Text style={[Type.small, { color: colors.textTertiary, paddingVertical: Spacing.sm }]}>
            Includes {subject.baseAttended}/{subject.baseTotal} entered as your starting count.
          </Text>
        ) : null}
      </Card>

      <Row style={{ marginTop: Spacing.lg }}>
        <Button title="Edit" icon="edit" kind="secondary" style={{ flex: 1 }} onPress={() => setEditing(true)} />
        <Button title="Delete" icon="delete-outline" kind="danger" style={{ flex: 1 }} onPress={remove} />
      </Row>

      <SubjectForm visible={editing} onClose={() => setEditing(false)} subject={subject} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 18, height: 18, borderRadius: 9, marginTop: 4 },
  verdict: { borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  histRow: { paddingVertical: 10 },
  pill: { borderRadius: Radius.round, paddingHorizontal: 10, paddingVertical: 4 },
});