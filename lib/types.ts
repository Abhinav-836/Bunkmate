// All data lives on the device in one JSON document (see lib/storage.ts).

export type ID = string;

export type Subject = {
  id: ID;
  name: string;
  code: string;
  color: string;
  /** Required attendance in percent, e.g. 75. */
  target: number;
  /** Classes attended / held before you started using the app (mid-semester start). */
  baseAttended: number;
  baseTotal: number;
  createdAt: string;
};

/** 'od' = on duty / medical / sports leave. Counts as present or is left out, per Settings. */
export type AttendanceStatus = 'present' | 'absent' | 'od' | 'cancelled';

export type AttendanceRecord = {
  id: ID;
  subjectId: ID;
  /** Local date, yyyy-MM-dd. */
  date: string;
  /** Timetable slot this mark belongs to; null for an extra class marked by hand. */
  slotId: ID | null;
  status: AttendanceStatus;
  createdAt: string;
};

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ClassKind = 'lecture' | 'lab' | 'tutorial';

export type Slot = {
  id: ID;
  subjectId: ID;
  day: Weekday;
  /** 24h "HH:mm". */
  start: string;
  end: string;
  room: string;
  kind: ClassKind;
};

export type DeadlineType = 'assignment' | 'exam' | 'quiz' | 'lab' | 'project' | 'other';

export type Deadline = {
  id: ID;
  title: string;
  subjectId: ID | null;
  type: DeadlineType;
  /** ISO timestamp of when it is due. */
  due: string;
  notes: string;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
};

export type Course = {
  id: ID;
  name: string;
  credits: number;
  grade: string;
};

export type Semester = {
  id: ID;
  name: string;
  courses: Course[];
};

export type StudySession = {
  id: ID;
  /** Local date, yyyy-MM-dd. */
  date: string;
  minutes: number;
  label: string;
  endedAt: string;
};

export type StudyTimer = {
  /** Epoch ms when the running timer ends; null when not running. */
  endsAt: number | null;
  /** Seconds left while paused; null when not paused. */
  pausedRemaining: number | null;
  durationMin: number;
  label: string;
};

export type ThemeSetting = 'system' | 'light' | 'dark';

export type Settings = {
  defaultTarget: number;
  /** Minutes before a class to remind; 0 turns class reminders off. */
  classReminderMinutes: number;
  deadlineReminders: boolean;
  theme: ThemeSetting;
  /** Show Saturday/Sunday columns in the timetable. */
  showSaturday: boolean;
  showSunday: boolean;
  /** true: OD counts as attended. false: OD classes are left out of the count (like cancelled). */
  odCountsPresent: boolean;
  /** "HH:mm" for the evening "mark today's attendance" reminder, or null for off. */
  dailyReminder: string | null;
  onboarded: boolean;
};

export type AppData = {
  version: 1;
  subjects: Subject[];
  records: AttendanceRecord[];
  slots: Slot[];
  deadlines: Deadline[];
  semesters: Semester[];
  sessions: StudySession[];
  timer: StudyTimer;
  settings: Settings;
};