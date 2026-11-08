// Une page = un lieu : en-tête, cartes de prévisions et tuiles de détail.
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { minutesUntilRain } from '../lib/forecast';
import { temp, time } from '../lib/format';
import { notifyRain } from '../lib/notifications';
import { backgroundFor } from '../lib/sky';
import type { Place } from '../lib/types';
import { useForecast } from '../lib/useForecast';
import { weatherLabel } from '../lib/weatherCodes';
import { AirCard } from './AirCard';
import { DailyCard } from './DailyCard';
import { HourlyCard } from './HourlyCard';
import { MoonCard } from './MoonCard';
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
  const scrollY = useRef(new Animated.Value(0)).current;
  const bigOpacity = scrollY.interpolate({ inputRange: [0, 110], outputRange: [1, 0], extrapolate: 'clamp' });
  const compactOpacity = scrollY.interpolate({ inputRange: [90, 140], outputRange: [0, 1], extrapolate: 'clamp' });
  const headerShift = scrollY.interpolate({ inputRange: [-100, 0, 160], outputRange: [40, 0, 90], extrapolate: 'clamp' });

  return (
    <View style={{ width, height }}>
      <LinearGradient colors={[...colors]} style={StyleSheet.absoluteFill} />
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: bottomInset + 24, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={loading && !!forecast} onRefresh={refresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: bigOpacity, transform: [{ translateY: headerShift }] }]}>
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
        </Animated.View>

        {forecast ? (
          <>
            <VigilanceBanner department={place.department} />
            <RainCard minutely={forecast.minutely} />
            <HourlyCard hourly={forecast.hourly} daily={forecast.daily} />
            <Pressable onPress={() => router.push({ pathname: '/detail', params: { metric: 'temp' } })}>
              <DailyCard daily={forecast.daily} currentTemp={forecast.current.temperature} />
            </Pressable>
            <AirCard place={place} />
            <Tiles forecast={forecast} />
            <MoonCard />
            <T style={styles.source}>
              Prévisions : AROME et ARPEGE (Météo-France) · Mise à jour {time(forecast.fetchedAt / 1000)}
            </T>
          </>
        ) : null}
      </Animated.ScrollView>

      {/* En-tête compact qui apparaît quand on fait défiler */}
      <Animated.View pointerEvents="none" style={[styles.compact, { paddingTop: insets.top + 6, opacity: compactOpacity }]}>
        <LinearGradient colors={[colors[0], colors[0]]} style={StyleSheet.absoluteFill} />
        <T style={styles.compactCity} numberOfLines={1}>
          {place.name}
        </T>
        {c ? <T style={styles.compactLine}>{`${temp(c.temperature)} · ${weatherLabel(c.weatherCode, c.isDay)}`}</T> : null}
      </Animated.View>
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
  compact: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 10 },
  compactCity: { fontSize: 22, fontWeight: '600' },
  compactLine: { fontSize: 15, color: DIM, fontWeight: '500' },
  source: { fontSize: 12, color: DIM, textAlign: 'center', marginTop: 8 },
});
