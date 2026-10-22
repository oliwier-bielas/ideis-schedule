import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchSchedule } from './scraper.mjs';

const app = express();
app.disable('x-powered-by');
let pending;
// Coalesce simultaneous requests only. Every new page load refreshes IDEIS.
app.get('/api/schedule', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    pending ??= fetchSchedule().finally(() => {
      pending = undefined;
    });
    const schedule = await pending;
    res.json(schedule);
  } catch (error) {
    console.error(error.message);
    res.status(502).json({ error: error.message });
  }
});
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
const dist = resolve('dist/ideis-schedule/browser');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (req, res) =>
    req.path.startsWith('/api/') ? res.sendStatus(404) : res.sendFile(resolve(dist, 'index.html')),
  );
}
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`FizjoPlan API: http://localhost:${port}`),
);
server.requestTimeout = 100_000;
