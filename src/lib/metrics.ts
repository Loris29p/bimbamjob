// Définition des indicateurs affichables en détail (graphique 24 h).
import type { SymbolViewProps } from 'expo-symbols';
import type { HourPoint } from './forecast';

export type MetricId = 'temp' | 'rain' | 'wind' | 'uv' | 'humidity' | 'pressure' | 'visibility';

type Metric = {
  title: string;
  icon: SymbolViewProps['name'];
  unit: string;
  color: string;
  get: (h: HourPoint) => number | null;
  /** valeur secondaire (ressenti, rafales…) */
  get2?: (h: HourPoint) => number | null;
  label2?: string;
  bars?: boolean;
  fixedRange?: [number, number];
  about: string;
};

export const METRICS: Record<MetricId, Metric> = {
  temp: {
    title: 'Température',
    icon: { ios: 'thermometer.medium', android: 'thermostat' },
    unit: '°',
    color: '#FFB340',
    get: (h) => h.temperature,
    get2: (h) => h.apparent,
    label2: 'Ressentie',
    about: 'Température de l’air à 2 m. La température ressentie tient compte du vent et de l’humidité.',
  },
  rain: {
    title: 'Précipitations',
    icon: { ios: 'drop.fill', android: 'water_drop' },
    unit: ' %',
    color: '#5AC8FA',
    get: (h) => h.precipitationProbability,
    get2: (h) => h.precipitation,
    label2: 'Quantité (mm)',
    bars: true,
    fixedRange: [0, 100],
    about: 'Risque de précipitation heure par heure. La quantité (mm) vient des modèles Météo-France quand ils sont disponibles.',
  },
  wind: {
    title: 'Vent',
    icon: { ios: 'wind', android: 'air' },
    unit: ' km/h',
    color: '#7FD3A6',
    get: (h) => h.windSpeed,
    get2: (h) => h.windGusts,
    label2: 'Rafales',
    about: 'Vent moyen à 10 m. Les rafales sont les pointes de vent attendues.',
  },
  uv: {
    title: 'Indice UV',
    icon: { ios: 'sun.max.fill', android: 'light_mode' },
    unit: '',
    color: '#FFD60A',
    get: (h) => h.uv,
    fixedRange: [0, 11],
    about: 'Indice UV de l’OMS. Protection conseillée à partir de 3.',
  },
  humidity: {
    title: 'Humidité',
    icon: { ios: 'humidity.fill', android: 'humidity_percentage' },
    unit: ' %',
    color: '#64D2FF',
    get: (h) => h.humidity,
    get2: (h) => h.dewPoint,
    label2: 'Point de rosée (°)',
    fixedRange: [0, 100],
    about: 'Humidité relative. Le point de rosée indique à quel point l’air est lourd : au-delà de 16 °, il paraît moite.',
  },
  pressure: {
    title: 'Pression',
    icon: { ios: 'gauge.with.dots.needle.33percent', android: 'speed' },
    unit: ' hPa',
    color: '#BF9BFF',
    get: (h) => h.pressure,
    about: 'Pression au niveau de la mer. Une baisse rapide annonce souvent une dégradation.',
  },
  visibility: {
    title: 'Visibilité',
    icon: { ios: 'eye.fill', android: 'visibility' },
    unit: ' km',
    color: '#A0C4FF',
    get: (h) => (h.visibility === null ? null : h.visibility / 1000),
    about: 'Distance à laquelle on distingue nettement les objets. Moins de 1 km : brouillard.',
  },
};
