import { classifyGroup, SOURCE_URL } from './normalize.mjs';

export function validateStaticSchedule(schedule, now = Date.now()) {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (
    schedule?.source !== SOURCE_URL ||
    !Array.isArray(schedule.lessons) ||
    !schedule.lessons.length
  ) {
    throw new Error('Brak poprawnego planu IDEIS. Publikacja pustego planu została zatrzymana.');
  }
  const fetchedAt = Date.parse(schedule.fetchedAt);
  if (
    !Number.isFinite(fetchedAt) ||
    now - fetchedAt > 12 * 60 * 60 * 1000 ||
    fetchedAt - now > 5 * 60 * 1000
  ) {
    throw new Error(
      'Plan jest nieaktualny lub ma błędną datę pobrania. Uruchom npm run sync:schedule.',
    );
  }
  if (!date.test(schedule.semester?.from) || !date.test(schedule.semester?.to))
    throw new Error('Brak zakresu semestru.');
  for (const lesson of schedule.lessons) {
    if (
      !['1', '1A', '1B', '2', '2A', '2B', 'all'].includes(lesson.group) ||
      classifyGroup(lesson.sourceGroup ?? '') !== lesson.group
    ) {
      throw new Error(
        'Plan zawiera zajęcia spoza grup 1 / 1A / 1B / 2 / 2A / 2B i wykładów wspólnych.',
      );
    }
    if (
      !date.test(lesson.date) ||
      !time.test(lesson.start) ||
      !time.test(lesson.end) ||
      lesson.start >= lesson.end ||
      typeof lesson.title !== 'string' ||
      !lesson.title.trim()
    ) {
      throw new Error('Nieprawidłowy format zajęć. Publikacja została zatrzymana.');
    }
  }
  for (const group of ['1A', '1B', '2A', '2B']) {
    if (!schedule.lessons.some((lesson) => lesson.group === group))
      throw new Error(`Brak danych grupy ${group}. Uruchom npm run sync:schedule.`);
  }
  return schedule;
}

export function normalizeBasePath(value = '/') {
  if (value === '') return '/';
  if (
    !value.startsWith('/') ||
    /[?#\\\s]/.test(value) ||
    value.includes('..') ||
    value.includes('//')
  ) {
    throw new Error('PAGES_BASE_PATH musi być ścieżką, np. /ideis-schedule/ lub /.');
  }
  return value.endsWith('/') ? value : value + '/';
}
