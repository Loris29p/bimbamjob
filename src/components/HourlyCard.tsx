import { router } from 'expo-router';
import { useContext } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { upcomingHours, type DayPoint, type HourPoint } from '../lib/forecast';
import { hour, temp, time } from '../lib/format';
import { symbolFor } from '../lib/sky';
import { windDirection } from '../lib/weatherCodes';
import { tick } from '../lib/hig';
import { DIM, Glass, Icon, PinContext, RAIN_BLUE, T } from './ui';

export type Mode = 'temp' | 'rain' | 'wind';
const SUBTITLE: Record<Mode, string> = { temp: 'Température (°C)', rain: 'Précipitations (mm)', wind: 'Vent (km/h)' };
// bleu des probabilités de pluie (iOS)
const PROB = '#5AC8FA';
type Item = { kind: 'hour'; h: HourPoint; first: boolean } | { kind: 'sun'; time: number; rise: boolean };

const MODES: { id: Mode; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'temp', label: 'Températures', icon: { ios: 'cloud.sun.fill', android: 'partly_cloudy_day' } },
  { id: 'rain', label: 'Pluie', icon: { ios: 'drop.fill', android: 'water_drop' } },
  { id: 'wind', label: 'Vent', icon: { ios: 'wind', android: 'air' } },
];

