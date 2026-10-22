export interface Lesson {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  type: 'Wykład' | 'Ćwiczenia' | 'Laboratorium';
  group: 'all' | '1' | '1A' | '1B';
  sourceGroup: string;
  location: string;
  teacher: string;
  assessment: string;
  notes: string;
  online: boolean;
  canceled: boolean;
}
export interface Schedule {
  lessons: Lesson[];
  source: string;
  fetchedAt: string;
  semester: { from: string; to: string };
  course: string;
}
export function warsawNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}
export function shiftDate(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function defaultWeekend(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDate(date, weekday === 0 ? -2 : weekday === 6 ? -1 : 5 - weekday);
}
export function minutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function isActive(lesson: Lesson, now: ReturnType<typeof warsawNow>) {
  return (
    !lesson.canceled &&
    lesson.date === now.date &&
    lesson.start <= now.time &&
    now.time < lesson.end
  );
}
export function lessonEpoch(date: string, time: string) {
  const local = Date.parse(`${date}T${time}:00Z`);
  let utc = local;
  for (let i = 0; i < 2; i++) {
    const parts = warsawNow(new Date(utc));
    utc += local - Date.parse(`${parts.date}T${parts.time}:00Z`);
  }
  return utc;
}
export function liveStatus(lessons: Lesson[], now: ReturnType<typeof warsawNow>) {
  const available = lessons.filter((l) => !l.canceled);
  const current = available.find((l) => isActive(l, now));
  const next = available.find((l) => `${l.date} ${l.start}` > `${now.date} ${now.time}`);
  const today = available.filter((l) => l.date === now.date);
  const previous = today.filter((l) => l.end <= now.time).at(-1);
  const state = current
    ? 'current'
    : next?.date === now.date
      ? previous
        ? 'break'
        : 'before'
      : today.length
        ? 'finished'
        : 'free';
  return { current, next, previous, state };
}
