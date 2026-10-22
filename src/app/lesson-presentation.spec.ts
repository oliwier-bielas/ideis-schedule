import { describe, expect, it } from 'vitest';
import { groupLessonBlocks, subjectPalette } from './lesson-presentation';
import { Lesson, liveStatus } from './schedule';

const lesson = (
  id: string,
  start: string,
  end: string,
  overrides: Partial<Lesson> = {},
): Lesson => ({
  id,
  start,
  end,
  date: '2026-10-23',
  title: 'Psychologia',
  type: 'Wykład',
  group: 'all',
  sourceGroup: 'WykN',
  location: 'Online',
  teacher: 'dr Test',
  notes: '',
  assessment: '',
  online: true,
  canceled: false,
  ...overrides,
});
describe('subject colors', () => {
  it('keeps the requested palette, regardless of case, spacing or display order', () => {
    expect(subjectPalette('Psychologia')).toEqual({ color: '#B6A0E6', background: '#262733' });
    expect(subjectPalette('  PODSTAWY   DIETETYKI ')).toEqual({
      color: '#7BC9AA',
      background: '#212A2E',
    });
    expect(subjectPalette('Anatomia').color).toBe('#85ACE5');
    const before = subjectPalette('Biologia medyczna');
    ['Genetyka', 'Fizjologia', 'Psychologia'].forEach(subjectPalette);
    expect(subjectPalette('biologia medyczna')).toEqual(before);
  });
});
describe('consecutive blocks', () => {
  const first = lesson('a', '10:45', '12:15');
  const second = lesson('b', '12:30', '14:00', { notes: 'Drugi blok' });
  it('sorts and combines the same class, keeping original times, notes and teaching duration', () => {
    const [block] = groupLessonBlocks([second, first]);
    expect(block.slots).toEqual([first, second]);
    expect(block.start).toBe('10:45');
    expect(block.end).toBe('14:00');
    expect(block.teachingMinutes).toBe(180);
    expect(liveStatus(block.slots, { date: first.date, time: '12:20' }).state).toBe('break');
    expect(liveStatus(block.slots, { date: first.date, time: '12:20' }).current).toBeUndefined();
  });
  it('keeps different days, teachers, rooms, types, groups, online modes and cancellations separate', () => {
    const changes: Partial<Lesson>[] = [
      { date: '2026-10-24' },
      { teacher: 'dr Inny' },
      { location: 'S55 - 101' },
      { type: 'Ćwiczenia' },
      { group: '1' },
      { online: false },
      { canceled: true },
    ];
    for (const change of changes)
      expect(groupLessonBlocks([first, { ...second, ...change }])).toHaveLength(2);
  });
  it('never combines overlapping blocks or slots separated by a different subject', () => {
    expect(groupLessonBlocks([first, lesson('c', '11:30', '12:00')])).toHaveLength(2);
    const between = lesson('other', '12:15', '12:30', { title: 'Anatomia' });
    expect(groupLessonBlocks([first, between, second])).toHaveLength(3);
    expect(
      groupLessonBlocks([first, between, second]).filter(
        (block) => block.lesson.title === 'Psychologia',
      ),
    ).toHaveLength(2);
  });
});
