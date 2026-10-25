import { describe, expect, it } from 'vitest';
import {
  GROUP_STORAGE_KEY,
  lessonsForGroup,
  parseSubgroup,
  readSavedGroup,
  saveGroup,
  SUBGROUPS,
} from './group-selection';
import { Lesson, liveStatus } from './schedule';

const lesson = (group: Lesson['group'], start: string): Lesson => ({
  id: group,
  group,
  start,
  date: '2026-10-24',
  end: '14:00',
  title: `Zajęcia ${group}`,
  type: 'Laboratorium',
  sourceGroup: '',
  location: 'S55',
  teacher: 'dr Test',
  assessment: '',
  notes: '',
  online: false,
  canceled: false,
});
describe('group preferences', () => {
  it('accepts all four subgroups and rejects missing or corrupted saved choices', () => {
    for (const group of SUBGROUPS) expect(parseSubgroup(group)).toBe(group);
    for (const value of [null, '', '1', '2', '3A', '2C', '1AB', '{}'])
      expect(parseSubgroup(value)).toBeNull();
    expect(readSavedGroup({ getItem: () => '1B' })).toBe('1B');
    expect(readSavedGroup({ getItem: () => 'invalid' })).toBeNull();
  });
  it('saves and restores a changed choice using the same key', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    expect(readSavedGroup(storage)).toBeNull();
    expect(saveGroup('1A', storage)).toBe(true);
    expect(data.get(GROUP_STORAGE_KEY)).toBe('1A');
    expect(readSavedGroup(storage)).toBe('1A');
    saveGroup('1B', storage);
    expect(readSavedGroup(storage)).toBe('1B');
    for (const group of ['2A', '2B'] as const) {
      expect(saveGroup(group, storage)).toBe(true);
      expect(readSavedGroup(storage)).toBe(group);
    }
  });
  it('keeps selection usable when browser storage is blocked', () => {
    expect(
      readSavedGroup({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBeNull();
    expect(
      saveGroup('1B', {
        setItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe(false);
  });
});
describe('selected group schedule', () => {
  const lessons = [
    lesson('all', '08:00'),
    lesson('1', '09:00'),
    lesson('1A', '10:00'),
    lesson('1B', '11:00'),
    lesson('2', '09:15'),
    lesson('2A', '10:15'),
    lesson('2B', '11:15'),
  ];
  it('shows no lessons before choosing and isolates subgroups while keeping common classes', () => {
    expect(lessonsForGroup(lessons, null)).toEqual([]);
    expect(lessonsForGroup(lessons, '1A').map((lesson) => lesson.group)).toEqual([
      'all',
      '1',
      '1A',
    ]);
    expect(lessonsForGroup(lessons, '1B').map((lesson) => lesson.group)).toEqual([
      'all',
      '1',
      '1B',
    ]);
    expect(lessonsForGroup(lessons, '2A').map((lesson) => lesson.group)).toEqual([
      'all',
      '2',
      '2A',
    ]);
    expect(lessonsForGroup(lessons, '2B').map((lesson) => lesson.group)).toEqual([
      'all',
      '2',
      '2B',
    ]);
    expect(lessons).toHaveLength(7);
  });
  it('selects the next class from the chosen subgroup, never the other subgroup', () => {
    const now = { date: '2026-10-24', time: '09:30' };
    expect(liveStatus(lessonsForGroup(lessons, '1A'), now).next?.group).toBe('1A');
    expect(liveStatus(lessonsForGroup(lessons, '1B'), now).next?.group).toBe('1B');
    expect(liveStatus(lessonsForGroup(lessons, '2A'), now).next?.group).toBe('2A');
    expect(liveStatus(lessonsForGroup(lessons, '2B'), now).next?.group).toBe('2B');
  });
});
