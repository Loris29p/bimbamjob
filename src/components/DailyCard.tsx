// Prévisions sur plusieurs jours. Le contenu suit le mode choisi dans l'heure par heure :
// températures, pluie (barres par tranches de 3 h) ou vent (mini-courbe + écart).
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { hoursOfDay, startOfDay, type DayPoint, type HourPoint } from '../lib/forecast';
import { dayLabel, temp } from '../lib/format';
import { symbolFor, tempColor } from '../lib/sky';
import type { Mode } from './HourlyCard';
import { DIM, Glass, Icon, LINE, RAIN_BLUE, T } from './ui';

function RainBars({ hours }: { hours: HourPoint[] }) {
  // 8 tranches de 3 h, hauteur selon le cumul (échelle racine, plafonnée à 6 mm)
  const blocks = Array.from({ length: 8 }, (_, b) => hours.slice(b * 3, b * 3 + 3).reduce((s, h) => s + h.precipitation, 0));
  const now = Date.now() / 1000;
  return (
    <View style={styles.bars}>
      {blocks.map((mm, b) => {
        const past = hours[b * 3] && hours[b * 3].time + 3 * 3600 < now;
        const h = mm < 0.05 ? 0 : Math.max(3, Math.min(1, Math.sqrt(mm / 6)) * 22);
        return (
          <View key={b} style={[styles.barSlot, { opacity: past ? 0.45 : 1 }]}>
            <View style={[styles.barFill, { height: h }]} />
          </View>
        );
      })}
    </View>
  );
}

function WindLine({ hours, max }: { hours: HourPoint[]; max: number }) {
  const W = 86;
  const H = 24;
  if (hours.length < 2) return <View style={{ width: W }} />;
  const x = (i: number) => (i / (hours.length - 1)) * W;
  const y = (v: number) => H - 2 - (v / max) * (H - 4);
  const line = hours.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.windSpeed).toFixed(1)}`).join(' ');
  const gust = hours.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.windGusts).toFixed(1)}`).join(' ');
  return (
    <Svg width={W} height={H}>
      <Path d={`${gust} L${W},${H} L0,${H} Z`} fill="rgba(127,211,166,0.25)" />
      <Path d={line} stroke="#7FD3A6" strokeWidth={2} fill="none" />
    </Svg>
  );
}

export function DailyCard({ daily, hourly, currentTemp, mode = 'temp' }: { daily: DayPoint[]; hourly: HourPoint[]; currentTemp: number; mode?: Mode }) {
  if (!daily.length) return null;
  const lo = Math.min(...daily.map((d) => d.tMin));
  const hi = Math.max(...daily.map((d) => d.tMax));
  const span = Math.max(1, hi - lo);
  const pct = (t: number) => ((t - lo) / span) * 100;
  const maxWind = Math.max(20, ...hourly.map((h) => h.windGusts));

  return (
    <Glass title={`Prévisions sur ${daily.length} jours`} icon={{ ios: 'calendar', android: 'calendar_month' }}>
      {daily.map((d, i) => {
        const prob = d.precipitationProbability ?? 0;
        const hours = hoursOfDay(hourly, startOfDay(d.time)).slice(0, 24);
        return (
          <View key={d.time} style={[styles.row, i > 0 && styles.border]}>
            <T style={styles.day}>{dayLabel(d.time, i)}</T>
            {mode === 'rain' ? (
              <>
                <RainBars hours={hours} />
                <T style={[styles.mm, { color: d.precipitationSum >= 0.5 ? '#fff' : DIM }]}>{d.precipitationSum >= 0.5 ? `${Math.round(d.precipitationSum)} mm` : '0 mm'}</T>
                <T style={[styles.pct, { color: prob >= 20 ? RAIN_BLUE : DIM }]}>{prob} %</T>
              </>
            ) : mode === 'wind' ? (
              <>
                <WindLine hours={hours} max={maxWind} />
                <T style={styles.windRange}>
                  {hours.length ? `${Math.round(Math.min(...hours.map((h) => h.windSpeed)))} – ${Math.round(Math.max(...hours.map((h) => h.windSpeed)))}` : '–'}
                  <T style={{ color: DIM }}> km/h</T>
                </T>
              </>
            ) : (
              <>
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
              </>
            )}
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
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24 },
  barSlot: { width: 7, height: 24, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { backgroundColor: RAIN_BLUE, borderRadius: 2 },
  mm: { flex: 1, textAlign: 'right', fontSize: 17, fontWeight: '500' },
  pct: { width: 54, textAlign: 'right', fontSize: 16, fontWeight: '600' },
  windRange: { flex: 1, textAlign: 'right', fontSize: 17, fontWeight: '500' },
  note: { fontSize: 11.5, color: DIM, marginTop: 8 },
});
