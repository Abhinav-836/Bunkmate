/*
 * Share a timetable with classmates as a short code inside a normal text
 * message (WhatsApp, Telegram, anything). No server and no account: the code
 * *is* the timetable. Only the subjects and classes are shared — never
 * attendance, deadlines, grades or settings.
 *
 * Format: "BUNK1." + base64url(UTF-8 JSON of a compact payload).
 */
import { newId } from './dates';
import type { AppData, ClassKind, Slot, Subject, Weekday } from './types';

const PREFIX = 'BUNK1.';
const CODE_RE = /BUNK1\.([A-Za-z0-9_-]+)/;

const LIMITS = { subjects: 40, slots: 250, name: 80, code: 24, room: 40, chars: 60_000 };
const KIND_TO_CHAR: Record<ClassKind, string> = { lecture: 'l', lab: 'p', tutorial: 't' };
const CHAR_TO_KIND: Record<string, ClassKind> = { l: 'lecture', p: 'lab', t: 'tutorial' };

/** What a shared code holds, once decoded and checked. */
export type SharedTimetable = {
  subjects: { name: string; code: string; color: string; target: number }[];
  /** `subject` is an index into `subjects`. */
  slots: { subject: number; day: Weekday; start: string; end: string; room: string; kind: ClassKind }[];
};

// ── base64url over UTF-8, in plain TypeScript (no dependence on btoa/TextEncoder) ──

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Encode(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      c = Math.min(c, 0x10ffff);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return out;
}

function utf8Decode(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let c: number;
    let n: number;
    if (b < 0x80) [c, n] = [b, 1];
    else if (b >> 5 === 6) [c, n] = [b & 31, 2];
    else if (b >> 4 === 14) [c, n] = [b & 15, 3];
    else if (b >> 3 === 30) [c, n] = [b & 7, 4];
    else throw new Error('bad utf-8');
    if (i + n > bytes.length) throw new Error('bad utf-8');
    for (let k = 1; k < n; k++) {
      const cont = bytes[i + k];
      if (cont >> 6 !== 2) throw new Error('bad utf-8');
      c = (c << 6) | (cont & 63);
    }
    s += String.fromCodePoint(c);
    i += n;
  }
  return s;
}

function toBase64Url(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) s += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) s += B64[n & 63];
  }
  return s;
}

function fromBase64Url(s: string): number[] {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad base64');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return out;
}

// ── Encode ─────────────────────────────────────────────────────────────────

/** Turn this phone's subjects and timetable into a share code. Subjects with no classes are included too. */
export function encodeTimetable(data: AppData): string {
  const index = new Map<string, number>();
  const s = data.subjects.map((x, i) => {
    index.set(x.id, i);
    return [x.name, x.code, x.color, x.target];
  });
  const t = data.slots
    .filter((x) => index.has(x.subjectId))
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
    .map((x) => [index.get(x.subjectId)!, x.day, x.start.replace(':', ''), x.end.replace(':', ''), x.room, KIND_TO_CHAR[x.kind] ?? 'l']);
  return PREFIX + toBase64Url(utf8Encode(JSON.stringify({ s, t })));
}

/** The text to send: a line people understand, then the code. */
export function shareMessage(data: AppData): string {
  const n = data.slots.filter((x) => data.subjects.some((s) => s.id === x.subjectId)).length;
  return [
    `📅 Class timetable for Bunkmate — ${data.subjects.length} subject${data.subjects.length === 1 ? '' : 's'}, ${n} class${n === 1 ? '' : 'es'} a week.`,
    'To use it: open Bunkmate → Timetable → Import, and paste this whole message.',
    '',
    encodeTimetable(data),
  ].join('\n');
}

// ── Decode ─────────────────────────────────────────────────────────────────

const BAD = "That doesn't look like a Bunkmate timetable. Copy the whole message your classmate sent and paste it again.";

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
const hhmm = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}$/.test(v)) return null;
  const h = Number(v.slice(0, 2));
  const m = Number(v.slice(2));
  return h < 24 && m < 60 ? `${v.slice(0, 2)}:${v.slice(2)}` : null;
};

