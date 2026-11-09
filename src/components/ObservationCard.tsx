// Mesures réelles de la station Météo-France la plus proche.
import { StyleSheet, View } from 'react-native';
import type { Observation } from '../lib/observations';
import { windFrom } from '../lib/weatherCodes';
import { DIM, Glass, LINE, T } from './ui';

export function ago(unix: number) {
  const min = Math.max(0, Math.round((Date.now() / 1000 - unix) / 60));
  return min < 60 ? `il y a ${min} min` : `il y a ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** « ST-MAUR » → « St-Maur » */
export const pretty = (name: string) => name.replace(/_/g, ' ').toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

export function ObservationCard({ obs }: { obs: Observation }) {
  const rows: [string, string][] = [];
  if (obs.temperature !== null) rows.push(['Température', `${obs.temperature.toFixed(1)}°`]);
  if (obs.humidity !== null) rows.push(['Humidité', `${Math.round(obs.humidity)} %`]);
  if (obs.windSpeed !== null)
    rows.push(['Vent', `${Math.round(obs.windSpeed)} km/h${obs.windDirection !== null ? ` ${windFrom(obs.windDirection)}` : ''}`]);
  if (obs.windGusts !== null) rows.push(['Rafales', `${Math.round(obs.windGusts)} km/h`]);
  if (obs.rain6min !== null) rows.push(['Pluie (6 dernières min)', `${obs.rain6min.toFixed(1)} mm`]);
  if (obs.pressure !== null) rows.push(['Pression', `${Math.round(obs.pressure)} hPa`]);
  if (obs.visibility !== null) rows.push(['Visibilité', obs.visibility >= 10000 ? `${Math.round(obs.visibility / 1000)} km` : `${(obs.visibility / 1000).toFixed(1)} km`]);
  if (!rows.length) return null;

  return (
    <Glass title="Mesuré en ce moment" icon={{ ios: 'sensor.fill', android: 'sensors' }}>
      <T style={styles.station}>
        Station Météo-France {pretty(obs.station.name)} · {obs.distanceKm < 1 ? 'moins de 1' : Math.round(obs.distanceKm)} km · {ago(obs.time)}
      </T>
      {obs.windStation ? (
        <T style={styles.station}>
          Vent : station {pretty(obs.windStation.name)} · {Math.round(obs.windStation.distanceKm)} km
        </T>
      ) : null}
      {rows.map(([k, v], i) => (
        <View key={k} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE }]}>
          <T style={{ fontSize: 15 }}>{k}</T>
          <T style={{ fontSize: 15, fontWeight: '600' }}>{v}</T>
        </View>
      ))}
    </Glass>
  );
}

const styles = StyleSheet.create({
  station: { color: DIM, fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
});
