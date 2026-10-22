import { Lesson, minutes } from './schedule';

export interface SubjectPalette {
  color: string;
  background: string;
}
const palettes: SubjectPalette[] = [
  { color: '#B6A0E6', background: '#262733' },
  { color: '#7BC9AA', background: '#212A2E' },
  { color: '#85ACE5', background: '#222833' },
  { color: '#E2B07F', background: '#29282A' },
  { color: '#79C2CE', background: '#212931' },
  { color: '#DB98B5', background: '#29262F' },
  { color: '#D4C27E', background: '#28292A' },
  { color: '#DA9591', background: '#28262C' },
];
const subjects = [
  'Psychologia',
  'Podstawy dietetyki',
  'Anatomia',
  'Fizjologia',
  'Biomechanika',
  'Kinezyterapia',
  'Genetyka',
  'Pierwsza pomoc',
];
const normalize = (title: string) => title.trim().toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ');

// A subject's color never depends on its position, date, group or class type.
export function subjectPalette(title: string): SubjectPalette {
  const key = normalize(title);
  const known = subjects.findIndex((subject) => normalize(subject) === key);
  if (known >= 0) return palettes[known];
  let hash = 0;
  for (const character of key) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return palettes[hash % palettes.length];
}

export interface LessonBlock {
  id: string;
  lesson: Lesson;
  slots: Lesson[];
  start: string;
  end: string;
  teachingMinutes: number;
}
function sameClass(a: Lesson, b: Lesson) {
  return (
    a.date === b.date &&
    normalize(a.title) === normalize(b.title) &&
    a.type === b.type &&
    a.group === b.group &&
    a.location === b.location &&
    a.teacher === b.teacher &&
    a.online === b.online &&
    a.canceled === b.canceled
  );
}

// Group the complete chronological day before filtering: hiding another subject
// must never join blocks that were separated by a different class.
export function groupLessonBlocks(lessons: readonly Lesson[]): LessonBlock[] {
  const sorted = [...lessons].sort((a, b) =>
    `${a.date} ${a.start} ${a.end}`.localeCompare(`${b.date} ${b.start} ${b.end}`),
  );
  const blocks: LessonBlock[] = [];
  for (const lesson of sorted) {
    const previous = blocks.at(-1);
    const duration = minutes(lesson.end) - minutes(lesson.start);
    if (previous && sameClass(previous.lesson, lesson) && previous.end <= lesson.start) {
      previous.slots.push(lesson);
      previous.end = lesson.end;
      previous.teachingMinutes += duration;
    } else {
      blocks.push({
        id: lesson.id,
        lesson,
        slots: [lesson],
        start: lesson.start,
        end: lesson.end,
        teachingMinutes: duration,
      });
    }
  }
  return blocks;
}
