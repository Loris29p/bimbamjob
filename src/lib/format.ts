const DAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

const pad = (v: number) => String(v).padStart(2, '0');
const date = (unix: number) => new Date(unix * 1000);

/**
 * Format horaire du téléphone : 24 h (« 18 h », « 18:05 ») ou 12 h (« 6 PM », « 6:05 PM »).
 * Lu dans les réglages via expo-localization ; si le module natif manque (ancien build),
 * on se rabat sur Intl, puis sur le format 24 h.
 */
function detect24h(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const v = require('expo-localization').getCalendars()[0]?.uses24hourClock;
    if (typeof v === 'boolean') return v;
  } catch {}
  try {
    const hc = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
    if (hc) return hc === 'h23' || hc === 'h24';
  } catch {}
  return true;
}
export const uses24h = detect24h();

const h12 = (h: number) => ({ h: h % 12 === 0 ? 12 : h % 12, ap: h < 12 ? 'AM' : 'PM' });

/** Heure pleine : « 18 h » ou « 6 PM ». */
export const hourOf = (d: Date) => {
  if (uses24h) return `${d.getHours()} h`;
  const { h, ap } = h12(d.getHours());
  return `${h} ${ap}`;
};
/** Heure et minutes : « 18:05 » ou « 6:05 PM ». */
export const timeOf = (d: Date) => {
  if (uses24h) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const { h, ap } = h12(d.getHours());
  return `${h}:${pad(d.getMinutes())} ${ap}`;
};

export const hour = (unix: number) => hourOf(date(unix));
export const time = (unix: number) => timeOf(date(unix));
export const temp = (v: number) => `${Math.round(v)}°`;

export function dayLabel(unix: number, index: number) {
  if (index === 0) return 'Auj.';
  return DAYS[date(unix).getDay()];
}
