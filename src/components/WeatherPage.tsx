// Une page = un lieu : en-tête, cartes de prévisions et tuiles de détail.
import MaskedViewBase from '@react-native-masked-view/masked-view';
import type { ComponentType, ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, type HostInstance, Platform, Pressable, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import { headerLabel } from '../lib/rain';
import { umbrellaVerdict } from '../lib/umbrella';
import { AirCard } from './AirCard';
import { PageFooter, WindCard } from './DetailCards';
import { RadarPreview } from './RadarPreview';
import { DailyCard } from './DailyCard';
import { HourlyCard, type Mode } from './HourlyCard';
import { MoonCard } from './MoonCard';
import { ago, ObservationCard, pretty } from './ObservationCard';
import { RainCard } from './RainCard';
import { SkyBackground } from './SkyBackground';
import { Tiles } from './Tiles';
import { DIM, Icon, PinContext, T } from './ui';
import { VigilanceBanner } from './VigilanceBanner';

// Les types fournis par la bibliothèque datent d'avant React 19.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Le masque n'existe pas sur le web : on affiche alors le contenu tel quel.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MaskedView: ComponentType<any> =
  Platform.OS === 'web' ? ({ children, style }: { children: ReactNode; style: object }) => <View style={style}>{children}</View> : (MaskedViewBase as unknown as ComponentType<any>);

export function WeatherPage({ place, bottomInset, inSheet = false }: { place: Place; bottomInset: number; inSheet?: boolean }) {
  const { width, height } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  // Dans une feuille iOS (aperçu d'une ville), pas de marge d'encoche : la feuille est déjà dessous.
  const insets = inSheet ? { ...safe, top: 44 } : safe;
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
  // Vent : la mesure de la station remplace la prévision quand elle existe.
  const windMeasured = obs?.windSpeed != null && obs.windDirection != null;
  const wind = {
    speed: windMeasured ? obs!.windSpeed! : (c?.windSpeed ?? 0),
    direction: windMeasured ? obs!.windDirection! : (c?.windDirection ?? 0),
    gusts: windMeasured && obs!.windGusts != null ? obs!.windGusts : (c?.windGusts ?? 0),
  };
  // Réponse « parapluie » : mesure de station + prévision ; elle corrige aussi le libellé de l'en-tête.
  const verdict = useMemo(() => (forecast ? umbrellaVerdict(forecast.minutely, forecast.hourly, place.name, obs) : null), [forecast, place.name, obs]);
  const label = c ? headerLabel(weatherLabel(c.weatherCode, c.isDay), c.weatherCode, verdict ? verdict.now.wet : null, verdict?.now.mmh ?? 0, c.cloudCover) : '';
  const scrollY = useRef(new Animated.Value(0)).current;
  const bigOpacity = scrollY.interpolate({ inputRange: [0, 110], outputRange: [1, 0], extrapolate: 'clamp' });
  const compactOpacity = scrollY.interpolate({ inputRange: [90, 140], outputRange: [0, 1], extrapolate: 'clamp' });
  const headerShift = scrollY.interpolate({ inputRange: [-100, 0, 160], outputRange: [40, 0, 90], extrapolate: 'clamp' });
  // Le nom de la ville reste en place en haut (comme l'app Météo d'iOS) ; la grande température
  // défile et s'efface, puis la ligne « 10° | Bruine » apparaît sous le nom.
  const showPos = !!place.isGps && place.name !== 'Ma position';
  const NAME_TOP = 6;
  const nameBlock = (showPos ? POS_H : 0) + CITY_H;
  // Zone de l'en-tête replié : les cartes passent DESSOUS (masquées) au lieu de la recouvrir.
  const compactHeight = insets.top + NAME_TOP + nameBlock + LINE_H + 12;
  const maskTop = scrollY.interpolate({ inputRange: [70, 140], outputRange: [1, 0], extrapolate: 'clamp' });
  const [mode, setMode] = useState<Mode>('temp');
  const contentRef = useRef<HostInstance>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const pin = useMemo(() => ({ scrollY, top: compactHeight, content: contentRef, version: layoutVersion }), [scrollY, compactHeight, layoutVersion]);

  return (
    <View style={{ width, height }}>
      <SkyBackground code={c?.weatherCode} isDay={c?.isDay} cloudCover={c?.cloudCover} rate={c?.precipitation} />
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <View style={{ flex: 1 }}>
            <Animated.View style={{ height: compactHeight, backgroundColor: '#000', opacity: maskTop }} />
            {/* fondu sous l'en-tête : actif seulement une fois l'en-tête replié (sinon il coupait le nom de la ville) */}
            <View style={{ height: 14 }}>
              <LinearGradient colors={['rgba(0,0,0,0)', '#000']} style={StyleSheet.absoluteFill} />
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: maskTop }]} />
            </View>
            <View style={{ flex: 1, backgroundColor: '#000' }} />
          </View>
        }
      >
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottomInset + 24, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={loading && !!forecast} onRefresh={refresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        <PinContext.Provider value={pin}>
        {/* la marge du haut est DANS la vue mesurée, pour que la position des cartes soit exacte */}
        <View ref={contentRef} collapsable={false} style={{ paddingTop: insets.top + NAME_TOP + nameBlock }} onLayout={() => setLayoutVersion((v) => v + 1)}>
        <Animated.View style={[styles.header, { opacity: bigOpacity, transform: [{ translateY: headerShift }] }]}>
          {c ? (
            <>
              <T style={styles.temp}>{temp(shownTemp ?? c.temperature)}</T>
              <T style={styles.cond}>{label}</T>
              {today ? (
                <View style={styles.hiloRow}>
                  <Icon name={{ ios: 'arrow.up', android: 'arrow_upward' }} size={17} />
                  <T style={styles.hilo}>{temp(today.tMax)}</T>
                  <View style={{ width: 10 }} />
                  <Icon name={{ ios: 'arrow.down', android: 'arrow_downward' }} size={17} />
                  <T style={styles.hilo}>{temp(today.tMin)}</T>
                </View>
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
            {verdict ? <RainCard verdict={verdict} minutely={forecast.minutely} placeName={place.name} placeId={placeKey(place)} /> : null}
            <HourlyCard hourly={forecast.hourly} daily={forecast.daily} mode={mode} onMode={setMode} />
            <Pressable onPress={() => router.push({ pathname: '/detail', params: { metric: mode } })}>
              <DailyCard daily={forecast.daily} hourly={forecast.hourly} currentTemp={forecast.current.temperature} mode={mode} />
            </Pressable>
            {/* même ordre que l'app Météo ; nos cartes en plus (pluie dans les 3 h, mesures) restent */}
            <RadarPreview place={place} temperature={shownTemp ?? c!.temperature} />
            <AirCard place={place} />
            <WindCard speed={wind.speed} gusts={wind.gusts} direction={wind.direction} />
            <MoonCard place={place} />
            <Tiles forecast={forecast} obs={useObs ? obs : null} place={place} />
            {obs ? <ObservationCard obs={obs} /> : null}
            <PageFooter
              place={place}
              sources={`Prévisions : AROME et ARPEGE (Météo-France) · Mesures : stations Météo-France · Mise à jour ${time(forecast.fetchedAt / 1000)}`}
            />
          </>
        ) : null}
        </View>
        </PinContext.Provider>
      </Animated.ScrollView>
      </MaskedView>

      {/* Nom du lieu, fixe en haut ; « 10° | Bruine » apparaît dessous quand on fait défiler */}
      <View pointerEvents="none" style={[styles.compact, { paddingTop: insets.top + NAME_TOP }]}>
        {showPos ? (
          <View style={styles.posRow}>
            <Icon name={{ ios: 'location.fill', android: 'near_me' }} size={12} />
            <T style={styles.myPos}>MA POSITION</T>
          </View>
        ) : null}
        <T style={styles.city} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {place.name}
        </T>
        {c ? (
          <Animated.Text style={[styles.compactLine, { opacity: compactOpacity }]}>
            {`${temp(shownTemp ?? c.temperature)}  |  ${label}`}
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
}

const POS_H = 18;
const CITY_H = 42;
const LINE_H = 26;

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 56 },
  posRow: { height: POS_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  myPos: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  city: { height: CITY_H, fontSize: 34, lineHeight: CITY_H, fontWeight: '400', paddingHorizontal: 20, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.12)', textShadowRadius: 6 },
  temp: { fontSize: 102, fontWeight: '100', lineHeight: 112, marginLeft: 26, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.12)', textShadowRadius: 8 },
  cond: { fontSize: 20, fontWeight: '500' },
  hiloRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  hilo: { fontSize: 20, fontWeight: '500', fontVariant: ['tabular-nums'] },
  retry: { marginTop: 30, padding: 16 },
  measured: { fontSize: 12, color: DIM, marginTop: 6 },
  compact: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 10 },
  compactLine: { height: LINE_H, fontSize: 20, lineHeight: LINE_H, color: '#fff', fontWeight: '500', fontVariant: ['tabular-nums'] },
});
