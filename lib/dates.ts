import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { Weekday } from './types';

export const WEEKDAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Local calendar date as yyyy-MM-dd (never UTC, so late-night marks land on the right day). */
export function dateKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}

/** Parse yyyy-MM-dd as a LOCAL date. `new Date('2026-10-27')` would be UTC midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isoWeekday(d: Date = new Date()): Weekday {
  const js = d.getDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "14:05" -> "2:05 PM" */
export function formatTime12(hhmm: string): string {
  const total = toMinutes(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function safeParse(iso: string): Date | null {
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

/** Short human text for a due date relative to now: "Today, 11:59 PM", "Tomorrow", "in 5 days", "2 days late". */
export function relativeDue(iso: string, now: Date = new Date()): string {
  const due = safeParse(iso);
  if (!due) return 'No date';
  const days = differenceInCalendarDays(due, now);
  const time = format(due, 'h:mm a');
  if (due.getTime() < now.getTime()) {
    const late = -days;
    if (late === 0) return `Today, ${time} (overdue)`;
    return `${late} day${late === 1 ? '' : 's'} overdue`;
  }
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days < 7) return `${format(due, 'EEEE')}, ${time}`;
  return `${format(due, 'd MMM')}, ${time}`;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}