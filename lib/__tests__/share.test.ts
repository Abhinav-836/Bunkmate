import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyImport, decodeTimetable, describe, encodeTimetable, shareMessage } from '../share';
import { emptyDataForTests } from './helpers';
import type { AppData, AttendanceRecord, Slot, Subject } from '../types';

const subject = (id: string, name: string, code = '', over: Partial<Subject> = {}): Subject => ({
  id, name, code, color: '#22C55E', target: 75, baseAttended: 0, baseTotal: 0, createdAt: '', ...over,
});
const slot = (id: string, subjectId: string, day: Slot['day'], start: string, end: string, over: Partial<Slot> = {}): Slot => ({
  id, subjectId, day, start, end, room: '', kind: 'lecture', ...over,
});

function sharer(): AppData {
  const d = emptyDataForTests();
  d.subjects = [
    subject('a', 'Data Structures', 'CS201', { color: '#EF4444', target: 80 }),
    subject('b', 'गणित (Maths)', 'MA102'), // non-English names survive the round trip
    subject('c', 'Lab Only', ''),
  ];
  d.slots = [
    slot('1', 'a', 1, '09:00', '10:00', { room: 'LH-204' }),
    slot('2', 'b', 1, '10:00', '11:00'),
    slot('3', 'a', 3, '14:00', '16:00', { kind: 'lab', room: 'Lab 3' }),
    slot('4', 'b', 6, '09:30', '10:20', { kind: 'tutorial' }),
  ];
  // Personal data that must never be shared
  d.records = [{ id: 'r', subjectId: 'a', date: '2026-11-02', slotId: '1', status: 'absent', createdAt: '' } as AttendanceRecord];
  d.deadlines = [{ id: 'x', title: 'Secret assignment', subjectId: 'a', type: 'assignment', due: '2026-11-20T10:00:00Z', notes: '', done: false, doneAt: null, createdAt: '' }];
  return d;
}

test('round trip keeps subjects and classes', () => {
  const shared = decodeTimetable(encodeTimetable(sharer()));
  assert.deepEqual(shared.subjects.map((s) => [s.name, s.code, s.color, s.target]), [
    ['Data Structures', 'CS201', '#EF4444', 80],
    ['गणित (Maths)', 'MA102', '#22C55E', 75],
    ['Lab Only', '', '#22C55E', 75],
  ]);
  assert.equal(shared.slots.length, 4);
  assert.deepEqual(shared.slots[2], { subject: 0, day: 3, start: '14:00', end: '16:00', room: 'Lab 3', kind: 'lab' });
  assert.equal(describe(shared), '3 subjects, 4 classes a week');
});

test('the code carries no attendance or deadlines', () => {
  const code = encodeTimetable(sharer());
  const json = Buffer.from(code.slice('BUNK1.'.length), 'base64url').toString('utf8');
  assert.ok(!json.includes('Secret assignment'));
  assert.ok(!json.includes('absent'));
  assert.ok(!json.includes('2026-11-02'));
});

test('finds the code inside a pasted WhatsApp message', () => {
  const pasted = `[08/11, 10:02] Rahul: ${shareMessage(sharer())}\n[08/11, 10:03] Rahul: use this guys`;
  assert.equal(decodeTimetable(pasted).subjects.length, 3);
});

test('rejects text without a code, and damaged codes, with readable errors', () => {
  assert.throws(() => decodeTimetable('hello'), /doesn't look like a Bunkmate timetable/);
  const code = encodeTimetable(sharer());
  assert.throws(() => decodeTimetable(code.slice(0, code.length - 15)), /cut off or damaged|doesn't look like/);
  const bad = 'BUNK1.' + Buffer.from(JSON.stringify({ s: [['X', '', '#fff', 75]], t: [[5, 1, '0900', '1000', '', 'l']] })).toString('base64url');
  assert.throws(() => decodeTimetable(bad), /doesn't look like/); // class points at a missing subject
  const backwards = 'BUNK1.' + Buffer.from(JSON.stringify({ s: [['X', '', '#123456', 75]], t: [[0, 1, '1000', '0900', '', 'l']] })).toString('base64url');
  assert.throws(() => decodeTimetable(backwards), /doesn't look like/);
});

test('bad colours and targets fall back to defaults; long names are cut', () => {
  const code = 'BUNK1.' + Buffer.from(JSON.stringify({ s: [['Y'.repeat(200), 'C1', 'red', 10]], t: [] })).toString('base64url');
  const s = decodeTimetable(code).subjects[0];
  assert.equal(s.color, '#6366F1');
  assert.equal(s.target, 75);
  assert.equal(s.name.length, 80);
});

test('importing into an empty phone adds everything and turns on Saturday', () => {
  const me = emptyDataForTests();
  me.settings.showSaturday = false;
  const r = applyImport(me, decodeTimetable(encodeTimetable(sharer())), 'replace');
  assert.equal(r.newSubjects, 3);
  assert.equal(r.classesAdded, 4);
  assert.equal(r.data.subjects.length, 3);
  assert.equal(r.data.slots.length, 4);
  assert.equal(r.data.settings.showSaturday, true);
  assert.equal(r.data.records.length, 0); // nobody else's attendance
  assert.ok(r.data.slots.every((s) => r.data.subjects.some((x) => x.id === s.subjectId)));
});

test('matching subjects are reused so attendance carries on', () => {
  const me = emptyDataForTests();
  me.subjects = [subject('mine', 'data  structures', 'cs 201', { color: '#000000', baseAttended: 10, baseTotal: 12 })];
  me.slots = [slot('old', 'mine', 2, '08:00', '09:00')];
  me.records = [{ id: 'r1', subjectId: 'mine', date: '2026-11-03', slotId: 'old', status: 'present', createdAt: '' }];

  const replaced = applyImport(me, decodeTimetable(encodeTimetable(sharer())), 'replace');
  assert.equal(replaced.reusedSubjects, 1);
  assert.equal(replaced.newSubjects, 2);
  const mine = replaced.data.subjects.find((s) => s.id === 'mine')!;
  assert.equal(mine.color, '#000000'); // my settings for my subject are kept
  assert.equal(mine.baseAttended, 10);
  assert.ok(replaced.data.slots.every((s) => s.id !== 'old')); // old timetable swapped out
  assert.equal(replaced.data.slots.filter((s) => s.subjectId === 'mine').length, 2);
  assert.equal(replaced.data.records.length, 1); // attendance untouched

  const merged = applyImport(me, decodeTimetable(encodeTimetable(sharer())), 'add');
  assert.equal(merged.data.slots.length, 5);
  assert.ok(merged.data.slots.some((s) => s.id === 'old'));
});

test('adding the same timetable twice adds nothing the second time', () => {
  const shared = decodeTimetable(encodeTimetable(sharer()));
  const once = applyImport(emptyDataForTests(), shared, 'add');
  const twice = applyImport(once.data, shared, 'add');
  assert.equal(twice.newSubjects, 0);
  assert.equal(twice.classesAdded, 0);
  assert.equal(twice.data.slots.length, 4);
});
