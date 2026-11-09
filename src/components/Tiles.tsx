// Tuiles de détail (2 par ligne).
import type { SymbolViewProps } from 'expo-symbols';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { MetricId } from '../lib/metrics';
import { upcomingHours, type Forecast } from '../lib/forecast';
import { temp, time } from '../lib/format';
import type { Observation } from '../lib/observations';
import { uvLabel, windFrom } from '../lib/weatherCodes';
import { DIM, Glass, T, WHITE } from './ui';

function Tile({ title, icon, value, unit, children, note, metric, wide }: { title: string; icon: SymbolViewProps['name']; value: string; unit?: string; children?: ReactNode; note?: string; metric?: MetricId; wide?: boolean }) {
  const open = metric ? () => router.push({ pathname: '/detail', params: { metric } }) : undefined;
  return (
    <Pressable onPress={open} disabled={!open} style={({ pressed }) => [wide ? styles.wide : styles.tile, pressed && { opacity: 0.85 }]}>
    <Glass title={title} icon={icon} style={{ flex: 1, marginBottom: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <T style={styles.value}>{value}</T>
        {unit ? <T style={styles.unit}>{unit}</T> : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>{children}</View>
      {note ? <T style={styles.note}>{note}</T> : null}
    </Glass>
    </Pressable>
  );
}

/** Jauge de pression : arc 970 → 1050 hPa, repère à la valeur actuelle. */
function Gauge({ value, trend }: { value: number; trend: string }) {
  const W = 120;
  const R = 46;
  const cx = W / 2;
  const cy = 52;
  const a0 = Math.PI * 0.8;
  const a1 = Math.PI * 2.2;
  const k = Math.min(1, Math.max(0, (value - 970) / 80));
  const pt = (a: number, r: number) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  const ticks = Array.from({ length: 29 }, (_, i) => a0 + ((a1 - a0) * i) / 28);
  const am = a0 + (a1 - a0) * k;
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={W} height={70}>
        {ticks.map((a, i) => (
          <Line key={i} x1={pt(a, R - 7).split(',')[0]} y1={pt(a, R - 7).split(',')[1]} x2={pt(a, R).split(',')[0]} y2={pt(a, R).split(',')[1]} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
        ))}
        <Line x1={pt(am, R - 12).split(',')[0]} y1={pt(am, R - 12).split(',')[1]} x2={pt(am, R + 3).split(',')[0]} y2={pt(am, R + 3).split(',')[1]} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      </Svg>
      {trend ? <T style={{ position: 'absolute', top: 30, fontSize: 18 }}>{trend === 'En hausse' ? '↑' : trend === 'En baisse' ? '↓' : '='}</T> : null}
    </View>
  );
}

/** Courbe du soleil sur la journée, avec la position actuelle. */
function SunArc({ sunrise, sunset }: { sunrise: number; sunset: number }) {
  const W = 140;
  const H = 50;
  const now = Date.now() / 1000;
  const day0 = sunrise - (sunrise % 86400);
  const xs = (t: number) => (((t - day0) % 86400) / 86400) * W;
  const ys = (t: number) => {
    const noon = (sunrise + sunset) / 2;
    const half = (sunset - sunrise) / 2;
    return H / 2 - Math.cos(((t - noon) / (2 * half)) * Math.PI) * (H / 2.4);
  };
  const pts = Array.from({ length: 49 }, (_, i) => day0 + i * 1800);
  const d = pts.map((t, i) => `${i ? 'L' : 'M'}${xs(t).toFixed(1)},${ys(t).toFixed(1)}`).join(' ');
  const horizon = ys(sunrise);
  return (
    <Svg width={W} height={H}>
      <Path d={d} stroke="rgba(255,255,255,0.45)" strokeWidth={2} fill="none" />
      <Line x1={0} x2={W} y1={horizon} y2={horizon} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      <Circle cx={xs(now)} cy={ys(now)} r={5} fill={now > sunrise && now < sunset ? '#FFD60A' : '#fff'} stroke="rgba(0,0,0,0.3)" />
    </Svg>
  );
}

function Compass({ deg }: { deg: number }) {
  return (
    <View style={styles.compass}>
      {['N', 'E', 'S', 'O'].map((l, i) => (
        <T key={l} style={[styles.cardinal, [{ top: 2 }, { right: 4 }, { bottom: 2 }, { left: 4 }][i]]}>
          {l}
        </T>
      ))}
      {/* La flèche indique d'où vient le vent */}
      <View style={[styles.needle, { transform: [{ rotate: `${deg}deg` }] }]}>
        <View style={styles.needleHead} />
        <View style={styles.needleTail} />
      </View>
    </View>
  );
}

function Scale({ ratio, colors }: { ratio: number; colors: string[] }) {
  return (
    <View style={styles.scale}>
      {colors.map((c) => (
        <View key={c} style={{ flex: 1, backgroundColor: c }} />
      ))}
      <View style={[styles.scaleDot, { left: `${Math.min(96, Math.max(0, ratio * 100))}%` }]} />
    </View>
  );
}

export function Tiles({ forecast, obs }: { forecast: Forecast; obs: Observation | null }) {
  const model = forecast.current;
  // Les mesures des stations remplacent la prévision quand elles existent.
  const windMeasured = obs?.windSpeed != null && obs.windDirection != null;
  const c = {
    ...model,
    windSpeed: windMeasured ? obs!.windSpeed! : model.windSpeed,
    windDirection: windMeasured ? obs!.windDirection! : model.windDirection,
    windGusts: windMeasured && obs!.windGusts != null ? obs!.windGusts : model.windGusts,
    humidity: obs?.humidity ?? model.humidity,
    pressure: obs?.pressure ?? model.pressure,
  };
  const hours = upcomingHours(forecast.hourly);
  const now = hours[0];
  const today = forecast.daily[0];
  const tomorrow = forecast.daily[1];
  const uv = now?.uv ?? today?.uvMax ?? null;
  const vis = now?.visibility ?? null;
  const p3 = hours[3]?.pressure;
  const trend = p3 === undefined ? '' : p3 - model.pressure > 0.8 ? 'En hausse' : model.pressure - p3 > 0.8 ? 'En baisse' : 'Stable';
  const rain24 = hours.slice(0, 24).reduce((s, h) => s + h.precipitation, 0);
  const nowSec = Date.now() / 1000;
  const nextSun = today && nowSec < today.sunrise ? { t: today.sunrise, rise: true } : today && nowSec < today.sunset ? { t: today.sunset, rise: false } : tomorrow ? { t: tomorrow.sunrise, rise: true } : null;

  const feels = c.apparent - c.temperature;
  return (
    <View style={styles.grid}>
      <Tile title="Vent" metric="wind" wide icon={{ ios: 'wind', android: 'air' }} value={`${Math.round(c.windSpeed)}`} unit="km/h">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Compass deg={c.windDirection} />
          <View>
            <T style={styles.small}>Rafales</T>
            <T style={styles.strong}>{Math.round(c.windGusts)} km/h</T>
            <T style={styles.small}>Vient {windFrom(c.windDirection)}</T>
            {windMeasured ? <T style={styles.small}>Mesuré</T> : null}
          </View>
        </View>
      </Tile>
      <Tile
        title="Ressenti"
        metric="temp"
        icon={{ ios: 'thermometer.medium', android: 'thermostat' }}
        value={temp(c.apparent)}
        note={Math.abs(feels) < 1.5 ? 'Proche de la température réelle.' : feels < 0 ? 'Le vent ou l’humidité donnent une sensation plus froide.' : 'L’humidité donne une sensation plus chaude.'}
      />
      <Tile
        title="Précipitations"
        metric="rain"
        icon={{ ios: 'drop.fill', android: 'water_drop' }}
        value={today ? (today.precipitationSum < 0.1 ? '0' : today.precipitationSum < 10 ? today.precipitationSum.toFixed(1) : `${Math.round(today.precipitationSum)}`) : rain24.toFixed(1)}
        unit="mm aujourd’hui"
        note={tomorrow ? (tomorrow.precipitationSum < 0.5 ? 'Demain : pas de pluie notable.' : `Demain : ${Math.round(tomorrow.precipitationSum)} mm attendus.`) : undefined}
      />
      <Tile title="Humidité" metric="humidity" icon={{ ios: 'humidity.fill', android: 'humidity_percentage' }} value={`${Math.round(c.humidity)}`} unit="%" note={`Point de rosée : ${temp(c.dewPoint)}.`} />
      {uv !== null ? (
        <Tile title="Indice UV" metric="uv" icon={{ ios: 'sun.max.fill', android: 'light_mode' }} value={`${Math.round(uv)}`} unit={uvLabel(uv)}>
          <Scale ratio={uv / 11} colors={['#3EC46D', '#F5D312', '#F28C1A', '#E5484D', '#A04BD8']} />
        </Tile>
      ) : null}
      {nextSun ? (
        <Tile
          title={nextSun.rise ? 'Lever du soleil' : 'Coucher du soleil'}
          icon={nextSun.rise ? { ios: 'sunrise.fill', android: 'wb_twilight' } : { ios: 'sunset.fill', android: 'wb_twilight' }}
          value={time(nextSun.t)}
          note={today ? `Lever ${time(today.sunrise)} · coucher ${time(today.sunset)}` : undefined}
        >
          {today ? <SunArc sunrise={today.sunrise} sunset={today.sunset} /> : null}
        </Tile>
      ) : null}
      <Tile title="Pression" metric="pressure" icon={{ ios: 'gauge.with.dots.needle.33percent', android: 'speed' }} value={`${Math.round(c.pressure)}`} unit="hPa" note={trend ? `${trend} sur les 3 prochaines heures.` : undefined}>
        <Gauge value={c.pressure} trend={trend} />
      </Tile>
      {vis !== null ? (
        <Tile
          title="Visibilité"
          metric="visibility"
          icon={{ ios: 'eye.fill', android: 'visibility' }}
          value={vis >= 10000 ? `${Math.round(vis / 1000)}` : (vis / 1000).toFixed(1)}
          unit="km"
          note={vis < 1000 ? 'Brouillard : visibilité réduite.' : vis < 5000 ? 'Visibilité moyenne.' : 'Bonne visibilité.'}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.6%', aspectRatio: 1, marginBottom: 10 },
  wide: { width: '100%', marginBottom: 10 },
  value: { fontSize: 32, fontWeight: '500' },
  unit: { fontSize: 16, color: DIM, fontWeight: '500' },
  note: { fontSize: 12.5, lineHeight: 16 },
  small: { fontSize: 12, color: DIM },
  strong: { fontSize: 15, fontWeight: '600' },
  compass: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  cardinal: { position: 'absolute', fontSize: 9, color: DIM, fontWeight: '700' },
  needle: { width: 4, height: 50, alignItems: 'center' },
  needleHead: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: WHITE },
  needleTail: { width: 2, flex: 1, backgroundColor: WHITE, opacity: 0.8 },
  scale: { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'visible' },
  scaleDot: { position: 'absolute', top: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: WHITE, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.3)' },
});
