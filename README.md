# Bunkmate

**Attendance, timetable and deadlines for college students, in one app.**

Bunkmate answers the question every student asks before skipping a class: *can I afford to?* Mark each class with one tap and it tells you, per subject, exactly how many classes you can still skip, or how many in a row you need to attend to get back above your college's cutoff (75% by default).

Everything stays on your phone. No account, no ads, works offline.

<p>
  <img src="docs/screenshots/today.png" width="200" alt="Today screen with classes to mark and overall attendance" />
  <img src="docs/screenshots/attendance.png" width="200" alt="Attendance per subject with skip / attend verdicts" />
  <img src="docs/screenshots/subject.png" width="200" alt="Subject detail with what-if planner" />
  <img src="docs/screenshots/timetable.png" width="200" alt="Weekly timetable" />
</p>

## Features

**Attendance**
- One tap per class: Present, Absent, OD (on duty / medical / sports leave) or Cancelled. Tap again to undo. Cancelled classes don't count.
- **Holiday** and **All present** buttons mark the whole day in one tap, with undo.
- **"Can I skip tomorrow?"** gives one answer for the whole day, with each subject's percentage after skipping.
- A clear verdict for each subject, such as *"You can skip 3 classes"*, *"On the edge: don't skip the next class"* or *"Attend the next 4 classes to reach 75%"*.
- **What-if planner:** see your percentage if you skip or attend the next *N* classes.
- OD counts as present by default. You can switch it to "not counted" if your college treats it that way.
- **Evening reminder** (5–9 PM) to mark the day's classes, skipped once everything is marked.
- Per-subject target (50-100%), plus a starting count for when you begin mid-semester.
- Mark yesterday's or older classes from the Today screen, add extra classes that aren't on the timetable, and see the full history with delete.
- Percentages are floored, never rounded up, so 74.9% is never shown as 75%.

**Timetable**
- Weekly schedule from Monday to Saturday (Sunday optional), with lectures, labs and tutorials, rooms and clash warnings.
- Add the same class to several days at once.
- **Share with your class:** tap Share on the Timetable tab and send the message to your class group. Classmates paste it under Import and get every subject and class in one go. The message holds only subjects and classes (no attendance, deadlines or grades), and works without an account or internet server. Subjects with the same name and code are matched to ones you already have, so your attendance carries on.
- **Reminders before every class** (5, 10, 15 or 30 minutes, or off).

**Deadlines**
- Assignments, exams, quizzes, lab records and projects, tagged by subject.
- Reminders a day before and an hour before.
- Overdue, upcoming and completed sections. Nothing is ever auto-deleted.

**More**
- **Study timer** that keeps counting when the phone is locked and notifies you when it's done, plus a study log.
- **CGPA calculator:** SGPA per semester and credit-weighted CGPA on the 10-point scale (O, A+, A, B+, B, C, P, F), or typed grade points.
- **Backup:** export everything as text and import it on another phone.
- Light, dark or match-phone theme.

## Run it

You need Node.js 18 or newer and the **Expo Go** app on your phone.

```bash
git clone https://github.com/Abhinav-836/Bunkmate.git
cd Bunkmate
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Press `w` to open it in a browser instead. Reminders only work on a phone.

### Build an APK

The **Android APK** workflow builds one on every push to `main` (Actions tab → latest run → `bunkmate-apk`). Or build it yourself:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

### Updates without reinstalling

Installed apps get JavaScript changes over the air: the **Update installed apps** workflow publishes each push to `main` with EAS Update, and phones download it the next time the app opens (it applies on the launch after). It needs an `EXPO_TOKEN` repository secret (expo.dev → Account settings → Access tokens).

Updates only reach apps built with the same `version` in `app.json` (the runtime version). When you add or upgrade a package with native code, bump `version` and install the new APK; apps on the old version stop receiving updates instead of crashing.

## Checks

```bash
npm test           # attendance maths, CGPA, dates and timetable sharing
npm run typecheck  # TypeScript
npm run lint
```

## How the numbers are calculated

With `a` classes attended out of `t` held and a target of `T`%:

- **Classes you can skip:** the largest `k` with `a / (t + k) ≥ T%`, which is `floor((100a − T·t) / T)`.
- **Classes you must attend:** the smallest `n` with `(a + n) / (t + n) ≥ T%`, which is `ceil((T·t − 100a) / (100 − T))`.

Both use whole-number maths, so results are exact at the cutoff. See [`lib/attendance.ts`](lib/attendance.ts) and its tests in [`lib/__tests__`](lib/__tests__).

## Project structure

```
app/
  (tabs)/            Today, Attendance, Timetable, Deadlines, More
  subject/[id].tsx   Subject detail, what-if planner, history
  study.tsx          Study timer
  cgpa.tsx           CGPA calculator
  settings.tsx       Reminders, target, theme, backup
components/          Shared UI, pickers, subject form
context/AppContext   App state, saving, reminder scheduling, theme
lib/                 Attendance / GPA / date logic, timetable sharing, storage, notifications
```

Built with Expo SDK 54, React Native, Expo Router, AsyncStorage, expo-notifications (local only) and expo-updates.

## License

[MIT](LICENSE) © Abhinav Ashutosh