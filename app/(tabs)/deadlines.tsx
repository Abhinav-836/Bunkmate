import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { DatePicker, SubjectPicker, TimePicker } from '@/components/pickers';
import { Button, Card, Chip, Empty, Field, Icon, IconButton, Label, Row, Screen, SectionTitle, Sheet, Wrap } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, Type } from '@/constants/theme';
import { confirmAction, notify } from '@/lib/confirm';
import { dateKey, fromDateKey, relativeDue, safeParse, toMinutes } from '@/lib/dates';
import type { Deadline, DeadlineType, ID } from '@/lib/types';

const TYPES: { key: DeadlineType; label: string; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
  { key: 'assignment', label: 'Assignment', icon: 'assignment' },
  { key: 'exam', label: 'Exam', icon: 'school' },
  { key: 'quiz', label: 'Quiz', icon: 'quiz' },
  { key: 'lab', label: 'Lab record', icon: 'science' },
  { key: 'project', label: 'Project', icon: 'rocket-launch' },
  { key: 'other', label: 'Other', icon: 'push-pin' },
];
const typeInfo = (t: DeadlineType) => TYPES.find((x) => x.key === t) ?? TYPES[TYPES.length - 1];

type Draft = { id?: ID; title: string; subjectId: ID | null; type: DeadlineType; date: string; time: string; notes: string };
type Filter = 'all' | 'exam' | 'assignment' | 'other';

