import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { addDays, format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, SubjectColors, Type } from '@/constants/theme';
import { dateKey, fromDateKey, toMinutes, fromMinutes } from '@/lib/dates';
import type { ID, Subject } from '@/lib/types';
import { Chip, Icon, Label, Row, Stepper, Wrap } from './ui';

/** 12-hour time picker that stores "HH:mm" (24h). Minutes move in 5-minute steps. */
export function TimePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const total = toMinutes(value);
  const h24 = Math.floor(total / 60);
  const minute = total % 60;
  const pm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const set = (hour12: number, min: number, isPm: boolean) => {
    const h = (hour12 % 12) + (isPm ? 12 : 0);
    onChange(fromMinutes(h * 60 + min));
  };

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Label>{label}</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        <Stepper label={`${label} hour`} value={h12} min={1} max={12} onChange={(v) => set(v, minute, pm)} />
        <Stepper
          label={`${label} minute`}
          value={minute}
          min={0}
          max={59}
          step={5}
          onChange={(v) => set(h12, v, pm)}
        />
        <Chip label="AM" selected={!pm} onPress={() => set(h12, minute, false)} />
        <Chip label="PM" selected={pm} onPress={() => set(h12, minute, true)} />
      </Row>
    </View>
  );
}

/** Date picker with quick choices and an expandable month calendar. Value is yyyy-MM-dd. */
export function DatePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { colors, isDark } = useApp();
  const [open, setOpen] = useState(false);
  const today = new Date();
  const quick: [string, string][] = [
    ['Today', dateKey(today)],
    ['Tomorrow', dateKey(addDays(today, 1))],
    ['In 3 days', dateKey(addDays(today, 3))],
    ['Next week', dateKey(addDays(today, 7))],
  ];

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Label>{label}</Label>
      <Wrap>
        {quick.map(([text, key]) => (
          <Chip key={text} label={text} selected={value === key} onPress={() => onChange(key)} />
        ))}
      </Wrap>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((o) => !o)}
        style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
        <Icon name="event" size={20} color={colors.primary} />
        <Text style={[Type.body, { color: colors.text, flex: 1 }]}>{format(fromDateKey(value), 'EEEE, d MMMM yyyy')}</Text>
        <Icon name={open ? 'expand-less' : 'expand-more'} color={colors.textSecondary} />
      </Pressable>
      {open ? (
        <Calendar
          key={isDark ? 'dark' : 'light'}
          current={value}
          onDayPress={(d) => {
            onChange(d.dateString);
            setOpen(false);
          }}
          markedDates={{ [value]: { selected: true, selectedColor: colors.primary } }}
          firstDay={1}
          enableSwipeMonths
          theme={{
            calendarBackground: colors.surface,
            dayTextColor: colors.text,
            monthTextColor: colors.text,
            textDisabledColor: colors.textTertiary,
            arrowColor: colors.primary,
            todayTextColor: colors.primary,
            textSectionTitleColor: colors.textSecondary,
          }}
          style={{ marginTop: Spacing.sm, borderRadius: Radius.md }}
        />
      ) : null}
    </View>
  );
}

export function SubjectPicker({
  subjects,
  value,
  onChange,
  allowNone,
  label = 'Subject',
}: {
  subjects: Subject[];
  value: ID | null;
  onChange: (id: ID | null) => void;
  allowNone?: boolean;
  label?: string;
}) {
  return (
    <View>
      <Label>{label}</Label>
      <Wrap>
        {allowNone ? <Chip label="None" selected={value === null} onPress={() => onChange(null)} /> : null}
        {subjects.map((s) => (
          <Chip key={s.id} label={s.code || s.name} color={s.color} selected={value === s.id} onPress={() => onChange(s.id)} />
        ))}
      </Wrap>
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { colors } = useApp();
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Label>Colour</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        {SubjectColors.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${c}`}
            accessibilityState={{ selected: value === c }}
            onPress={() => onChange(c)}
            style={[styles.swatch, { backgroundColor: c, borderColor: value === c ? colors.text : 'transparent' }]}>
            {value === c ? <Icon name="check" size={18} color="#fff" /> : null}
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});