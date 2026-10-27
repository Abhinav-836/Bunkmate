import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData, Settings } from './types';

const KEY = 'bunkmate:data:v1';

export const DEFAULT_SETTINGS: Settings = {
  defaultTarget: 75,
  classReminderMinutes: 10,
  deadlineReminders: true,
  theme: 'system',
  showSaturday: true,
  showSunday: false,
  odCountsPresent: true,
  dailyReminder: '18:00',
  onboarded: false,
};

export function emptyData(): AppData {
  return {
    version: 1,
    subjects: [],
    records: [],
    slots: [],
    deadlines: [],
    semesters: [],
    sessions: [],
    timer: { endsAt: null, pausedRemaining: null, durationMin: 25, label: '' },
    settings: { ...DEFAULT_SETTINGS },
  };
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Fill in anything missing so older saves and hand-edited backups still load.
 * Throws if the input is clearly not a Bunkmate backup.
 */
export function normalize(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Bunkmate backup');
  const r = raw as Partial<AppData>;
  if (r.version !== 1 || !Array.isArray(r.subjects)) throw new Error('Not a Bunkmate backup');
  const base = emptyData();
  return {
    version: 1,
    subjects: arr(r.subjects),
    records: arr(r.records),
    slots: arr(r.slots),
    deadlines: arr(r.deadlines),
    semesters: arr(r.semesters),
    sessions: arr(r.sessions),
    timer: { ...base.timer, ...(r.timer ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}

export async function loadData(): Promise<AppData> {
  try {
    const json = await AsyncStorage.getItem(KEY);
    if (!json) return emptyData();
    return normalize(JSON.parse(json));
  } catch (e) {
    console.warn('Could not read saved data, starting fresh', e);
    return emptyData();
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export function exportJson(data: AppData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

export function parseBackup(text: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new Error('That text is not valid JSON. Paste the whole backup.');
  }
  return normalize(parsed);
}