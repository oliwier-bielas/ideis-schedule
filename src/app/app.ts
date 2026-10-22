import { Component, computed, OnDestroy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { Icon } from './icon';
import { LessonCard } from './lesson-card';
import { groupLessonBlocks, LessonBlock, subjectPalette } from './lesson-presentation';
import { environment } from '../environments/environment';
import {
  lessonsForGroup,
  parseSubgroup,
  readSavedGroup,
  saveGroup,
  SCHEDULE_STORAGE_KEY,
} from './group-selection';
import {
  defaultWeekend,
  Lesson,
  liveStatus,
  minutes,
  Schedule,
  shiftDate,
  warsawNow,
} from './schedule';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatProgressBarModule, MatMenuModule, Icon, LessonCard],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  readonly selectedGroup = signal(readSavedGroup());
  readonly preferenceSaved = signal(true);
  readonly now = signal(warsawNow());
  readonly schedule = signal<Schedule | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly stale = signal(false);
  readonly weekend = signal(defaultWeekend(this.now().date));
  readonly selectedDay = signal(0);
  readonly filter = signal('all');
  readonly filterTypes = ['Wykład', 'Ćwiczenia', 'Laboratorium'];
  readonly source = 'https://harmonogramy.ideis.pl/Plany/PlanyTokow/1516';
  readonly staticSchedule = environment.staticSchedule;
  private timer = setInterval(() => this.now.set(warsawNow()), 15_000);
  private controller?: AbortController;
  private destroyed = false;
  readonly lessons = computed(() =>
    lessonsForGroup(this.schedule()?.lessons ?? [], this.selectedGroup()),
  );
  readonly live = computed(() => liveStatus(this.lessons(), this.now()));
  readonly featured = computed(() => this.live().current ?? this.live().next);
  readonly featuredPalette = computed(() => subjectPalette(this.featured()?.title ?? ''));
  readonly isNearestWeekend = computed(() => this.weekend() === defaultWeekend(this.now().date));
  readonly days = computed(() =>
    [0, 1, 2].map((index) => {
      const date = shiftDate(this.weekend(), index);
      const blocks = groupLessonBlocks(this.lessons().filter((l) => l.date === date));
      const filtered = blocks.filter(
        (block) => this.filter() === 'all' || block.lesson.type === this.filter(),
      );
      return {
        date,
        index,
        name: ['Piątek', 'Sobota', 'Niedziela'][index],
        short: ['Pt', 'Sob', 'Ndz'][index],
        blocks: filtered,
        count: filtered.reduce((sum, block) => sum + block.slots.length, 0),
      };
    }),
  );
  readonly weekendLessons = computed(() =>
    this.lessons().filter(
      (l) => l.date >= this.weekend() && l.date <= shiftDate(this.weekend(), 2) && !l.canceled,
    ),
  );
  readonly visibleCount = computed(() => this.days().reduce((sum, day) => sum + day.count, 0));
  readonly focusedDay = computed(() => this.days()[this.selectedDay()]);
  readonly progress = computed(() => {
    const l = this.live().current;
    return l
      ? ((minutes(this.now().time) - minutes(l.start)) / (minutes(l.end) - minutes(l.start))) * 100
      : 0;
  });
  readonly remaining = computed(() => {
    const live = this.live();
    if (live.current)
      return `Pozostało ${minutes(live.current.end) - minutes(this.now().time)} min`;
    if (live.next?.date === this.now().date)
      return `Za ${minutes(live.next.start) - minutes(this.now().time)} min`;
    return '';
  });
  readonly weekendLabel = computed(() => {
    const end = shiftDate(this.weekend(), 2);
    return this.weekend().slice(0, 7) === end.slice(0, 7)
      ? `${this.dateLabel(this.weekend(), { day: 'numeric' })}–${this.dateLabel(end, { day: 'numeric', month: 'long' })}`
      : `${this.dateLabel(this.weekend(), { day: 'numeric', month: 'long' })} – ${this.dateLabel(end, { day: 'numeric', month: 'long' })}`;
  });
  readonly outsideSemester = computed(
    () =>
      !!this.schedule() &&
      (this.weekend() > this.schedule()!.semester.to ||
        shiftDate(this.weekend(), 2) < this.schedule()!.semester.from),
  );
  constructor() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearInterval(this.timer);
    this.controller?.abort();
  }
  async load() {
    if (this.controller) return;
    this.loading.set(true);
    this.error.set('');
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 95_000);
    try {
      const response = await fetch(new URL(environment.schedulePath, document.baseURI), {
        signal: controller.signal,
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Serwer harmonogramu jest niedostępny.');
      this.acceptSchedule(data);
      this.stale.set(false);
      try {
        localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* Storage is optional. */
      }
    } catch (error) {
      if (this.destroyed) return;
      this.error.set(
        error instanceof Error && error.name !== 'AbortError'
          ? error.message
          : 'Pobieranie przekroczyło limit czasu. Spróbuj ponownie.',
      );
      if (!this.schedule()) {
        try {
          const saved = localStorage.getItem(SCHEDULE_STORAGE_KEY);
          if (saved) this.acceptSchedule(JSON.parse(saved));
        } catch {
          /* No valid offline copy. */
        }
      }
      this.stale.set(!!this.schedule());
    } finally {
      clearTimeout(timeout);
      this.controller = undefined;
      this.loading.set(false);
    }
  }
  private acceptSchedule(data: Schedule) {
    if (!Array.isArray(data.lessons) || !data.semester || !data.fetchedAt)
      throw new Error('Nieprawidłowa odpowiedź serwera.');
    if (
      data.lessons.some(
        (l) =>
          !['1', '1A', '1B', 'all'].includes(l.group) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(l.date) ||
          !/^\d{2}:\d{2}$/.test(l.start) ||
          !/^\d{2}:\d{2}$/.test(l.end),
      )
    )
      throw new Error('Odpowiedź zawiera nierozpoznaną grupę lub format zajęć.');
    if (!['1A', '1B'].every((group) => data.lessons.some((lesson) => lesson.group === group)))
      throw new Error(
        'Plan nie zawiera danych obu grup 1A i 1B. Wymagana jest ponowna synchronizacja.',
      );
    this.schedule.set(data);
    this.pickDefaultDay();
  }
  dateLabel(date: string, options: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat('pl-PL', { ...options, timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  }
  syncLabel() {
    const value = this.schedule()?.fetchedAt;
    return value
      ? new Intl.DateTimeFormat('pl-PL', {
          timeZone: 'Europe/Warsaw',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(value))
      : '';
  }
  moveWeekend(direction: number) {
    this.weekend.update((date) => shiftDate(date, direction * 7));
    this.pickDefaultDay();
  }
  resetWeekend() {
    this.weekend.set(defaultWeekend(this.now().date));
    this.pickDefaultDay();
  }
  private pickDefaultDay() {
    const today = this.days().find((d) => d.date === this.now().date);
    this.selectedDay.set(today?.index ?? this.days().find((d) => d.count)?.index ?? 0);
  }
  setFilter(value: string) {
    this.filter.set(value);
  }
  chooseGroup(value: unknown) {
    const group = parseSubgroup(value);
    if (!group) return;
    const firstChoice = !this.selectedGroup();
    this.selectedGroup.set(group);
    this.preferenceSaved.set(saveGroup(group));
    if (firstChoice) this.pickDefaultDay();
  }
  onDayKey(event: KeyboardEvent, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % 3;
    else if (event.key === 'ArrowLeft') next = (index + 2) % 3;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 2;
    else return;
    event.preventDefault();
    this.selectedDay.set(next);
    document.getElementById(`tab-${next}`)?.focus();
  }
  room(lesson: Lesson) {
    return lesson.online ? 'Zajęcia online' : lesson.location.split(' - ')[0];
  }
  gap(previous: LessonBlock, next: LessonBlock) {
    if (previous.lesson.canceled || next.lesson.canceled) return 0;
    // A hidden class is not a break when a type filter is active.
    if (
      this.lessons().some(
        (lesson) =>
          !lesson.canceled &&
          lesson.date === previous.lesson.date &&
          lesson.start < next.start &&
          lesson.end > previous.end,
      )
    )
      return 0;
    return Math.max(0, minutes(next.start) - minutes(previous.end));
  }
  relativeDate(date: string) {
    if (date === this.now().date) return 'Dzisiaj';
    if (date === shiftDate(this.now().date, 1)) return 'Jutro';
    return this.dateLabel(date, { day: 'numeric', month: 'long' });
  }
  lessonCount(count: number) {
    return `${count} ${count === 1 ? 'blok zajęć' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'bloki zajęć' : 'bloków zajęć'}`;
  }
  exportCsv() {
    if (!this.selectedGroup()) return;
    const cell = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const rows = [
      ['Data', 'Od', 'Do', 'Przedmiot', 'Forma', 'Grupa', 'Sala', 'Prowadzący', 'Uwagi'],
      ...this.weekendLessons().map((l) => [
        l.date,
        l.start,
        l.end,
        l.title,
        l.type,
        l.group === 'all' ? 'Wykład wspólny' : l.group,
        l.location,
        l.teacher,
        l.notes,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `FizjoPlan_${this.weekend()}_1-${this.selectedGroup()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
