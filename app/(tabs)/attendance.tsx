import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SubjectForm } from '@/components/SubjectForm';
import { Button, Card, Empty, IconButton, ProgressBar, Row, Screen } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, Type } from '@/constants/theme';
import { formatPercent, overallStats, statsFor, verdictFor } from '@/lib/attendance';

export default function AttendanceScreen() {
  const router = useRouter();
  const { data, colors } = useApp();
  const [adding, setAdding] = useState(false);

  const od = data.settings.odCountsPresent;
  const overall = overallStats(data.subjects, data.records, od);
  const rows = data.subjects.map((s) => {
    const stats = statsFor(s, data.records, od);
    return { subject: s, stats, verdict: verdictFor(stats, s.target) };
  });
  // Subjects that need attention first
  const order = { danger: 0, edge: 1, safe: 2, empty: 3 } as const;
  rows.sort((a, b) => order[a.verdict.kind] - order[b.verdict.kind]);

  return (
    <Screen
      title="Attendance"
      subtitle={data.subjects.length ? `${formatPercent(overall.percent)} overall · ${overall.attended}/${overall.total} classes` : undefined}
      action={<IconButton icon="add" label="Add subject" onPress={() => setAdding(true)} />}>
      {rows.length === 0 ? (
        <Card>
          <Empty
            icon="menu-book"
            title="No subjects yet"
            body="Add each subject you have this semester. Bunkmate will tell you how many classes you can skip and still stay above the cutoff."
            action={<Button title="Add subject" icon="add" onPress={() => setAdding(true)} />}
          />
        </Card>
      ) : (
        rows.map(({ subject, stats, verdict }) => {
          const tone =
            verdict.kind === 'danger' ? colors.danger : verdict.kind === 'edge' ? colors.warning : verdict.kind === 'safe' ? colors.success : colors.textTertiary;
          return (
            <Card key={subject.id} onPress={() => router.push({ pathname: '/subject/[id]', params: { id: subject.id } })}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={[styles.dot, { backgroundColor: subject.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[Type.h3, { color: colors.text }]} numberOfLines={1}>
                    {subject.name}
                  </Text>
                  <Text style={[Type.small, { color: colors.textSecondary }]}>
                    {subject.code ? `${subject.code} · ` : ''}
                    {stats.attended}/{stats.total} attended · target {subject.target}%
                  </Text>
                </View>
                <Text style={[Type.h2, { color: verdict.kind === 'danger' ? colors.danger : colors.text }]}>{formatPercent(stats.percent)}</Text>
              </Row>
              <View style={{ marginTop: Spacing.md }}>
                <ProgressBar value={stats.percent ?? 0} color={tone} track={colors.surfaceAlt} />
              </View>
              <View style={[styles.verdict, { backgroundColor: tone + '1A' }]}>
                <Text style={[Type.small, { color: tone, fontWeight: '700' }]}>{verdict.text}</Text>
              </View>
            </Card>
          );
        })
      )}
      <SubjectForm visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  verdict: { marginTop: Spacing.md, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8, alignSelf: 'flex-start' },
});