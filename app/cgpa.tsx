import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, Empty, Icon, Row, SectionTitle, Sheet, Wrap } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, Type } from '@/constants/theme';
import { confirmAction, notify } from '@/lib/confirm';
import { newId } from '@/lib/dates';
import { GRADES, GRADE_POINTS, cgpa, formatGpa, gradePoint, semesterCredits, sgpa } from '@/lib/gpa';
import type { Course, Semester } from '@/lib/types';

const blankCourse = (): Course => ({ id: newId(), name: '', credits: 3, grade: 'A' });

export default function CgpaScreen() {
  const { data, colors, saveSemester, deleteSemester } = useApp();
  const [draft, setDraft] = useState<Semester | null>(null);
  const [gradeFor, setGradeFor] = useState<string | null>(null);
  // Raw text of the credit boxes, so typing "1." on the way to "1.5" isn't swallowed
  const [creditText, setCreditText] = useState<Record<string, string>>({});

  const overall = cgpa(data.semesters);
  const totalCredits = semesterCredits(data.semesters.flatMap((s) => s.courses));

  const openNew = () => {
    setGradeFor(null);
    setCreditText({});
    setDraft({
      id: newId(),
      name: `Semester ${data.semesters.length + 1}`,
      // Pre-fill this semester's subjects from the attendance list
      courses: data.subjects.length
        ? data.subjects.map((s) => ({ id: newId(), name: s.name, credits: 3, grade: 'A' }))
        : [blankCourse(), blankCourse(), blankCourse()],
    });
  };

  const setCourse = (id: string, patch: Partial<Course>) =>
    setDraft((d) => (d ? { ...d, courses: d.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : d));

  const save = () => {
    if (!draft) return;
    const courses = draft.courses.filter((c) => c.name.trim() || c.credits > 0);
    if (!courses.some((c) => c.credits > 0 && gradePoint(c.grade) !== null)) {
      return notify('Add a course', 'Enter at least one course with credits and a grade.');
    }
    saveSemester({ ...draft, name: draft.name.trim() || 'Semester', courses: courses.map((c) => ({ ...c, name: c.name.trim() })) });
    setDraft(null);
  };

  const remove = () => {
    if (!draft) return;
    confirmAction('Delete semester?', draft.name, 'Delete', () => {
      deleteSemester(draft.id);
      setDraft(null);
    });
  };

  const live = draft ? sgpa(draft.courses) : null;
  const exists = draft ? data.semesters.some((s) => s.id === draft.id) : false;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
      <Card style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
        <Text style={[Type.small, { color: colors.textSecondary }]}>CGPA</Text>
        <Text style={[styles.big, { color: colors.text }]}>{formatGpa(overall)}</Text>
        <Text style={[Type.small, { color: colors.textSecondary }]}>
          {totalCredits ? `${totalCredits} credits across ${data.semesters.length} semester${data.semesters.length === 1 ? '' : 's'}` : 'Add your semesters to calculate'}
        </Text>
      </Card>

      <SectionTitle action={<Text style={[Type.small, { color: colors.primary, fontWeight: '600' }]} onPress={openNew}>Add semester</Text>}>
        Semesters
      </SectionTitle>

      {data.semesters.length === 0 ? (
        <Card>
          <Empty
            icon="calculate"
            title="No semesters yet"
            body="Enter each course's credits and grade. CGPA is weighted by credits, the way most Indian universities calculate it."
            action={<Button title="Add semester" icon="add" onPress={openNew} />}
          />
        </Card>
      ) : (
        data.semesters.map((s) => (
          <Card
            key={s.id}
            onPress={() => {
              setGradeFor(null);
              setCreditText({});
              setDraft({ ...s, courses: s.courses.map((c) => ({ ...c })) });
            }}>
            <Row>
              <View style={{ flex: 1 }}>
                <Text style={[Type.h3, { color: colors.text }]}>{s.name}</Text>
                <Text style={[Type.small, { color: colors.textSecondary }]}>
                  {s.courses.length} courses · {semesterCredits(s.courses)} credits
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[Type.tiny, { color: colors.textSecondary }]}>SGPA</Text>
                <Text style={[Type.h2, { color: colors.text }]}>{formatGpa(sgpa(s.courses))}</Text>
              </View>
            </Row>
          </Card>
        ))
      )}

      <Card>
        <Text style={[Type.small, { color: colors.textSecondary }]}>
          Grade points: {GRADES.map((g) => `${g} ${GRADE_POINTS[g]}`).join(' · ')}. You can also type a number (0-10) as the grade. Check your university’s
          rules for converting CGPA to a percentage, as they differ.
        </Text>
      </Card>

      <Sheet visible={draft !== null} title={exists ? 'Edit semester' : 'New semester'} onClose={() => setDraft(null)}>
        {draft ? (
          <>
            <TextInput
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              placeholder="Semester 3"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Semester name"
            />
            <Row style={{ marginBottom: Spacing.sm }}>
              <Text style={[Type.tiny, { color: colors.textSecondary, flex: 1 }]}>COURSE</Text>
              <Text style={[Type.tiny, { color: colors.textSecondary, width: 56, textAlign: 'center' }]}>CREDITS</Text>
              <Text style={[Type.tiny, { color: colors.textSecondary, width: 56, textAlign: 'center' }]}>GRADE</Text>
              <View style={{ width: 24 }} />
            </Row>
            {draft.courses.map((c) => (
              <View key={c.id} style={{ marginBottom: Spacing.sm }}>
                <Row>
                  <TextInput
                    value={c.name}
                    onChangeText={(name) => setCourse(c.id, { name })}
                    placeholder="Course"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Course name"
                    style={[styles.cell, { flex: 1, minWidth: 0, color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                  />
                  <TextInput
                    value={creditText[c.id] ?? (c.credits ? String(c.credits) : '')}
                    onChangeText={(t) => {
                      const clean = t.replace(/[^0-9.]/g, '');
                      setCreditText((m) => ({ ...m, [c.id]: clean }));
                      setCourse(c.id, { credits: Math.min(30, parseFloat(clean) || 0) });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Credits"
                    style={[styles.cell, { width: 56, flexShrink: 0, textAlign: 'center', color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Grade ${c.grade}`}
                    onPress={() => setGradeFor(gradeFor === c.id ? null : c.id)}
                    style={[styles.cell, styles.gradeBtn, { borderColor: gradeFor === c.id ? colors.primary : colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[Type.body, { color: gradePoint(c.grade) === null ? colors.danger : colors.text, fontWeight: '700' }]}>{c.grade || '?'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Remove course"
                    hitSlop={8}
                    onPress={() => setDraft({ ...draft, courses: draft.courses.filter((x) => x.id !== c.id) })}>
                    <Icon name="close" size={20} color={colors.textTertiary} />
                  </Pressable>
                </Row>
                {gradeFor === c.id ? (
                  <View style={{ marginTop: Spacing.sm }}>
                    <Wrap>
                      {GRADES.map((g) => (
                        <Chip
                          key={g}
                          label={g}
                          selected={c.grade === g}
                          onPress={() => {
                            setCourse(c.id, { grade: g });
                            setGradeFor(null);
                          }}
                        />
                      ))}
                    </Wrap>
                  </View>
                ) : null}
              </View>
            ))}
            <Button title="Add course" icon="add" kind="secondary" compact style={{ marginBottom: Spacing.lg }} onPress={() => setDraft({ ...draft, courses: [...draft.courses, blankCourse()] })} />
            <Row style={{ justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <Text style={[Type.body, { color: colors.textSecondary }]}>SGPA</Text>
              <Text style={[Type.h2, { color: colors.text }]}>{formatGpa(live)}</Text>
            </Row>
            <Button title="Save semester" onPress={save} />
            {exists ? <Button title="Delete semester" kind="ghost" style={{ marginTop: Spacing.sm }} onPress={remove} /> : null}
          </>
        ) : null}
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  big: { fontSize: 56, fontWeight: '800', marginVertical: 4 },
  nameInput: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16, marginBottom: Spacing.lg, fontWeight: '600' },
  cell: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
  gradeBtn: { width: 56, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
});