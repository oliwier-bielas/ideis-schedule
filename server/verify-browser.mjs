// Local end-to-end verification using the Puppeteer dependency required by IDEIS.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('tmp', { recursive: true });
const pagesMode = process.argv.includes('--pages');
const base = pagesMode
  ? (await readFile('dist/ideis-schedule/browser/index.html', 'utf8')).match(
      /<base href="([^"]+)"/,
    )[1]
  : '/';
const target = pagesMode ? `http://127.0.0.1:4300${base}` : 'http://127.0.0.1:4200/';
const isScheduleRequest = (url) =>
  /\/(?:api\/schedule|data\/schedule\.json)$/.test(new URL(url).pathname);
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  const scheduleRequests = [];
  page.on('request', (request) => {
    if (isScheduleRequest(request.url())) scheduleRequests.push(request.url());
  });
  const cached = process.argv.includes('--cached')
    ? await readFile('tmp/verified-schedule.json', 'utf8')
    : null;
  if (cached) {
    await page.setRequestInterception(true);
    page.on('request', (request) =>
      isScheduleRequest(request.url())
        ? request.respond({ status: 200, contentType: 'application/json', body: cached })
        : request.continue(),
    );
  }
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(target, { waitUntil: 'networkidle2' });
  await page.waitForFunction(
    () => document.querySelector('.sync-status')?.textContent.includes('Zaktualizowano'),
    { timeout: 100_000 },
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('fizjoplan:schedule:v1')),
  );
  assert.ok(saved.lessons.length > 0);
  assert.ok(saved.lessons.every((l) => ['1', '1A', 'all'].includes(l.group)));
  if (pagesMode) {
    assert.equal(new URL(scheduleRequests[0]).pathname, base + 'data/schedule.json');
    assert.ok(
      scheduleRequests.every((url) => !url.includes('/api/')),
      'Static hosting never needs the local API',
    );
    assert.equal(
      await page.$eval('.brand-mark', (el) => el.href),
      new URL('./', target).href,
      'Home link keeps the Pages repository path',
    );
  }
  await writeFile('tmp/verified-schedule.json', JSON.stringify(saved, null, 2));
  await page.screenshot({ path: 'tmp/desktop.png', fullPage: true });
  const shownTitle = await page.$eval('.lesson-card .lesson-title', (el) => el.textContent.trim());
  const shownTeacher = await page.$eval('.agenda-item .agenda-teacher', (el) =>
    el.textContent.trim(),
  );
  const shownCount = await page.$$eval('.lesson-card', (els) => els.length);
  await page.click('.view-switch button:nth-child(2)');
  await page.waitForSelector('.calendar-board:not(.calendar-layout)');
  assert.equal(
    await page.$$eval(
      '.day-column',
      (els) => els.filter((el) => getComputedStyle(el).display !== 'none').length,
    ),
    3,
  );
  await page.click('.view-switch button:first-child');
  await page.waitForSelector('.calendar-layout');
  await page.type('.search-field input', shownTitle);
  await page.waitForFunction(
    (title) =>
      [...document.querySelectorAll('.lesson-card')].every((el) => el.innerText.includes(title)),
    {},
    shownTitle,
  );
  assert.ok(await page.$('.lesson-card'));
  await page.$eval('.search-field input', (el) => {
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(
    (count) => document.querySelectorAll('.lesson-card').length === count,
    {},
    shownCount,
  );
  const liveText = await page.$eval('.live-card', (el) => el.innerText);
  await page.click('[aria-label="Następny weekend"]');
  assert.equal(
    await page.$eval('.live-card', (el) => el.innerText),
    liveText,
    'Browsing must not change the live card',
  );
  await page.click('.today-button');
  await page.waitForSelector('.lesson-card');
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__exportedBlob = blob;
      return create(blob);
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        window.__exportedName = this.download;
        return;
      }
      click.call(this);
    };
  });
  await page.click('.export-button');
  await page.waitForFunction(() => !!window.__exportedBlob);
  const csv = await page.evaluate(() => window.__exportedBlob.text());
  assert.ok(
    csv.includes('Prowadzący') && csv.includes(shownTeacher),
    'CSV keeps Polish teacher names',
  );
  assert.ok(!csv.includes('"1B"') && !csv.includes('"2"'), 'CSV excludes other groups');
  assert.ok(csv.includes(shownTitle), 'CSV contains the selected weekend');
  assert.match(
    await page.evaluate(() => window.__exportedName),
    /^FizjoPlan_\d{4}-\d{2}-\d{2}_1-1A\.csv$/,
  );
  await page.click('.lesson-card');
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  );
  assert.ok((await page.$eval('[role="dialog"]', (el) => el.innerText)).includes('Prowadzący'));
  await page.screenshot({ path: 'tmp/details-desktop.png' });
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `No horizontal scroll at ${width}px`,
    );
    assert.equal(
      await page.$$eval(
        '.day-column',
        (els) => els.filter((el) => getComputedStyle(el).display !== 'none').length,
      ),
      1,
    );
    assert.ok(
      await page.$eval(
        '.day-column:not(.mobile-hidden) .lesson-card',
        (el) => el.getBoundingClientRect().width > innerWidth * 0.7,
      ),
      'Mobile cards use the full day width',
    );
    await page.screenshot({ path: `tmp/mobile-${width}.png`, fullPage: true });
    await page.click('.mobile-days button:nth-child(2)');
    await page.waitForFunction(() =>
      document
        .querySelector('.day-column:not(.mobile-hidden) .day-heading')
        ?.innerText.includes('Sobota'),
    );
  }
  await page.click('.day-column:not(.mobile-hidden) .lesson-card');
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  );
  await page.screenshot({ path: 'tmp/details-mobile.png' });
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  await page.setViewport({ width: 1440, height: 1100 });
  page.removeAllListeners('request');
  await page.setRequestInterception(true);
  page.on('request', (request) =>
    isScheduleRequest(request.url())
      ? request.respond({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Test niedostępności IDEIS' }),
        })
      : request.continue(),
  );
  await page.click('[aria-label="Odśwież plan"]');
  await page.waitForSelector('.error-banner');
  assert.ok(
    (await page.$eval('.error-banner', (el) => el.innerText)).includes('ostatnio zapisany'),
  );
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.error-banner');
  assert.ok((await page.$eval('.day-content', (el) => el.innerText)).includes('Plan niedostępny'));
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    JSON.stringify({
      passed: true,
      liveSource: !cached,
      staticHosting: pagesMode,
      lessons: saved.lessons.length,
      groups: [...new Set(saved.lessons.map((l) => l.sourceGroup))],
      screenshots: 'tmp/',
    }),
  );
} finally {
  await browser.close();
}
