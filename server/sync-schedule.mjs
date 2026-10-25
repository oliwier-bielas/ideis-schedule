import { mkdir, rename, writeFile, appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fetchSchedule } from './scraper.mjs';
import { validateStaticSchedule } from './static-schedule.mjs';

const destination = new URL('../public/data/schedule.json', import.meta.url);
const temporary = new URL('../public/data/schedule.json.tmp', import.meta.url);
let schedule;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    console.log(`Synchronizacja IDEIS (${attempt}/3)…`);
    schedule = validateStaticSchedule(await fetchSchedule());
    break;
  } catch (error) {
    console.error(error.message);
    if (attempt === 3) {
      console.error(
        'Synchronizacja nie powiodła się. Ostatni poprawny plik i opublikowana strona pozostają bez zmian.',
      );
      process.exitCode = 1;
    } else await delay(attempt * 5000);
  }
}
if (schedule) {
  await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
  await writeFile(temporary, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
  await rename(temporary, destination);
  console.log(`Zapisano ${schedule.lessons.length} zajęć. Aktualizacja: ${schedule.fetchedAt}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `### Synchronizacja planu\n\n- Zajęcia po filtrowaniu: **${schedule.lessons.length}**\n- Grupy: **1, 1A, 1B, 2, 2A, 2B i wykłady wspólne**\n- Pobranie: ${schedule.fetchedAt}\n- Semestr: ${schedule.semester.from} – ${schedule.semester.to}\n`,
    );
  }
}
