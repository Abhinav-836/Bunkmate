import type { AttendanceRecord, Slot, Subject } from './types';

export type SubjectStats = {
  attended: number;
  total: number;
  /** 0-100, or null when no classes have been held yet. */
  percent: number | null;
  cancelled: number;
  od: number;
};

export type Verdict = {
  kind: 'empty' | 'safe' | 'edge' | 'danger';
  /** Classes you can still skip and stay at or above target. */
  canSkip: number;
  /** Classes in a row you must attend to get back to target (Infinity if impossible). */
  mustAttend: number;
  text: string;
};

/**
 * @param odCountsPresent true (default): OD / duty leave counts as attended.
 *   false: OD classes are left out entirely, like cancelled ones. Colleges differ.
 */
export function statsFor(subject: Subject, records: AttendanceRecord[], odCountsPresent = true): SubjectStats {
  let present = 0;
  let absent = 0;
  let cancelled = 0;
  let od = 0;
  for (const r of records) {
    if (r.subjectId !== subject.id) continue;
    if (r.status === 'present') present++;
    else if (r.status === 'absent') absent++;
    else if (r.status === 'od') od++;
    else cancelled++;
  }
  const counted = odCountsPresent ? od : 0;
  const attended = Math.max(0, subject.baseAttended) + present + counted;
  const total = Math.max(0, subject.baseTotal) + present + absent + counted;
  return { attended, total, percent: percentOf(attended, total), cancelled, od };
}

export function percentOf(attended: number, total: number): number | null {
  if (total <= 0) return null;
  return (attended / total) * 100;
}

/**
 * Largest k with attended / (total + k) >= target%.
 * Integer maths (attended*100 vs target*total) avoids float edge cases like
 * 75.00000001%.
 */
export function classesYouCanSkip(attended: number, total: number, target: number): number {
  if (target <= 0) return Infinity;
  const k = Math.floor((100 * attended - target * total) / target);
  return Math.max(0, k);
}

/** Smallest n with (attended + n) / (total + n) >= target%. */
export function classesYouMustAttend(attended: number, total: number, target: number): number {
  if (100 * attended >= target * total) return 0;
  if (target >= 100) return Infinity; // one absence already makes 100% impossible
  return Math.ceil((target * total - 100 * attended) / (100 - target));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 'es'}`;

export function verdictFor(stats: SubjectStats, target: number): Verdict {
  const { attended, total } = stats;
  if (total === 0) {
    return { kind: 'empty', canSkip: 0, mustAttend: 0, text: 'No classes marked yet' };
  }
  const mustAttend = classesYouMustAttend(attended, total, target);
  if (mustAttend > 0) {
    return {
      kind: 'danger',
      canSkip: 0,
      mustAttend,
      text:
        mustAttend === Infinity
          ? `${target}% is no longer reachable`
          : `Attend the next ${plural(mustAttend, 'class')} to reach ${target}%`,
    };
  }
  const canSkip = classesYouCanSkip(attended, total, target);
  if (canSkip === 0) {
    return { kind: 'edge', canSkip: 0, mustAttend: 0, text: "On the edge: don't skip the next class" };
  }
  return { kind: 'safe', canSkip, mustAttend: 0, text: `You can skip ${plural(canSkip, 'class')}` };
}

export function overallStats(subjects: Subject[], records: AttendanceRecord[], odCountsPresent = true): SubjectStats {
  let attended = 0;
  let total = 0;
  let cancelled = 0;
  let od = 0;
  for (const s of subjects) {
    const st = statsFor(s, records, odCountsPresent);
    attended += st.attended;
    total += st.total;
    cancelled += st.cancelled;
    od += st.od;
  }
  return { attended, total, percent: percentOf(attended, total), cancelled, od };
}

export type SkipDayRow = {
  subject: Subject;
  /** Classes of this subject on that day. */
  classes: number;
  before: number | null;
  after: number | null;
  /** Still at or above target after skipping all of that day's classes. */
  ok: boolean;
};

export type SkipDayPlan = {
  rows: SkipDayRow[];
  /** True when there are classes and every subject stays at or above target. */
  safe: boolean;
};

/** "Can I skip this whole day?" Skip every class in `daySlots` and see where each subject lands. */
export function planSkipDay(
  subjects: Subject[],
  records: AttendanceRecord[],
  daySlots: Slot[],
  odCountsPresent = true,
): SkipDayPlan {
  const counts = new Map<string, number>();
  for (const s of daySlots) counts.set(s.subjectId, (counts.get(s.subjectId) ?? 0) + 1);
  const rows: SkipDayRow[] = [];
  for (const subject of subjects) {
    const classes = counts.get(subject.id);
    if (!classes) continue;
    const st = statsFor(subject, records, odCountsPresent);
    const after = percentOf(st.attended, st.total + classes);
    // No history yet: one skip puts you at 0%, so it's not "safe"
    const ok = after !== null && 100 * st.attended >= subject.target * (st.total + classes);
    rows.push({ subject, classes, before: st.percent, after, ok });
  }
  // Riskiest first
  rows.sort((a, b) => Number(a.ok) - Number(b.ok) || (a.after ?? 0) - (b.after ?? 0));
  return { rows, safe: rows.length > 0 && rows.every((r) => r.ok) };
}

export function formatPercent(p: number | null): string {
  if (p === null) return '--';
  // Floor, not round: 74.6% must never be shown as "75%" when 75% is the cutoff.
  // The tiny epsilon stops float noise (58/100*100 = 57.999...) from showing 57.9%.
  return `${Math.floor(p * 10 + 1e-9) / 10}%`;
}