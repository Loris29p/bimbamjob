// Une page = un lieu : en-tête, cartes de prévisions et tuiles de détail.
import MaskedViewBase from '@react-native-masked-view/masked-view';
import type { ComponentType, ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { minutesUntilRain } from '../lib/forecast';
import { temp, time } from '../lib/format';
import { notifyRain } from '../lib/notifications';
import { backgroundFor } from '../lib/sky';
import type { Place } from '../lib/types';
import { fetchNearestObservation } from '../lib/observations';
import { placeKey } from '../lib/types';
import { useCached } from '../lib/useAsync';
import { useForecast } from '../lib/useForecast';
import { weatherLabel } from '../lib/weatherCodes';
import { AirCard } from './AirCard';
import { DailyCard } from './DailyCard';
import { HourlyCard, type Mode } from './HourlyCard';
import { MoonCard } from './MoonCard';
import { ago, ObservationCard, pretty } from './ObservationCard';
import { RainCard } from './RainCard';
import { SkyBackground } from './SkyBackground';
import { Tiles } from './Tiles';
import { DIM, T } from './ui';
import { VigilanceBanner } from './VigilanceBanner';

// Les types fournis par la bibliothèque datent d'avant React 19.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Le masque n'existe pas sur le web : on affiche alors le contenu tel quel.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MaskedView: ComponentType<any> =
  Platform.OS === 'web' ? ({ children, style }: { children: ReactNode; style: object }) => <View style={style}>{children}</View> : (MaskedViewBase as unknown as ComponentType<any>);

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
  // Mesure réelle de la station la plus proche (rafraîchie toutes les 6 min)
  const obs = useCached(
    forecast ? `obs:${placeKey(place)}:${Math.floor(Date.now() / 360000)}` : null,
    () => fetchNearestObservation(place, forecast?.elevation),
    6 * 60 * 1000,
  );
  // On affiche la température mesurée si la station est proche et la mesure récente.
  const useObs = !!obs && obs.temperature !== null && obs.distanceKm <= 15 && Date.now() / 1000 - obs.time < 45 * 60;
  const shownTemp = useObs ? obs!.temperature! : c?.temperature;
  const scrollY = useRef(new Animated.Value(0)).current;
  const bigOpacity = scrollY.interpolate({ inputRange: [0, 110], outputRange: [1, 0], extrapolate: 'clamp' });
  const compactOpacity = scrollY.interpolate({ inputRange: [90, 140], outputRange: [0, 1], extrapolate: 'clamp' });
  const headerShift = scrollY.interpolate({ inputRange: [-100, 0, 160], outputRange: [40, 0, 90], extrapolate: 'clamp' });
  // Zone de l'en-tête compact : une fois repliée, les cartes passent DESSOUS (masquées) au lieu de la recouvrir.
  const compactHeight = insets.top + 62;
  const maskTop = scrollY.interpolate({ inputRange: [70, 140], outputRange: [1, 0], extrapolate: 'clamp' });
  const [mode, setMode] = useState<Mode>('temp');

  return (
    <View style={{ width, height }}>
      <SkyBackground code={c?.weatherCode} isDay={c?.isDay} cloudCover={c?.cloudCover} rate={c?.precipitation} />
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <View style={{ flex: 1 }}>
            <Animated.View style={{ height: compactHeight, backgroundColor: '#000', opacity: maskTop }} />
            <LinearGradient colors={['rgba(0,0,0,0)', '#000']} style={{ height: 14 }} />
            <View style={{ flex: 1, backgroundColor: '#000' }} />
          </View>
        }
      >
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: bottomInset + 24, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={loading && !!forecast} onRefresh={refresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: bigOpacity, transform: [{ translateY: headerShift }] }]}>
          {place.isGps && place.name !== 'Ma position' ? <T style={styles.myPos}>MA POSITION</T> : null}
          <T style={styles.city} numberOfLines={1}>
            {place.name}
          </T>
          {c ? (
            <>
              <T style={styles.temp}>{temp(shownTemp ?? c.temperature)}</T>
              <T style={styles.cond}>{weatherLabel(c.weatherCode, c.isDay)}</T>
              {today ? (
                <T style={styles.hilo}>
                  Max. {temp(today.tMax)}  Min. {temp(today.tMin)}
                </T>
              ) : null}
              {useObs ? <T style={styles.measured}>{`Mesurée à ${pretty(obs!.station.name)} · ${ago(obs!.time)}`}</T> : null}
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
            <HourlyCard hourly={forecast.hourly} daily={forecast.daily} minutely={forecast.minutely} mode={mode} onMode={setMode} />
            <Pressable onPress={() => router.push({ pathname: '/detail', params: { metric: mode } })}>
              <DailyCard daily={forecast.daily} hourly={forecast.hourly} currentTemp={forecast.current.temperature} mode={mode} />
            </Pressable>
            {obs ? <ObservationCard obs={obs} /> : null}
            <AirCard place={place} />
            <Tiles forecast={forecast} obs={useObs ? obs : null} />
            <MoonCard />
            <T style={styles.source}>
              Prévisions : AROME et ARPEGE (Météo-France) · Mesures : stations Météo-France · Mise à jour {time(forecast.fetchedAt / 1000)}
            </T>
          </>
        ) : null}
      </Animated.ScrollView>
      </MaskedView>

      {/* En-tête compact qui apparaît quand on fait défiler */}
      <Animated.View pointerEvents="none" style={[styles.compact, { paddingTop: insets.top + 6, opacity: compactOpacity }]}>
        <T style={styles.compactCity} numberOfLines={1}>
          {place.name}
        </T>
        {c ? <T style={styles.compactLine}>{`${temp(shownTemp ?? c.temperature)} · ${weatherLabel(c.weatherCode, c.isDay)}`}</T> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 28 },
  myPos: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  city: { fontSize: 34, fontWeight: '400', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.12)', textShadowRadius: 6 },
  temp: { fontSize: 102, fontWeight: '100', lineHeight: 112, marginLeft: 26, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.12)', textShadowRadius: 8 },
  cond: { fontSize: 20, fontWeight: '500' },
  hilo: { fontSize: 20, fontWeight: '500', marginTop: 2, fontVariant: ['tabular-nums'] },
  retry: { marginTop: 30, padding: 16 },
  measured: { fontSize: 12, color: DIM, marginTop: 6 },
  compact: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 10 },
  compactCity: { fontSize: 22, fontWeight: '600' },
  compactLine: { fontSize: 15, color: DIM, fontWeight: '500' },
  source: { fontSize: 12, color: DIM, textAlign: 'center', marginTop: 8 },
});
