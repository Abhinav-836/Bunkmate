import type { AppData } from '../types';

/** emptyData() without importing storage.ts (which needs AsyncStorage, a native module). */
export function emptyDataForTests(): AppData {
  return {
    version: 1,
    subjects: [],
    records: [],
    slots: [],
    deadlines: [],
    semesters: [],
    sessions: [],
    timer: { endsAt: null, pausedRemaining: null, durationMin: 25, label: '' },
    settings: {
      defaultTarget: 75, classReminderMinutes: 10, deadlineReminders: true, theme: 'system',
      showSaturday: true, showSunday: false, odCountsPresent: true, dailyReminder: '18:00', onboarded: true,
    },
  };
}
