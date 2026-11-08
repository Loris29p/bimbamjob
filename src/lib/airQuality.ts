// Qualité de l'air : modèle européen CAMS (Copernicus, ~10 km) via Open-Meteo.
// Indice européen (EAQI) et libellés de l'Agence européenne pour l'environnement.
import type { Place } from './types';

export type AirQuality = {
  aqi: number;
  yesterdayAqi: number | null;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  hourly: { time: number; aqi: number }[];
};

export const AQI_LEVELS = [
  { max: 20, label: 'Bon', color: '#50F0E6' },
  { max: 40, label: 'Moyen', color: '#50CCAA' },
  { max: 60, label: 'Dégradé', color: '#F0E641' },
  { max: 80, label: 'Mauvais', color: '#FF5050' },
  { max: 100, label: 'Très mauvais', color: '#960032' },
  { max: Infinity, label: 'Extrêmement mauvais', color: '#7D2181' },
];

export const aqiLevel = (aqi: number) => AQI_LEVELS.find((l) => aqi <= l.max) ?? AQI_LEVELS[AQI_LEVELS.length - 1];

export async function fetchAirQuality(place: Place): Promise<AirQuality> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.latitude.toFixed(4)}&longitude=${place.longitude.toFixed(4)}` +
    '&timezone=Europe%2FParis&timeformat=unixtime&past_days=1&forecast_days=2' +
    '&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&hourly=european_aqi';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Qualité de l'air indisponible (${res.status})`);
  const j = await res.json();
  const c = j.current ?? {};
  const times: number[] = j.hourly?.time ?? [];
  const values: (number | null)[] = j.hourly?.european_aqi ?? [];
  const hourly = times.map((t, i) => ({ time: t, aqi: values[i] ?? NaN })).filter((p) => Number.isFinite(p.aqi));
  const target = (c.time ?? Date.now() / 1000) - 24 * 3600;
  const y = hourly.reduce<{ time: number; aqi: number } | null>((best, p) => (!best || Math.abs(p.time - target) < Math.abs(best.time - target) ? p : best), null);
  return {
    aqi: c.european_aqi ?? NaN,
    yesterdayAqi: y && Math.abs(y.time - target) < 2 * 3600 ? y.aqi : null,
    pm25: c.pm2_5 ?? NaN,
    pm10: c.pm10 ?? NaN,
    no2: c.nitrogen_dioxide ?? NaN,
    o3: c.ozone ?? NaN,
    hourly,
  };
}
