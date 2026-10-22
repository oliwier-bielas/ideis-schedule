import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { Icon } from './icon';
import { LessonDetails } from './lesson-details';
import { environment } from '../environments/environment';
import {
  defaultWeekend,
  isActive,
  Lesson,
  liveStatus,
  minutes,
  Schedule,
  shiftDate,
  warsawNow,
} from './schedule';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatTooltipModule, MatProgressBarModule, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private readonly dialog = inject(MatDialog);
  readonly now = signal(warsawNow());
  readonly schedule = signal<Schedule | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly stale = signal(false);
  readonly weekend = signal(defaultWeekend(this.now().date));
  readonly selectedDay = signal(0);
  readonly filter = signal('all');
  readonly query = signal('');
  readonly view = signal<'calendar' | 'list'>('calendar');
  readonly source = 'https://harmonogramy.ideis.pl/Plany/PlanyTokow/1516';
  readonly staticSchedule = environment.staticSchedule;
  private timer = setInterval(() => this.now.set(warsawNow()), 15_000);
  private controller?: AbortController;
  private destroyed = false;
  readonly lessons = computed(() => this.schedule()?.lessons ?? []);
  readonly live = computed(() => liveStatus(this.lessons(), this.now()));
  readonly featured = computed(() => this.live().current ?? this.live().next);
  readonly days = computed(() =>
    [0, 1, 2].map((index) => {
      const date = shiftDate(this.weekend(), index);
      const lessons = this.lessons().filter(
        (l) =>
          l.date === date &&
          (this.filter() === 'all' || l.type === this.filter()) &&
          `${l.title} ${l.teacher} ${l.location}`
            .toLocaleLowerCase('pl-PL')
            .includes(this.query().toLocaleLowerCase('pl-PL').trim()),
      );
      return {
        date,
        index,
        name: ['Piątek', 'Sobota', 'Niedziela'][index],
        short: ['Pt', 'Sob', 'Nd'][index],
        lessons,
      };
    }),
  );
  readonly weekendLessons = computed(() =>
    this.lessons().filter(
      (l) => l.date >= this.weekend() && l.date <= shiftDate(this.weekend(), 2) && !l.canceled,
    ),
  );
  readonly totalHours = computed(() =>
    new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(
      this.weekendLessons().reduce((sum, l) => sum + minutes(l.end) - minutes(l.start), 0) / 60,
    ),
  );
  readonly dayCount = computed(() => new Set(this.weekendLessons().map((l) => l.date)).size);
  readonly focusedDay = computed(() => this.days()[this.selectedDay()]);
  readonly timelineStart = computed(() =>
    Math.min(8, ...this.weekendLessons().map((l) => Math.floor(minutes(l.start) / 60))),
  );
  readonly timelineEnd = computed(() =>
    Math.max(20, ...this.weekendLessons().map((l) => Math.ceil(minutes(l.end) / 60))),
  );
  readonly timelineHours = computed(() =>
    Array.from(
      { length: this.timelineEnd() - this.timelineStart() + 1 },
      (_, i) => this.timelineStart() + i,
    ),
  );
  readonly timelineHeight = computed(() => (this.timelineEnd() - this.timelineStart()) * 64);
  eventTop(lesson: Lesson) {
    return ((minutes(lesson.start) - this.timelineStart() * 60) / 60) * 64;
  }
  eventHeight(lesson: Lesson) {
    return Math.max(50, ((minutes(lesson.end) - minutes(lesson.start)) / 60) * 64 - 4);
  }
  readonly progress = computed(() => {
    const l = this.live().current;
    return l
      ? ((minutes(this.now().time) - minutes(l.start)) / (minutes(l.end) - minutes(l.start))) * 100
      : 0;
  });
  readonly statusHeading = computed(() => {
    const live = this.live();
    if (live.current) return 'Jesteś we właściwym miejscu.';
    if (live.state === 'break') return 'Chwila oddechu między zajęciami.';
    if (live.state === 'before') return `Zaczynasz dziś o ${live.next!.start}.`;
    if (live.state === 'finished') return 'Na dziś koniec zajęć.';
    if (live.next) return 'Przed Tobą kolejny zjazd.';
    return 'Dziś możesz złapać oddech.';
  });
  readonly remaining = computed(() => {
    const live = this.live();
    if (live.current) return `Do końca ${minutes(live.current.end) - minutes(this.now().time)} min`;
    if (live.next?.date === this.now().date)
      return `Za ${minutes(live.next.start) - minutes(this.now().time)} min`;
    return live.next
      ? `${this.dateLabel(live.next.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${live.next.start}`
      : 'Czas dla Ciebie';
  });
  readonly weekendLabel = computed(() => {
    const end = shiftDate(this.weekend(), 2);
    return this.weekend().slice(0, 7) === end.slice(0, 7)
      ? `${this.dateLabel(this.weekend(), { day: 'numeric' })}–${this.dateLabel(end, { day: 'numeric', month: 'long', year: 'numeric' })}`
      : `${this.dateLabel(this.weekend(), { day: 'numeric', month: 'long' })} – ${this.dateLabel(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
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
        localStorage.setItem('fizjoplan:schedule:v1', JSON.stringify(data));
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
          const saved = localStorage.getItem('fizjoplan:schedule:v1');
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
          !['1', '1A', 'all'].includes(l.group) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(l.date) ||
          !/^\d{2}:\d{2}$/.test(l.start) ||
          !/^\d{2}:\d{2}$/.test(l.end),
      )
    )
      throw new Error('Odpowiedź zawiera nierozpoznaną grupę lub format zajęć.');
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
    this.selectedDay.set(today?.index ?? this.days().find((d) => d.lessons.length)?.index ?? 0);
  }
  setFilter(value: string) {
    this.filter.set(value);
    this.pickDefaultDay();
  }
  active(lesson: Lesson) {
    return isActive(lesson, this.now());
  }
  past(lesson: Lesson) {
    return `${lesson.date} ${lesson.end}` <= `${this.now().date} ${this.now().time}`;
  }
  gap(previous: Lesson, next: Lesson) {
    return Math.max(0, minutes(next.start) - minutes(previous.end));
  }
  duration(lesson: Lesson) {
    const m = minutes(lesson.end) - minutes(lesson.start);
    return m >= 60
      ? `${Math.floor(m / 60)} godz.${m % 60 ? ' ' + (m % 60) + ' min' : ''}`
      : `${m} min`;
  }
  room(lesson: Lesson) {
    return lesson.location.split(' - ')[0];
  }
  typeClass(lesson: Lesson) {
    return lesson.type === 'Wykład'
      ? 'lecture'
      : lesson.type === 'Laboratorium'
        ? 'lab'
        : 'exercise';
  }
  nextGap() {
    const { current, next } = this.live();
    return current && next?.date === current.date ? this.gap(current, next) : 0;
  }
  showDetails(lesson: Lesson) {
    this.dialog.open(LessonDetails, {
      data: lesson,
      panelClass: 'lesson-dialog',
      width: '450px',
      maxWidth: '100vw',
      height: '100dvh',
      position: { right: '0', top: '0' },
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabel: 'Szczegóły zajęć: ' + lesson.title,
    });
  }
  exportCsv() {
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
    link.download = `FizjoPlan_${this.weekend()}_1-1A.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
