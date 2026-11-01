import { StyleSheet, Text, View } from 'react-native';
import type { Daily } from '../lib/forecast';
import { dayLabel, temp } from '../lib/format';
import { useTheme } from '../lib/theme';
import { describeWeather } from '../lib/weatherCodes';
import { Card } from './Card';

export function DailyList({ daily }: { daily: Daily }) {
  const t = useTheme();
  if (daily.length === 0) return null;
  const min = Math.min(...daily.map((d) => d.tMin));
  const max = Math.max(...daily.map((d) => d.tMax));
  const span = Math.max(1, max - min);

  return (
    <Card title="14 jours">
      {daily.map((d, i) => {
        const w = describeWeather(d.weatherCode);
        return (
          <View key={d.time} style={[styles.row, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.day, { color: t.text }]}>{dayLabel(d.time, i)}</Text>
            <Text style={styles.icon}>{w.icon}</Text>
            <View style={styles.rainBox}>
              <Text style={[styles.rain, { color: d.precipitationSum > 0.1 ? t.accent : t.muted }]}>
                {d.precipitationSum > 0.1 ? `${d.precipitationSum.toFixed(1)} mm` : ''}
              </Text>
              {d.precipitationProbability ? (
                <Text style={[styles.prob, { color: t.muted }]}>{d.precipitationProbability} %</Text>
              ) : null}
            </View>
            <Text style={[styles.tmin, { color: t.muted }]}>{temp(d.tMin)}</Text>
            <View style={[styles.track, { backgroundColor: t.border }]}>
              <View
                style={[
                  styles.range,
                  { left: `${((d.tMin - min) / span) * 100}%`, width: `${Math.max(4, ((d.tMax - d.tMin) / span) * 100)}%` },
                ]}
              />
            </View>
            <Text style={[styles.tmax, { color: t.text }]}>{temp(d.tMax)}</Text>
          </View>
        );
      })}
      <Text style={[styles.note, { color: t.muted }]}>Au-delà de 4 jours, la fiabilité baisse : à prendre comme une tendance.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 8 },
  day: { width: 92, fontSize: 15 },
  icon: { fontSize: 22, width: 30 },
  rainBox: { width: 58 },
  rain: { fontSize: 12, fontWeight: '600' },
  prob: { fontSize: 11 },
  tmin: { width: 32, textAlign: 'right' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  range: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: '#F2994A' },
  tmax: { width: 32, fontWeight: '600' },
  note: { fontSize: 11, marginTop: 8 },
});
