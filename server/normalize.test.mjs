import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyGroup, normalizeRows } from './normalize.mjs';

test('only exercise group 1, lab group 1A and shared lectures are allowed', () => {
  for (const [token, expected] of [
    ['Ćw1N', '1'],
    ['Cw1N', '1'],
    ['Labor1AN', '1A'],
    ['WykN', 'all'],
  ]) {
    assert.equal(classifyGroup(`Fizjoterapia Jmgr 1sem ${token}`), expected);
  }
  for (const token of [
    'Ćw2N',
    'Ćw10N',
    'Ćw11N',
    'Labor1BN',
    'Labor2AN',
    'Labor2BN',
    'Labor10AN',
    'Unknown',
    '1sem',
  ]) {
    assert.equal(classifyGroup(`Fizjoterapia Jmgr 1sem ${token}`), null, token);
  }
  assert.equal(classifyGroup('1'), '1');
  assert.equal(classifyGroup('1A'), '1A');
  assert.equal(classifyGroup('1B'), null);
});
const row = (group, start = '9:00', overrides = {}) => ({
  date: '2026-10-24',
  cells: [
    start,
    '10:30',
    '2h00m',
    `Fizjoterapia Jmgr 1sem ${group}`,
    'Biologia medyczna',
    'Labor',
    '',
    'dr Małgorzata Socha',
    'Zaliczenie',
    '76753',
    'Lack',
  ],
  ...overrides,
});
test('the actual IDEIS row format is filtered, sorted and preserves Polish teacher names', () => {
  const lessons = normalizeRows([
    row('Labor1BN'),
    row('Labor1AN', '10:45'),
    row('Labor1AN'),
    row('Labor2AN'),
    row('Labor1AN'),
  ]);
  assert.equal(lessons.length, 2);
  assert.equal(lessons[0].start, '09:00');
  assert.equal(lessons[0].teacher, 'dr Małgorzata Socha');
  assert.equal(lessons[0].notes, '');
  assert.equal(lessons[0].location, 'Nie podano sali');
  assert.equal(lessons[0].group, '1A');
});
test('cancellation and remote teaching survive normalization', () => {
  const remote = row('WykN');
  remote.cells[5] = 'Lecture';
  remote.cells[10] = 'Distance learning';
  const canceled = row('Ćw1N');
  canceled.cells[5] = 'Tutorials';
  canceled.cells[10] = 'Class canceled';
  const lessons = normalizeRows([remote, canceled]);
  assert.ok(
    lessons.find((l) => l.online && l.location === 'Zajęcia zdalne' && l.type === 'Wykład'),
  );
  assert.ok(lessons.find((l) => l.canceled && l.notes === 'Zajęcia odwołane'));
});
test('an unrecognized date fails instead of silently showing a free day', () => {
  assert.throws(() => normalizeRows([row('Labor1AN', '9:00', { date: '' })]), /format dat/);
});
