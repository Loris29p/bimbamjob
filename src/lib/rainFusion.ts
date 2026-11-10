// Fusion radar + modèle pour la pluie des 90 prochaines minutes.
// Le radar (ce qui tombe vraiment, prolongé selon son déplacement) est très fiable à court terme
// et se dégrade vite ; AROME prend le relais progressivement. Poids du radar :
// 85 % jusqu'à +20 min, puis décroissant jusqu'à 0 à +90 min.
import type { Minutely } from './forecast';
import type { RadarPoint } from './radarPoint';
import { isWet } from './rain';

export type FusionInfo = {
  /** le radar a servi (image récente et lisible) */
  radar: boolean;
  /** accord radar / modèle sur la prochaine heure : 0..1, null si pas de radar */
  agreement: number | null;
  /** ce que voit le radar au-dessus du lieu maintenant (mm/h) */
  radarNow: number | null;
  radarSnowNow: boolean;
  motion: RadarPoint['motion'];
  /** âge de l'image radar (min) */
  ageMin: number | null;
};

const radarWeight = (leadMin: number) => (leadMin <= 20 ? 0.85 : leadMin >= 90 ? 0 : 0.85 * (1 - (leadMin - 20) / 70));

/** Débit radar moyen (mm/h) sur [t, t + 15 min], ou null si le radar ne couvre pas cette période. */
function radarOver(radar: RadarPoint, t: number) {
  const pts = radar.series.filter((s) => s.t >= t - 150 && s.t <= t + 900 + 150);
  if (!pts.length) return null;
  return { mmh: pts.reduce((a, s) => a + s.mmh, 0) / pts.length, snow: pts.filter((s) => s.snow).length * 2 > pts.length };
}

export function fuseRain(minutely: Minutely, radar: RadarPoint | null | undefined): { minutely: Minutely; info: FusionInfo } {
  const now = Date.now() / 1000;
  const fresh = radar && radar.series.length && now - radar.frameTime < 30 * 60 ? radar : null;
  if (!fresh) return { minutely, info: { radar: false, agreement: null, radarNow: null, radarSnowNow: false, motion: null, ageMin: null } };

  let agree = 0;
  let total = 0;
  const fused = minutely.map((p) => {
    const lead = (p.time + 450 - now) / 60;
    const r = lead > -15 ? radarOver(fresh, Math.max(p.time, now)) : null;
    if (!r) return p;
    if (lead <= 60) {
      total++;
      if (isWet(r.mmh) === isWet(p.precipitation * 4)) agree++;
    }
    const w = radarWeight(Math.max(0, lead));
    const mm = w * (r.mmh / 4) + (1 - w) * p.precipitation;
    // Neige vue au radar : on la garde tant que le radar pèse dans la fusion.
    const snowfall = r.snow && w >= 0.4 ? mm / 0.7 : p.snowfall;
    return { ...p, precipitation: mm, snowfall };
  });
  const first = fresh.series[0];
  return {
    minutely: fused,
    info: {
      radar: true,
      agreement: total ? agree / total : null,
      radarNow: first?.mmh ?? null,
      radarSnowNow: !!first?.snow,
      motion: fresh.motion,
      ageMin: Math.round((now - fresh.frameTime) / 60),
    },
  };
}
