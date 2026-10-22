import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Icon } from './icon';
import { Lesson } from './schedule';
import { findCampusBuilding } from './campus-location';
import { LessonMap } from './lesson-map';
@Component({
  selector: 'app-lesson-details',
  imports: [MatDialogModule, MatButtonModule, Icon, LessonMap],
  template: ` <div class="detail-heading">
      <span class="eyebrow">SZCZEGÓŁY ZAJĘĆ</span
      ><button mat-icon-button mat-dialog-close aria-label="Zamknij szczegóły">
        <app-icon name="close" />
      </button>
    </div>
    <div class="detail-body">
      <span class="detail-type"
        >{{ lesson.type }} ·
        {{ lesson.group === 'all' ? 'Wykład wspólny' : 'Grupa ' + lesson.group }}</span
      >
      <h2 mat-dialog-title>{{ lesson.title }}</h2>
      <mat-dialog-content>
        @if (lesson.canceled) {
          <p class="cancel-note">Zajęcia odwołane</p>
        }
        <div class="detail-row">
          <app-icon name="calendar" />
          <div>
            <small>Data</small><strong>{{ date }}</strong>
          </div>
        </div>
        <div class="detail-row">
          <app-icon name="clock" />
          <div>
            <small>Godziny</small><strong>{{ lesson.start }}–{{ lesson.end }}</strong>
          </div>
        </div>
        <div class="detail-row">
          <app-icon [name]="lesson.online ? 'video' : 'pin'" />
          <div>
            <small>Sala i budynek</small><strong>{{ lesson.location }}</strong>
          </div>
        </div>
        @if (building) {
          <app-lesson-map [building]="building" />
        }
        <div class="detail-row">
          <app-icon name="user" />
          <div>
            <small>Prowadzący</small><strong>{{ lesson.teacher }}</strong>
          </div>
        </div>
        <div class="detail-row">
          <app-icon name="book" />
          <div>
            <small>Forma zaliczenia</small><strong>{{ lesson.assessment || 'Nie podano' }}</strong>
          </div>
        </div>
        @if (lesson.notes) {
          <div class="detail-note">
            <app-icon name="info" />
            <p>{{ lesson.notes }}</p>
          </div>
        }
        <p class="detail-source">{{ lesson.sourceGroup }}</p>
      </mat-dialog-content>
      <mat-dialog-actions
        ><button mat-flat-button mat-dialog-close>Wróć do planu</button></mat-dialog-actions
      >
    </div>`,
})
export class LessonDetails {
  readonly lesson = inject<Lesson>(MAT_DIALOG_DATA);
  readonly building = findCampusBuilding(this.lesson);
  readonly date = new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(this.lesson.date + 'T12:00:00Z'));
}