/** Find a code anywhere in pasted text and check every field. Throws an Error with a readable message. */
export function decodeTimetable(text: string): SharedTimetable {
  const match = CODE_RE.exec(text || '');
  if (!match) throw new Error(BAD);
  if (match[1].length > LIMITS.chars) throw new Error('This timetable is too big to import.');
  let raw: unknown;
  try {
    raw = JSON.parse(utf8Decode(fromBase64Url(match[1])));
  } catch {
    throw new Error("The timetable code is cut off or damaged. Ask for it again and paste the whole message.");
  }
  const r = raw as { s?: unknown; t?: unknown };
  if (!Array.isArray(r.s) || !Array.isArray(r.t)) throw new Error(BAD);
  if (r.s.length === 0) throw new Error('That timetable has no subjects in it.');
  if (r.s.length > LIMITS.subjects || r.t.length > LIMITS.slots) throw new Error('This timetable is too big to import.');

  const subjects = r.s.map((row) => {
    if (!Array.isArray(row)) throw new Error(BAD);
    const name = str(row[0], LIMITS.name);
    if (!name) throw new Error(BAD);
    const color = typeof row[2] === 'string' && /^#[0-9a-fA-F]{6}$/.test(row[2]) ? row[2] : '#6366F1';
    const target = typeof row[3] === 'number' && row[3] >= 50 && row[3] <= 100 ? Math.round(row[3]) : 75;
    return { name, code: str(row[1], LIMITS.code) ?? '', color, target };
  });

  const slots = r.t.map((row) => {
    if (!Array.isArray(row)) throw new Error(BAD);
    const [subject, day] = row;
    const start = hhmm(row[2]);
    const end = hhmm(row[3]);
    if (
      typeof subject !== 'number' || !Number.isInteger(subject) || subject < 0 || subject >= subjects.length ||
      typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7 ||
      !start || !end || start >= end
    ) {
      throw new Error(BAD);
    }
    return {
      subject,
      day: day as Weekday,
      start,
      end,
      room: str(row[4], LIMITS.room) ?? '',
      kind: CHAR_TO_KIND[typeof row[5] === 'string' ? row[5] : 'l'] ?? 'lecture',
    };
  });
  return { subjects, slots };
}

// ── Import ─────────────────────────────────────────────────────────────────

/** Same subject on both phones? Matched by name and code, ignoring case and spacing. */
const subjectKey = (name: string, code: string) =>
  `${name.toLowerCase().replace(/\s+/g, ' ').trim()}|${code.toLowerCase().replace(/\s+/g, '')}`;

export type ImportMode = 'replace' | 'add';

export type ImportResult = { data: AppData; newSubjects: number; reusedSubjects: number; classesAdded: number };

/**
 * Apply a shared timetable.
 * - Subjects that already exist (same name and code) are reused, so their
 *   attendance carries on; the rest are added.
 * - 'replace' swaps this phone's timetable for the shared one; 'add' keeps it
 *   and adds any classes it doesn't already have.
 * Attendance, deadlines and grades are never touched.
 */
export function applyImport(data: AppData, shared: SharedTimetable, mode: ImportMode, now = new Date()): ImportResult {
  const existing = new Map(data.subjects.map((s) => [subjectKey(s.name, s.code), s.id]));
  const created: Subject[] = [];
  const idFor: string[] = [];
  let reused = 0;
  for (const s of shared.subjects) {
    const key = subjectKey(s.name, s.code);
    const found = existing.get(key);
    if (found) {
      reused += 1;
      idFor.push(found);
      continue;
    }
    const id = newId();
    existing.set(key, id); // a code that lists the same subject twice maps both to one
    idFor.push(id);
    created.push({ id, name: s.name, code: s.code, color: s.color, target: s.target, baseAttended: 0, baseTotal: 0, createdAt: now.toISOString() });
  }

  const kept: Slot[] = mode === 'replace' ? [] : data.slots;
  const sameClass = (a: Pick<Slot, 'subjectId' | 'day' | 'start' | 'end'>, b: typeof a) =>
    a.subjectId === b.subjectId && a.day === b.day && a.start === b.start && a.end === b.end;
  const added: Slot[] = [];
  for (const x of shared.slots) {
    const slot: Slot = { id: newId(), subjectId: idFor[x.subject], day: x.day, start: x.start, end: x.end, room: x.room, kind: x.kind };
    if (![...kept, ...added].some((k) => sameClass(k, slot))) added.push(slot);
  }

  const usesSat = shared.slots.some((x) => x.day === 6);
  const usesSun = shared.slots.some((x) => x.day === 7);
  return {
    data: {
      ...data,
      subjects: [...data.subjects, ...created],
      slots: [...kept, ...added],
      settings: {
        ...data.settings,
        showSaturday: data.settings.showSaturday || usesSat,
        showSunday: data.settings.showSunday || usesSun,
      },
    },
    newSubjects: created.length,
    reusedSubjects: reused,
    classesAdded: added.length,
  };
}

/** One-line summary for the import preview, e.g. "6 subjects, 28 classes a week". */
export function describe(shared: SharedTimetable): string {
  const s = shared.subjects.length;
  const c = shared.slots.length;
  return `${s} subject${s === 1 ? '' : 's'}, ${c} class${c === 1 ? '' : 'es'} a week`;
}
