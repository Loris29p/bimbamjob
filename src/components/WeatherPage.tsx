// Une page = un lieu : en-tête, cartes de prévisions et tuiles de détail.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { minutesUntilRain } from '../lib/forecast';
import { temp, time } from '../lib/format';
import { notifyRain } from '../lib/notifications';
import { backgroundFor } from '../lib/sky';
import type { Place } from '../lib/types';
import { useForecast } from '../lib/useForecast';
import { weatherLabel } from '../lib/weatherCodes';
import { DailyCard } from './DailyCard';
import { HourlyCard } from './HourlyCard';
import { RainCard } from './RainCard';
import { Tiles } from './Tiles';
import { DIM, T } from './ui';
import { VigilanceBanner } from './VigilanceBanner';

export function WeatherPage({ place, bottomInset }: { place: Place; bottomInset: number }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { forecast, loading, error, refresh } = useForecast(place);

  useEffect(() => {
    if (!forecast || !place.isGps) return;
    const mins = minutesUntilRain(forecast.minutely);
    if (mins !== null && mins > 0) notifyRain(place.name, mins);
  }, [forecast, place]);

  const c = forecast?.current;
  const colors = c ? backgroundFor(c.weatherCode, c.isDay) : (['#2B5C9E', '#4D7FBF', '#7FA6D6'] as const);
  const today = forecast?.daily[0];

  return (
    <View style={{ width, height }}>
      <LinearGradient colors={[...colors]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: bottomInset + 24, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={loading && !!forecast} onRefresh={refresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {place.isGps ? <T style={styles.myPos}>MA POSITION</T> : null}
          <T style={styles.city} numberOfLines={1}>
            {place.name}
          </T>
          {c ? (
            <>
              <T style={styles.temp}>{temp(c.temperature)}</T>
              <T style={styles.cond}>{weatherLabel(c.weatherCode, c.isDay)}</T>
              {today ? (
                <T style={styles.hilo}>
                  Max. {temp(today.tMax)}  Min. {temp(today.tMin)}
                </T>
              ) : null}
            </>
          ) : error ? (
            <Pressable onPress={refresh} style={styles.retry}>
              <T style={{ textAlign: 'center' }}>{error}</T>
              <T style={{ fontWeight: '700', marginTop: 8 }}>Réessayer</T>
            </Pressable>
          ) : (
            <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
          )}
        </View>

        {forecast ? (
          <>
            <VigilanceBanner department={place.department} />
            <RainCard minutely={forecast.minutely} />
            <HourlyCard hourly={forecast.hourly} daily={forecast.daily} />
            <DailyCard daily={forecast.daily} currentTemp={forecast.current.temperature} />
            <Tiles forecast={forecast} />
            <T style={styles.source}>
              Prévisions : AROME et ARPEGE (Météo-France) · Mise à jour {time(forecast.fetchedAt / 1000)}
            </T>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 28 },
  myPos: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
  city: { fontSize: 32, fontWeight: '500', marginTop: 2 },
  temp: { fontSize: 96, fontWeight: '200', lineHeight: 104, marginLeft: 24 },
  cond: { fontSize: 20, fontWeight: '500', color: DIM },
  hilo: { fontSize: 20, fontWeight: '500', marginTop: 2 },
  retry: { marginTop: 30, padding: 16 },
  source: { fontSize: 12, color: DIM, textAlign: 'center', marginTop: 8 },
});
