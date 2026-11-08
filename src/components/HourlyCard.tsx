import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { upcomingHours, type DayPoint, type HourPoint } from '../lib/forecast';
import { hour, temp, time } from '../lib/format';
import { symbolFor } from '../lib/sky';
import { isRainy, weatherLabel, windDirection } from '../lib/weatherCodes';
import { DIM, Glass, Icon, RAIN_BLUE, T } from './ui';

type Mode = 'temp' | 'rain' | 'wind';
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

const MODES: { id: Mode; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'temp', icon: { ios: 'cloud.sun.fill', android: 'partly_cloudy_day' } },
  { id: 'rain', icon: { ios: 'drop.fill', android: 'water_drop' } },
  { id: 'wind', icon: { ios: 'wind', android: 'air' } },
];

export function HourlyCard({ hourly, daily }: { hourly: HourPoint[]; daily: DayPoint[] }) {
  const [mode, setMode] = useState<Mode>('temp');
  const hours = upcomingHours(hourly).slice(0, 25);
  if (!hours.length) return null;
  const start = hours[0].time;
  const end = hours[hours.length - 1].time + 3600;

  const items: Item[] = hours.map((h, i) => ({ kind: 'hour', h, first: i === 0 }));
  if (mode === 'temp') {
    for (const d of daily.slice(0, 2)) {
      for (const [t, rise] of [[d.sunrise, true], [d.sunset, false]] as const) {
        if (t > start && t < end) items.push({ kind: 'sun', time: t, rise });
      }
    }
  }
  items.sort((a, b) => (a.kind === 'hour' ? a.h.time : a.time) - (b.kind === 'hour' ? b.h.time : b.time));
  const maxRain = Math.max(1, ...hours.map((h) => h.precipitation));

  return (
    <Glass>
      <View style={styles.top}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/detail', params: { metric: mode } })}>
          <T style={styles.summary}>{summary(hours)}</T>
        </Pressable>
        <View style={styles.modes}>
          {MODES.map((m) => (
            <Pressable key={m.id} onPress={() => setMode(m.id)} style={[styles.mode, mode === m.id && styles.modeOn]} hitSlop={4}>
              <Icon name={m.icon} size={15} />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.sep} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
        {items.map((it) => {
          if (it.kind === 'sun') {
            return (
              <View key={`sun${it.time}`} style={styles.col}>
                <T style={styles.hour}>{time(it.time)}</T>
                <View style={styles.iconBox}>
                  <Icon name={it.rise ? { ios: 'sunrise.fill', android: 'wb_twilight' } : { ios: 'sunset.fill', android: 'wb_twilight' }} size={26} multicolor />
                </View>
                <T style={styles.sunLabel}>{it.rise ? 'Lever' : 'Coucher'}</T>
              </View>
            );
          }
          const h = it.h;
          return (
            <View key={h.time} style={styles.col}>
              <T style={styles.hour}>{it.first ? 'Maint.' : hour(h.time)}</T>
              {mode === 'temp' ? (
                <>
                  <View style={styles.iconBox}>
                    <Icon name={symbolFor(h.weatherCode, h.isDay)} size={26} multicolor />
                    {(h.precipitationProbability ?? 0) >= 20 ? <T style={styles.prob}>{Math.round((h.precipitationProbability ?? 0) / 10) * 10} %</T> : null}
                  </View>
                  <T style={styles.value}>{temp(h.temperature)}</T>
                </>
              ) : mode === 'rain' ? (
                <>
                  <View style={[styles.iconBox, { justifyContent: 'flex-end' }]}>
                    <View style={[styles.rainBar, { height: Math.max(2, (h.precipitation / maxRain) * 44), opacity: h.precipitation > 0 ? 1 : 0.25 }]} />
                  </View>
                  <T style={styles.value}>{h.precipitation >= 0.1 ? h.precipitation.toFixed(1) : '0'}</T>
                  <T style={styles.smallBlue}>{h.precipitationProbability !== null ? `${h.precipitationProbability} %` : ' '}</T>
                </>
              ) : (
                <>
                  <View style={styles.iconBox}>
                    {/* flèche dans le sens où souffle le vent */}
                    <View style={{ transform: [{ rotate: `${h.windDirection + 180}deg` }] }}>
                      <Icon name={{ ios: 'location.north.fill', android: 'navigation' }} size={18} />
                    </View>
                    <T style={styles.small}>{windDirection(h.windDirection)}</T>
                  </View>
                  <T style={styles.value}>{Math.round(h.windSpeed)}</T>
                  <T style={[styles.small, h.windGusts >= 60 && { color: '#FF8A80' }]}>raf. {Math.round(h.windGusts)}</T>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
      <T style={styles.unit}>{mode === 'rain' ? 'Pluie en mm/h · risque en %' : mode === 'wind' ? 'Vent et rafales en km/h' : ' '}</T>
    </Glass>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  summary: { fontSize: 15, lineHeight: 20 },
  modes: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, padding: 2 },
  mode: { width: 34, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: 'rgba(255,255,255,0.25)' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 12 },
  col: { width: 54, alignItems: 'center' },
  hour: { fontSize: 14, fontWeight: '600' },
  iconBox: { height: 52, alignItems: 'center', justifyContent: 'center' },
  prob: { color: RAIN_BLUE, fontSize: 11, fontWeight: '700', marginTop: 2 },
  value: { fontSize: 19, fontWeight: '500' },
  rainBar: { width: 14, borderRadius: 3, backgroundColor: RAIN_BLUE },
  smallBlue: { fontSize: 11, color: RAIN_BLUE, fontWeight: '600' },
  small: { fontSize: 11, color: DIM },
  sunLabel: { fontSize: 12, color: DIM, marginTop: 4 },
  unit: { fontSize: 11, color: DIM, marginTop: 6 },
});
