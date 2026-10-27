import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { subDays } from 'date-fns';
import { Card, Icon, Row, Screen, SectionTitle, type IconName } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Spacing, Type } from '@/constants/theme';
import { cgpa, formatGpa } from '@/lib/gpa';
import { dateKey } from '@/lib/dates';

export default function MoreScreen() {
  const router = useRouter();
  const { data, colors } = useApp();

  const weekAgo = dateKey(subDays(new Date(), 6));
  const weekMinutes = data.sessions.filter((s) => s.date >= weekAgo).reduce((a, s) => a + s.minutes, 0);
  const running = data.timer.endsAt !== null || data.timer.pausedRemaining !== null;
  const g = cgpa(data.semesters);

  const items: { icon: IconName; title: string; subtitle: string; href: Href }[] = [
    {
      icon: 'timer',
      title: 'Study timer',
      subtitle: running ? 'Session in progress' : weekMinutes ? `${Math.floor(weekMinutes / 60)}h ${weekMinutes % 60}m this week` : 'Focus sessions with a reminder when time is up',
      href: '/study',
    },
    {
      icon: 'calculate',
      title: 'CGPA calculator',
      subtitle: g !== null ? `Current CGPA ${formatGpa(g)} over ${data.semesters.length} semester${data.semesters.length === 1 ? '' : 's'}` : 'SGPA per semester and overall CGPA',
      href: '/cgpa',
    },
    { icon: 'settings', title: 'Settings', subtitle: 'Reminders, default target, theme, backup', href: '/settings' },
  ];

  return (
    <Screen title="More">
      {items.map((it) => (
        <Card key={it.title} onPress={() => router.push(it.href)}>
          <Row>
            <View style={[styles.round, { backgroundColor: colors.primarySoft }]}>
              <Icon name={it.icon} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Type.h3, { color: colors.text }]}>{it.title}</Text>
              <Text style={[Type.small, { color: colors.textSecondary }]}>{it.subtitle}</Text>
            </View>
            <Icon name="chevron-right" color={colors.textTertiary} />
          </Row>
        </Card>
      ))}

      <SectionTitle>About</SectionTitle>
      <Card>
        <Text style={[Type.body, { color: colors.text }]}>
          Bunkmate keeps everything on your phone. No account, no ads, works offline.
        </Text>
        <Text style={[Type.small, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
          Back up from Settings before changing phones or reinstalling.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});