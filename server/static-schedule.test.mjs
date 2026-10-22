import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_URL } from './normalize.mjs';
import { normalizeBasePath, validateStaticSchedule } from './static-schedule.mjs';

const now = Date.parse('2026-10-22T15:00:00Z');
const valid = () => ({
  source: SOURCE_URL,
  fetchedAt: new Date(now).toISOString(),
  semester: { from: '2026-09-11', to: '2027-02-07' },
  lessons: [
    {
      date: '2026-10-23',
      start: '09:00',
      end: '10:30',
      title: 'Anatomia',
      group: '1A',
      sourceGroup: 'Fizjoterapia Jmgr 1sem Labor1AN',
    },
  ],
});
test('Pages builds both at the domain root and under a repository path', () => {
  assert.equal(normalizeBasePath(''), '/');
  assert.equal(normalizeBasePath('/'), '/');
  assert.equal(normalizeBasePath('/ideis-schedule'), '/ideis-schedule/');
  for (const value of ['https://example.com/', '/../private', '//example.com', '/bad?query'])
    assert.throws(() => normalizeBasePath(value));
});
test('a valid current filtered snapshot can be published', () =>
  assert.equal(validateStaticSchedule(valid(), now).lessons.length, 1));
test('empty, stale and incorrectly filtered snapshots cannot replace a published plan', () => {
  assert.throws(() => validateStaticSchedule({ ...valid(), lessons: [] }, now), /pustego/);
  assert.throws(() => validateStaticSchedule(valid(), now + 13 * 60 * 60 * 1000), /nieaktualny/);
  const wrongGroup = valid();
  wrongGroup.lessons[0].sourceGroup = 'Fizjoterapia Jmgr 1sem Labor1BN';
  assert.throws(() => validateStaticSchedule(wrongGroup, now), /spoza grup/);
  const wrongTime = valid();
  wrongTime.lessons[0].end = '08:00';
  assert.throws(() => validateStaticSchedule(wrongTime, now), /format zajęć/);
});
