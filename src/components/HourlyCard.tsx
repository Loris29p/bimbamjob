import { ScrollView, StyleSheet, View } from 'react-native';
import { upcomingHours, type DayPoint, type HourPoint } from '../lib/forecast';
import { hour, temp, time } from '../lib/format';
import { symbolFor } from '../lib/sky';
import { isRainy, weatherLabel } from '../lib/weatherCodes';
import { DIM, Glass, Icon, RAIN_BLUE, T } from './ui';

type Item = { kind: 'hour'; h: HourPoint; first: boolean } | { kind: 'sun'; time: number; rise: boolean };

/** Phrase de synthèse pour les prochaines heures. */
function summary(hours: HourPoint[]) {
  const next = hours.slice(0, 24);
  const rainIdx = next.findIndex((h) => isRainy(h.weatherCode) || (h.precipitationProbability ?? 0) >= 60);
  const gust = Math.max(...next.map((h) => h.windGusts));
  const parts: string[] = [];
  if (rainIdx === 0) {
    const stop = next.findIndex((h) => !isRainy(h.weatherCode) && h.precipitation < 0.1);
    parts.push(stop > 0 ? `Pluie jusqu'à ${hour(next[stop].time)} environ.` : 'Temps pluvieux ces prochaines heures.');
  } else if (rainIdx > 0) {
    parts.push(`${weatherLabel(next[rainIdx].weatherCode)} attendue vers ${hour(next[rainIdx].time)}.`);
  } else {
    parts.push(`${weatherLabel(next[Math.min(2, next.length - 1)].weatherCode, next[0].isDay)} pour les prochaines heures, sans pluie prévue.`);
  }
  if (gust >= 50) parts.push(`Rafales jusqu'à ${Math.round(gust)} km/h.`);
  return parts.join(' ');
}

export function HourlyCard({ hourly, daily }: { hourly: HourPoint[]; daily: DayPoint[] }) {
  const hours = upcomingHours(hourly).slice(0, 25);
  if (!hours.length) return null;
  const start = hours[0].time;
  const end = hours[hours.length - 1].time + 3600;

  const items: Item[] = hours.map((h, i) => ({ kind: 'hour', h, first: i === 0 }));
  for (const d of daily.slice(0, 2)) {
    for (const [t, rise] of [[d.sunrise, true], [d.sunset, false]] as const) {
      if (t > start && t < end) items.push({ kind: 'sun', time: t, rise });
    }
  }
  items.sort((a, b) => (a.kind === 'hour' ? a.h.time : a.time) - (b.kind === 'hour' ? b.h.time : b.time));

  return (
    <Glass>
      <T style={styles.summary}>{summary(hours)}</T>
      <View style={styles.sep} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
        {items.map((it) =>
          it.kind === 'hour' ? (
            <View key={it.h.time} style={styles.col}>
              <T style={styles.hour}>{it.first ? 'Maint.' : hour(it.h.time)}</T>
              <View style={styles.iconBox}>
                <Icon name={symbolFor(it.h.weatherCode, it.h.isDay)} size={26} multicolor />
                {(it.h.precipitationProbability ?? 0) >= 20 ? (
                  <T style={styles.prob}>{Math.round((it.h.precipitationProbability ?? 0) / 10) * 10} %</T>
                ) : null}
              </View>
              <T style={styles.temp}>{temp(it.h.temperature)}</T>
            </View>
          ) : (
            <View key={`sun${it.time}`} style={styles.col}>
              <T style={styles.hour}>{time(it.time)}</T>
              <View style={styles.iconBox}>
                <Icon name={it.rise ? { ios: 'sunrise.fill', android: 'wb_twilight' } : { ios: 'sunset.fill', android: 'wb_twilight' }} size={26} multicolor />
              </View>
              <T style={styles.sunLabel}>{it.rise ? 'Lever' : 'Coucher'}</T>
            </View>
          ),
        )}
      </ScrollView>
    </Glass>
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 15, lineHeight: 20 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 12 },
  col: { width: 54, alignItems: 'center' },
  hour: { fontSize: 14, fontWeight: '600' },
  iconBox: { height: 52, alignItems: 'center', justifyContent: 'center' },
  prob: { color: RAIN_BLUE, fontSize: 11, fontWeight: '700', marginTop: 2 },
  temp: { fontSize: 19, fontWeight: '500' },
  sunLabel: { fontSize: 12, color: DIM, marginTop: 4 },
});
