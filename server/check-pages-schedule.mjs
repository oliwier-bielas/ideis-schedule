import { readFile, appendFile } from 'node:fs/promises';
import { needsScheduleFetch } from './pages-schedule.mjs';

try {
  let schedule;
  try {
    schedule = JSON.parse(await readFile('public/data/schedule.json', 'utf8'));
  } catch (error) {
    if (process.env.GITHUB_EVENT_NAME === 'workflow_run') throw error;
  }
  const needsFetch = needsScheduleFetch(schedule, process.env.GITHUB_EVENT_NAME);
  console.log(
    needsFetch
      ? 'Brak aktualnego artefaktu. Pobieramy plan przy publikacji kodu.'
      : 'Używamy aktualnego planu z synchronizacji.',
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `needs-fetch=${needsFetch}\n`);
} catch (error) {
  console.error(`Nie można użyć wyniku synchronizacji: ${error.message}`);
  process.exitCode = 1;
}
