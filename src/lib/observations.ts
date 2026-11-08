// Mesures réelles des stations Météo-France (API « Données Publiques Observation »).
// Une mesure toutes les 6 minutes. Même clé API que les vigilances :
// sur portail-api.meteofrance.fr, abonne ton application aux deux API.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from './types';

const BASE = 'https://public-api.meteofrance.fr/public/DPObs/v1';
const KEY = process.env.EXPO_PUBLIC_METEOFRANCE_API_KEY;
const STATIONS_CACHE = 'mf-stations-v1';

export type Station = { id: string; name: string; lat: number; lon: number; alt: number };

export type Observation = {
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
 * Dernière mesure de la station la plus proche ayant de la température.
 * On ne garde que les stations à moins de 25 km et à moins de 300 m d'écart d'altitude.
 */
export async function fetchNearestObservation(place: Place, placeAltitude?: number): Promise<Observation | null> {
  if (!KEY) return null;
  const candidates = (await stations())
    .map((s) => ({ s, d: distanceKm(place.latitude, place.longitude, s.lat, s.lon) }))
    .filter(({ s, d }) => d <= 25 && (placeAltitude === undefined || !Number.isFinite(s.alt) || Math.abs(s.alt - placeAltitude) <= 300))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);

  for (const { s, d } of candidates) {
    try {
      const json = await (await get(`/station/infrahoraire-6m?id_station=${s.id}&format=json`)).json();
      const rows: Record<string, unknown>[] = Array.isArray(json) ? json : json ? [json] : [];
      const last = rows
        .filter((r) => n(r.t) !== null)
        .sort((a, b) => Date.parse(String(b.validity_time)) - Date.parse(String(a.validity_time)))[0];
      if (!last) continue;
      const t = n(last.t);
      const ff = n(last.ff);
      const fx = n(last.fxi10);
      const p = n(last.pmer);
      return {
        station: s,
        distanceKm: d,
        time: Date.parse(String(last.validity_time)) / 1000,
        temperature: t === null ? null : t - 273.15, // Kelvin → °C
        humidity: n(last.u),
        windSpeed: ff === null ? null : ff * 3.6, // m/s → km/h
        windGusts: fx === null ? null : fx * 3.6,
        windDirection: n(last.dd),
        rain6min: n(last.rr_per),
        pressure: p === null ? null : p / 100, // Pa → hPa
        visibility: n(last.vv),
      };
    } catch {
      // station suivante
    }
  }
  return null;
}
