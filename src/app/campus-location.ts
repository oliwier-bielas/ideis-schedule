import { Lesson } from './schedule';

export interface CampusBuilding {
  readonly code: 'S55' | 'S47' | 'W1';
  readonly name: string;
  readonly street: string;
  readonly latitude: number;
  readonly longitude: number;
}

// Addresses supplied by the user. Positions verified against the DSW campus
// POIs in OpenStreetMap (nodes 14143260187, 6157589845 and 14143260188).
export const CAMPUS_BUILDINGS: readonly CampusBuilding[] = [
  {
    code: 'S55',
    name: 'Gmach Główny',
    street: 'ul. Strzegomska 55',
    latitude: 51.1142984,
    longitude: 16.9926546,
  },
  {
    code: 'S47',
    name: 'Budynek S47',
    street: 'ul. Strzegomska 47',
    latitude: 51.1141182,
    longitude: 16.9966415,
  },
  {
    code: 'W1',
    name: 'Budynek W1',
    street: 'ul. Wagonowa 1',
    latitude: 51.1135976,
    longitude: 16.988142,
  },
];

const aliases: Record<CampusBuilding['code'], RegExp> = {
  S55: /(?:\bs\s*55\b|\bgmach glowny\b|\bstrzegomska\s+55\b)/,
  S47: /(?:\bs\s*47\b|\bstrzegomska\s+47\b)/,
  W1: /(?:\bw\s*1\b|\bwagonowa\s+1\b)/,
};

export function findCampusBuilding(
  lesson: Pick<Lesson, 'location' | 'online'>,
): CampusBuilding | null {
  if (lesson.online) return null;
  const location = lesson.location
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replaceAll('ł', 'l')
    .replaceAll('Ł', 'L')
    .toLowerCase();
  if (/\b(?:zdalne|online|distance learning)\b/.test(location)) return null;
  const matches = CAMPUS_BUILDINGS.filter((building) => aliases[building.code].test(location));
  // Do not guess when a room is unknown or several campus buildings are listed.
  return matches.length === 1 ? matches[0] : null;
}

export function campusNavigationUrl(building: CampusBuilding): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  // A textual address can resolve to the whole street in Google Maps. Use the
  // verified campus POI position so the building number cannot be discarded.
  url.searchParams.set('destination', `${building.latitude},${building.longitude}`);
  url.searchParams.set('dir_action', 'navigate');
  // Let Google Maps use the device's position and preferred transport mode.
  return url.href;
}

export function campusMapEmbedUrl(building: CampusBuilding): string {
  const { latitude: lat, longitude: lng } = building;
  const url = new URL('https://www.openstreetmap.org/export/embed.html');
  url.searchParams.set(
    'bbox',
    [lng - 0.003, lat - 0.0012, lng + 0.003, lat + 0.0012].map((n) => n.toFixed(7)).join(','),
  );
  url.searchParams.set('layer', 'mapnik');
  url.searchParams.set('marker', `${lat},${lng}`);
  return url.href;
}