const RAINY = (code: number) => code >= 51 && code <= 67 || (code >= 80 && code <= 82) || code >= 95;
/** Heure où le modèle Météo-France ne prévoit pas de pluie mesurable (moins de 0,1 mm). */
const dryHour = (h: HourPoint) => RAINY(h.weatherCode) && h.precipitation < 0.1 && h.snowfall === 0;
export function HourlyCard({ hourly, daily, mode, onMode: setMode }: { hourly: HourPoint[]; daily: DayPoint[]; mode: Mode; onMode: (m: Mode) => void }) {
  // Comme dans Météo : « Conditions météo » en haut de page, puis « PRÉVISIONS HEURE PAR HEURE »
  // une fois l'en-tête de la ville replié.
  const pin = useContext(PinContext);
  const caps = pin ? pin.scrollY.interpolate({ inputRange: [90, 140], outputRange: [0, 1], extrapolate: 'clamp' }) : null;
  const full = caps ? caps.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1;
  const hours = upcomingHours(hourly).slice(0, 25);
  if (!hours.length) return null;
  const start = hours[0].time;
  const end = hours[hours.length - 1].time + 3600;

  const items: Item[] = hours.map((h, i) => ({ kind: 'hour', h, first: i === 0 }));
  if (mode === 'temp') {
    for (const d of daily.slice(0, 2)) {
      for (const [t, rise] of [[d.sunrise, true], [d.sunset, false]] as const) {
        if (t > start && t < end) items.push({ kind: 'sun', time: t, rise });
      }
    }
  }
  items.sort((a, b) => (a.kind === 'hour' ? a.h.time : a.time) - (b.kind === 'hour' ? b.h.time : b.time));
  const maxRain = Math.max(1, ...hours.map((h) => h.precipitation));

  return (
    <Glass>
      <View style={styles.top}>
        <Pressable style={styles.heading} onPress={() => router.push({ pathname: '/detail', params: { metric: mode } })}>
          <Animated.View style={{ opacity: full }}>
            <T style={styles.title}>Conditions météo</T>
            <T style={styles.subtitle}>{SUBTITLE[mode]}</T>
          </Animated.View>
          {caps ? (
            <Animated.View style={[styles.capsRow, { opacity: caps }]}>
              <Icon name={{ ios: 'clock', android: 'schedule' }} size={13} color={DIM} />
              <T style={styles.caps} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                PRÉVISIONS HEURE PAR HEURE
              </T>
            </Animated.View>
          ) : null}
        </Pressable>
        <View style={styles.modes}>
          {MODES.map((m, i) => {
            // fin trait entre deux icônes non sélectionnées
            const sep = i > 0 && mode !== m.id && mode !== MODES[i - 1].id;
            return (
              <View key={m.id} style={styles.modeWrap}>
                {sep ? <View style={styles.modeSep} /> : null}
                <Pressable onPress={() => { if (m.id !== mode) tick(); setMode(m.id); }} accessibilityRole="button" accessibilityLabel={m.label} accessibilityState={{ selected: mode === m.id }} style={[styles.mode, mode === m.id && styles.modeOn]} hitSlop={4}>
                  <Icon name={m.icon} size={17} />
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
        {items.map((it) => {
          if (it.kind === 'sun') {
            return (
              <View key={`sun${it.time}`} style={styles.col}>
                <T style={styles.hour} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {time(it.time)}
                </T>
                <View style={styles.iconBox}>
                  <Icon name={it.rise ? { ios: 'sunrise.fill', android: 'wb_twilight' } : { ios: 'sunset.fill', android: 'wb_twilight' }} size={26} multicolor />
                </View>
                <T style={styles.sunLabel}>{it.rise ? 'Lever' : 'Coucher'}</T>
              </View>
            );
          }
          const h = it.h;
          return (
            <View key={h.time} style={styles.col}>
              <T style={styles.hour} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {it.first ? 'Maint.' : hour(h.time)}
              </T>
              {mode === 'temp' ? (
                <>
                  <View style={styles.iconBox}>
                    {/* Même règle que la carte Pluie : AROME (1,3 km) fait foi sur la quantité ; sans pluie prévue,
                        pas d'icône de pluie ni de pourcentage venu de l'ensemble (maille ~27 km). */}
                    <Icon name={symbolFor(dryHour(h) ? 3 : h.weatherCode, h.isDay)} size={26} multicolor />
                    {!dryHour(h) && (h.precipitationProbability ?? 0) >= 20 ? <T style={styles.prob}>{Math.round((h.precipitationProbability ?? 0) / 10) * 10} %</T> : null}
                  </View>
                  <T style={styles.value}>{temp(h.temperature)}</T>
                </>
              ) : mode === 'rain' ? (
                <>
                  <View style={[styles.iconBox, { justifyContent: 'flex-end' }]}>
                    <View style={[styles.rainBar, { height: Math.max(2, (h.precipitation / maxRain) * 44), opacity: h.precipitation > 0 ? 1 : 0.25 }]} />
                  </View>
                  <T style={styles.value}>{h.precipitation >= 0.1 ? h.precipitation.toFixed(1) : '0'}</T>
                  <T style={styles.smallBlue}>{h.precipitationProbability !== null ? `${h.precipitationProbability} %` : ' '}</T>
                </>
              ) : (
                <>
                  <View style={styles.iconBox}>
                    {/* flèche dans le sens où souffle le vent */}
                    <View style={{ transform: [{ rotate: `${h.windDirection + 180}deg` }] }}>
                      <Icon name={{ ios: 'location.north.fill', android: 'navigation' }} size={18} />
                    </View>
                    <T style={styles.small}>{windDirection(h.windDirection)}</T>
                  </View>
                  <T style={styles.value}>{Math.round(h.windSpeed)}</T>
                  <T style={[styles.small, h.windGusts >= 60 && { color: '#FF8A80' }]}>raf. {Math.round(h.windGusts)}</T>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </Glass>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  heading: { flex: 1, justifyContent: 'center' },
  capsRow: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  caps: { flex: 1, fontSize: 14, fontWeight: '600', color: DIM },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: DIM, marginTop: 1 },
  modes: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.16)', borderRadius: 20, padding: 3 },
  modeWrap: { flexDirection: 'row', alignItems: 'center' },
  modeSep: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: 'rgba(255,255,255,0.35)' },
  mode: { width: 36, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modeOn: { width: 46, backgroundColor: 'rgba(255,255,255,0.2)' },
  col: { width: 52, alignItems: 'center' },
  hour: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  iconBox: { height: 58, alignItems: 'center', justifyContent: 'center' },
  prob: { color: PROB, fontSize: 13, fontWeight: '600', marginTop: 2 },
  value: { fontSize: 20, fontWeight: '500', letterSpacing: 0.38, fontVariant: ['tabular-nums'] },
  rainBar: { width: 14, borderRadius: 3, backgroundColor: RAIN_BLUE },
  smallBlue: { fontSize: 11, color: RAIN_BLUE, fontWeight: '600' },
  small: { fontSize: 11, color: DIM },
  sunLabel: { fontSize: 12, color: DIM, marginTop: 4 },
});
