import type { Course, Semester } from './types';

/** Common 10-point letter grades used by most Indian universities (UGC / AICTE style). */
export const GRADE_POINTS: Record<string, number> = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  P: 4,
  F: 0,
};

export const GRADES = Object.keys(GRADE_POINTS);

/** Grade points for a letter grade, or a typed number between 0 and 10. */
export function gradePoint(grade: string): number | null {
  const g = grade.trim().toUpperCase();
  if (g in GRADE_POINTS) return GRADE_POINTS[g];
  const n = Number(g);
  if (g !== '' && Number.isFinite(n) && n >= 0 && n <= 10) return n;
  return null;
}

type Totals = { points: number; credits: number };

function totals(courses: Course[]): Totals {
  let points = 0;
  let credits = 0;
  for (const c of courses) {
    const gp = gradePoint(c.grade);
    if (gp === null || !(c.credits > 0)) continue;
    points += gp * c.credits;
    credits += c.credits;
  }
  return { points, credits };
}

export function sgpa(courses: Course[]): number | null {
  const t = totals(courses);
  return t.credits > 0 ? t.points / t.credits : null;
}

/** Credit-weighted across every course of every semester. */
export function cgpa(semesters: Semester[]): number | null {
  const t = totals(semesters.flatMap((s) => s.courses));
  return t.credits > 0 ? t.points / t.credits : null;
}

export function semesterCredits(courses: Course[]): number {
  return totals(courses).credits;
}

export function formatGpa(v: number | null): string {
  return v === null ? '--' : v.toFixed(2);
}