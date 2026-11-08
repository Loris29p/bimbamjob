// Prévisions via Open-Meteo, qui redistribue gratuitement les modèles de Météo-France.
//  - AROME HD (1,3 km, pas de 15 min) pour la pluie à court terme ;
//  - AROME + ARPEGE (« meteofrance_seamless ») pour les conditions actuelles, l'horaire et les 4 premiers jours ;
//  - le meilleur modèle disponible (ECMWF…) pour ce que Météo-France ne fournit pas
//    (probabilité de pluie, UV, visibilité) et pour la tendance jusqu'à 14 jours.
import type { Place } from './types';

const BASE = 'https://api.open-meteo.com/v1/forecast';

export type Minutely = { time: number; precipitation: number }[];

export type HourPoint = {
  time: number;
  temperature: number;
  apparent: number;
  precipitation: number;
  precipitationProbability: number | null;
  weatherCode: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  humidity: number;
  dewPoint: number;
  pressure: number;
  uv: number | null;
  visibility: number | null;
  isDay: boolean;
};

export type DayPoint = {
  time: number;
  weatherCode: number;
  tMin: number;
  tMax: number;
  precipitationSum: number;
  precipitationProbability: number | null;
  windGustsMax: number;
  uvMax: number | null;
  sunrise: number;
  sunset: number;
  /** true si les valeurs viennent des modèles Météo-France (AROME/ARPEGE) */
  meteoFrance: boolean;
};

export type Current = {
  time: number;
  temperature: number;
  apparent: number;
  humidity: number;
  dewPoint: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  pressure: number;
  cloudCover: number;
  isDay: boolean;
};

