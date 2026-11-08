import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SubjectPicker, TimePicker } from '@/components/pickers';
import { Button, Card, Chip, Empty, Field, Icon, IconButton, Label, Row, Screen, Sheet, Wrap } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, Type } from '@/constants/theme';
import { confirmAction, notify } from '@/lib/confirm';
import { applyImport, decodeTimetable, describe, shareMessage, type ImportMode, type SharedTimetable } from '@/lib/share';
import { WEEKDAY_LONG, WEEKDAY_SHORT, formatTime12, fromMinutes, isoWeekday, toMinutes } from '@/lib/dates';
import type { ClassKind, ID, Slot, Weekday } from '@/lib/types';

type Draft = { id?: ID; subjectId: ID | null; days: Weekday[]; start: string; end: string; room: string; kind: ClassKind };

const KINDS: ClassKind[] = ['lecture', 'lab', 'tutorial'];

export default function TimetableScreen() {
  const router = useRouter();
  const { data, colors, saveSlot, deleteSlot, enableReminders, replaceAll } = useApp();
  const days: Weekday[] = [1, 2, 3, 4, 5];
  if (data.settings.showSaturday) days.push(6);
  if (data.settings.showSunday) days.push(7);
  const todayIso = isoWeekday();
  const [day, setDay] = useState<Weekday>(days.includes(todayIso) ? todayIso : 1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState<SharedTimetable | null>(null);
  const [importError, setImportError] = useState('');

  const shareTimetable = async () => {
    if (data.slots.length === 0) return notify('Nothing to share yet', 'Add your classes first, then share them with your class.');
    try {
      await Share.share({ message: shareMessage(data) });
    } catch {
      notify("Couldn't open sharing", 'Try again.');
    }
  };

  const closeImport = () => {
    setImporting(false);
    setPasted('');
    setPreview(null);
    setImportError('');
  };

  const onPaste = (text: string) => {
    setPasted(text);
    setImportError('');
    if (!text.trim()) return setPreview(null);
    try {
      setPreview(decodeTimetable(text));
    } catch (e) {
      setPreview(null);
      // Only complain once something code-like is there, not while they're still typing
      if (/BUNK1\./.test(text) || text.length > 40) setImportError((e as Error).message);
    }
  };

  const runImport = (mode: ImportMode) => {
    if (!preview) return;
    const result = applyImport(data, preview, mode);
    replaceAll(result.data);
    closeImport();
    const parts = [
      `${result.classesAdded} class${result.classesAdded === 1 ? '' : 'es'} added`,
      result.newSubjects ? `${result.newSubjects} new subject${result.newSubjects === 1 ? '' : 's'}` : null,
      result.reusedSubjects ? `${result.reusedSubjects} matched your existing subjects (attendance kept)` : null,
    ].filter(Boolean);
    if (result.classesAdded === 0 && result.newSubjects === 0) {
      notify('Nothing new', 'You already have every subject and class in that timetable.');
      return;
    }
    notify(
      'Timetable imported',
      `${parts.join(', ')}.` +
        (result.newSubjects ? " If you're joining mid-semester, set each new subject's starting attendance on the Attendance tab." : ''),
    );
    if (data.slots.length === 0 && data.settings.classReminderMinutes > 0) setTimeout(enableReminders, 0);
  };

  const subjects = new Map(data.subjects.map((s) => [s.id, s]));
  const slots = data.slots
    .filter((s) => s.day === day && subjects.has(s.subjectId))
    .sort((a, b) => a.start.localeCompare(b.start));

  const openNew = () => {
    // Start the new class right after the last one of the day, or at 9:00
    const last = slots[slots.length - 1];
    const start = last ? last.end : '09:00';
    setDraft({
      subjectId: data.subjects[0]?.id ?? null,
      days: [day],
      start,
      end: fromMinutes(toMinutes(start) + 60),
      room: '',
      kind: 'lecture',
    });
  };

  const openEdit = (s: Slot) =>
    setDraft({ id: s.id, subjectId: s.subjectId, days: [s.day], start: s.start, end: s.end, room: s.room, kind: s.kind });

  const save = async () => {
    if (!draft) return;
    if (!draft.subjectId) return notify('Pick a subject', 'Choose which subject this class is for.');
    if (draft.days.length === 0) return notify('Pick a day', 'Choose at least one day.');
    if (toMinutes(draft.end) <= toMinutes(draft.start)) return notify('Check the time', 'The class must end after it starts.');

    const clash = data.slots.find(
      (s) =>
        s.id !== draft.id &&
        draft.days.includes(s.day) &&
        toMinutes(s.start) < toMinutes(draft.end) &&
        toMinutes(draft.start) < toMinutes(s.end),
    );

    const commit = async () => {
      const [firstDay, ...otherDays] = draft.days;
      const base = { subjectId: draft.subjectId!, start: draft.start, end: draft.end, room: draft.room.trim(), kind: draft.kind };
      saveSlot({ ...base, id: draft.id, day: firstDay });
      for (const d of otherDays) saveSlot({ ...base, day: d });
      setDraft(null);
      // First class added: ask for notification permission so reminders work
      if (data.slots.length === 0 && data.settings.classReminderMinutes > 0) setTimeout(enableReminders, 0); // after the new item is saved
    };

    if (clash) {
      const other = subjects.get(clash.subjectId)?.name ?? 'another class';
      confirmAction('Time clash', `This overlaps ${other} on ${WEEKDAY_LONG[clash.day]}. Save anyway?`, 'Save', commit);
      return;
    }
    await commit();
  };

  const remove = () => {
    if (!draft?.id) return;
    confirmAction('Remove class?', 'Attendance already marked for it is kept.', 'Remove', () => {
      deleteSlot(draft.id!);
      setDraft(null);
    });
  };

  const toggleDay = (d: Weekday) =>
    setDraft((x) => {
      if (!x) return x;
      if (x.id) return { ...x, days: [d] }; // editing moves a single class
      return { ...x, days: x.days.includes(d) ? x.days.filter((v) => v !== d) : [...x.days, d].sort() as Weekday[] };
    });

  return (
    <Screen
      title="Timetable"
      subtitle={data.settings.classReminderMinutes ? `Reminder ${data.settings.classReminderMinutes} min before each class` : 'Class reminders are off'}
      action={
        data.subjects.length ? (
          <Row style={{ gap: Spacing.sm }}>
            <IconButton icon="download" label="Import a timetable" onPress={() => setImporting(true)} />
            <IconButton icon="share" label="Share timetable with your class" onPress={shareTimetable} />
            <IconButton icon="add" label="Add class" onPress={openNew} />
          </Row>
        ) : undefined
      }>
      {data.subjects.length === 0 ? (
        <Card>
          <Empty
            icon="calendar-view-week"
            title="Add subjects first"
            body="Your timetable is built from your subjects. Add them on the Attendance tab — or, if a classmate already set up Bunkmate, import their timetable in one go."
            action={
              <View style={{ gap: Spacing.sm, alignSelf: 'stretch' }}>
                <Button title="Import from a classmate" icon="download" onPress={() => setImporting(true)} />
                <Button title="Go to Attendance" kind="ghost" onPress={() => router.push('/attendance')} />
              </View>
            }
          />
        </Card>
      ) : (
        <>
          <View style={styles.dayRow}>
            {days.map((d) => {
              const count = data.slots.filter((s) => s.day === d && subjects.has(s.subjectId)).length;
              const active = d === day;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${WEEKDAY_LONG[d]}, ${count} classes`}
                  onPress={() => setDay(d)}
                  style={[styles.day, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}>
                  <Text style={[Type.small, { fontWeight: '700', color: active ? colors.onPrimary : colors.text }]}>{WEEKDAY_SHORT[d]}</Text>
                  <Text style={[Type.tiny, { color: active ? colors.onPrimary : colors.textTertiary }]}>{count || '·'}</Text>
                </Pressable>
              );
            })}
          </View>

          {slots.length === 0 ? (
            <Card>
              <Empty
                icon="event-available"
                title={`Nothing on ${WEEKDAY_LONG[day]}`}
                body="Add the classes you have on this day. You can add the same class to several days at once."
                action={<Button title="Add class" icon="add" onPress={openNew} />}
              />
            </Card>
          ) : (
            slots.map((slot) => {
              const subject = subjects.get(slot.subjectId)!;
              return (
                <Card key={slot.id} onPress={() => openEdit(slot)} style={{ paddingVertical: Spacing.md }}>
                  <Row style={{ alignItems: 'stretch' }}>
                    <View style={{ width: 74 }}>
                      <Text style={[Type.body, { color: colors.text, fontWeight: '700' }]}>{formatTime12(slot.start)}</Text>
                      <Text style={[Type.small, { color: colors.textTertiary }]}>{formatTime12(slot.end)}</Text>
                    </View>
                    <View style={[styles.stripe, { backgroundColor: subject.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[Type.h3, { color: colors.text }]} numberOfLines={1}>
                        {subject.name}
                      </Text>
                      <Text style={[Type.small, { color: colors.textSecondary }]}>
                        {[slot.kind !== 'lecture' ? slot.kind : null, slot.room || null].filter(Boolean).join(' · ') || 'Lecture'}
                      </Text>
                    </View>
                    <Icon name="edit" size={18} color={colors.textTertiary} />
                  </Row>
                </Card>
              );
            })
          )}
        </>
      )}

      <Sheet visible={importing} title="Import a timetable" onClose={closeImport}>
        <Text style={[Type.body, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
          Ask a classmate to tap Share on their Timetable tab, then copy the whole message they send and paste it here. Only
          subjects and classes come across — never anyone&apos;s attendance.
        </Text>
        <Field
          label="Paste the message"
          placeholder="📅 Class timetable for Bunkmate… BUNK1.…"
          value={pasted}
          onChangeText={onPaste}
          multiline
          autoCorrect={false}
          autoCapitalize="none"
          style={{ maxHeight: 160 }}
        />
        {importError ? <Text style={[Type.small, { color: colors.danger, marginTop: -Spacing.sm, marginBottom: Spacing.md }]}>{importError}</Text> : null}
        {preview ? (
          <>
            <Card style={{ marginBottom: Spacing.md }}>
              <Text style={[Type.h3, { color: colors.text }]}>{describe(preview)}</Text>
              <Text style={[Type.small, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={3}>
                {preview.subjects.map((x) => x.name).join(' · ')}
              </Text>
            </Card>
            {data.slots.length === 0 ? (
              <Button title="Import timetable" icon="download" onPress={() => runImport('replace')} />
            ) : (
              <>
                <Button title="Replace my timetable" onPress={() => runImport('replace')} />
                <Button title="Add to my timetable" kind="ghost" style={{ marginTop: Spacing.sm }} onPress={() => runImport('add')} />
                <Text style={[Type.tiny, { color: colors.textTertiary, marginTop: Spacing.sm }]}>
                  Either way your attendance is kept. Subjects with the same name and code are matched to yours.
                </Text>
              </>
            )}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={draft !== null} title={draft?.id ? 'Edit class' : 'Add class'} onClose={() => setDraft(null)}>
        {draft ? (
          <>
            <SubjectPicker subjects={data.subjects} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
            <Label>{draft.id ? 'Day' : 'Days (pick all that apply)'}</Label>
            <Wrap>
              {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => (
                <Chip key={d} label={WEEKDAY_SHORT[d]} selected={draft.days.includes(d)} onPress={() => toggleDay(d)} />
              ))}
            </Wrap>
            <TimePicker
              label="Starts"
              value={draft.start}
              onChange={(start) => {
                // Keep the same length when the start moves
                const len = Math.max(15, toMinutes(draft.end) - toMinutes(draft.start));
                setDraft({ ...draft, start, end: fromMinutes(Math.min(toMinutes(start) + len, 23 * 60 + 55)) });
              }}
            />
            <TimePicker label="Ends" value={draft.end} onChange={(end) => setDraft({ ...draft, end })} />
            <Label>Type</Label>
            <Wrap>
              {KINDS.map((k) => (
                <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} selected={draft.kind === k} onPress={() => setDraft({ ...draft, kind: k })} />
              ))}
            </Wrap>
            <Field label="Room (optional)" placeholder="LH-204 / Lab 3" value={draft.room} onChangeText={(room) => setDraft({ ...draft, room })} />
            <Button title={draft.id ? 'Save changes' : draft.days.length > 1 ? `Add to ${draft.days.length} days` : 'Add class'} onPress={save} />
            {draft.id ? <Button title="Remove from timetable" kind="ghost" style={{ marginTop: Spacing.sm }} onPress={remove} /> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.lg },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, gap: 2 },
  stripe: { width: 4, borderRadius: 2 },
});