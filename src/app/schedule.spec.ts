import { describe, expect, it } from 'vitest';
import {
  defaultWeekend,
  isActive,
  Lesson,
  lessonEpoch,
  liveStatus,
  shiftDate,
  warsawNow,
} from './schedule';

const lesson = (start: string, end: string, date = '2026-10-23', canceled = false): Lesson => ({
  id: start,
  date,
  start,
  end,
  title: 'Anatomia',
  type: 'Wykład',
  group: 'all',
  sourceGroup: 'WykN',
  location: 'Online',
  teacher: 'dr Test',
  assessment: '',
  notes: '',
  online: true,
  canceled,
});
describe('Warsaw calendar', () => {
  it('selects upcoming Friday Mon–Thu and current Friday Fri–Sun', () => {
    for (const date of ['2026-10-19', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
      expect(defaultWeekend(date)).toBe('2026-10-23');
    expect(defaultWeekend('2026-10-26')).toBe('2026-10-30');
    expect(defaultWeekend('2027-01-01')).toBe('2027-01-01');
  });
  it('does not shift dates across the October DST change', () => {
    expect(shiftDate('2026-10-23', 2)).toBe('2026-10-25');
    expect(warsawNow(new Date('2026-10-24T07:00:00Z'))).toEqual({
      date: '2026-10-24',
      time: '09:00',
    });
    expect(warsawNow(new Date('2026-10-25T08:00:00Z'))).toEqual({
      date: '2026-10-25',
      time: '09:00',
    });
    expect(lessonEpoch('2026-10-24', '09:00')).toBe(Date.parse('2026-10-24T07:00:00Z'));
    expect(lessonEpoch('2026-10-25', '09:00')).toBe(Date.parse('2026-10-25T08:00:00Z'));
  });
});
describe('live status', () => {
  const lessons = [
    lesson('09:00', '10:30'),
    lesson('10:45', '12:15'),
    lesson('09:00', '10:30', '2026-10-24'),
  ];
  const at = (time: string) => ({ date: '2026-10-23', time });
  it('handles exact start/end boundaries and canceled classes', () => {
    expect(isActive(lessons[0], at('09:00'))).toBe(true);
    expect(isActive(lessons[0], at('10:30'))).toBe(false);
    expect(isActive({ ...lessons[0], canceled: true }, at('09:00'))).toBe(false);
  });
  it('distinguishes before, current, break, finished and free day', () => {
    expect(liveStatus(lessons, at('08:00')).state).toBe('before');
    expect(liveStatus(lessons, at('09:15')).state).toBe('current');
    expect(liveStatus(lessons, at('10:35')).state).toBe('break');
    expect(liveStatus(lessons, at('12:15')).state).toBe('finished');
    expect(liveStatus(lessons, { date: '2026-10-22', time: '12:00' }).state).toBe('free');
    expect(liveStatus(lessons, at('12:15')).next?.date).toBe('2026-10-24');
  });
  it('never picks canceled lessons as the next class', () => {
    const state = liveStatus(
      [lesson('08:00', '09:00', '2026-10-23', true), ...lessons],
      at('07:30'),
    );
    expect(state.next?.start).toBe('09:00');
  });
});
