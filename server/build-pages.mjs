import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { normalizeBasePath, validateStaticSchedule } from './static-schedule.mjs';

try {
  validateStaticSchedule(
    JSON.parse(await readFile(new URL('../public/data/schedule.json', import.meta.url), 'utf8')),
  );
  const base = normalizeBasePath(process.env.PAGES_BASE_PATH ?? '/');
  console.log(`Budowanie GitHub Pages pod ścieżką: ${base}`);
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/@angular/cli/bin/ng.js',
      'build',
      '--configuration=production,pages',
      '--base-href',
      base,
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else await writeFile('dist/ideis-schedule/browser/.nojekyll', '');
} catch (error) {
  console.error(
    error.code === 'ENOENT'
      ? 'Nie ma pobranego planu. Najpierw uruchom npm run sync:schedule.'
      : error.message,
  );
  process.exitCode = 1;
}