export type Forecast = {
  current: Current;
  minutely: Minutely;
  hourly: HourPoint[];
  daily: DayPoint[];
  fetchedAt: number;
};

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur ${res.status} du service météo`);
  return res.json();
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const opt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function fetchForecast(place: Place): Promise<Forecast> {
  const common = `latitude=${place.latitude.toFixed(4)}&longitude=${place.longitude.toFixed(4)}&timezone=Europe%2FParis&timeformat=unixtime&wind_speed_unit=kmh`;
  const hourlyVars =
    'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,dew_point_2m,pressure_msl,is_day';
  const dailyVars = 'weather_code,temperature_2m_min,temperature_2m_max,precipitation_sum,wind_gusts_10m_max,sunrise,sunset';

  // 1) Modèles Météo-France
  const mfUrl =
    `${BASE}?${common}&models=meteofrance_seamless` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,cloud_cover,is_day' +
    '&minutely_15=precipitation&forecast_minutely_15=12' +
    `&hourly=${hourlyVars}&forecast_hours=48` +
    `&daily=${dailyVars}&forecast_days=4`;

  // 2) Meilleur modèle disponible : compléments + tendance 14 jours
  const bestUrl =
    `${BASE}?${common}` +
    `&hourly=${hourlyVars},precipitation_probability,uv_index,visibility&forecast_hours=48` +
    `&daily=${dailyVars},precipitation_probability_max,uv_index_max&forecast_days=14`;

  const [mf, best] = await Promise.all([getJson(mfUrl), getJson(bestUrl)]);

  const c = mf.current ?? {};
  const current: Current = {
    time: num(c.time, Date.now() / 1000),
    temperature: num(c.temperature_2m),
    apparent: num(c.apparent_temperature),
    humidity: num(c.relative_humidity_2m),
    dewPoint: num(c.dew_point_2m),
    precipitation: num(c.precipitation),
    weatherCode: num(c.weather_code),
    windSpeed: num(c.wind_speed_10m),
    windGusts: num(c.wind_gusts_10m),
    windDirection: num(c.wind_direction_10m),
    pressure: num(c.pressure_msl),
    cloudCover: num(c.cloud_cover),
    isDay: c.is_day !== 0,
  };

  const m = mf.minutely_15 ?? { time: [] };
  const minutely: Minutely = ((m.time ?? []) as number[]).map((t, i) => ({ time: t, precipitation: num(m.precipitation?.[i]) }));

  // Horaire : Météo-France en priorité, l'autre modèle en secours valeur par valeur.
  const h = mf.hourly ?? { time: [] };
  const bh = best.hourly ?? { time: [] };
  const bIndex = new Map<number, number>(((bh.time ?? []) as number[]).map((t, i) => [t, i]));
  const pick = (key: string, i: number, t: number) => {
    const v = opt(h[key]?.[i]);
    if (v !== null) return v;
    const j = bIndex.get(t);
    return j === undefined ? null : opt(bh[key]?.[j]);
  };
  const fromBest = (key: string, t: number) => {
    const j = bIndex.get(t);
    return j === undefined ? null : opt(bh[key]?.[j]);
  };
  const hourly: HourPoint[] = ((h.time ?? []) as number[]).map((t, i) => ({
    time: t,
    temperature: num(pick('temperature_2m', i, t)),
    apparent: num(pick('apparent_temperature', i, t)),
    precipitation: num(pick('precipitation', i, t)),
    precipitationProbability: fromBest('precipitation_probability', t),
    weatherCode: num(pick('weather_code', i, t)),
    windSpeed: num(pick('wind_speed_10m', i, t)),
    windGusts: num(pick('wind_gusts_10m', i, t)),
    windDirection: num(pick('wind_direction_10m', i, t)),
    humidity: num(pick('relative_humidity_2m', i, t)),
    dewPoint: num(pick('dew_point_2m', i, t)),
    pressure: num(pick('pressure_msl', i, t)),
    uv: fromBest('uv_index', t),
    visibility: fromBest('visibility', t),
    isDay: pick('is_day', i, t) !== 0,
  }));

  // Journalier : Météo-France pour les 4 premiers jours, puis tendance.
  const md = mf.daily ?? { time: [] };
  const bd = best.daily ?? { time: [] };
  const mfDay = new Map<number, number>(((md.time ?? []) as number[]).map((t, i) => [t, i]));
  const daily: DayPoint[] = ((bd.time ?? []) as number[]).map((t, i) => {
    const k = mfDay.get(t);
    const take = (key: string) => {
      const v = k === undefined ? null : opt(md[key]?.[k]);
      return v ?? num(bd[key]?.[i]);
    };
    return {
      time: t,
      weatherCode: take('weather_code'),
      tMin: take('temperature_2m_min'),
      tMax: take('temperature_2m_max'),
      precipitationSum: take('precipitation_sum'),
      precipitationProbability: opt(bd.precipitation_probability_max?.[i]),
      windGustsMax: take('wind_gusts_10m_max'),
      uvMax: opt(bd.uv_index_max?.[i]),
      sunrise: take('sunrise'),
      sunset: take('sunset'),
      meteoFrance: k !== undefined && opt(md.temperature_2m_max?.[k]) !== null,
    };
  });

  return { current, minutely, hourly, daily, fetchedAt: Date.now() };
}

/** Tranches de 15 min encore à venir (la tranche en cours comprise). */
export function upcomingMinutely(minutely: Minutely) {
  const now = Date.now() / 1000;
  return minutely.filter((p) => p.time + 15 * 60 > now);
}

/** Délai (en minutes) avant la prochaine pluie dans l'heure, ou null. */
export function minutesUntilRain(minutely: Minutely, thresholdMmPer15 = 0.05) {
  const now = Date.now() / 1000;
  const first = upcomingMinutely(minutely).find((p) => p.time < now + 3600 && p.precipitation >= thresholdMmPer15);
  if (!first) return null;
  return Math.max(0, Math.round((first.time - now) / 60));
}

/** Heures à venir (l'heure en cours comprise). */
export function upcomingHours(hourly: HourPoint[]) {
  const now = Date.now() / 1000;
  return hourly.filter((h) => h.time + 3600 > now);
}
