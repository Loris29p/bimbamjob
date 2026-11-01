// Recherche de communes via la Base Adresse Nationale (api-adresse.data.gouv.fr),
// le service officiel et gratuit de l'État.
import type { Place } from './types';

const BASE = 'https://api-adresse.data.gouv.fr';

type Feature = {
  geometry: { coordinates: [number, number] };
  properties: { label: string; city?: string; name?: string; context?: string; citycode?: string; postcode?: string };
};

function toPlace(f: Feature): Place {
  const p = f.properties;
  const department = p.context?.split(',')[0]?.trim();
  return {
    name: p.city ?? p.name ?? p.label,
    department,
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
  };
}

export async function searchCities(query: string): Promise<(Place & { label: string })[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`${BASE}/search/?q=${encodeURIComponent(query)}&type=municipality&limit=10`);
  if (!res.ok) throw new Error('Recherche indisponible');
  const json = await res.json();
  return (json.features as Feature[]).map((f) => ({
    ...toPlace(f),
    label: `${f.properties.city ?? f.properties.name} (${f.properties.postcode ?? f.properties.context ?? ''})`,
  }));
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<Place> {
  try {
    const res = await fetch(`${BASE}/reverse/?lon=${longitude}&lat=${latitude}&type=municipality`);
    const json = await res.json();
    const f = (json.features as Feature[])[0];
    if (f) return { ...toPlace(f), latitude, longitude };
  } catch {
    // on garde la position sans nom
  }
  return { name: 'Ma position', latitude, longitude };
}
