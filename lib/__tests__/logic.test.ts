import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classesYouCanSkip,
  classesYouMustAttend,
  formatPercent,
  planSkipDay,
  statsFor,
  verdictFor,
} from '../attendance';
import { cgpa, gradePoint, sgpa } from '../gpa';
import { formatTime12, fromDateKey, fromMinutes, isoWeekday, relativeDue, toMinutes } from '../dates';
import type { AttendanceRecord, Slot, Subject } from '../types';

const subject = (over: Partial<Subject> = {}): Subject => ({
  id: 's1',
  name: 'DBMS',
  code: 'CS301',
  color: '#6366F1',
  target: 75,
  baseAttended: 0,
  baseTotal: 0,
  createdAt: '',
  ...over,
});

const rec = (status: AttendanceRecord['status'], i: number): AttendanceRecord => ({
  id: `r${i}`,
  subjectId: 's1',
  date: '2026-10-01',
  slotId: null,
  status,
  createdAt: '',
});

test('can skip: 30/36 at 75% -> 4 more (30/40 = 75%)', () => {
  assert.equal(classesYouCanSkip(30, 36, 75), 4);
});

test('can skip is 0 exactly at the line', () => {
  assert.equal(classesYouCanSkip(3, 4, 75), 0); // 3/4 = 75%; skipping one gives 3/5 = 60%
});

test('must attend: 20/30 at 75% -> 10 (30/40)', () => {
  assert.equal(classesYouMustAttend(20, 30, 75), 10);
});

test('must attend is 0 when already at target', () => {
  assert.equal(classesYouMustAttend(3, 4, 75), 0);
});

test('100% target after an absence is unreachable', () => {
  assert.equal(classesYouMustAttend(9, 10, 100), Infinity);
});

test('stats include base counts and ignore cancelled classes', () => {
  const s = subject({ baseAttended: 10, baseTotal: 12 });
  const st = statsFor(s, [rec('present', 1), rec('absent', 2), rec('cancelled', 3)]);
  assert.deepEqual([st.attended, st.total, st.cancelled], [11, 14, 1]);
});

test('OD counts as attended by default, or is left out when the college does not count it', () => {
  const recs = [rec('present', 1), rec('absent', 2), rec('od', 3), rec('od', 4)];
  const counted = statsFor(subject(), recs);
  assert.deepEqual([counted.attended, counted.total, counted.od], [3, 4, 2]);
  const excluded = statsFor(subject(), recs, false);
  assert.deepEqual([excluded.attended, excluded.total, excluded.od], [1, 2, 2]);
});

const slot = (subjectId: string, i: number): Slot => ({
  id: `sl${i}`, subjectId, day: 2, start: '09:00', end: '10:00', room: '', kind: 'lecture',
});

test('skip a whole day: safe only if every subject stays at target', () => {
  const os = subject({ id: 'os', baseAttended: 30, baseTotal: 36 }); // can skip 4
  const dbms = subject({ id: 'db', baseAttended: 8, baseTotal: 10 }); // 80%, can skip 0
  const free = subject({ id: 'x', baseAttended: 1, baseTotal: 1 }); // not on that day

  const easy = planSkipDay([os, free], [], [slot('os', 1), slot('os', 2)]);
  assert.equal(easy.safe, true);
  assert.equal(easy.rows.length, 1); // subjects without classes that day are not listed
  assert.equal(easy.rows[0].after?.toFixed(1), '78.9'); // 30 / 38

  const risky = planSkipDay([os, dbms], [], [slot('os', 1), slot('db', 2)]);
  assert.equal(risky.safe, false);
  assert.equal(risky.rows[0].subject.id, 'db'); // the subject that fails is listed first
  assert.equal(risky.rows[0].ok, false); // 8 / 11 = 72.7%

  assert.equal(planSkipDay([os], [], []).safe, false); // no classes: nothing to skip
});

test('verdicts', () => {
  assert.equal(verdictFor({ attended: 0, total: 0, percent: null, cancelled: 0, od: 0 }, 75).kind, 'empty');
  assert.equal(verdictFor({ attended: 30, total: 36, percent: 83.3, cancelled: 0, od: 0 }, 75).text, 'You can skip 4 classes');
  assert.equal(verdictFor({ attended: 3, total: 4, percent: 75, cancelled: 0, od: 0 }, 75).kind, 'edge');
  assert.equal(verdictFor({ attended: 20, total: 30, percent: 66.7, cancelled: 0, od: 0 }, 75).text, 'Attend the next 10 classes to reach 75%');
  assert.equal(verdictFor({ attended: 7, total: 9, percent: 77.8, cancelled: 0, od: 0 }, 75).text, "On the edge: don't skip the next class");
});

test('percent is floored, never rounded up past the cutoff', () => {
  assert.equal(formatPercent(74.96), '74.9%');
  assert.equal(formatPercent((58 / 100) * 100), '58%');
  assert.equal(formatPercent((2 / 3) * 100), '66.6%');
  assert.equal(formatPercent(null), '--');
});

test('gpa', () => {
  assert.equal(gradePoint('a+'), 9);
  assert.equal(gradePoint('8.5'), 8.5);
  assert.equal(gradePoint('Z'), null);
  const courses = [
    { id: '1', name: 'Maths', credits: 4, grade: 'O' },
    { id: '2', name: 'Physics', credits: 3, grade: 'B' },
    { id: '3', name: 'Lab', credits: 0, grade: 'O' }, // 0-credit audit course ignored
  ];
  assert.equal(sgpa(courses)?.toFixed(2), '8.29'); // (40 + 18) / 7
  assert.equal(
    cgpa([
      { id: 'a', name: 'S1', courses },
      { id: 'b', name: 'S2', courses: [{ id: '4', name: 'DSA', credits: 3, grade: 'A' }] },
    ])?.toFixed(2),
    '8.20', // (58 + 24) / 10
  );
  assert.equal(sgpa([]), null);
});

test('dates', () => {
  assert.equal(fromMinutes(toMinutes('08:50') - 10), '08:40');
  assert.equal(fromMinutes(-5), '23:55');
  assert.equal(formatTime12('00:05'), '12:05 AM');
  assert.equal(formatTime12('13:30'), '1:30 PM');
  assert.equal(isoWeekday(fromDateKey('2026-10-25')), 7); // Sunday
  assert.equal(isoWeekday(fromDateKey('2026-10-26')), 1); // Monday
  const now = new Date(2026, 9, 27, 10, 0);
  assert.equal(relativeDue(new Date(2026, 9, 27, 23, 59).toISOString(), now), 'Today, 11:59 PM');
  assert.equal(relativeDue(new Date(2026, 9, 28, 9, 0).toISOString(), now), 'Tomorrow, 9:00 AM');
  assert.equal(relativeDue(new Date(2026, 9, 25, 9, 0).toISOString(), now), '2 days overdue');
});