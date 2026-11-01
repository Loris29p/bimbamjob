// « Pluie dans l'heure » : 8 tranches de 15 min (2 h) issues du modèle AROME de Météo-France.
import { StyleSheet, Text, View } from 'react-native';
import { minutesUntilRain, type Minutely } from '../lib/forecast';
import { time } from '../lib/format';
import { useTheme } from '../lib/theme';
import { RAIN_LABELS, rainLevel } from '../lib/weatherCodes';
import { Card } from './Card';

export function RainNextHour({ minutely }: { minutely: Minutely }) {
  const t = useTheme();
  const now = Date.now() / 1000;
  const slots = minutely.filter((p) => p.time + 15 * 60 > now).slice(0, 8);
  if (slots.length === 0) return null;

  const levels = slots.map((s) => rainLevel(s.precipitation));
  const rainingNow = levels[0] > 0;
  const mins = minutesUntilRain(minutely);
  const dryAt = rainingNow ? slots.find((_, i) => levels[i] === 0) : undefined;

  let headline = 'Pas de pluie prévue dans les 2 prochaines heures';
  if (rainingNow) headline = dryAt ? `${RAIN_LABELS[levels[0]]} jusqu'à ${time(dryAt.time)} environ` : `${RAIN_LABELS[levels[0]]} en cours`;
  else if (mins !== null) headline = `Pluie prévue dans ~${mins} min`;
  else if (levels.some((l) => l > 0)) headline = `Pluie possible à partir de ${time(slots[levels.findIndex((l) => l > 0)].time)}`;

  return (
    <Card title="Pluie dans les 2 h">
      <Text style={[styles.headline, { color: t.text }]}>{headline}</Text>
      <View style={styles.bars}>
        {slots.map((s, i) => (
          <View key={s.time} style={styles.slot}>
            <View style={[styles.bar, { backgroundColor: t.rain[levels[i]], borderColor: t.border }]} />
            <Text style={[styles.label, { color: t.muted }]}>{i % 2 === 0 ? time(s.time) : ''}</Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        {RAIN_LABELS.slice(1).map((l, i) => (
          <View key={l} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: t.rain[i + 1] }]} />
            <Text style={{ color: t.muted, fontSize: 12 }}>{l.replace('Pluie ', '')}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  bars: { flexDirection: 'row', gap: 3 },
  slot: { flex: 1 },
  bar: { height: 26, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 11, marginTop: 4 },
  legend: { flexDirection: 'row', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
