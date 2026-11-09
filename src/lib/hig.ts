// Repères des recommandations d'Apple pour iOS (Human Interface Guidelines) :
// styles de texte « Dynamic Type » par défaut, couleurs système en mode sombre,
// espacements sur une grille de 4 pt, zones tactiles d'au moins 44 pt.
import * as Haptics from 'expo-haptics';
import { Platform, type TextStyle } from 'react-native';

export const TYPE = {
  largeTitle: { fontSize: 34, fontWeight: '400', letterSpacing: 0.4 },
  title1: { fontSize: 28, fontWeight: '400', letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: '400', letterSpacing: 0.35 },
  title3: { fontSize: 20, fontWeight: '400', letterSpacing: 0.38 },
  headline: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, fontWeight: '400', letterSpacing: -0.32 },
  subheadline: { fontSize: 15, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, fontWeight: '400', letterSpacing: 0.07 },
} satisfies Record<string, TextStyle>;

// Couleurs système iOS (variante sombre), utilisées sur fond de ciel
export const COLOR = {
  label: '#FFFFFF',
  secondaryLabel: 'rgba(235,235,245,0.6)',
  tertiaryLabel: 'rgba(235,235,245,0.3)',
  separator: 'rgba(235,235,245,0.18)',
  systemBlue: '#0A84FF',
  systemCyan: '#64D2FF',
  systemRed: '#FF453A',
  systemGroupedBackground: '#000000',
  secondaryGroupedBackground: '#1C1C1E',
  tertiaryGroupedBackground: '#2C2C2E',
};

export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24 };
export const RADIUS = { card: 22, control: 12, pill: 999 };
export const HIT = 44;

/** Retour haptique léger (sélection) — sans effet sur Android/web si non pris en charge. */
export function tick() {
  if (Platform.OS === 'ios') Haptics.selectionAsync().catch(() => {});
}
/** Petit « choc » pour une action (ajout, suppression…). */
export function tap() {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
