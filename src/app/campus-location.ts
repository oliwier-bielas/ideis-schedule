import { Lesson } from './schedule';

export interface CampusBuilding {
  readonly code: 'S55' | 'S47' | 'W1';
  readonly name: string;
  readonly street: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly googlePlaceId: string;
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
    googlePlaceId: 'ChIJHTLq-PvBD0cRvlKluBaHqvA',
  },
  {
    code: 'S47',
    name: 'Budynek S47',
    street: 'ul. Strzegomska 47',
    latitude: 51.1141182,
    longitude: 16.9966415,
    googlePlaceId: 'ChIJt3Zwcf_BD0cRmoQqUH3knyc',
  },
  {
    code: 'W1',
    name: 'Budynek W1',
    street: 'ul. Wagonowa 1',
    latitude: 51.1135976,
    longitude: 16.988142,
    googlePlaceId: 'ChIJyVr4SSfBD0cRPnz9VdiwW3E',
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
  // Pass the complete street address, including the building number, city and
  // country, so Google Maps receives the address the student sees in the app.
  url.searchParams.set('destination', `${building.street}, Wrocław, Polska`);
  // Google can drop the house number when geocoding the address alone. These
  // IDs were verified on Google Maps against each building's displayed address.
  url.searchParams.set('destination_place_id', building.googlePlaceId);
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
