// « Parapluie ou pas ? » : une réponse en une phrase, calculée sur la pluie au quart d'heure
// (AROME, ~6 h) puis sur l'horaire jusqu'à ce soir (ou les 12 prochaines heures en soirée).
import { upcomingHours, upcomingMinutely, type HourPoint, type Minutely } from './forecast';
import { hour, time } from './format';

type Slot = {
  start: number;
  end: number;
  /** pluie sûre (assez forte et probable) */
  wet: boolean;
  /** pluie possible mais incertaine */
  maybe: boolean;
  probability: number | null;
  /** tranche au quart d'heure (heure précise) ou horaire (heure ronde) */
  fine: boolean;
};

export type UmbrellaVerdict = {
  need: 'yes' | 'maybe' | 'no';
  title: string;
  detail: string;
  /** rappel proposé : à la fin de la pluie, ou juste avant qu'elle arrive */
  reminder?: { at: number; label: string; body: string };
};

const fmt = (s: Slot, edge: number) => (s.fine ? time(edge) : hour(edge));

function timeline(minutely: Minutely, hourly: HourPoint[], until: number): Slot[] {
  const slots: Slot[] = upcomingMinutely(minutely)
    .filter((p) => p.time < until)
    .map((p) => ({ start: p.time, end: p.time + 900, wet: p.precipitation * 4 >= 0.2, maybe: false, probability: null, fine: true }));
  const fineEnd = slots.length ? slots[slots.length - 1].end : Date.now() / 1000;
  for (const h of upcomingHours(hourly)) {
    if (h.time < fineEnd || h.time >= until) continue;
    const p = h.precipitationProbability;
    const wet = h.precipitation >= 0.2 && (p === null || p >= 40);
    const maybe = !wet && (h.precipitation >= 0.1 || (p !== null && p >= 30));
    slots.push({ start: h.time, end: h.time + 3600, wet, maybe, probability: p, fine: false });
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

export function umbrellaVerdict(minutely: Minutely, hourly: HourPoint[], placeName: string): UmbrellaVerdict | null {
  const now = Date.now() / 1000;
  const evening = new Date();
  evening.setHours(23, 0, 0, 0);
  // Tard le soir, on regarde la nuit et le début de matinée.
  const night = evening.getTime() / 1000 - now < 3 * 3600;
  const until = night ? now + 12 * 3600 : evening.getTime() / 1000;
  const horizon = night ? "d'ici demain matin" : "d'ici ce soir";

  const slots = timeline(minutely, hourly, until);
  if (!slots.length) return null;

  // Il pleut maintenant
  if (slots[0].wet) {
    const stop = dryFrom(slots, 0);
    if (stop === -1) return { need: 'yes', title: 'Prends ton parapluie', detail: `Il pleut, sans accalmie prévue ${horizon}.` };
    const end = slots[stop];
    const back = slots.findIndex((s, i) => i > stop && s.wet);
    const again = back === -1 ? '' : ` Retour de la pluie vers ${fmt(slots[back], slots[back].start)}.`;
    return {
      need: 'yes',
      title: 'Prends ton parapluie',
      detail: `Il pleut, ça devrait s'arrêter vers ${fmt(end, end.start)}.${again}`,
      reminder: { at: end.start, label: `Préviens-moi quand ça s'arrête`, body: `La pluie s'arrête à ${placeName}.` },
    };
  }

  // Pluie plus tard
  const first = slots.findIndex((s) => s.wet);
  if (first !== -1) {
    const s = slots[first];
    const stop = dryFrom(slots, first);
    const span = stop === -1 ? ` et jusqu'à la fin ${night ? 'de la nuit' : 'de la journée'}` : `, jusqu'à ${fmt(slots[stop], slots[stop].start)} environ`;
    const at = s.start - 10 * 60;
    return {
      need: 'yes',
      title: 'Prends ton parapluie',
      detail: `Pluie à partir de ${fmt(s, s.start)}${span}.`,
      reminder: at - now > 5 * 60 ? { at, label: 'Préviens-moi 10 min avant', body: `La pluie arrive à ${placeName} dans 10 min.` } : undefined,
    };
  }

  // Pluie seulement possible
  const maybe = slots.find((s) => s.maybe);
  if (maybe) {
    const pct = maybe.probability !== null ? ` (${Math.round(maybe.probability)} %)` : '';
    return { need: 'maybe', title: 'Au cas où, prends-le', detail: `Averses possibles vers ${fmt(maybe, maybe.start)}${pct}.` };
  }

  return { need: 'no', title: 'Pas besoin de parapluie', detail: `Pas de pluie prévue ${horizon}.` };
}
