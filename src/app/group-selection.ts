import { Lesson } from './schedule';

export const SUBGROUPS = ['1A', '1B', '2A', '2B'] as const;
export type Subgroup = (typeof SUBGROUPS)[number];
export const GROUP_STORAGE_KEY = 'fizjoplan:group:v1';
// Older caches do not contain all four subgroups.
export const SCHEDULE_STORAGE_KEY = 'fizjoplan:schedule:v3';

export function parseSubgroup(value: unknown): Subgroup | null {
  return SUBGROUPS.find((group) => group === value) ?? null;
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
    (lesson) => lesson.group === 'all' || lesson.group === group[0] || lesson.group === group,
  );
}
