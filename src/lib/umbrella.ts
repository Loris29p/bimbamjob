// « Parapluie ou pas ? » : une réponse en une phrase.
// Sources, de la plus sûre à la moins sûre :
//  1. la pluie MESURÉE par une station Météo-France proche (6 dernières minutes) ;
//  2. la prévision AROME au quart d'heure (~6 h) ;
//  3. puis l'horaire jusqu'à ce soir (ou les 12 prochaines heures en soirée).
// Chaque tranche couvre [start, end] : la pluie qui tombe PENDANT la tranche (voir forecast.ts).
import { upcomingHours, upcomingMinutely, type HourPoint, type Minutely } from './forecast';
import { hour, time } from './format';
import type { Observation } from './observations';
import { KIND_WORDS, isWet, kindOf, type PrecipKind } from './rain';

type Slot = {
  start: number;
  end: number;
  /** débit moyen (mm/h) */
  mmh: number;
  /** pluie sûre (assez forte et probable) */
  wet: boolean;
  /** pluie possible mais incertaine */
  maybe: boolean;
  kind: PrecipKind;
  probability: number | null;
  /** tranche au quart d'heure (heure précise) ou horaire (heure ronde) */
  fine: boolean;
};

export type RainNow = {
  wet: boolean;
  mmh: number;
  kind: PrecipKind;
  /** d'où vient l'info « il pleut / il ne pleut pas maintenant » */
  source: 'station' | 'forecast';
  station?: { name: string; distanceKm: number; ageMin: number };
};

export type UmbrellaVerdict = {
  need: 'yes' | 'maybe' | 'no';
  /** couleur de la pastille */
  tone: 'rain' | 'snow' | 'storm' | 'maybe' | 'dry';
  title: string;
  detail: string;
  now: RainNow;
  /** cumul prévu sur la prochaine heure (mm) */
  nextHourMm: number;
  /** prochain créneau sans pluie d'au moins 30 min, quand il pleut ou va pleuvoir */
  dryWindow?: { from: number; to: number | null };
  /** rappel proposé : à la fin de la pluie, ou juste avant qu'elle arrive */
  reminder?: { at: number; label: string; body: string };
};

/** Mesure de station prise en compte : à moins de 10 km et de moins de 20 min. */
const STATION_KM = 10;
const STATION_MAX_AGE = 20 * 60;

const fmt = (s: Slot, edge: number) => (s.fine ? time(edge) : hour(edge));
const prettyStation = (name: string) => name.replace(/_/g, ' ').toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

function timeline(minutely: Minutely, hourly: HourPoint[], until: number): Slot[] {
  const slots: Slot[] = upcomingMinutely(minutely)
    .filter((p) => p.time < until)
    .map((p) => {
      const mmh = p.precipitation * 4;
      return { start: p.time, end: p.time + 900, mmh, wet: isWet(mmh), maybe: false, kind: kindOf(p.precipitation, p.snowfall, p.cape), probability: null, fine: true };
    });
  const fineEnd = slots.length ? slots[slots.length - 1].end : Date.now() / 1000;
  for (const h of upcomingHours(hourly)) {
    if (h.time < fineEnd || h.time >= until) continue;
    const p = h.precipitationProbability;
    // AROME prévoit une vraie pluie : on la croit même si l'ensemble (maille ~27 km) est hésitant,
    // sauf si l'ensemble la juge très improbable.
    const wet = isWet(h.precipitation) && (p === null || p >= 25 || h.precipitation >= 1);
    const maybe = !wet && (h.precipitation >= 0.1 || (p !== null && p >= 30));
    slots.push({ start: h.time, end: h.time + 3600, mmh: h.precipitation, wet, maybe, kind: kindOf(h.precipitation, h.snowfall, h.cape, h.weatherCode), probability: p, fine: false });
  }
  return slots;
}

/** Index de la fin de pluie à partir de `from` : 30 min sèches au quart d'heure, ou une heure sèche. */
function dryFrom(slots: Slot[], from: number) {
  for (let i = from; i < slots.length; i++) {
    if (slots[i].wet) continue;
    if (!slots[i].fine || !slots[i + 1] || !slots[i + 1].wet) return i;
  }
  return -1;
}

/** Type dominant d'une suite de tranches pluvieuses. */
function spanKind(slots: Slot[], from: number, to: number): PrecipKind {
  const span = slots.slice(from, to === -1 ? undefined : to).filter((s) => s.wet);
  if (span.some((s) => s.kind === 'snow')) return span.every((s) => s.kind === 'snow') ? 'snow' : 'mixed';
  if (span.some((s) => s.kind === 'mixed')) return 'mixed';
  if (span.some((s) => s.kind === 'storm')) return 'storm';
  return 'rain';
}

const titleFor = (kind: PrecipKind, now: boolean) =>
  kind === 'snow' ? (now ? 'Couvre-toi, il neige' : 'Neige en vue') : kind === 'storm' ? 'Prends ton parapluie, orage possible' : 'Prends ton parapluie';
