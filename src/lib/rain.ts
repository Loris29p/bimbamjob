// Règles communes de la pluie : seuils, type de précipitation, libellés.
// Tous les écrans (carte Pluie, en-tête, heure par heure, détail) passent par ici pour dire la même chose.

/** En dessous de ce débit (mm/h), on considère qu'il ne pleut pas. */
export const RAIN_MMH = 0.2;
/** Limites faible / modérée / forte (mm/h), échelle usuelle des radars. */
export const MODERATE_MMH = 2.5;
export const HEAVY_MMH = 7.6;
/** Énergie convective au-delà de laquelle une averse peut tourner à l'orage (J/kg). */
export const STORM_CAPE = 800;

export type PrecipKind = 'rain' | 'snow' | 'mixed' | 'storm';

export const isWet = (mmh: number) => mmh >= RAIN_MMH;

/** 0 sec · 1 faible · 2 modérée · 3 forte */
export function intensity(mmh: number): 0 | 1 | 2 | 3 {
  if (mmh < RAIN_MMH) return 0;
  if (mmh < MODERATE_MMH) return 1;
  if (mmh < HEAVY_MMH) return 2;
  return 3;
}
export const INTENSITY_LABELS = ['Pas de pluie', 'Pluie faible', 'Pluie modérée', 'Forte pluie'];

/**
 * Type de précipitation d'une période : `mm` d'eau au total, dont `snowCm` de neige
 * (1 cm de neige ≈ 0,7 mm d'eau), `cape` pour le risque d'orage, `code` WMO éventuel.
 */
export function kindOf(mm: number, snowCm: number, cape: number | null, code?: number): PrecipKind {
  const snowWater = snowCm * 0.7;
  if (mm > 0 && snowWater >= mm * 0.6) return 'snow';
  if (mm > 0 && snowWater >= mm * 0.2) return 'mixed';
  if ((code !== undefined && code >= 95) || (cape !== null && cape >= STORM_CAPE)) return 'storm';
  return 'rain';
}

export const KIND_WORDS: Record<PrecipKind, string> = { rain: 'Pluie', snow: 'Neige', mixed: 'Pluie et neige', storm: 'Averses orageuses' };

/** Code WMO de pluie ou bruine (pas la neige ni le brouillard). */
const RAINY_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

/**
 * Libellé de l'en-tête cohérent avec la carte Pluie : si le modèle dit « Bruine » alors qu'on a établi
 * qu'il ne pleut pas (ou l'inverse), on corrige le libellé.
 */
export function headerLabel(base: string, code: number, wetNow: boolean | null, mmhNow: number, cloudCover: number): string {
  if (wetNow === null) return base;
  if (!wetNow && RAINY_CODES.has(code)) return cloudCover >= 85 ? 'Couvert' : 'Nuageux';
  if (wetNow && !RAINY_CODES.has(code) && !(code >= 71 && code <= 86)) return INTENSITY_LABELS[Math.max(1, intensity(mmhNow))];
  return base;
}
