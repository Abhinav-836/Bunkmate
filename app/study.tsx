import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, subDays } from 'date-fns';
import { Button, Card, Chip, Label, Row, SectionTitle, Stepper, Wrap } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Spacing, Type } from '@/constants/theme';
import { notify } from '@/lib/confirm';
import { dateKey, fromDateKey } from '@/lib/dates';
import { ensurePermission } from '@/lib/notifications';

const PRESETS = [25, 45, 60, 90];

function clock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function StudyScreen() {
  const { data, colors, startTimer, pauseTimer, resumeTimer, stopTimer, finishTimerIfDue } = useApp();
  const { timer } = data;
  const [minutes, setMinutes] = useState(timer.durationMin || 25);
  const [label, setLabel] = useState(timer.label);
  const [now, setNow] = useState(Date.now());

  const running = timer.endsAt !== null;
  const paused = timer.pausedRemaining !== null;
  const remaining = running ? Math.ceil((timer.endsAt! - now) / 1000) : paused ? timer.pausedRemaining! : minutes * 60;

  // The countdown is computed from the stored end time, so it stays correct
  // when the phone is locked or the app is closed and reopened.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (running && remaining <= 0 && finishTimerIfDue()) {
      notify('Session complete', `${timer.durationMin} minutes${timer.label ? ` of ${timer.label}` : ''} added to your study log.`);
    }
  }, [running, remaining, finishTimerIfDue, timer.durationMin, timer.label]);

  const start = async () => {
    await ensurePermission();
    setNow(Date.now());
    startTimer(minutes, label.trim());
  };

  // `now` only ticks while running, so it is stale after a pause. Refresh it
  // before resuming, or the clock briefly shows the paused time added on.
  const resume = () => {
    setNow(Date.now());
    resumeTimer();
  };

  const today = dateKey();
  const weekAgo = dateKey(subDays(new Date(), 6));
  const todayMin = data.sessions.filter((s) => s.date === today).reduce((a, s) => a + s.minutes, 0);
  const weekMin = data.sessions.filter((s) => s.date >= weekAgo).reduce((a, s) => a + s.minutes, 0);
  const total = timer.durationMin * 60 || 1;
  const progress = running || paused ? 1 - remaining / total : 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Card style={{ alignItems: 'center', paddingVertical: Spacing.xxl }}>
        <Text style={[Type.small, { color: colors.textSecondary }]}>
          {running ? (timer.label ? `Studying ${timer.label}` : 'Focus') : paused ? 'Paused' : 'Ready'}
        </Text>
        <Text style={[styles.clock, { color: colors.text }]} accessibilityLabel={`Time left ${clock(remaining)}`}>
          {clock(remaining)}
        </Text>
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, progress * 100))}%`, backgroundColor: colors.primary }]} />
        </View>
        <Row style={{ marginTop: Spacing.xl, width: '100%' }}>
          {!running && !paused ? <Button title="Start" icon="play-arrow" style={{ flex: 1 }} onPress={start} /> : null}
          {running ? <Button title="Pause" icon="pause" kind="secondary" style={{ flex: 1 }} onPress={pauseTimer} /> : null}
          {paused ? <Button title="Resume" icon="play-arrow" style={{ flex: 1 }} onPress={resume} /> : null}
          {running || paused ? <Button title="Stop" icon="stop" kind="danger" style={{ flex: 1 }} onPress={stopTimer} /> : null}
        </Row>
        {running || paused ? (
          <Text style={[Type.small, { color: colors.textTertiary, marginTop: Spacing.md, textAlign: 'center' }]}>
            Stopping early doesn’t count the session. You’ll get a notification when time is up, even if you leave the app.
          </Text>
        ) : null}
      </Card>

      {!running && !paused ? (
        <Card>
          <Label>Length</Label>
          <Wrap>
            {PRESETS.map((p) => (
              <Chip key={p} label={`${p} min`} selected={minutes === p} onPress={() => setMinutes(p)} />
            ))}
          </Wrap>
          <Row style={{ marginBottom: Spacing.md }}>
            <Stepper label="Minutes" value={minutes} min={5} max={180} step={5} onChange={setMinutes} />
            <Text style={[Type.body, { color: colors.textSecondary }]}>minutes</Text>
          </Row>
          {data.subjects.length ? (
            <>
              <Label>Studying (optional)</Label>
              <Wrap>
                <Chip label="General" selected={label === ''} onPress={() => setLabel('')} />
                {data.subjects.map((s) => (
                  <Chip key={s.id} label={s.code || s.name} color={s.color} selected={label === (s.code || s.name)} onPress={() => setLabel(s.code || s.name)} />
                ))}
              </Wrap>
            </>
          ) : null}
        </Card>
      ) : null}

      <SectionTitle>Your study log</SectionTitle>
      <Row style={{ marginBottom: Spacing.md }}>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <Text style={[Type.small, { color: colors.textSecondary }]}>Today</Text>
          <Text style={[Type.h2, { color: colors.text }]}>{todayMin} min</Text>
        </Card>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <Text style={[Type.small, { color: colors.textSecondary }]}>Last 7 days</Text>
          <Text style={[Type.h2, { color: colors.text }]}>
            {Math.floor(weekMin / 60)}h {weekMin % 60}m
          </Text>
        </Card>
      </Row>
      <Card style={{ paddingVertical: Spacing.sm }}>
        {data.sessions.length === 0 ? (
          <Text style={[Type.body, { color: colors.textSecondary, paddingVertical: Spacing.sm }]}>Finished sessions show up here.</Text>
        ) : (
          data.sessions.slice(0, 12).map((s, i) => (
            <Row key={s.id} style={[{ paddingVertical: 10 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Text style={[Type.body, { color: colors.text, flex: 1 }]}>{s.label || 'General'}</Text>
              <Text style={[Type.small, { color: colors.textSecondary }]}>
                {s.minutes} min · {format(fromDateKey(s.date), 'd MMM')}
              </Text>
            </Row>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  clock: { fontSize: 64, fontWeight: '200', letterSpacing: 2, marginVertical: Spacing.md, fontVariant: ['tabular-nums'] },
  track: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%' },
});