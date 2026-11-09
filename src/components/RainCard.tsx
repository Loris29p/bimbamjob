// Pluie dans les 3 prochaines heures, par tranches de 15 min (modèle AROME de Météo-France).
import { StyleSheet, View } from 'react-native';
import { minutesUntilRain, upcomingMinutely, type Minutely } from '../lib/forecast';
import { time } from '../lib/format';
import { RAIN_LABELS, rainLevel } from '../lib/weatherCodes';
import { DIM, Glass, LINE, RAIN_BLUE, T } from './ui';

const MAX_MMH = 8;

export function rainHeadline(minutely: Minutely) {
  const slots = upcomingMinutely(minutely);
  if (!slots.length) return null;
  const levels = slots.map((s) => rainLevel(s.precipitation));
  const firstRain = levels.findIndex((l) => l > 0);
  if (firstRain === -1) return null;
  if (firstRain === 0) {
    const dry = levels.findIndex((l) => l === 0);
    return dry === -1 ? `${RAIN_LABELS[levels[0]]} pour les prochaines heures` : `${RAIN_LABELS[levels[0]]}, fin prévue vers ${time(slots[dry].time)}`;
  }
  const mins = minutesUntilRain(minutely);
  return mins !== null ? `${RAIN_LABELS[levels[firstRain]]} dans ~${mins} min` : `${RAIN_LABELS[levels[firstRain]]} vers ${time(slots[firstRain].time)}`;
}

export function RainCard({ minutely }: { minutely: Minutely }) {
  const slots = upcomingMinutely(minutely).slice(0, 12);
  const headline = rainHeadline(minutely);
  if (!headline || slots.length < 2) return null;

  return (
    <Glass title="Pluie dans les 3 h" icon={{ ios: 'umbrella.fill', android: 'umbrella' }}>
      <T style={styles.headline}>{headline}</T>
      <View style={styles.chart}>
        {[0.33, 0.66].map((k) => (
          <View key={k} style={[styles.grid, { bottom: `${k * 100}%` }]} />
        ))}
        {slots.map((s) => {
          const mmh = s.precipitation * 4;
          const h = mmh <= 0.05 ? 0 : Math.max(0.06, Math.min(1, Math.sqrt(mmh / MAX_MMH)));
          return (
            <View key={s.time} style={styles.col}>
              <View style={[styles.bar, { height: `${h * 100}%` }]} />
            </View>
          );
        })}
      </View>
      {/* une étiquette par heure (toutes les 4 barres), sur une seule ligne */}
      <View style={styles.axis}>
        {slots
          .filter((_, i) => i % 4 === 0)
          .map((s, k) => (
            <T key={s.time} numberOfLines={1} style={[styles.label, { flex: Math.min(4, slots.length - k * 4) }]}>
              {k === 0 ? 'Maint.' : time(s.time)}
            </T>
          ))}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  chart: { height: 70, flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: LINE },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: RAIN_BLUE, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axis: { flexDirection: 'row', gap: 4, marginTop: 4 },
  label: { fontSize: 12, color: DIM },
});
