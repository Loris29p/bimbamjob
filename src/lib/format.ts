const DAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const DAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const pad = (v: number) => String(v).padStart(2, '0');
const date = (unix: number) => new Date(unix * 1000);

export const hour = (unix: number) => `${date(unix).getHours()}h`;
export const time = (unix: number) => `${pad(date(unix).getHours())}:${pad(date(unix).getMinutes())}`;
export const temp = (v: number) => `${Math.round(v)}°`;

export function dayLabel(unix: number, index: number) {
  if (index === 0) return "Aujourd'hui";
  if (index === 1) return 'Demain';
  const d = date(unix);
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
}

export function longDay(unix: number) {
  const d = date(unix);
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
