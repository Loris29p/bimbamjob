// Mesures réelles des stations Météo-France (API « Données Publiques Observation »).
// Une mesure toutes les 6 minutes. Même clé API que les vigilances :
// sur portail-api.meteofrance.fr, abonne ton application aux deux API.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from './types';

const BASE = 'https://public-api.meteofrance.fr/public/DPObs/v1';
const KEY = process.env.EXPO_PUBLIC_METEOFRANCE_API_KEY;
const STATIONS_CACHE = 'mf-stations-v1';

export type Station = { id: string; name: string; lat: number; lon: number; alt: number };

type Measured = { value: number; station: Station; distanceKm: number; time: number };

export type Observation = {
  /** Station principale (celle qui donne la température) */
  station: Station;
  distanceKm: number;
  time: number; // unix (s)
  temperature: number | null; // °C
  humidity: number | null; // %
  windSpeed: number | null; // km/h
  windGusts: number | null; // km/h
  windDirection: number | null; // degrés
  rain6min: number | null; // mm
  pressure: number | null; // hPa
  visibility: number | null; // m
  /** Station utilisée pour le vent, si différente de la station principale */
  windStation: { name: string; distanceKm: number } | null;
};

export const observationsAvailable = !!KEY;

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { apikey: KEY ?? '', accept: '*/*' } });
  if (!res.ok) throw new Error(`Observations Météo-France : erreur ${res.status}`);
  return res;
}

let stationsMemo: Station[] | null = null;

/** Liste des stations (mise en cache 7 jours sur le téléphone). */
async function stations(): Promise<Station[]> {
  if (stationsMemo) return stationsMemo;
  try {
    const raw = await AsyncStorage.getItem(STATIONS_CACHE);
    if (raw) {
      const { at, list } = JSON.parse(raw) as { at: number; list: Station[] };
      if (Date.now() - at < 7 * 86400 * 1000 && list.length) return (stationsMemo = list);
    }
  } catch {
    // cache illisible : on recharge
  }
  const csv = await (await get('/liste-stations')).text();
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0].split(';').map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const [iId, iName, iLat, iLon, iAlt] = ['id_station', 'nom_usuel', 'latitude', 'longitude', 'altitude'].map(col);
  const list = lines
    .slice(1)
    .map((l) => l.split(';'))
    .map((c) => ({ id: c[iId]?.trim(), name: c[iName]?.trim(), lat: Number(c[iLat]?.replace(',', '.')), lon: Number(c[iLon]?.replace(',', '.')), alt: Number(c[iAlt]?.replace(',', '.')) }))
    .filter((s): s is Station => !!s.id && Number.isFinite(s.lat) && Number.isFinite(s.lon));
  stationsMemo = list;
  AsyncStorage.setItem(STATIONS_CACHE, JSON.stringify({ at: Date.now(), list })).catch(() => {});
  return list;
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const n = (v: unknown) => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
};

/**
 * Combine les mesures récentes des stations Météo-France proches.
 * Beaucoup de petites stations ne mesurent que la température et la pluie :
 * chaque valeur est prise dans la station la plus proche qui la mesure.
 * Stations retenues : moins de 25 km, moins de 300 m d'écart d'altitude, mesure de moins de 90 min.
 */
export async function fetchNearestObservation(place: Place, placeAltitude?: number): Promise<Observation | null> {
  if (!KEY) return null;
  const candidates = (await stations())
    .map((s) => ({ s, d: distanceKm(place.latitude, place.longitude, s.lat, s.lon) }))
    .filter(({ s, d }) => d <= 25 && (placeAltitude === undefined || !Number.isFinite(s.alt) || Math.abs(s.alt - placeAltitude) <= 300))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);

  const results = await Promise.all(
    candidates.map(async ({ s, d }) => {
      try {
        const json = await (await get(`/station/infrahoraire-6m?id_station=${s.id}&format=json`)).json();
        const rows: Record<string, unknown>[] = Array.isArray(json) ? json : json ? [json] : [];
        const last = rows.sort((a, b) => Date.parse(String(b.validity_time)) - Date.parse(String(a.validity_time)))[0];
        if (!last) return null;
        const time = Date.parse(String(last.validity_time)) / 1000;
        if (!Number.isFinite(time) || Date.now() / 1000 - time > 90 * 60) return null; // station en retard
        return { s, d, time, row: last };
      } catch {
        return null;
      }
    }),
  );
  const ok = results.filter((r): r is NonNullable<typeof r> => r !== null);
  if (!ok.length) return null;

  const pickField = (key: string, convert: (v: number) => number = (v) => v): Measured | null => {
    for (const r of ok) {
      const v = n(r.row[key]);
      if (v !== null) return { value: convert(v), station: r.s, distanceKm: r.d, time: r.time };
    }
    return null;
  };

  const t = pickField('t', (k) => k - 273.15); // Kelvin → °C
  const ff = pickField('ff', (v) => v * 3.6); // m/s → km/h
  const main = t ?? ff;
  if (!main) return null;
  const sameWindStation = (m: Measured | null) => (m && m.station.id === ff?.station.id ? m.value : null);

  return {
    station: main.station,
    distanceKm: main.distanceKm,
    time: main.time,
    temperature: t?.value ?? null,
    humidity: pickField('u')?.value ?? null,
    windSpeed: ff?.value ?? null,
    windGusts: sameWindStation(pickField('fxi10', (v) => v * 3.6)),
    windDirection: sameWindStation(pickField('dd')),
    rain6min: pickField('rr_per')?.value ?? null,
    pressure: pickField('pmer', (p) => p / 100)?.value ?? null, // Pa → hPa
    visibility: pickField('vv')?.value ?? null,
    windStation: ff && ff.station.id !== main.station.id ? { name: ff.station.name, distanceKm: ff.distanceKm } : null,
  };
}
