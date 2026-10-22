// Browser regression checks against the real IDEIS snapshot, never demo lessons.
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
  const errors = [];
  const scheduleRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
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
  // Use a known date within the real semester so these checks can be repeated later.
  await page.evaluateOnNewDocument(() => {
    const OriginalDate = Date;
    const timestamp = Number(
      sessionStorage.getItem('test:clock') || OriginalDate.parse('2026-10-22T16:00:00Z'),
    );
    window.Date = class extends OriginalDate {
      constructor(...args) {
        if (args.length) super(...args);
        else super(timestamp);
      }
      static now() {
        return timestamp;
      }
    };
  });
  const waitForSchedule = () =>
    page.waitForFunction(
      () => document.querySelector('.sync-status')?.textContent.includes('Zaktualizowano'),
      { timeout: 100_000 },
    );
  const visibleDay = '.day-column:not(.mobile-hidden)';
  const selectMenu = async (trigger, text) => {
    await page.click(trigger);
    await page.waitForSelector('[role="menu"]');
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    const buttons = await page.$$('[role="menuitem"], [role="menuitemradio"]');
    for (const button of buttons) {
      if ((await button.evaluate((el) => el.textContent)).trim() === text) {
        await button.asLocator().click();
        await page.waitForSelector('[role="menu"]', { hidden: true });
        return;
      }
    }
    throw new Error(`Missing menu item: ${text}`);
  };
  const selectGroup = async (group) => {
    await selectMenu('.group-label', `Grupa ${group}`);
    await page.waitForFunction(
      (value) =>
        localStorage.getItem('fizjoplan:group:v1') === value &&
        [...document.querySelectorAll('.lesson-card')].every((el) =>
          ['1', 'all', value].includes(el.getAttribute('data-group')),
        ),
      {},
      group,
    );
  };
  const visibleColumns = () =>
    page.$$eval(
      '.day-column',
      (els) => els.filter((el) => getComputedStyle(el).display !== 'none').length,
    );
  const checkOverflow = async (width) =>
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `No horizontal scroll at ${width}px`,
    );

  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(target, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.group-welcome');
  assert.equal(
    await page.$('.calendar-board'),
    null,
    'No schedule is shown before choosing a group',
  );
  assert.equal(await page.evaluate(() => localStorage.getItem('fizjoplan:group:v1')), null);
  await page.setViewport({ width: 320, height: 844, deviceScaleFactor: 1 });
  await checkOverflow(320);
  await page.screenshot({ path: 'tmp/group-welcome-mobile.png', fullPage: true });
  await page.locator('[data-group-choice="1B"]').click();
  await waitForSchedule();
  assert.equal(await page.evaluate(() => localStorage.getItem('fizjoplan:group:v1')), '1B');
  assert.ok(await page.$('.lesson-card[data-group="1B"]'));
  assert.equal(await page.$('.lesson-card[data-group="1A"]'), null);
  await page.reload({ waitUntil: 'networkidle2' });
  await waitForSchedule();
  assert.equal(await page.$('.group-welcome'), null, 'Saved choice skips the welcome screen');
  assert.match(await page.$eval('.group-label', (el) => el.innerText), /Grupa 1B/);
  await page.screenshot({ path: 'tmp/group-1b-mobile.png', fullPage: true });
  await page.focus('.group-label');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.group-menu');
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  );
  assert.match(
    await page.$eval('.group-menu [aria-checked="true"]', (el) => el.innerText),
    /Grupa 1B/,
  );
  await checkOverflow(320);
  await page.screenshot({ path: 'tmp/group-menu-mobile.png' });
  await page.keyboard.press('End');
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Grupa 1B/);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.group-menu', { hidden: true });
  assert.equal(
    await page.evaluate(() => document.activeElement.classList.contains('group-label')),
    true,
  );
  await selectGroup('1A');
  assert.ok(await page.$('.lesson-card[data-group="1A"]'));
  assert.equal(await page.$('.lesson-card[data-group="1B"]'), null);
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('fizjoplan:schedule:v2')),
  );
  assert.ok(saved.lessons.length > 0);
  assert.ok(saved.lessons.every((lesson) => ['1', '1A', '1B', 'all'].includes(lesson.group)));
  if (pagesMode) {
    assert.equal(new URL(scheduleRequests[0]).pathname, base + 'data/schedule.json');
    assert.ok(scheduleRequests.every((url) => !url.includes('/api/')));
    assert.equal(await page.$eval('.brand-mark', (el) => el.href), new URL('./', target).href);
  }
  await writeFile('tmp/verified-schedule.json', JSON.stringify(saved, null, 2));
  assert.equal(await visibleColumns(), 3);
  assert.equal(
    await page.$eval('body', (el) => getComputedStyle(el).backgroundColor),
    'rgb(16, 18, 23)',
  );
  await page.screenshot({ path: 'tmp/desktop.png', fullPage: true });
  const friday = saved.lessons.filter(
    (lesson) => lesson.date === '2026-10-23' && lesson.group !== '1B',
  );
  assert.ok(friday.length > 0, 'The real source has lessons on the QA weekend');
  const shownTitle = friday[0].title;
  const initialCards = await page.$$eval('.lesson-card', (els) => els.length);
  const colors = await page.$$eval('.lesson-card', (els) =>
    els.map((el) => ({
      title: el.querySelector('.lesson-title').textContent.trim(),
      color: el.style.getPropertyValue('--subject-color'),
    })),
  );
  for (const item of colors)
    assert.ok(
      colors
        .filter((other) => other.title === item.title)
        .every((other) => other.color === item.color),
    );

  const featuredText = await page.$eval('.live-card', (el) => el.innerText);
  assert.match(featuredText, /Jutro/);
  await page.click('[aria-label="Następny zjazd"]');
  await page.waitForSelector('.nearest-button');
  assert.equal(await page.$eval('.live-card', (el) => el.innerText), featuredText);
  await page.click('.nearest-button');
  await page.waitForSelector('.nearest-button', { hidden: true });
  assert.equal(await page.$('.nearest-button'), null);

  // Export lives in the actions menu and preserves every original time block.
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
  await selectMenu('[aria-label="Więcej akcji"]', 'Eksportuj zjazd do CSV');
  await page.waitForFunction(() => !!window.__exportedBlob);
  const csv = await page.evaluate(() => window.__exportedBlob.text());
  assert.ok(
    csv.includes('Prowadzący') && csv.includes(friday[0].teacher) && csv.includes(shownTitle),
  );
  assert.ok(!csv.includes('"1B"') && !csv.includes('"2"'));
  assert.match(
    await page.evaluate(() => window.__exportedName),
    /^FizjoPlan_2026-10-23_1-1A\.csv$/,
  );
  const weekendRows = saved.lessons.filter(
    (lesson) =>
      lesson.date >= '2026-10-23' &&
      lesson.date <= '2026-10-25' &&
      !lesson.canceled &&
      lesson.group !== '1B',
  );
  assert.equal(
    csv.split('\r\n').length - 1,
    weekendRows.length,
    'Grouping does not remove exported slots',
  );
  assert.ok(!csv.includes('"1B"'), 'Group A export excludes subgroup B');
  await selectGroup('1B');
  await page.evaluate(() => {
    window.__exportedBlob = null;
  });
  await selectMenu('[aria-label="Więcej akcji"]', 'Eksportuj zjazd do CSV');
  await page.waitForFunction(() => !!window.__exportedBlob);
  const csvB = await page.evaluate(() => window.__exportedBlob.text());
  assert.ok(csvB.includes('"1B"') && !csvB.includes('"1A"'), 'Group B export excludes subgroup A');
  assert.match(await page.evaluate(() => window.__exportedName), /_1-1B\.csv$/);
  assert.equal(
    csvB.split('\r\n').length - 1,
    saved.lessons.filter(
      (lesson) =>
        lesson.date >= '2026-10-23' &&
        lesson.date <= '2026-10-25' &&
        !lesson.canceled &&
        lesson.group !== '1A',
    ).length,
  );
  await selectGroup('1A');

  await selectMenu('.filter-button', 'Laboratorium');
  assert.ok((await page.$eval('.filter-button', (el) => el.innerText)).includes('Laboratorium'));
  assert.ok(await page.$('.lesson-card'));
  assert.ok(
    await page.$$eval('.lesson-card .lesson-type', (els) =>
      els.every((el) => el.textContent.trim() === 'Laboratorium'),
    ),
  );
  await page.click('[aria-label="Wyczyść filtr"]');
  await page.waitForFunction(
    (count) => document.querySelectorAll('.lesson-card').length === count,
    {},
    initialCards,
  );
  assert.equal(await page.$$eval('.lesson-card', (els) => els.length), initialCards);
  const anatomyColors = await page.$$eval('.lesson-card', (els) =>
    els
      .filter((el) => el.querySelector('.lesson-title').textContent.trim() === 'Anatomia')
      .map((el) => el.style.getPropertyValue('--subject-color')),
  );
  assert.ok(anatomyColors.length >= 1 && anatomyColors.every((color) => color === '#85ACE5'));
  const dietColors = await page.$$eval('.lesson-card', (els) =>
    els
      .filter((el) => el.querySelector('.lesson-title').textContent.trim() === 'Podstawy dietetyki')
      .map((el) => el.style.getPropertyValue('--subject-color')),
  );
  assert.ok(dietColors.length >= 2 && dietColors.every((color) => color === '#7BC9AA'));

  const groupedHeader = (await page.$$('.day-column:first-child .lesson-summary')).at(-1);
  await groupedHeader.click();
  await page.waitForSelector('.day-column:first-child .block-list');
  assert.equal(await groupedHeader.evaluate((el) => el.getAttribute('aria-expanded')), 'true');
  assert.equal(await page.$$eval('.day-column:first-child .block-row', (els) => els.length), 2);
  assert.match(
    await page.$eval('.day-column:first-child .block-list', (el) => el.innerText),
    /Blok 1[\s\S]*16:00–17:30[\s\S]*15 min przerwy[\s\S]*Blok 2[\s\S]*17:45–19:15/,
  );
  await page.screenshot({ path: 'tmp/details-desktop.png', fullPage: true });
  await groupedHeader.click();
  await page.waitForSelector('.day-column:first-child .block-list', { hidden: true });
  await page.click('.day-column:first-child .lesson-summary');
  await page.waitForSelector('.day-column:first-child .lesson-details');
  assert.equal(
    await page.$('.day-column:first-child app-lesson-map'),
    null,
    'Online lesson has no physical map',
  );
  await page.click('.day-column:first-child .lesson-summary');
  await page.waitForSelector('.day-column:first-child .lesson-details', { hidden: true });

  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    await checkOverflow(width);
    assert.equal(await visibleColumns(), 1);
    assert.ok(
      await page.$eval(
        `${visibleDay} .lesson-card`,
        (el) => el.getBoundingClientRect().width > innerWidth * 0.7,
      ),
    );
    await page.screenshot({ path: `tmp/mobile-${width}.png`, fullPage: true });
    await page.focus('#tab-0');
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('#tab-1[aria-selected="true"]');
    assert.equal(await page.$eval('#tab-1', (el) => el.getAttribute('aria-selected')), 'true');
    assert.match(await page.$eval(visibleDay, (el) => el.getAttribute('aria-label')), /Sobota/);
    await selectMenu('.filter-button', 'Wykład');
    assert.equal(
      await page.$eval('#tab-1', (el) => el.getAttribute('aria-selected')),
      'true',
      'Filtering keeps the selected day',
    );
    await page.click('[aria-label="Wyczyść filtr"]');
    await page.waitForSelector('[aria-label="Wyczyść filtr"]', { hidden: true });
    await page.click('#tab-0');
    await page.waitForSelector('#tab-0[aria-selected="true"]');
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.click('#tab-1');
  await page.waitForSelector('#tab-1[aria-selected="true"]');
  await page.click(`${visibleDay} .lesson-summary`);
  await page.waitForSelector(`${visibleDay} .navigate-button`);
  const navigationHref = await page.$eval(`${visibleDay} .navigate-button`, (el) => el.href);
  const url = new URL(navigationHref);
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('dir_action'), 'navigate');
  assert.match(url.searchParams.get('destination'), /^51\.\d+,16\.\d+$/);
  assert.equal(await page.$eval(`${visibleDay} .map-preview`, (el) => el.href), navigationHref);
  await page.$eval(`${visibleDay} app-lesson-map`, (el) => el.scrollIntoView({ block: 'center' }));
  const preview = await page.$eval(`${visibleDay} app-lesson-map iframe`, (el) => ({
    src: el.src,
    tabIndex: el.tabIndex,
  }));
  assert.equal(
    new URL(preview.src).searchParams.get('marker'),
    url.searchParams.get('destination'),
  );
  assert.equal(preview.tabIndex, -1);
  const previewFrame = await (await page.$(`${visibleDay} app-lesson-map iframe`)).contentFrame();
  await previewFrame.waitForSelector('#map canvas, #map img', { timeout: 20000 });
  await previewFrame.waitForFunction(
    () =>
      performance
        .getEntriesByType('resource')
        .some((resource) => resource.name.startsWith('https://tile.openstreetmap.org/')),
    { timeout: 20000 },
  );
  await previewFrame.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await checkOverflow(390);
  await page.screenshot({ path: 'tmp/details-mobile.png', fullPage: true });
  await page.setViewport({ width: 320, height: 844, deviceScaleFactor: 1 });
  await checkOverflow(320);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

  // Verify the real two-block class both during teaching and during its break.
  await page.evaluate(() =>
    sessionStorage.setItem('test:clock', String(Date.parse('2026-10-23T14:15:00Z'))),
  );
  await page.reload({ waitUntil: 'networkidle2' });
  await waitForSchedule();
  assert.match(
    await page.$eval('.live-card', (el) => el.innerText),
    /Trwa teraz[\s\S]*Anatomia[\s\S]*Pozostało 75 min/,
  );
  assert.ok(await page.$('mat-progress-bar'));
  await page.screenshot({ path: 'tmp/live-mobile.png', fullPage: true });
  await page.evaluate(() =>
    sessionStorage.setItem('test:clock', String(Date.parse('2026-10-23T15:35:00Z'))),
  );
  await page.reload({ waitUntil: 'networkidle2' });
  await waitForSchedule();
  const breakText = await page.$eval('.live-card', (el) => el.innerText);
  assert.ok(
    breakText.includes('Najbliższe zajęcia') &&
      breakText.includes('17:45–19:15') &&
      !breakText.includes('Trwa teraz'),
  );
  await page.evaluate(() =>
    sessionStorage.setItem('test:clock', String(Date.parse('2026-10-24T11:00:00Z'))),
  );
  await page.reload({ waitUntil: 'networkidle2' });
  await waitForSchedule();
  assert.equal(
    await page.$('.live-card.is-live'),
    null,
    'Group A has finished Saturday classes at 13:00',
  );
  await selectGroup('1B');
  await page.waitForSelector('.live-card.is-live');
  assert.match(
    await page.$eval('.live-card', (el) => el.innerText),
    /Biologia medyczna[\s\S]*12:30–14:00[\s\S]*Pozostało 60 min/,
  );
  assert.ok(await page.$('.lesson-card[data-group="1B"].is-live'));
  await page.screenshot({ path: 'tmp/group-1b-live-mobile.png', fullPage: true });

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
  await selectMenu('[aria-label="Więcej akcji"]', 'Odśwież plan');
  await page.waitForSelector('.error-banner');
  assert.match(await page.$eval('.error-banner', (el) => el.innerText), /ostatnio zapisany/);
  assert.equal(
    await page.$('.lesson-card[data-group="1A"]'),
    null,
    'Offline fallback keeps the selected group',
  );
  await page.evaluate(() => localStorage.removeItem('fizjoplan:schedule:v2'));
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.error-banner');
  assert.match(await page.$eval('.day-content', (el) => el.innerText), /Plan niedostępny/);
  await page.evaluate(() => localStorage.setItem('fizjoplan:group:v1', '2A'));
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.group-welcome');
  assert.equal(
    await page.$('.calendar-board'),
    null,
    'Invalid saved groups require a fresh choice',
  );
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    JSON.stringify({
      passed: true,
      liveSource: !cached,
      staticHosting: pagesMode,
      lessons: saved.lessons.length,
      groupedWeekendCards: initialCards,
      screenshots: 'tmp/',
    }),
  );
} finally {
  await browser.close();
}