const toneFor = (kind: PrecipKind): UmbrellaVerdict['tone'] => (kind === 'snow' || kind === 'mixed' ? 'snow' : kind === 'storm' ? 'storm' : 'rain');

export function umbrellaVerdict(minutely: Minutely, hourly: HourPoint[], placeName: string, obs?: Observation | null): UmbrellaVerdict | null {
  const now = Date.now() / 1000;
  const evening = new Date();
  evening.setHours(23, 0, 0, 0);
  // Tard le soir, on regarde la nuit et le début de matinée.
  const night = evening.getTime() / 1000 - now < 3 * 3600;
  const until = night ? now + 12 * 3600 : evening.getTime() / 1000;
  const horizon = night ? "d'ici demain matin" : "d'ici ce soir";

  const slots = timeline(minutely, hourly, until);
  if (!slots.length) return null;

  // Une mesure bat une prévision : si une station proche mesure de la pluie, il pleut maintenant.
  const r = obs?.rain;
  const measured = r && r.distanceKm <= STATION_KM && now - r.time <= STATION_MAX_AGE ? r : null;
  const station = measured ? { name: prettyStation(measured.stationName), distanceKm: measured.distanceKm, ageMin: Math.round((now - measured.time) / 60) } : undefined;
  if (measured && measured.mm > 0 && !slots[0].wet) {
    slots[0] = { ...slots[0], wet: true, mmh: Math.max(slots[0].mmh, measured.mm * 10) };
  }
  const nowState: RainNow = {
    wet: slots[0].wet,
    mmh: slots[0].mmh,
    kind: slots[0].kind,
    source: measured && (measured.mm > 0 || !slots[0].wet) ? 'station' : 'forecast',
    station,
  };
  const nextHourMm = slots.filter((s) => s.fine && s.start < now + 3600).reduce((a, s) => a + s.mmh / 4, 0);
  const base = { now: nowState, nextHourMm };

  // Il pleut maintenant
  if (slots[0].wet) {
    const stop = dryFrom(slots, 0);
    const kind = spanKind(slots, 0, stop);
    const where = nowState.source === 'station' && station ? ` (mesuré à ${station.name})` : '';
    const verb = kind === 'snow' ? 'Il neige' : kind === 'mixed' ? 'Pluie et neige' : 'Il pleut';
    if (stop === -1)
      return { ...base, need: 'yes', tone: toneFor(kind), title: titleFor(kind, true), detail: `${verb}${where}, sans accalmie prévue ${horizon}.` };
    const end = slots[stop];
    const back = slots.findIndex((s, i) => i > stop && s.wet);
    const again = back === -1 ? '' : ` Retour vers ${fmt(slots[back], slots[back].start)}.`;
    return {
      ...base,
      need: 'yes',
      tone: toneFor(kind),
      title: titleFor(kind, true),
      detail: `${verb}${where}, ça devrait s'arrêter vers ${fmt(end, end.start)}.${again}`,
      dryWindow: { from: end.start, to: back === -1 ? null : slots[back].start },
      reminder: { at: end.start, label: `Préviens-moi quand ça s'arrête`, body: `${kind === 'snow' ? 'La neige' : 'La pluie'} s'arrête à ${placeName}.` },
    };
  }

  // Pluie plus tard
  const first = slots.findIndex((s) => s.wet);
  if (first !== -1) {
    const s = slots[first];
    const stop = dryFrom(slots, first);
    const kind = spanKind(slots, first, stop);
    const span = stop === -1 ? ` et jusqu'à la fin ${night ? 'de la nuit' : 'de la journée'}` : `, jusqu'à ${fmt(slots[stop], slots[stop].start)} environ`;
    const at = s.start - 10 * 60;
    const dryNow = nowState.source === 'station' && station ? ` Rien de mesuré à ${station.name} pour l'instant.` : '';
    return {
      ...base,
      need: 'yes',
      tone: toneFor(kind),
      title: titleFor(kind, false),
      detail: `${KIND_WORDS[kind]} à partir de ${fmt(s, s.start)}${span}.${dryNow}`,
      reminder: at - now > 5 * 60 ? { at, label: 'Préviens-moi 10 min avant', body: `${KIND_WORDS[kind]} à ${placeName} dans 10 min.` } : undefined,
    };
  }

  // Pluie seulement possible
  const maybe = slots.find((s) => s.maybe);
  if (maybe) {
    const pct = maybe.probability !== null ? ` (${Math.round(maybe.probability)} %)` : '';
    const word = maybe.kind === 'snow' ? 'Flocons possibles' : maybe.kind === 'storm' ? 'Averses orageuses possibles' : 'Averses possibles';
    return { ...base, need: 'maybe', tone: 'maybe', title: 'Au cas où, prends-le', detail: `${word} vers ${fmt(maybe, maybe.start)}${pct}.` };
  }

  return { ...base, need: 'no', tone: 'dry', title: 'Pas besoin de parapluie', detail: `Pas de pluie prévue ${horizon}.` };
}
