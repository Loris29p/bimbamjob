import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import type { DayPoint } from '../lib/forecast';
import { dayLabel, temp } from '../lib/format';
import { symbolFor, tempColor } from '../lib/sky';
import { DIM, Glass, Icon, LINE, RAIN_BLUE, T } from './ui';

export function DailyCard({ daily, currentTemp }: { daily: DayPoint[]; currentTemp: number }) {
  if (!daily.length) return null;
  const lo = Math.min(...daily.map((d) => d.tMin));
  const hi = Math.max(...daily.map((d) => d.tMax));
  const span = Math.max(1, hi - lo);
  const pct = (t: number) => ((t - lo) / span) * 100;

  return (
    <Glass title={`Prévisions sur ${daily.length} jours`} icon={{ ios: 'calendar', android: 'calendar_month' }}>
      {daily.map((d, i) => {
        const prob = d.precipitationProbability ?? 0;
        return (
          <View key={d.time} style={[styles.row, i > 0 && styles.border]}>
            <T style={styles.day}>{dayLabel(d.time, i)}</T>
            <View style={styles.iconBox}>
              <Icon name={symbolFor(d.weatherCode)} size={24} multicolor />
              {prob >= 30 ? <T style={styles.prob}>{Math.round(prob / 10) * 10} %</T> : null}
            </View>
            <T style={styles.min}>{temp(d.tMin)}</T>
            <View style={styles.track}>
              <LinearGradient
                colors={[tempColor(d.tMin), tempColor(d.tMax)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.range, { left: `${pct(d.tMin)}%`, width: `${Math.max(6, pct(d.tMax) - pct(d.tMin))}%` }]}
              />
              {i === 0 ? <View style={[styles.now, { left: `${Math.min(97, Math.max(0, pct(currentTemp)))}%` }]} /> : null}
            </View>
            <T style={styles.max}>{temp(d.tMax)}</T>
          </View>
        );
      })}
      <T style={styles.note}>
        {daily.filter((d) => d.meteoFrance).length} premiers jours : modèles Météo-France. Au-delà : tendance (ECMWF), moins fiable.
      </T>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: 50, gap: 8 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  day: { width: 46, fontSize: 18, fontWeight: '500' },
  iconBox: { width: 40, alignItems: 'center' },
  prob: { color: RAIN_BLUE, fontSize: 11, fontWeight: '700' },
  min: { width: 36, textAlign: 'right', fontSize: 18, color: DIM },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
  range: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  now: { position: 'absolute', top: -1.5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' },
  max: { width: 36, fontSize: 18, fontWeight: '500' },
  note: { fontSize: 11.5, color: DIM, marginTop: 8 },
});
