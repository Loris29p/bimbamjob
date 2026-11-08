// Codes météo WMO renvoyés par Open-Meteo → libellé français.
const LABELS: Record<number, string> = {
  0: 'Ciel dégagé',
  1: 'Plutôt ensoleillé',
  2: 'Partiellement nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine',
  55: 'Bruine forte',
  56: 'Bruine verglaçante',
  57: 'Bruine verglaçante',
  61: 'Pluie faible',
  63: 'Pluie',
  65: 'Forte pluie',
  66: 'Pluie verglaçante',
  67: 'Pluie verglaçante',
  71: 'Neige faible',
  73: 'Neige',
  75: 'Forte neige',
  77: 'Grains de neige',
  80: 'Averses',
  81: 'Averses',
  82: 'Fortes averses',
  85: 'Averses de neige',
  86: 'Fortes averses de neige',
  95: 'Orages',
  96: 'Orages avec grêle',
  99: 'Violents orages avec grêle',
};

export function weatherLabel(code: number, isDay = true) {
  if (code === 0 && !isDay) return 'Ciel clair';
  return LABELS[code] ?? '—';
}

export function isRainy(code: number) {
  return code >= 51;
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export function windDirection(deg: number) {
  return DIRS[Math.round(deg / 22.5) % 16];
}

/** Intensité de pluie (mm sur 15 min) → niveau 0 à 3. */
export function rainLevel(mmPer15: number): 0 | 1 | 2 | 3 {
  const mmh = mmPer15 * 4;
  if (mmh < 0.2) return 0;
  if (mmh < 2.5) return 1;
  if (mmh < 7.6) return 2;
  return 3;
}
export const RAIN_LABELS = ['Pas de pluie', 'Pluie faible', 'Pluie modérée', 'Forte pluie'];

export function uvLabel(uv: number) {
  if (uv < 3) return 'Faible';
  if (uv < 6) return 'Modéré';
  if (uv < 8) return 'Élevé';
  if (uv < 11) return 'Très élevé';
  return 'Extrême';
}
