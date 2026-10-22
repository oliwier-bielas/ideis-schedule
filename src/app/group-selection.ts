import { Lesson } from './schedule';

export type Subgroup = '1A' | '1B';
export const GROUP_STORAGE_KEY = 'fizjoplan:group:v1';
// The old v1 cache contains only 1A. It cannot be used for a 1B timetable.
export const SCHEDULE_STORAGE_KEY = 'fizjoplan:schedule:v2';

export function parseSubgroup(value: unknown): Subgroup | null {
  return value === '1A' || value === '1B' ? value : null;
}

export function readSavedGroup(storage?: Pick<Storage, 'getItem'>): Subgroup | null {
  try {
    return parseSubgroup((storage ?? localStorage).getItem(GROUP_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveGroup(group: Subgroup, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    (storage ?? localStorage).setItem(GROUP_STORAGE_KEY, group);
    return true;
  } catch {
    return false;
  }
}

export function lessonsForGroup(lessons: readonly Lesson[], group: Subgroup | null): Lesson[] {
  if (!group) return [];
  return lessons.filter(
    (lesson) => lesson.group === 'all' || lesson.group === '1' || lesson.group === group,
  );
}
