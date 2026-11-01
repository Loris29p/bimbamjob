export type Place = {
  name: string;
  /** Code du département (ex. "29", "2A"), utilisé pour les vigilances. */
  department?: string;
  latitude: number;
  longitude: number;
};
