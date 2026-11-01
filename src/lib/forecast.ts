// Prévisions via Open-Meteo, qui redistribue gratuitement les modèles de Météo-France :
//  - AROME (1,3 km, pas de 15 min) pour la pluie à court terme,
//  - AROME + ARPEGE (« meteofrance_seamless ») pour les 4 prochains jours,
//  - meilleur modèle disponible (ECMWF…) pour la tendance jusqu'à 14 jours.
import type { Place } from './types';

const BASE = 'https://api.open-meteo.com/v1/forecast';

export type Minutely = { time: number; precipitation: number }[];

export type Hourly = {
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
  isDay: boolean;
}[];

export type Daily = {
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
}[];

export type Current = {
  time: number;
  temperature: number;
  apparent: number;
  humidity: number;
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
  hourly: Hourly;
  daily: Daily;
  fetchedAt: number;
};

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur ${res.status} du service météo`);
  return res.json();
}

const n = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);

export async function fetchForecast(place: Place): Promise<Forecast> {
  const common = `latitude=${place.latitude}&longitude=${place.longitude}&timezone=Europe%2FParis&timeformat=unixtime&wind_speed_unit=kmh`;

  const shortUrl =
    `${BASE}?${common}&models=meteofrance_seamless` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,cloud_cover,is_day' +
    '&minutely_15=precipitation&forecast_minutely_15=8' +
    '&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,is_day' +
    '&forecast_hours=48';

  const longUrl =
    `${BASE}?${common}` +
    '&daily=weather_code,temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset' +
    '&forecast_days=14';

  const [s, l] = await Promise.all([getJson(shortUrl), getJson(longUrl)]);

  const c = s.current ?? {};
  const current: Current = {
    time: n(c.time),
    temperature: n(c.temperature_2m),
    apparent: n(c.apparent_temperature),
    humidity: n(c.relative_humidity_2m),
    precipitation: n(c.precipitation),
    weatherCode: n(c.weather_code),
    windSpeed: n(c.wind_speed_10m),
    windGusts: n(c.wind_gusts_10m),
    windDirection: n(c.wind_direction_10m),
    pressure: n(c.pressure_msl),
    cloudCover: n(c.cloud_cover),
    isDay: c.is_day !== 0,
  };

  const m = s.minutely_15 ?? { time: [], precipitation: [] };
  const minutely: Minutely = (m.time as number[]).map((t, i) => ({
    time: t,
    precipitation: n(m.precipitation?.[i]),
  }));

  const h = s.hourly ?? { time: [] };
  const hourly: Hourly = (h.time as number[]).map((t, i) => ({
    time: t,
    temperature: n(h.temperature_2m?.[i]),
    apparent: n(h.apparent_temperature?.[i]),
    precipitation: n(h.precipitation?.[i]),
    precipitationProbability: h.precipitation_probability?.[i] ?? null,
    weatherCode: n(h.weather_code?.[i]),
    windSpeed: n(h.wind_speed_10m?.[i]),
    windGusts: n(h.wind_gusts_10m?.[i]),
    windDirection: n(h.wind_direction_10m?.[i]),
    humidity: n(h.relative_humidity_2m?.[i]),
    isDay: h.is_day?.[i] !== 0,
  }));

  const d = l.daily ?? { time: [] };
  const daily: Daily = (d.time as number[]).map((t, i) => ({
    time: t,
    weatherCode: n(d.weather_code?.[i]),
    tMin: n(d.temperature_2m_min?.[i]),
    tMax: n(d.temperature_2m_max?.[i]),
    precipitationSum: n(d.precipitation_sum?.[i]),
    precipitationProbability: d.precipitation_probability_max?.[i] ?? null,
    windGustsMax: n(d.wind_gusts_10m_max?.[i]),
    uvMax: d.uv_index_max?.[i] ?? null,
    sunrise: n(d.sunrise?.[i]),
    sunset: n(d.sunset?.[i]),
  }));

  return { current, minutely, hourly, daily, fetchedAt: Date.now() };
}

/** Renvoie le délai (en minutes) avant la prochaine pluie dans l'heure, ou null. */
export function minutesUntilRain(minutely: Minutely, thresholdMmPer15 = 0.05) {
  const now = Date.now() / 1000;
  const upcoming = minutely.filter((p) => p.time + 15 * 60 > now && p.time < now + 3600);
  const first = upcoming.find((p) => p.precipitation >= thresholdMmPer15);
  if (!first) return null;
  return Math.max(0, Math.round((first.time - now) / 60));
}
