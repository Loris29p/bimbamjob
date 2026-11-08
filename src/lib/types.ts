export type Place = {
  name: string;
  /** Code du département (ex. "29", "2A"), utilisé pour les vigilances. */
  department?: string;
  latitude: number;
  longitude: number;
  /** true pour la position GPS de l'appareil */
  isGps?: boolean;
};

export const placeKey = (p: Place) => `${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}`;