export default function DeadlinesScreen() {
  const { data, colors, saveDeadline, toggleDeadline, deleteDeadline, enableReminders } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(false);

  const subjects = new Map(data.subjects.map((s) => [s.id, s]));
  const now = Date.now();
  const matches = (d: Deadline) =>
    filter === 'all' ? true : filter === 'other' ? d.type !== 'exam' && d.type !== 'assignment' : d.type === filter;

  const open = data.deadlines.filter((d) => !d.done && matches(d)).sort((a, b) => a.due.localeCompare(b.due));
  const overdue = open.filter((d) => (safeParse(d.due)?.getTime() ?? 0) < now);
  const upcoming = open.filter((d) => (safeParse(d.due)?.getTime() ?? 0) >= now);
  const done = data.deadlines
    .filter((d) => d.done && matches(d))
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  const openNew = () =>
    setDraft({ title: '', subjectId: null, type: 'assignment', date: dateKey(new Date(Date.now() + 2 * 864e5)), time: '23:59', notes: '' });

  const openEdit = (d: Deadline) => {
    const due = safeParse(d.due) ?? new Date();
    setDraft({ id: d.id, title: d.title, subjectId: d.subjectId, type: d.type, date: dateKey(due), time: format(due, 'HH:mm'), notes: d.notes });
  };

  const save = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return notify('Title needed', 'For example "DBMS assignment 3" or "OS mid-sem".');
    const due = fromDateKey(draft.date);
    const mins = toMinutes(draft.time);
    due.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    const first = data.deadlines.length === 0;
    saveDeadline({ id: draft.id, title, subjectId: draft.subjectId, type: draft.type, due: due.toISOString(), notes: draft.notes.trim() });
    setDraft(null);
    if (first && data.settings.deadlineReminders) setTimeout(enableReminders, 0); // after the new item is saved
  };

  const remove = () => {
    if (!draft?.id) return;
    confirmAction('Delete deadline?', draft.title, 'Delete', () => {
      deleteDeadline(draft.id!);
      setDraft(null);
    });
  };

  const renderItem = (d: Deadline, i: number) => {
    const info = typeInfo(d.type);
    const subject = d.subjectId ? subjects.get(d.subjectId) : undefined;
    const late = !d.done && (safeParse(d.due)?.getTime() ?? 0) < now;
    return (
      <Pressable
        key={d.id}
        onPress={() => openEdit(d)}
        style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: d.done }}
          accessibilityLabel={`Mark ${d.title} ${d.done ? 'not done' : 'done'}`}
          onPress={() => toggleDeadline(d.id)}
          hitSlop={10}>
          <Icon name={d.done ? 'check-circle' : 'radio-button-unchecked'} color={d.done ? colors.success : colors.textTertiary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={[Type.body, { color: d.done ? colors.textTertiary : colors.text, fontWeight: '600', textDecorationLine: d.done ? 'line-through' : 'none' }]}
            numberOfLines={2}>
            {d.title}
          </Text>
          <Row style={{ marginTop: 2, gap: 6, flexWrap: 'wrap' }}>
            <Icon name={info.icon} size={14} color={colors.textTertiary} />
            <Text style={[Type.small, { color: colors.textSecondary }]}>{info.label}</Text>
            {subject ? (
              <View style={[styles.tag, { backgroundColor: subject.color + '22' }]}>
                <Text style={[Type.tiny, { color: subject.color }]}>{subject.code || subject.name}</Text>
              </View>
            ) : null}
          </Row>
        </View>
        <Text style={[Type.small, { color: late ? colors.danger : colors.textSecondary, fontWeight: late ? '700' : '400', maxWidth: 120, textAlign: 'right' }]}>
          {d.done ? 'Done' : relativeDue(d.due)}
        </Text>
      </Pressable>
    );
  };

  return (
    <Screen
      title="Deadlines"
      subtitle={open.length ? `${open.length} pending${overdue.length ? ` · ${overdue.length} overdue` : ''}` : undefined}
      action={<IconButton icon="add" label="Add deadline" onPress={openNew} />}>
      <Wrap>
        {(['all', 'exam', 'assignment', 'other'] as Filter[]).map((f) => (
          <Chip key={f} label={f === 'all' ? 'All' : f === 'exam' ? 'Exams' : f === 'assignment' ? 'Assignments' : 'Others'} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </Wrap>

      {open.length === 0 && done.length === 0 ? (
        <Card>
          <Empty
            icon="assignment-turned-in"
            title="No deadlines"
            body="Add assignments, exams, quizzes and lab records. You'll get a reminder a day before and an hour before."
            action={<Button title="Add deadline" icon="add" onPress={openNew} />}
          />
        </Card>
      ) : null}

      {overdue.length ? (
        <>
          <SectionTitle>Overdue</SectionTitle>
          <Card style={{ paddingVertical: 0, borderColor: colors.danger }}>{overdue.map(renderItem)}</Card>
        </>
      ) : null}

      {upcoming.length ? (
        <>
          <SectionTitle>Upcoming</SectionTitle>
          <Card style={{ paddingVertical: 0 }}>{upcoming.map(renderItem)}</Card>
        </>
      ) : open.length === 0 && done.length ? (
        <Card>
          <Text style={[Type.body, { color: colors.textSecondary }]}>All caught up.</Text>
        </Card>
      ) : null}

      {done.length ? (
        <>
          <SectionTitle
            action={
              <Text style={[Type.small, { color: colors.primary, fontWeight: '600' }]} onPress={() => setShowDone((v) => !v)}>
                {showDone ? 'Hide' : `Show ${done.length}`}
              </Text>
            }>
            Completed
          </SectionTitle>
          {showDone ? <Card style={{ paddingVertical: 0 }}>{done.map(renderItem)}</Card> : null}
        </>
      ) : null}

      <Sheet visible={draft !== null} title={draft?.id ? 'Edit deadline' : 'New deadline'} onClose={() => setDraft(null)}>
        {draft ? (
          <>
            <Field label="What is it?" placeholder="DBMS assignment 3" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} autoFocus={!draft.id} />
            <Label>Type</Label>
            <Wrap>
              {TYPES.map((t) => (
                <Chip key={t.key} label={t.label} selected={draft.type === t.key} onPress={() => setDraft({ ...draft, type: t.key })} />
              ))}
            </Wrap>
            {data.subjects.length ? (
              <SubjectPicker subjects={data.subjects} value={draft.subjectId} allowNone onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
            ) : null}
            <DatePicker label="Due date" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
            <TimePicker label="Due time" value={draft.time} onChange={(time) => setDraft({ ...draft, time })} />
            <Field label="Notes (optional)" placeholder="Syllabus, submission link, room..." value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} multiline />
            <Button title={draft.id ? 'Save changes' : 'Add deadline'} onPress={save} />
            {draft.id ? <Button title="Delete" kind="ghost" style={{ marginTop: Spacing.sm }} onPress={remove} /> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  tag: { borderRadius: Radius.round, paddingHorizontal: 8, paddingVertical: 2 },
});