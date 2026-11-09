// Pas de carte Apple Plans sur le web : l'aperçu n'est pas affiché.
import type { Place } from '../lib/types';

export function RadarPreview(_: { place: Place; temperature: number }) {
  return null;
}
