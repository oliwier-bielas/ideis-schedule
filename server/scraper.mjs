import puppeteer from 'puppeteer';
import { normalizeRows, SOURCE_URL } from './normalize.mjs';

export async function fetchSchedule() {
  const browser = await puppeteer.launch({
    headless: true,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });
  const timeout = setTimeout(() => void browser.close(), 85_000);
  let stage = 'otwieranie strony IDEIS';
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pl-PL,pl;q=0.9' });
    const response = await page.goto(SOURCE_URL, { waitUntil: 'networkidle2', timeout: 45_000 });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
    stage = 'ustawianie zakresu całego semestru';
    await page.waitForFunction(() => window.MVCxDataOd && window.gridViewPlanyTokow, {
      timeout: 15_000,
    });
    const semester = await page.evaluate(() => {
      const radio = document.querySelector('#RadioList_Termin3');
      if (!radio) throw new Error('Nie znaleziono opcji Cały semestr.');
      // The site's radio handler splits on two slashes, but its HTML has one.
      // Set DevExpress dates directly using the range supplied by the source.
      const [from, to] = radio.value
        .split(/\\+/)
        .slice(0, 2)
        .map((value) => value.split(',').map(Number));
      if (from?.length !== 3 || to?.length !== 3) throw new Error('Nieprawidłowy zakres semestru.');
      window.MVCxDataOd.SetDate(new Date(from[0], from[1] - 1, from[2]));
      window.MVCxDataDo.SetDate(new Date(to[0], to[1] - 1, to[2]));
      radio.checked = true;
      const date = (parts) =>
        `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
      return { from: date(from), to: date(to) };
    });
    stage = 'wyszukiwanie zajęć (callback IDEIS)';
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const grid = window.gridViewPlanyTokow;
          const timer = setTimeout(
            () => reject(new Error('Serwer IDEIS nie zakończył wyszukiwania w 55 s.')),
            55_000,
          );
          const done = () => {
            clearTimeout(timer);
            grid.EndCallback.RemoveHandler(done);
            resolve();
          };
          grid.EndCallback.AddHandler(done);
          window.FiltrujDane(grid, 1516);
        }),
    );
    stage = 'odczyt tabeli harmonogramu';
    const result = await page.evaluate(() => {
      const table = document.querySelector('#gridViewPlanyTokow_DXMainTable');
      if (!table) throw new Error('Nie znaleziono tabeli harmonogramu.');
      const rows = [];
      let date = '';
      for (const row of table.querySelectorAll(':scope > tbody > tr')) {
        if (row.id.includes('DXGroupRow')) {
          const match = row.innerText.match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
          date = match ? `${match[1]}-${match[2]}-${match[3]}` : '';
        } else if (row.id.includes('DXDataRow')) {
          const cells = [...row.querySelectorAll(':scope > td.dx-wrap')].map((cell) =>
            cell.innerText.replace(/\u00a0/g, ' ').trim(),
          );
          if (cells.length !== 11)
            throw new Error(`Zmieniona struktura tabeli: ${cells.length} kolumn zamiast 11.`);
          rows.push({ date, cells });
        }
      }
      if (!rows.length && !table.querySelector('[class*="EmptyDataRow"]'))
        throw new Error('Nie rozpoznano zawartości tabeli.');
      const heading = [...document.querySelectorAll('p, h5, h6, div')].find(
        (el) => el.children.length === 0 && el.textContent.includes('Fizjoterapia N Jmgr'),
      );
      return {
        rows,
        course: heading?.textContent.trim() ?? 'Fizjoterapia N Jmgr 5.00 2026/2027 Zima',
      };
    });
    const lessons = normalizeRows(result.rows);
    if (result.rows.length && !lessons.length)
      throw new Error(
        'Tabela zawiera zajęcia, ale nie rozpoznano grup 1 / 1A / 1B ani wykładów wspólnych.',
      );
    for (const group of ['1A', '1B']) {
      if (!lessons.some((lesson) => lesson.group === group))
        throw new Error(`Nie znaleziono zajęć grupy ${group} w planie całego semestru.`);
    }
    return {
      lessons,
      source: SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      semester,
      course: result.course,
      sourceRows: result.rows.length,
    };
  } catch (error) {
    throw new Error(`Nie udało się pobrać planu — etap: ${stage}. ${error.message}`, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
    await browser.close();
  }
}
