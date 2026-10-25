import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsScheduleFetch, selectScheduleRun } from './pages-schedule.mjs';
import { SOURCE_URL } from './normalize.mjs';

const now = Date.parse('2026-10-22T20:00:00Z');
const run = (id, changes = {}) => ({
  id,
  conclusion: 'success',
  head_branch: 'master',
  head_repository: { full_name: 'test/fizjoplan' },
  path: '.github/workflows/sync-schedule.yml',
  event: 'schedule',
  created_at: new Date(now - 60_000).toISOString(),
  ...changes,
});
const context = (eventName = 'push', source = run(123)) => ({
  eventName,
  repo: { owner: 'test', repo: 'fizjoplan' },
  payload: { repository: { default_branch: 'master' }, workflow_run: source },
});
const client = (runs = [], artifacts = {}) => ({
  rest: {
    actions: {
      listWorkflowRuns: async () => ({ data: { workflow_runs: runs } }),
      listWorkflowRunArtifacts: async ({ run_id }) => ({
        data: { artifacts: artifacts[run_id] ?? [] },
      }),
    },
  },
});
const artifact = { name: 'ideis-schedule', expired: false };

test('a completed synchronization uses its own artifact, not a different newer run', async () => {
  const github = client([run(999)], { 999: [artifact] });
  assert.equal(await selectScheduleRun({ github, context: context('workflow_run'), now }), 123);
});
test('foreign, failed, untrusted or non-default-branch synchronization cannot publish', async () => {
  for (const change of [
    { head_branch: 'feature' },
    { conclusion: 'failure' },
    { head_repository: { full_name: 'someone/fork' } },
    { path: '.github/workflows/other.yml' },
    { event: 'pull_request' },
  ])
    await assert.rejects(
      selectScheduleRun({
        github: client(),
        context: context('workflow_run', run(123, change)),
        now,
      }),
      /niezaufane/,
    );
});
test('a code push restores the newest available trusted artifact and skips expired or old ones', async () => {
  const github = client(
    [
      run(6, { head_branch: 'feature' }),
      run(5),
      run(4, { created_at: new Date(now - 13 * 3600_000).toISOString() }),
      run(3),
      run(2, { event: 'workflow_dispatch' }),
    ],
    {
      5: [{ ...artifact, expired: true }],
      4: [artifact],
      3: [{ name: 'unrelated', expired: false }],
      2: [artifact],
    },
  );
  assert.equal(await selectScheduleRun({ github, context: context(), now }), 2);
});
test('first deployment bootstraps without a registered sync workflow or saved artifact', async () => {
  assert.equal(await selectScheduleRun({ github: client(), context: context(), now }), null);
  const github = client();
  github.rest.actions.listWorkflowRuns = async () => {
    throw Object.assign(new Error('not found'), { status: 404 });
  };
  assert.equal(await selectScheduleRun({ github, context: context(), now }), null);
  github.rest.actions.listWorkflowRuns = async () => {
    throw Object.assign(new Error('forbidden'), { status: 403 });
  };
  await assert.rejects(selectScheduleRun({ github, context: context(), now }), /forbidden/);
});

const snapshot = () => ({
  source: SOURCE_URL,
  fetchedAt: new Date(now).toISOString(),
  semester: { from: '2026-09-11', to: '2027-02-07' },
  lessons: ['1A', '1B', '2A', '2B'].map((group) => ({
    date: '2026-10-24',
    start: '09:00',
    end: '10:30',
    title: 'Anatomia',
    group,
    sourceGroup: `Fizjoterapia Jmgr 1sem Labor${group}N`,
  })),
});
test('current validated data is reused for both code publication and scheduled publication', () => {
  for (const event of ['push', 'workflow_dispatch', 'workflow_run'])
    assert.equal(needsScheduleFetch(snapshot(), event, now), false);
});
test('code publication downloads a fresh schedule if no valid artifact exists', () => {
  for (const data of [
    undefined,
    { ...snapshot(), lessons: [] },
    { ...snapshot(), fetchedAt: new Date(now - 13 * 3600_000).toISOString() },
  ]) {
    assert.equal(needsScheduleFetch(data, 'push', now), true);
    assert.equal(needsScheduleFetch(data, 'workflow_dispatch', now), true);
  }
});
test('scheduled publication fails safely for missing, stale or wrongly grouped artifacts', () => {
  const wrong = snapshot();
  wrong.lessons[0].group = '2A';
  for (const data of [
    undefined,
    wrong,
    { ...snapshot(), fetchedAt: new Date(now - 13 * 3600_000).toISOString() },
  ]) {
    assert.throws(() => needsScheduleFetch(data, 'workflow_run', now));
  }
});
