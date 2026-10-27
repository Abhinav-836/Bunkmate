import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Button, Card, Chip, Label, Row, SectionTitle, Sheet, Stepper, Wrap } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, Type } from '@/constants/theme';
import { confirmAction, notify } from '@/lib/confirm';
import { exportJson, parseBackup } from '@/lib/storage';
import type { ThemeSetting } from '@/lib/types';

const REMINDER_OPTIONS = [0, 5, 10, 15, 30];
const DAILY_OPTIONS: (string | null)[] = [null, '17:00', '18:00', '19:00', '20:00', '21:00'];
const dailyLabel = (t: string | null) => (t === null ? 'Off' : `${Number(t.slice(0, 2)) - 12} PM`);

export default function SettingsScreen() {
  const { data, colors, updateSettings, updateSubject, replaceAll, resetAll, enableReminders } = useApp();
  const s = data.settings;
  const [permission, setPermission] = useState<'granted' | 'denied' | 'unsupported' | 'unknown'>('unknown');
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState<string | null>(null);

  const mobile = Platform.OS === 'ios' || Platform.OS === 'android';

  const refreshPermission = async () => {
    if (!mobile) return setPermission('unsupported');
    const p = await Notifications.getPermissionsAsync();
    setPermission(p.granted ? 'granted' : 'denied');
  };

  useEffect(() => {
    refreshPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turnOnReminders = async () => {
    const ok = await enableReminders();
    await refreshPermission();
    if (!ok) notify('Notifications are blocked', 'Allow notifications for Bunkmate in your phone settings, then come back.');
  };

  const applyTargetToAll = () =>
    confirmAction('Apply to all subjects?', `Every subject's required attendance will be set to ${s.defaultTarget}%.`, 'Apply', () =>
      data.subjects.forEach((sub) => updateSubject(sub.id, { target: s.defaultTarget })),
    );

  const doExport = async () => {
    const json = exportJson(data);
    if (!mobile) {
      setExportText(json);
      return;
    }
    try {
      await Share.share({ title: 'Bunkmate backup', message: json });
    } catch {
      setExportText(json);
    }
  };

  const doImport = () => {
    let next;
    try {
      next = parseBackup(importText);
    } catch (e) {
      return notify('Could not import', (e as Error).message);
    }
    confirmAction(
      'Replace everything?',
      `This backup has ${next.subjects.length} subjects, ${next.slots.length} classes and ${next.deadlines.length} deadlines. Your current data will be replaced.`,
      'Replace',
      () => {
        replaceAll({ ...next, settings: { ...next.settings, onboarded: true } });
        setImporting(false);
        setImportText('');
        notify('Backup restored');
      },
    );
  };

  const reset = () =>
    confirmAction('Delete all data?', 'Subjects, attendance, timetable, deadlines, CGPA and study log will be erased. This cannot be undone.', 'Delete all', resetAll);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <SectionTitle>Attendance</SectionTitle>
      <Card>
        <Label>Default required attendance for new subjects</Label>
        <Row>
          <Stepper label="Default target" value={s.defaultTarget} min={50} max={100} step={5} onChange={(v) => updateSettings({ defaultTarget: v })} />
          <Text style={[Type.body, { color: colors.textSecondary }]}>%</Text>
        </Row>
        {data.subjects.length ? (
          <Button title="Apply to all subjects" kind="ghost" compact style={{ alignSelf: 'flex-start', marginTop: Spacing.sm }} onPress={applyTargetToAll} />
        ) : null}
        <Row style={{ justifyContent: 'space-between', marginTop: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[Type.body, { color: colors.text }]}>Count OD as present</Text>
            <Text style={[Type.small, { color: colors.textSecondary }]}>
              {s.odCountsPresent
                ? 'On duty, medical and sports leave count as attended.'
                : 'OD classes are left out of the count, like cancelled ones.'}
            </Text>
          </View>
          <Switch
            value={s.odCountsPresent}
            onValueChange={(v) => updateSettings({ odCountsPresent: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Count OD as present"
          />
        </Row>
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card>
        {mobile && permission === 'denied' ? (
          <View style={[styles.banner, { backgroundColor: colors.warningSoft }]}>
            <Text style={[Type.small, { color: colors.warning, flex: 1 }]}>Notifications are off, so reminders won’t appear.</Text>
            <Button title="Turn on" compact onPress={turnOnReminders} />
          </View>
        ) : null}
        {!mobile ? (
          <Text style={[Type.small, { color: colors.textTertiary, marginBottom: Spacing.md }]}>Reminders work in the phone app.</Text>
        ) : null}
        <Label>Remind me before each class</Label>
        <Wrap>
          {REMINDER_OPTIONS.map((m) => (
            <Chip key={m} label={m === 0 ? 'Off' : `${m} min`} selected={s.classReminderMinutes === m} onPress={() => updateSettings({ classReminderMinutes: m })} />
          ))}
        </Wrap>
        <Label>Evening reminder to mark attendance</Label>
        <Text style={[Type.small, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>Only on days with classes, and skipped once everything is marked.</Text>
        <Wrap>
          {DAILY_OPTIONS.map((t) => (
            <Chip key={t ?? 'off'} label={dailyLabel(t)} selected={s.dailyReminder === t} onPress={() => updateSettings({ dailyReminder: t })} />
          ))}
        </Wrap>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[Type.body, { color: colors.text }]}>Deadline reminders</Text>
            <Text style={[Type.small, { color: colors.textSecondary }]}>A day before and an hour before</Text>
          </View>
          <Switch
            value={s.deadlineReminders}
            onValueChange={(v) => updateSettings({ deadlineReminders: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Deadline reminders"
          />
        </Row>
      </Card>

      <SectionTitle>Timetable</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: Spacing.md }}>
          <Text style={[Type.body, { color: colors.text }]}>Show Saturday</Text>
          <Switch value={s.showSaturday} onValueChange={(v) => updateSettings({ showSaturday: v })} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Show Saturday" />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={[Type.body, { color: colors.text }]}>Show Sunday</Text>
          <Switch value={s.showSunday} onValueChange={(v) => updateSettings({ showSunday: v })} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Show Sunday" />
        </Row>
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <Wrap>
          {(['system', 'light', 'dark'] as ThemeSetting[]).map((t) => (
            <Chip key={t} label={t === 'system' ? 'Match phone' : t === 'light' ? 'Light' : 'Dark'} selected={s.theme === t} onPress={() => updateSettings({ theme: t })} />
          ))}
        </Wrap>
      </Card>

      <SectionTitle>Backup</SectionTitle>
      <Card>
        <Text style={[Type.small, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
          Everything is stored only on this phone. Export a backup before switching phones or reinstalling, and save it somewhere safe (for example, send it to yourself).
        </Text>
        <Row>
          <Button title="Export" icon="ios-share" kind="secondary" style={{ flex: 1 }} onPress={doExport} />
          <Button title="Import" icon="download" kind="secondary" style={{ flex: 1 }} onPress={() => setImporting(true)} />
        </Row>
        {exportText ? (
          <View style={{ marginTop: Spacing.md }}>
            <Label>Copy this text and keep it safe</Label>
            <TextInput
              value={exportText}
              editable={false}
              multiline
              selectTextOnFocus
              style={[styles.code, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              accessibilityLabel="Backup text"
            />
          </View>
        ) : null}
      </Card>

      <SectionTitle>Danger zone</SectionTitle>
      <Button title="Delete all data" icon="delete-forever" kind="danger" onPress={reset} />

      <Sheet visible={importing} title="Import backup" onClose={() => setImporting(false)}>
        <Text style={[Type.small, { color: colors.textSecondary, marginBottom: Spacing.md }]}>Paste the full backup text you exported earlier.</Text>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          multiline
          placeholder='{"version": 1, ...}'
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.code, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt, minHeight: 180 }]}
          accessibilityLabel="Backup text to import"
        />
        <Button title="Restore backup" style={{ marginTop: Spacing.md }} disabled={!importText.trim()} onPress={doImport} />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.xl, paddingTop: 0, paddingBottom: Spacing.xxl * 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.md },
  code: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, fontSize: 12, maxHeight: 220, textAlignVertical: 'top', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
});