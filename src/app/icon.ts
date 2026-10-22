import { Component, input } from '@angular/core';
const paths: Record<string, string> = {
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  calendar:
    'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8 14h2m4 0h2m-8 4h2m4 0h2',
  clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  user: 'M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  left: 'm14 6-6 6 6 6',
  right: 'm10 6 6 6-6 6',
  down: 'm6 9 6 6 6-6',
  more: 'M4 12h1M11.5 12h1M19 12h1',
  filter: 'M4 7h5m4 0h7M4 17h9m4 0h3M9 4v6m4 4v6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  refresh:
    'M20 7v5h-5M4 17v-5h5M6.09 7a7 7 0 0 1 11.55-2.61L20 7M4 17l2.36 2.61A7 7 0 0 0 17.91 17',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  external: 'M15 3h6v6m0-6L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
  check: 'm5 12 4 4L19 6',
  coffee: 'M18 8h2a3 3 0 1 1 0 6h-2M3 8h15v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8m3-6v3m4-3v3m4-3v3',
  close: 'm6 6 12 12M6 18 18 6',
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  book: 'M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H3V4a1 1 0 0 1 1-1m9 3a3 3 0 0 1 3-3h5v16h-4a4 4 0 0 0-4 2',
  video: 'M16 8l6-4v16l-6-4M3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',
  leaf: 'M20 3C8 2 3 6 4 14s12 9 16-11M4 21 15 10',
  alert:
    'M12 8v5m0 4h.01M10.3 3.9 1.8 18.6A2 2 0 0 0 3.5 22h17a2 2 0 0 0 1.7-3.4L13.7 3.9a2 2 0 0 0-3.4 0',
};
@Component({
  selector: 'app-icon',
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()"/></svg>',
  styles:
    ':host{display:inline-flex;width:20px;height:20px;flex-shrink:0;vertical-align:middle}svg{width:100%;height:100%}',
})
export class Icon {
  name = input('calendar');
  path = () => paths[this.name()] ?? paths['info'];
}
