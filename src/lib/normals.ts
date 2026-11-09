// « Normale de saison » : moyenne des températures max/min des 10 dernières années
// autour de la même date (± 7 jours), à partir des archives ERA5 (via Open-Meteo).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from './types';

export type Normal = { tMax: number; tMin: number; years: number };

const DAY = 86400000;

export async function fetchNormal(place: Place, date = new Date()): Promise<Normal | null> {
  const key = `normal:${place.latitude.toFixed(1)},${place.longitude.toFixed(1)}:${date.getMonth()}-${date.getDate()}`;
  try {
    const hit = await AsyncStorage.getItem(key);
    if (hit) return JSON.parse(hit) as Normal;
  } catch {
    // pas de cache
  }
  const lastYear = date.getFullYear() - 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${place.latitude.toFixed(2)}&longitude=${place.longitude.toFixed(2)}` +
    `&start_date=${lastYear - 9}-01-01&end_date=${lastYear}-12-31&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const times: string[] = j.daily?.time ?? [];
  const maxs: (number | null)[] = j.daily?.temperature_2m_max ?? [];
  const mins: (number | null)[] = j.daily?.temperature_2m_min ?? [];
  const sumMax: number[] = [];
  const sumMin: number[] = [];
  const years = new Set<number>();
  times.forEach((t, i) => {
    const d = new Date(`${t}T12:00:00`);
    const same = new Date(d.getFullYear(), date.getMonth(), date.getDate(), 12);
    if (Math.abs(d.getTime() - same.getTime()) <= 7 * DAY && maxs[i] != null && mins[i] != null) {
      sumMax.push(maxs[i] as number);
      sumMin.push(mins[i] as number);
      years.add(d.getFullYear());
    }
  });
  if (!sumMax.length) return null;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const normal = { tMax: avg(sumMax), tMin: avg(sumMin), years: years.size };
  AsyncStorage.setItem(key, JSON.stringify(normal)).catch(() => {});
  return normal;
}
