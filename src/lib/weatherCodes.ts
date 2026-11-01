// Codes météo WMO renvoyés par Open-Meteo → libellé français + emoji.
const CODES: Record<number, [string, string, string?]> = {
  0: ['Ciel dégagé', '☀️', '🌙'],
  1: ['Peu nuageux', '🌤️', '🌙'],
  2: ['Partiellement nuageux', '⛅', '☁️'],
  3: ['Couvert', '☁️'],
  45: ['Brouillard', '🌫️'],
  48: ['Brouillard givrant', '🌫️'],
  51: ['Bruine légère', '🌦️'],
  53: ['Bruine', '🌦️'],
  55: ['Bruine forte', '🌧️'],
  56: ['Bruine verglaçante', '🌧️'],
  57: ['Bruine verglaçante forte', '🌧️'],
  61: ['Pluie faible', '🌦️'],
  63: ['Pluie modérée', '🌧️'],
  65: ['Pluie forte', '🌧️'],
  66: ['Pluie verglaçante', '🌧️'],
  67: ['Pluie verglaçante forte', '🌧️'],
  71: ['Neige faible', '🌨️'],
  73: ['Neige modérée', '🌨️'],
  75: ['Neige forte', '❄️'],
  77: ['Grains de neige', '🌨️'],
  80: ['Averses faibles', '🌦️'],
  81: ['Averses', '🌧️'],
  82: ['Averses violentes', '⛈️'],
  85: ['Averses de neige', '🌨️'],
  86: ['Fortes averses de neige', '❄️'],
  95: ['Orage', '⛈️'],
  96: ['Orage avec grêle', '⛈️'],
  99: ['Orage violent avec grêle', '⛈️'],
};

export function describeWeather(code: number, isDay = true) {
  const entry = CODES[code] ?? ['Inconnu', '❔'];
  return { label: entry[0], icon: !isDay && entry[2] ? entry[2] : entry[1] };
}

export function windDirection(deg: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(deg / 45) % 8];
}

/** Intensité de pluie (mm sur 15 min) → libellé façon « pluie dans l'heure ». */
export function rainLevel(mmPer15: number): 0 | 1 | 2 | 3 {
  const mmh = mmPer15 * 4;
  if (mmh < 0.2) return 0;
  if (mmh < 2.5) return 1;
  if (mmh < 7.6) return 2;
  return 3;
}
export const RAIN_LABELS = ['Pas de pluie', 'Pluie faible', 'Pluie modérée', 'Pluie forte'];
