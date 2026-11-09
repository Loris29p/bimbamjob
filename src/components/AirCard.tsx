// Qualité de l'air, présentée comme dans l'app Météo : niveau en gros, échelle colorée, comparaison avec hier.
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { aqiLevel, fetchAirQuality } from '../lib/airQuality';
import { placeKey, type Place } from '../lib/types';
import { useCached } from '../lib/useAsync';
import { Glass, T } from './ui';

// « La qualité de l'air est… » : libellés accordés au féminin
const NAMES: Record<string, string> = {
  Bon: 'Bonne',
  Moyen: 'Moyenne',
  Dégradé: 'Dégradée',
  Mauvais: 'Mauvaise',
  'Très mauvais': 'Très mauvaise',
  'Extrêmement mauvais': 'Extrêmement mauvaise',
};
const SCALE = ['#3D8BFF', '#34C759', '#A8D93A', '#FFD60A', '#FF9F0A', '#FF453A', '#B0123A', '#AF52DE'] as const;

export function AirCard({ place }: { place: Place }) {
  const air = useCached(`air:${placeKey(place)}`, () => fetchAirQuality(place));
  if (!air || !Number.isFinite(air.aqi)) return null;
  const level = aqiLevel(air.aqi);
  const ratio = Math.min(1, air.aqi / 120);

  let trend = '';
  if (air.yesterdayAqi !== null) {
    const d = air.aqi - air.yesterdayAqi;
    trend =
      Math.abs(d) < 5
        ? 'La qualité de l’air est comparable à hier à peu près à la même heure.'
        : d > 0
          ? 'La qualité de l’air est moins bonne qu’hier à peu près à la même heure.'
          : 'La qualité de l’air est meilleure qu’hier à peu près à la même heure.';
  }

  return (
    <Glass title="Qualité de l’air" icon={{ ios: 'aqi.medium', android: 'airwave' }}>
      <T style={styles.label}>{NAMES[level.label] ?? level.label}</T>
      <View style={styles.track}>
        <LinearGradient colors={SCALE as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bar} />
        <View style={[styles.dot, { left: `${ratio * 98}%` }]} />
      </View>
      {trend ? <T style={styles.text}>{trend}</T> : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 28, fontWeight: '700', letterSpacing: 0.3 },
  track: { height: 10, justifyContent: 'center', marginTop: 12, marginBottom: 12 },
  bar: { height: 5, borderRadius: 2.5 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, marginLeft: -5, backgroundColor: '#fff', borderWidth: 2, borderColor: 'rgba(30,40,60,0.9)' },
  text: { fontSize: 17, lineHeight: 22 },
});
