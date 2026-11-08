const DAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

const pad = (v: number) => String(v).padStart(2, '0');
const date = (unix: number) => new Date(unix * 1000);

export const hour = (unix: number) => `${date(unix).getHours()} h`;
export const time = (unix: number) => `${pad(date(unix).getHours())}:${pad(date(unix).getMinutes())}`;
export const temp = (v: number) => `${Math.round(v)}°`;

export function dayLabel(unix: number, index: number) {
  if (index === 0) return 'Auj.';
  return DAYS[date(unix).getDay()];
}
