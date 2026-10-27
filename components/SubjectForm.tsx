import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { Spacing, SubjectColors, Type } from '@/constants/theme';
import { notify } from '@/lib/confirm';
import type { Subject } from '@/lib/types';
import { ColorPicker } from './pickers';
import { Button, Field, Label, Row, Sheet, Stepper } from './ui';

type Draft = Omit<Subject, 'id' | 'createdAt'>;

/** Add or edit a subject. Pass `subject` to edit. */
export function SubjectForm({ visible, onClose, subject }: { visible: boolean; onClose: () => void; subject?: Subject }) {
  const { data, colors, addSubject, updateSubject } = useApp();
  const blank = (): Draft => ({
    name: '',
    code: '',
    color: SubjectColors[data.subjects.length % SubjectColors.length],
    target: data.settings.defaultTarget,
    baseAttended: 0,
    baseTotal: 0,
  });
  const [draft, setDraft] = useState<Draft>(blank);

  useEffect(() => {
    if (visible) setDraft(subject ? { ...subject } : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, subject?.id]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      notify('Name needed', 'Enter the subject name, for example "Operating Systems".');
      return;
    }
    if (draft.baseAttended > draft.baseTotal) {
      notify('Check the numbers', 'Classes attended cannot be more than classes held.');
      return;
    }
    const clean = { ...draft, name, code: draft.code.trim().toUpperCase() };
    if (subject) updateSubject(subject.id, clean);
    else addSubject(clean);
    onClose();
  };

  return (
    <Sheet visible={visible} title={subject ? 'Edit subject' : 'Add subject'} onClose={onClose}>
      <Field label="Subject name" placeholder="Operating Systems" value={draft.name} onChangeText={(name) => set({ name })} autoFocus={!subject} />
      <Field
        label="Short code (optional)"
        placeholder="OS / CS302"
        value={draft.code}
        onChangeText={(code) => set({ code })}
        autoCapitalize="characters"
        maxLength={10}
      />
      <ColorPicker value={draft.color} onChange={(color) => set({ color })} />

      <Label>Required attendance</Label>
      <Row style={{ marginBottom: Spacing.md }}>
        <Stepper label="Required attendance" value={draft.target} min={50} max={100} step={5} onChange={(target) => set({ target })} />
        <Text style={[Type.body, { color: colors.textSecondary }]}>%</Text>
      </Row>

      <Label>Already this semester (optional)</Label>
      <Text style={[Type.small, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
        Starting mid-semester? Enter the totals from your college portal so the numbers are right from day one.
      </Text>
      <View style={{ flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.lg, flexWrap: 'wrap' }}>
        <View>
          <Text style={[Type.small, { color: colors.textSecondary, marginBottom: 4 }]}>Attended</Text>
          <Stepper label="Classes attended" value={draft.baseAttended} onChange={(baseAttended) => set({ baseAttended })} />
        </View>
        <View>
          <Text style={[Type.small, { color: colors.textSecondary, marginBottom: 4 }]}>Held</Text>
          <Stepper label="Classes held" value={draft.baseTotal} onChange={(baseTotal) => set({ baseTotal })} />
        </View>
      </View>

      <Button title={subject ? 'Save changes' : 'Add subject'} onPress={save} />
    </Sheet>
  );
}