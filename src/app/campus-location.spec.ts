import { describe, expect, it } from 'vitest';
import {
  CAMPUS_BUILDINGS,
  campusMapEmbedUrl,
  campusNavigationUrl,
  findCampusBuilding,
} from './campus-location';

describe('campus directions', () => {
  it('recognizes IDEIS building tokens and the supplied full building names', () => {
    for (const [location, code] of [
      ['S55 410 - prac. anatomii i fizjologii człowieka/dietetyki', 'S55'],
      ['S47 8', 'S47'],
      ['W1 201', 'W1'],
      ['Budynek S47, sala 316', 'S47'],
      ['Gmach Główny', 'S55'],
      ['ul. Strzegomska 55', 'S55'],
      ['ul. Wagonowa 1', 'W1'],
    ])
      expect(findCampusBuilding({ location, online: false })?.code).toBe(code);
  });
  it('does not route remote classes, unknown buildings or ambiguous locations', () => {
    expect(findCampusBuilding({ location: 'S55 410', online: true })).toBeNull();
    for (const location of [
      '',
      'Zajęcia zdalne',
      'S55 online',
      'F14 B8',
      'S2-4 A4',
      'S550 12',
      'S470 1',
      'W10 9',
      'S55 410 / S47 316',
    ]) {
      expect(findCampusBuilding({ location, online: false }), location).toBeNull();
    }
  });
  it('opens Google Maps with the full street address, building number, city and country', () => {
    const addresses = {
      S55: 'ul. Strzegomska 55, Wrocław, Polska',
      S47: 'ul. Strzegomska 47, Wrocław, Polska',
      W1: 'ul. Wagonowa 1, Wrocław, Polska',
    };
    for (const building of CAMPUS_BUILDINGS) {
      const url = new URL(campusNavigationUrl(building));
      expect(url.origin).toBe('https://www.google.com');
      expect(url.pathname).toBe('/maps/dir/');
      expect(url.searchParams.get('api')).toBe('1');
      expect(url.searchParams.get('destination')).toBe(addresses[building.code]);
      expect(url.searchParams.get('destination_place_id')).toBe(building.googlePlaceId);
      expect(url.searchParams.get('dir_action')).toBe('navigate');
      expect(url.searchParams.has('origin')).toBe(false);
    }
    expect(new Set(CAMPUS_BUILDINGS.map((building) => building.googlePlaceId)).size).toBe(3);
  });
  it('uses the known campus position for the map preview', () => {
    for (const building of CAMPUS_BUILDINGS) {
      const url = new URL(campusMapEmbedUrl(building));
      expect(url.origin).toBe('https://www.openstreetmap.org');
      expect(url.searchParams.get('marker')).toBe(`${building.latitude},${building.longitude}`);
      expect(url.searchParams.get('bbox')!.split(',').map(Number).every(Number.isFinite)).toBe(
        true,
      );
    }
  });
});
