import { validateStaticSchedule } from './static-schedule.mjs';

export const SCHEDULE_ARTIFACT = 'ideis-schedule';
const workflowPath = '.github/workflows/sync-schedule.yml';

export async function selectScheduleRun({ github, context, now = Date.now() }) {
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  const branch = context.payload.repository.default_branch;
  const trusted = (run) =>
    run.conclusion === 'success' &&
    run.head_branch === branch &&
    run.head_repository?.full_name === repository &&
    run.path?.split('@')[0] === workflowPath &&
    ['schedule', 'workflow_dispatch'].includes(run.event);

  if (context.eventName === 'workflow_run') {
    const run = context.payload.workflow_run;
    if (!run || !trusted(run)) throw new Error('Odrzucono niezaufane uruchomienie synchronizacji.');
    return run.id;
  }

  let runs;
  try {
    ({
      data: { workflow_runs: runs },
    } = await github.rest.actions.listWorkflowRuns({
      ...context.repo,
      workflow_id: 'sync-schedule.yml',
      branch,
      status: 'success',
      per_page: 10,
    }));
  } catch (error) {
    // The newly added workflow may not be registered yet during the first push.
    if (error.status === 404) return null;
    throw error;
  }
  for (const run of runs) {
    if (
      !trusted(run) ||
      !Number.isFinite(Date.parse(run.created_at)) ||
      now - Date.parse(run.created_at) > 12 * 60 * 60 * 1000
    )
      continue;
    const { data } = await github.rest.actions.listWorkflowRunArtifacts({
      ...context.repo,
      run_id: run.id,
      per_page: 100,
    });
    if (data.artifacts.some((artifact) => artifact.name === SCHEDULE_ARTIFACT && !artifact.expired))
      return run.id;
  }
  return null;
}

export function needsScheduleFetch(schedule, eventName, now = Date.now()) {
  try {
    validateStaticSchedule(schedule, now);
    return false;
  } catch (error) {
    // A successful sync must provide its own validated artifact. Do not hide a
    // broken handoff by scraping again or publishing an unrelated cached plan.
    if (eventName === 'workflow_run') throw error;
    return true;
  }
}
