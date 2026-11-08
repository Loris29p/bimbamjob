// Phase de la lune, calculée localement (pas besoin de réseau).
const SYNODIC = 29.530588853;
// Nouvelle lune de référence : 6 janvier 2000, 18 h 14 UTC
const REF = Date.UTC(2000, 0, 6, 18, 14) / 1000;

const NAMES = [
  'Nouvelle lune',
  'Premier croissant',
  'Premier quartier',
  'Gibbeuse croissante',
  'Pleine lune',
  'Gibbeuse décroissante',
  'Dernier quartier',
  'Dernier croissant',
];

export function moonInfo(unix = Date.now() / 1000) {
  const days = (unix - REF) / 86400;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC; // 0 → 29,5 jours
  const fraction = age / SYNODIC; // 0 = nouvelle, 0,5 = pleine
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const name = NAMES[Math.round(fraction * 8) % 8];
  const toFull = ((0.5 - fraction + 1) % 1) * SYNODIC;
  const toNew = ((1 - fraction) % 1) * SYNODIC;
  return { fraction, illumination, name, daysToFull: Math.round(toFull), daysToNew: Math.round(toNew), waxing: fraction < 0.5 };
}
