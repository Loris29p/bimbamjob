import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { DailyList } from '../../components/DailyList';
import { HourlyStrip } from '../../components/HourlyStrip';
import { RainNextHour } from '../../components/RainNextHour';
import { longDay, temp, time } from '../../lib/format';
import { usePlace } from '../../lib/PlaceContext';
import { useTheme } from '../../lib/theme';
import { describeWeather, windDirection } from '../../lib/weatherCodes';

export default function WeatherScreen() {
  const t = useTheme();
  const { place, usingGps, forecast, loading, error, refresh, toggleFavorite, isFavorite } = usePlace();

  if (!forecast) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]}>
        {error ? (
          <>
            <Text style={{ color: t.text, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
            <Pressable onPress={refresh} style={[styles.button, { backgroundColor: t.accent }]}>
              <Text style={styles.buttonText}>Réessayer</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={t.accent} />
        )}
      </SafeAreaView>
    );
  }

  const c = forecast.current;
  const w = describeWeather(c.weatherCode, c.isDay);
  const today = forecast.daily[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.accent} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.city, { color: t.text }]} numberOfLines={1}>
              {usingGps ? '📍 ' : ''}
              {place?.name}
            </Text>
            <Text style={{ color: t.muted }}>{longDay(c.time)} · mis à jour {time(forecast.fetchedAt / 1000)}</Text>
          </View>
          {place ? (
            <Pressable onPress={() => toggleFavorite(place)} hitSlop={12}>
              <Text style={{ fontSize: 26 }}>{isFavorite(place) ? '★' : '☆'}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={[styles.error]}>{error}</Text> : null}

        <View style={styles.now}>
          <Text style={styles.nowIcon}>{w.icon}</Text>
          <View>
            <Text style={[styles.nowTemp, { color: t.text }]}>{temp(c.temperature)}</Text>
            <Text style={[styles.nowLabel, { color: t.text }]}>{w.label}</Text>
            <Text style={{ color: t.muted }}>
              Ressenti {temp(c.apparent)}
              {today ? ` · ${temp(today.tMin)} / ${temp(today.tMax)}` : ''}
            </Text>
          </View>
        </View>

        <RainNextHour minutely={forecast.minutely} />

        <Card title="En ce moment">
          <View style={styles.grid}>
            <Stat label="Vent" value={`${Math.round(c.windSpeed)} km/h ${windDirection(c.windDirection)}`} />
            <Stat label="Rafales" value={`${Math.round(c.windGusts)} km/h`} />
            <Stat label="Humidité" value={`${Math.round(c.humidity)} %`} />
            <Stat label="Pression" value={`${Math.round(c.pressure)} hPa`} />
            <Stat label="Nuages" value={`${Math.round(c.cloudCover)} %`} />
            <Stat label="Pluie (1 h)" value={`${c.precipitation.toFixed(1)} mm`} />
            {today?.uvMax != null ? <Stat label="UV max" value={`${Math.round(today.uvMax)}`} /> : null}
            {today ? <Stat label="Soleil" value={`${time(today.sunrise)} – ${time(today.sunset)}`} /> : null}
          </View>
        </Card>

        <HourlyStrip hourly={forecast.hourly} />
        <DailyList daily={forecast.daily} />

        <Text style={[styles.source, { color: t.muted }]}>
          Données : modèles AROME et ARPEGE de Météo-France (via Open-Meteo), ECMWF pour la tendance à 14 jours.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  city: { fontSize: 26, fontWeight: '700' },
  error: { color: '#E5484D', marginBottom: 8 },
  now: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 16 },
  nowIcon: { fontSize: 72 },
  nowTemp: { fontSize: 56, fontWeight: '300' },
  nowLabel: { fontSize: 18, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  stat: { width: '50%' },
  source: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  button: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
