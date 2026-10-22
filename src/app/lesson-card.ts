import { Component, computed, input, signal } from '@angular/core';
import { Icon } from './icon';
import { LessonMap } from './lesson-map';
import { findCampusBuilding } from './campus-location';
import { LessonBlock, subjectPalette } from './lesson-presentation';
import { isActive, minutes, warsawNow } from './schedule';

@Component({
  selector: 'app-lesson-card',
  imports: [Icon, LessonMap],
  template: `
    <article
      class="lesson-card"
      [attr.data-group]="block().lesson.group"
      [class.is-live]="active()"
      [class.is-canceled]="block().lesson.canceled"
      [style.--subject-color]="palette().color"
      [style.--subject-background]="palette().background"
    >
      <button
        class="lesson-summary"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="'details-' + block().id"
        [attr.aria-label]="
          block().lesson.title + ', ' + block().start + '–' + block().end + ', ' + location()
        "
      >
        <span class="lesson-meta"
          ><span class="lesson-time">{{ block().start }}–{{ block().end }}</span>
          <span class="lesson-type">{{ block().lesson.type }}</span></span
        >
        <span class="lesson-title">{{ block().lesson.title }}</span>
        <span class="lesson-bottom"
          ><span class="lesson-location"
            ><app-icon [name]="block().lesson.online ? 'video' : 'pin'" />{{ location() }}</span
          >
          <app-icon class="expand-icon" [class.is-expanded]="expanded()" name="down"
        /></span>
        @if (block().slots.length > 1 || active() || block().lesson.canceled) {
          <span class="lesson-tags">
            @if (block().slots.length > 1) {
              <span
                >{{ block().slots.length }} {{ block().slots.length < 5 ? 'bloki' : 'bloków'
                }}{{ hasBreak() ? ' · z przerwą' : '' }}</span
              >
            }
            @if (active()) {
              <span class="live-tag">Trwa teraz</span>
            }
            @if (block().lesson.canceled) {
              <span class="cancel-tag">Odwołane</span>
            }
          </span>
        }
      </button>
      @if (expanded()) {
        <div class="lesson-details" [id]="'details-' + block().id">
          <p class="teacher">{{ block().lesson.teacher || 'Prowadzący niepodany' }}</p>
          <p class="detail-caption">
            {{ block().teachingMinutes }} min zajęć ·
            {{
              block().lesson.group === 'all' ? 'Zajęcia wspólne' : 'Grupa ' + block().lesson.group
            }}
          </p>
          <div class="block-list" aria-label="Bloki zajęć">
            @for (slot of block().slots; track slot.id; let index = $index) {
              @if (index > 0 && gap(index) > 0) {
                <div class="block-break">
                  <app-icon name="coffee" />{{ gap(index) }} min przerwy
                </div>
              }
              <div class="block-row">
                <span>Blok {{ index + 1 }}</span
                ><time>{{ slot.start }}–{{ slot.end }}</time>
              </div>
            }
          </div>
          @if (!block().lesson.online) {
            <p class="full-location"><app-icon name="pin" />{{ block().lesson.location }}</p>
          }
          @if (assessment()) {
            <p class="detail-caption">{{ assessment() }}</p>
          }
          @if (notes()) {
            <p class="lesson-notes"><app-icon name="info" />{{ notes() }}</p>
          }
          @if (building(); as campus) {
            <app-lesson-map [building]="campus" />
          }
        </div>
      }
    </article>
  `,
  styleUrl: './lesson-card.scss',
})
export class LessonCard {
  readonly block = input.required<LessonBlock>();
  readonly now = input.required<ReturnType<typeof warsawNow>>();
  readonly expanded = signal(false);
  readonly palette = computed(() => subjectPalette(this.block().lesson.title));
  readonly active = computed(() => this.block().slots.some((slot) => isActive(slot, this.now())));
  readonly hasBreak = computed(() =>
    this.block().slots.some((slot, index, slots) => index > 0 && slot.start > slots[index - 1].end),
  );
  readonly location = computed(() =>
    this.block().lesson.online ? 'Zajęcia online' : this.block().lesson.location.split(' - ')[0],
  );
  readonly building = computed(() => findCampusBuilding(this.block().lesson));
  readonly notes = computed(() =>
    [
      ...new Set(
        this.block()
          .slots.map((slot) => slot.notes)
          .filter(Boolean),
      ),
    ].join(' · '),
  );
  readonly assessment = computed(() =>
    [
      ...new Set(
        this.block()
          .slots.map((slot) => slot.assessment)
          .filter(Boolean),
      ),
    ].join(' · '),
  );
  gap(index: number) {
    return Math.max(
      0,
      minutes(this.block().slots[index].start) - minutes(this.block().slots[index - 1].end),
    );
  }
}
