import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_URL } from './normalize.mjs';
import { normalizeBasePath, validateStaticSchedule } from './static-schedule.mjs';

const now = Date.parse('2026-10-22T15:00:00Z');
const valid = () => ({
  source: SOURCE_URL,
  fetchedAt: new Date(now).toISOString(),
  semester: { from: '2026-09-11', to: '2027-02-07' },
  lessons: ['1A', '1B', '2A', '2B'].map((group) => ({
    date: '2026-10-23',
    start: '09:00',
    end: '10:30',
    title: 'Anatomia',
    group,
    sourceGroup: `Fizjoterapia Jmgr 1sem Labor${group}N`,
  })),
});
test('Pages builds both at the domain root and under a repository path', () => {
  assert.equal(normalizeBasePath(''), '/');
  assert.equal(normalizeBasePath('/'), '/');
  assert.equal(normalizeBasePath('/ideis-schedule'), '/ideis-schedule/');
  for (const value of ['https://example.com/', '/../private', '//example.com', '/bad?query'])
    assert.throws(() => normalizeBasePath(value));
});
test('a valid current filtered snapshot can be published', () =>
  assert.equal(validateStaticSchedule(valid(), now).lessons.length, 4));
test('empty, stale and incorrectly filtered snapshots cannot replace a published plan', () => {
  assert.throws(() => validateStaticSchedule({ ...valid(), lessons: [] }, now), /pustego/);
  assert.throws(() => validateStaticSchedule(valid(), now + 13 * 60 * 60 * 1000), /nieaktualny/);
  const wrongGroup = valid();
  wrongGroup.lessons[0].sourceGroup = 'Fizjoterapia Jmgr 1sem Labor3AN';
  assert.throws(() => validateStaticSchedule(wrongGroup, now), /spoza grup/);
  const wrongTime = valid();
  wrongTime.lessons[0].end = '08:00';
  assert.throws(() => validateStaticSchedule(wrongTime, now), /format zajęć/);
  for (const group of ['1A', '1B', '2A', '2B']) {
    const oldSnapshot = valid();
    oldSnapshot.lessons = oldSnapshot.lessons.filter((lesson) => lesson.group !== group);
    assert.throws(
      () => validateStaticSchedule(oldSnapshot, now),
      new RegExp(`Brak danych grupy ${group}`),
    );
  }
  const mismatch = valid();
  mismatch.lessons[0].sourceGroup = 'Fizjoterapia Jmgr 1sem Labor1BN';
  assert.throws(() => validateStaticSchedule(mismatch, now), /spoza grup/);
});
