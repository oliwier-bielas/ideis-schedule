import express from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeBasePath } from './static-schedule.mjs';

const directory = resolve('dist/ideis-schedule/browser');
const index = await readFile(resolve(directory, 'index.html'), 'utf8');
const base = normalizeBasePath(index.match(/<base href="([^"]+)"/)?.[1] ?? '/');
const app = express();
app.disable('x-powered-by');
app.use(base, express.static(directory));
if (base !== '/') app.get('/', (_req, res) => res.redirect(base));
app.listen(4300, '127.0.0.1', () =>
  console.log(`Podgląd GitHub Pages: http://127.0.0.1:4300${base}`),
);
