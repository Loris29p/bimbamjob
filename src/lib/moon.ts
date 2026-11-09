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

// ---- Lever de la lune (méthode de SunCalc, V. Agafonkin, licence BSD) ----
const RAD = Math.PI / 180;
const OBLIQ = RAD * 23.4397;
const toDays = (ms: number) => ms / 86400000 - 0.5 + 2440588 - 2451545;

function moonAltitude(ms: number, lat: number, lon: number) {
  const d = toDays(ms);
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  const ra = Math.atan2(Math.sin(l) * Math.cos(OBLIQ) - Math.tan(b) * Math.sin(OBLIQ), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(OBLIQ) + Math.cos(b) * Math.sin(OBLIQ) * Math.sin(l));
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra;
  const phi = RAD * lat;
  let h = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const hr = Math.max(0, h);
  h += 0.0002967 / Math.tan(hr + 0.00312536 / (hr + 0.08901179)); // réfraction
  return h;
}

/** Heure (unix, s) du lever de lune pendant la journée locale qui commence à `midnightMs`, ou null. */
function moonriseOn(midnightMs: number, lat: number, lon: number): number | null {
  const hc = 0.133 * RAD;
  const at = (hours: number) => moonAltitude(midnightMs + hours * 3600000, lat, lon) - hc;
  let h0 = at(0);
  for (let i = 1; i <= 24; i += 2) {
    const h1 = at(i);
    const h2 = at(i + 1);
    const a = (h0 + h2) / 2 - h1;
    const b = (h2 - h0) / 2;
    const xe = -b / (2 * a);
    const ye = (a * xe + b) * xe + h1;
    const disc = b * b - 4 * a * h1;
    let roots = 0;
    let x1 = 0;
    let x2 = 0;
    if (disc >= 0) {
      const dx = Math.sqrt(disc) / (Math.abs(a) * 2);
      x1 = xe - dx;
      x2 = xe + dx;
      if (Math.abs(x1) <= 1) roots++;
      if (Math.abs(x2) <= 1) roots++;
      if (x1 < -1) x1 = x2;
    }
    let rise: number | null = null;
    if (roots === 1 && h0 < 0) rise = i + x1;
    else if (roots === 2) rise = i + (ye < 0 ? x2 : x1);
    if (rise !== null) return (midnightMs + rise * 3600000) / 1000;
    h0 = h2;
  }
  return null;
}

/** Prochain lever de lune après maintenant (unix, s). */
export function nextMoonrise(lat: number, lon: number, now = Date.now()): number | null {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  for (let k = 0; k < 3; k++) {
    const day = new Date(d);
    day.setDate(d.getDate() + k);
    const t = moonriseOn(day.getTime(), lat, lon);
    if (t !== null && t * 1000 > now) return t;
  }
  return null;
}
