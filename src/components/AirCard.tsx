import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { AQI_LEVELS, aqiLevel, fetchAirQuality } from '../lib/airQuality';
import { placeKey, type Place } from '../lib/types';
import { useCached } from '../lib/useAsync';
import { DIM, Glass, T } from './ui';

export function AirCard({ place }: { place: Place }) {
  const air = useCached(`air:${placeKey(place)}`, () => fetchAirQuality(place));
  if (!air || !Number.isFinite(air.aqi)) return null;
  const level = aqiLevel(air.aqi);
  const ratio = Math.min(1, air.aqi / 120);

  let trend = '';
  if (air.yesterdayAqi !== null) {
    const d = air.aqi - air.yesterdayAqi;
    trend = Math.abs(d) < 5 ? 'Comparable à hier à la même heure.' : d > 0 ? 'Moins bonne qu’hier à la même heure.' : 'Meilleure qu’hier à la même heure.';
  }
  const pollutants = [
    { label: 'PM2,5', v: air.pm25 },
    { label: 'PM10', v: air.pm10 },
    { label: 'NO₂', v: air.no2 },
    { label: 'O₃', v: air.o3 },
  ].filter((p) => Number.isFinite(p.v));

  return (
    <Glass title="Qualité de l’air" icon={{ ios: 'aqi.medium', android: 'airwave' }}>
      <View style={styles.row}>
        <T style={styles.value}>{Math.round(air.aqi)}</T>
        <T style={styles.label}>{level.label}</T>
      </View>
      <View style={styles.track}>
        <LinearGradient colors={AQI_LEVELS.map((l) => l.color) as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.dot, { left: `${ratio * 97}%` }]} />
      </View>
      {trend ? <T style={styles.text}>{trend}</T> : null}
      <View style={styles.pollutants}>
        {pollutants.map((p) => (
          <View key={p.label} style={{ alignItems: 'center' }}>
            <T style={styles.pv}>{Math.round(p.v)}</T>
            <T style={styles.pl}>{p.label}</T>
          </View>
        ))}
      </View>
      <T style={styles.src}>Indice européen (µg/m³) · Copernicus CAMS</T>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  value: { fontSize: 30, fontWeight: '600' },
  label: { fontSize: 20, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'visible', marginVertical: 12 },
  dot: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', borderWidth: 2, borderColor: 'rgba(0,0,0,0.35)' },
  text: { fontSize: 15 },
  pollutants: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  pv: { fontSize: 17, fontWeight: '600' },
  pl: { fontSize: 11, color: DIM },
  src: { fontSize: 11, color: DIM, marginTop: 10 },
});
