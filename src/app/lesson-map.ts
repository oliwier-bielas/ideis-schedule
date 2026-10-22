import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { CampusBuilding, campusMapEmbedUrl, campusNavigationUrl } from './campus-location';
import { Icon } from './icon';

@Component({
  selector: 'app-lesson-map',
  imports: [MatButtonModule, Icon],
  template: `
    <section class="lesson-map" aria-label="Dojazd na zajęcia">
      <div class="map-heading">
        <span>{{ building().name }}</span
        ><small>{{ building().code }}</small>
      </div>
      <a
        class="map-preview"
        [href]="navigationUrl()"
        target="_blank"
        rel="noopener noreferrer"
        [attr.aria-label]="'Wyznacz trasę w Google Maps: ' + building().street + ', Wrocław'"
      >
        <iframe
          [src]="embedUrl()"
          [title]="'Mapa: ' + building().street + ', Wrocław'"
          loading="lazy"
          referrerpolicy="no-referrer"
          tabindex="-1"
          aria-hidden="true"
        ></iframe>
        <span class="map-preview-label"
          ><app-icon name="pin" /> Wyznacz trasę <app-icon name="external"
        /></span>
      </a>
      <div class="map-address">
        <strong>{{ building().street }}</strong
        ><span>Wrocław</span>
      </div>
      <a
        class="navigate-button"
        mat-stroked-button
        [href]="navigationUrl()"
        target="_blank"
        rel="noopener noreferrer"
        ><app-icon name="arrow" />Nawiguj w Google Maps</a
      >
      <div class="map-attribution">
        Mapa:
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
          >© OpenStreetMap contributors</a
        >
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .lesson-map {
      margin: 0;
      padding: 0;
      background: #191c23;
      border: 0;
      border-radius: 0;
    }
    .map-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      color: #eef1f5;
      font-size: 12px;
      font-weight: 500;
      small {
        color: #7d8798;
        font-size: 10px;
        font-weight: 400;
      }
    }
    .map-preview {
      position: relative;
      display: block;
      height: 154px;
      overflow: hidden;
      isolation: isolate;
      border-radius: 8px;
      background: #20242d;
      border: 1px solid #2c323d;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      pointer-events: none;
      filter: grayscale(0.85) invert(0.9) hue-rotate(170deg) brightness(0.85);
    }
    .map-preview-label {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 9px;
      border: 1px solid #2c323d;
      border-radius: 6px;
      background: #191c23f2;
      color: #a8b8ef;
      font-size: 10px;
      box-shadow: 0 3px 12px #0003;
      transition: background 180ms;
      app-icon {
        width: 13px;
        height: 13px;
        &:last-child {
          width: 11px;
          height: 11px;
        }
      }
    }
    .map-preview:hover .map-preview-label {
      background: #272c36;
    }
    .map-address {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 7px;
      padding: 13px 0;
      strong {
        font-size: 12px;
        font-weight: 500;
        color: #eef1f5;
      }
      span {
        font-size: 11px;
        color: #a6aebc;
      }
    }
    .navigate-button {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      border-color: #2c323d;
      color: #a8b8ef;
      font-size: 12px;
      letter-spacing: 0;
      white-space: nowrap;
      padding: 0 8px;
      app-icon {
        width: 15px;
        height: 15px;
      }
    }
    .map-attribution {
      margin-top: 10px;
      text-align: right;
      color: #7d8798;
      font-size: 9px;
      line-height: 1.6;
      a {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
    @media (max-width: 360px) {
      .lesson-map {
        padding: 0;
      }
      .map-preview {
        height: 140px;
      }
      .navigate-button {
        font-size: 11px;
      }
    }
  `,
})
export class LessonMap {
  readonly building = input.required<CampusBuilding>();
  private readonly sanitizer = inject(DomSanitizer);
  readonly navigationUrl = computed(() => campusNavigationUrl(this.building()));
  // Only the fixed OSM embed origin and our verified, numeric campus positions
  // enter this resource URL; no room text or user-supplied URL is trusted.
  readonly embedUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(campusMapEmbedUrl(this.building())),
  );
}
