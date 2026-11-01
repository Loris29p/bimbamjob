import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Hourly } from '../lib/forecast';
import { hour, temp } from '../lib/format';
import { useTheme } from '../lib/theme';
import { describeWeather, windDirection } from '../lib/weatherCodes';
import { Card } from './Card';

export function HourlyStrip({ hourly }: { hourly: Hourly }) {
  const t = useTheme();
  const now = Date.now() / 1000;
  const items = hourly.filter((h) => h.time + 3600 > now).slice(0, 36);
  return (
    <Card title="Heure par heure (AROME / ARPEGE)">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.map((h, i) => {
          const w = describeWeather(h.weatherCode, h.isDay);
          return (
            <View key={h.time} style={[styles.col, { borderColor: t.border }]}>
              <Text style={[styles.small, { color: t.muted }]}>{i === 0 ? 'Maint.' : hour(h.time)}</Text>
              <Text style={styles.icon}>{w.icon}</Text>
              <Text style={[styles.temp, { color: t.text }]}>{temp(h.temperature)}</Text>
              <Text style={[styles.small, { color: t.muted }]}>ress. {temp(h.apparent)}</Text>
              <Text style={[styles.rain, { color: h.precipitation > 0 ? t.accent : t.muted }]}>
                {h.precipitation > 0 ? `${h.precipitation.toFixed(1)} mm` : '—'}
              </Text>
              <Text style={[styles.small, { color: t.muted }]}>
                {h.precipitationProbability !== null ? `${h.precipitationProbability} %` : ' '}
              </Text>
              <Text style={[styles.small, { color: t.muted }]}>
                {Math.round(h.windSpeed)} {windDirection(h.windDirection)}
              </Text>
              <Text style={[styles.small, { color: h.windGusts >= 60 ? '#E5484D' : t.muted }]}>
                raf. {Math.round(h.windGusts)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={[styles.note, { color: t.muted }]}>Pluie en mm/h · probabilité · vent et rafales en km/h</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  col: { width: 66, alignItems: 'center', gap: 3, paddingVertical: 4, borderRightWidth: StyleSheet.hairlineWidth },
  icon: { fontSize: 24 },
  temp: { fontSize: 17, fontWeight: '600' },
  rain: { fontSize: 12, fontWeight: '600' },
  small: { fontSize: 11 },
  note: { fontSize: 11, marginTop: 8 },
});
