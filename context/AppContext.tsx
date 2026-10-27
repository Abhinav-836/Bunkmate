import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { Colors, type Palette } from '@/constants/theme';
import { dateKey, newId } from '@/lib/dates';
import { cancelStudyEnd, ensurePermission, rescheduleAll, rescheduleDaily, scheduleStudyEnd } from '@/lib/notifications';
import { emptyData, loadData, saveData } from '@/lib/storage';
import type {
  AppData,
  AttendanceStatus,
  Deadline,
  ID,
  Semester,
  Settings,
  Slot,
  Subject,
} from '@/lib/types';

type Actions = {
  addSubject: (s: Omit<Subject, 'id' | 'createdAt'>) => ID;
  updateSubject: (id: ID, patch: Partial<Subject>) => void;
  deleteSubject: (id: ID) => void;

  /** Mark a class. Marking the same status again clears the mark (undo). */
  markClass: (subjectId: ID, date: string, slotId: ID | null, status: AttendanceStatus) => void;
  /** Mark several timetable classes on one date at once (holiday, all present). null clears their marks. */
  markDay: (date: string, slots: { id: ID; subjectId: ID }[], status: AttendanceStatus | null) => void;
  /** Add an extra class that isn't on the timetable (always a new record). */
  addExtraClass: (subjectId: ID, date: string, status: AttendanceStatus) => void;
  deleteRecord: (id: ID) => void;

  saveSlot: (slot: Omit<Slot, 'id'> & { id?: ID }) => void;
  deleteSlot: (id: ID) => void;

  saveDeadline: (d: Omit<Deadline, 'id' | 'createdAt' | 'done' | 'doneAt'> & { id?: ID }) => void;
  toggleDeadline: (id: ID) => void;
  deleteDeadline: (id: ID) => void;

  saveSemester: (s: Semester) => void;
  deleteSemester: (id: ID) => void;

  startTimer: (minutes: number, label: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  /** Called by the timer screen when time runs out; records the session once. */
  finishTimerIfDue: () => boolean;

  updateSettings: (patch: Partial<Settings>) => void;
  /** Ask for notification permission if needed, then schedule every reminder now. */
  enableReminders: () => Promise<boolean>;
  replaceAll: (data: AppData) => void;
  resetAll: () => void;
};

type Ctx = Actions & {
  data: AppData;
  ready: boolean;
  colors: Palette;
  isDark: boolean;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  // Latest data for callbacks that run outside render (timer, reminders)
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setReady(true);
    });
  }, []);

  // Persist after every change (once loaded, so we never overwrite saved data with the empty default)
  useEffect(() => {
    if (!ready) return;
    saveData(data).catch((e) => console.warn('Save failed', e));
  }, [data, ready]);

  // Re-plan reminders when anything they depend on changes (debounced)
  const reminderKey = JSON.stringify([
    data.slots,
    data.deadlines.map((d) => [d.id, d.title, d.due, d.done, d.type, d.subjectId]),
    data.subjects.map((s) => [s.id, s.name]),
    data.settings.classReminderMinutes,
    data.settings.deadlineReminders,
  ]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      rescheduleAll(dataRef.current).catch((e) => console.warn('Reminder scheduling failed', e));
    }, 800);
    return () => clearTimeout(t);
  }, [reminderKey, ready]);

  // Evening "mark attendance" reminder depends on today's marks too, so it has
  // its own (cheaper) scheduler that re-runs when those change.
  const today = dateKey();
  const dailyKey = JSON.stringify([
    today,
    data.settings.dailyReminder,
    data.slots.map((s) => [s.id, s.day, s.subjectId]),
    data.subjects.map((s) => s.id),
    data.records.filter((r) => r.date === today && r.slotId).map((r) => r.slotId),
  ]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      rescheduleDaily(dataRef.current).catch((e) => console.warn('Daily reminder scheduling failed', e));
    }, 800);
    return () => clearTimeout(t);
  }, [dailyKey, ready]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  const actions = useMemo<Actions>(
    () => ({
      addSubject: (s) => {
        const id = newId();
        update((d) => ({ ...d, subjects: [...d.subjects, { ...s, id, createdAt: new Date().toISOString() }] }));
        return id;
      },
      updateSubject: (id, patch) =>
        update((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === id ? { ...s, ...patch, id } : s)) })),
      deleteSubject: (id) =>
        update((d) => ({
          ...d,
          subjects: d.subjects.filter((s) => s.id !== id),
          records: d.records.filter((r) => r.subjectId !== id),
          slots: d.slots.filter((s) => s.subjectId !== id),
          deadlines: d.deadlines.map((x) => (x.subjectId === id ? { ...x, subjectId: null } : x)),
        })),

      markClass: (subjectId, date, slotId, status) =>
        update((d) => {
          const existing = d.records.find(
            (r) => r.subjectId === subjectId && r.date === date && r.slotId === slotId,
          );
          if (existing && existing.status === status) {
            return { ...d, records: d.records.filter((r) => r.id !== existing.id) };
          }
          if (existing) {
            return { ...d, records: d.records.map((r) => (r.id === existing.id ? { ...r, status } : r)) };
          }
          return {
            ...d,
            records: [
              ...d.records,
              { id: newId(), subjectId, date, slotId, status, createdAt: new Date().toISOString() },
            ],
          };
        }),
      markDay: (date, slots, status) =>
        update((d) => {
          const ids = new Set(slots.map((s) => s.id));
          // Drop existing marks for these classes on this date, then add the new ones
          const kept = d.records.filter((r) => !(r.date === date && r.slotId !== null && ids.has(r.slotId)));
          if (status === null) return { ...d, records: kept };
          const createdAt = new Date().toISOString();
          return {
            ...d,
            records: [
              ...kept,
              ...slots.map((s) => ({ id: newId(), subjectId: s.subjectId, date, slotId: s.id, status, createdAt })),
            ],
          };
        }),
      addExtraClass: (subjectId, date, status) =>
        update((d) => ({
          ...d,
          records: [
            ...d.records,
            { id: newId(), subjectId, date, slotId: null, status, createdAt: new Date().toISOString() },
          ],
        })),
      deleteRecord: (id) => update((d) => ({ ...d, records: d.records.filter((r) => r.id !== id) })),

      saveSlot: (slot) =>
        update((d) => {
          if (slot.id && d.slots.some((s) => s.id === slot.id)) {
            return { ...d, slots: d.slots.map((s) => (s.id === slot.id ? ({ ...slot, id: s.id } as Slot) : s)) };
          }
          return { ...d, slots: [...d.slots, { ...slot, id: newId() } as Slot] };
        }),
      deleteSlot: (id) => update((d) => ({ ...d, slots: d.slots.filter((s) => s.id !== id) })),

      saveDeadline: (x) =>
        update((d) => {
          if (x.id && d.deadlines.some((e) => e.id === x.id)) {
            return { ...d, deadlines: d.deadlines.map((e) => (e.id === x.id ? { ...e, ...x, id: e.id } : e)) };
          }
          const created: Deadline = {
            ...x,
            id: newId(),
            done: false,
            doneAt: null,
            createdAt: new Date().toISOString(),
          };
          return { ...d, deadlines: [...d.deadlines, created] };
        }),
      toggleDeadline: (id) =>
        update((d) => ({
          ...d,
          deadlines: d.deadlines.map((e) =>
            e.id === id ? { ...e, done: !e.done, doneAt: e.done ? null : new Date().toISOString() } : e,
          ),
        })),
      deleteDeadline: (id) => update((d) => ({ ...d, deadlines: d.deadlines.filter((e) => e.id !== id) })),

      saveSemester: (sem) =>
        update((d) => ({
          ...d,
          semesters: d.semesters.some((s) => s.id === sem.id)
            ? d.semesters.map((s) => (s.id === sem.id ? sem : s))
            : [...d.semesters, sem],
        })),
      deleteSemester: (id) => update((d) => ({ ...d, semesters: d.semesters.filter((s) => s.id !== id) })),

      startTimer: (minutes, label) => {
        const endsAt = Date.now() + minutes * 60_000;
        update((d) => ({ ...d, timer: { endsAt, pausedRemaining: null, durationMin: minutes, label } }));
        scheduleStudyEnd(endsAt, label).catch(() => {});
      },
      pauseTimer: () => {
        const t = dataRef.current.timer;
        if (!t.endsAt) return;
        const remaining = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
        update((d) => ({ ...d, timer: { ...d.timer, endsAt: null, pausedRemaining: remaining } }));
        cancelStudyEnd().catch(() => {});
      },
      resumeTimer: () => {
        const t = dataRef.current.timer;
        if (t.pausedRemaining === null) return;
        const endsAt = Date.now() + t.pausedRemaining * 1000;
        update((d) => ({ ...d, timer: { ...d.timer, endsAt, pausedRemaining: null } }));
        scheduleStudyEnd(endsAt, t.label).catch(() => {});
      },
      stopTimer: () => {
        update((d) => ({ ...d, timer: { ...d.timer, endsAt: null, pausedRemaining: null } }));
        cancelStudyEnd().catch(() => {});
      },
      finishTimerIfDue: () => {
        const t = dataRef.current.timer;
        if (!t.endsAt || t.endsAt > Date.now()) return false;
        const endedAt = new Date(t.endsAt);
        // Clear endsAt in the same update that records the session, so it can only be recorded once
        dataRef.current = { ...dataRef.current, timer: { ...t, endsAt: null } };
        update((d) =>
          d.timer.endsAt === null
            ? d
            : {
                ...d,
                timer: { ...d.timer, endsAt: null, pausedRemaining: null },
                sessions: [
                  {
                    id: newId(),
                    date: dateKey(endedAt),
                    minutes: t.durationMin,
                    label: t.label,
                    endedAt: endedAt.toISOString(),
                  },
                  ...d.sessions,
                ],
              },
        );
        return true;
      },

      updateSettings: (patch) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      enableReminders: async () => {
        const ok = await ensurePermission();
        // The debounced scheduler may have run while the permission prompt was
        // still open (and skipped everything), so schedule again now.
        if (ok) {
          await rescheduleAll(dataRef.current).catch(() => {});
          await rescheduleDaily(dataRef.current).catch(() => {});
        }
        return ok;
      },
      replaceAll: (next) => setData(next),
      resetAll: () => {
        cancelStudyEnd().catch(() => {});
        setData({ ...emptyData(), settings: { ...emptyData().settings, onboarded: true } });
      },
    }),
    [update],
  );

  // Record a finished study session even if the timer screen isn't open
  // (including when the app is reopened after the time ran out).
  const { finishTimerIfDue } = actions;
  const endsAt = data.timer.endsAt;
  useEffect(() => {
    if (!ready || endsAt === null) return;
    const t = setTimeout(finishTimerIfDue, Math.max(0, endsAt - Date.now()) + 300);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') finishTimerIfDue();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [ready, endsAt, finishTimerIfDue]);

  // Theme
  const device = useColorScheme();
  const pref = data.settings.theme;
  const isDark = pref === 'system' ? device === 'dark' : pref === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  const value = useMemo<Ctx>(
    () => ({ ...actions, data, ready, colors, isDark }),
    [actions, data, ready, colors, isDark],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}