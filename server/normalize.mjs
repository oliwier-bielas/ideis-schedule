export const SOURCE_URL = 'https://harmonogramy.ideis.pl/Plany/PlanyTokow/1516';

// Match complete IDEIS group tokens. A substring match would also admit 1B / 10.
export function classifyGroup(value) {
  const text = value.normalize('NFKC').trim();
  const token = text.split(/\s+/).at(-1);
  if (/^WykN$/i.test(token)) return 'all';
  if (/^(?:Ćw|Cw)1N$/i.test(token) || text === '1') return '1';
  if (/^Labor1AN$/i.test(token) || text === '1A') return '1A';
  return null;
}

export function normalizeRows(rows) {
  const lessons = [];
  for (const row of rows) {
    const [
      start,
      end,
      ,
      sourceGroup,
      title,
      rawType,
      location,
      teacher,
      assessment,
      sourceId,
      rawNotes,
    ] = row.cells;
    const group = classifyGroup(sourceGroup ?? '');
    if (!group) continue;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !/^\d{1,2}:\d{2}$/.test(start) ||
      !/^\d{1,2}:\d{2}$/.test(end) ||
      !title
    ) {
      throw new Error('Zmieniony format dat lub godzin w tabeli IDEIS.');
    }
    const type = /wyk|lecture/i.test(rawType)
      ? 'Wykład'
      : /lab/i.test(rawType)
        ? 'Laboratorium'
        : 'Ćwiczenia';
    const canceled = /odwoł|cancell?ed/i.test(rawNotes);
    const online = /zdal|distance|online/i.test(rawNotes);
    const notes = /^(?:brak|lack|none)?$/i.test(rawNotes)
      ? ''
      : rawNotes
          .replace(/Distance learning/gi, 'Zajęcia zdalne')
          .replace(/Class cancel[l]?ed/gi, 'Zajęcia odwołane');
    lessons.push({
      id: `${row.date}-${start}-${sourceId}-${group}`,
      date: row.date,
      start: start.padStart(5, '0'),
      end: end.padStart(5, '0'),
      title,
      type,
      group,
      sourceGroup,
      location: location || (online ? 'Zajęcia zdalne' : 'Nie podano sali'),
      teacher: teacher || 'Nie podano prowadzącego',
      assessment,
      notes,
      canceled,
      online,
    });
  }
  return [...new Map(lessons.map((lesson) => [lesson.id, lesson])).values()].sort((a, b) =>
    `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`),
  );
}
