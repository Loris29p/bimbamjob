// Tuiles carrées de détail (2 par ligne), sur le modèle de l'app Météo d'iOS :
// titre en petites capitales, grande valeur, sous-titre en gras, dessin, phrase en bas.
import type { SymbolViewProps } from 'expo-symbols';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { ClipPath, Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { MetricId } from '../lib/metrics';
import { upcomingHours, type Forecast } from '../lib/forecast';
import { hour, temp, time } from '../lib/format';
import { fetchNormal } from '../lib/normals';
import type { Observation } from '../lib/observations';
import { placeKey, type Place } from '../lib/types';
import { useCached } from '../lib/useAsync';
import { uvLabel } from '../lib/weatherCodes';
import { DIM, Glass, T, WHITE } from './ui';

type TileProps = {
  title: string;
  icon: SymbolViewProps['name'];
  value?: string;
  sub?: string;
  note?: string;
  metric?: MetricId;
  children?: ReactNode;
};

function Tile({ title, icon, value, sub, note, metric, children }: TileProps) {
  // carrées au minimum ; si le texte est long, la ligne entière grandit (les deux tuiles restent alignées)
  const { width } = useWindowDimensions();
  const side = (width - 32 - 10) / 2;
  const open = metric ? () => router.push({ pathname: '/detail', params: { metric } }) : undefined;
  return (
    <Pressable onPress={open} disabled={!open} style={({ pressed }) => [styles.tile, { minHeight: side }, pressed && { opacity: 0.85 }]}>
      <Glass title={title} icon={icon} style={styles.glass}>
        {value ? (
          <T style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {value}
          </T>
        ) : null}
        {sub ? <T style={styles.sub}>{sub}</T> : null}
        <View style={styles.middle}>{children}</View>
        {note ? <T style={styles.note}>{note}</T> : null}
      </Glass>
    </Pressable>
  );
}

/** Course du soleil sur 24 h, d'un bord à l'autre de la tuile, avec la position actuelle. */
function SunArc({ sunrise, sunset }: { sunrise: number; sunset: number }) {
  const [w, setW] = useState(0);
  const H = 76;
  const now = Date.now() / 1000;
  const day0 = (() => {
    const d = new Date(sunrise * 1000);
    d.setHours(0, 0, 0, 0);
    return d.getTime() / 1000;
  })();
  const noon = (sunrise + sunset) / 2;
  const amp = H * 0.42;
  const mid = H * 0.5;
  // sinusoïde qui passe par l'horizon au lever et au coucher
  const yAt = (t: number) => mid - amp * Math.cos(((t - noon) / 86400) * 2 * Math.PI);
  const horizon = yAt(sunrise);
  const xAt = (t: number) => ((t - day0) / 86400) * w;
  const pts = Array.from({ length: 97 }, (_, i) => day0 + i * 900);
  const d = pts.map((t, i) => `${i ? 'L' : 'M'}${xAt(t).toFixed(1)},${yAt(t).toFixed(1)}`).join(' ');
  const t = Math.min(day0 + 86399, Math.max(day0, now));
  const up = now > sunrise && now < sunset;
  return (
    <View style={styles.bleed} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Svg width={w} height={H}>
          <Defs>
            <ClipPath id="sky">
              <Rect x={0} y={0} width={w} height={horizon} />
            </ClipPath>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#fff" stopOpacity={0.9} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d={d} stroke="rgba(0,0,0,0.3)" strokeWidth={3} fill="none" />
          <G clipPath="url(#sky)">
            <Path d={d} stroke="rgba(255,255,255,0.45)" strokeWidth={3} fill="none" />
          </G>
          <Line x1={0} x2={w} y1={horizon} y2={horizon} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
          <Circle cx={xAt(t)} cy={yAt(t)} r={18} fill="url(#glow)" opacity={up ? 1 : 0.5} />
          <Circle cx={xAt(t)} cy={yAt(t)} r={6} fill="#fff" stroke="rgba(0,0,0,0.55)" strokeWidth={1.5} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Échelle colorée avec un point (UV). */
function Scale({ ratio, colors }: { ratio: number; colors: string[] }) {
  return (
    <View style={styles.scale}>
      <LinearGradient colors={colors as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.scaleBar} />
      <View style={[styles.scaleDot, { left: `${Math.min(98, Math.max(0, ratio * 100))}%` }]} />
    </View>
  );
}

/** Cadran de pression : graduations sur 300°, repère blanc à la valeur, tendance au centre. */
function PressureDial({ value, trend }: { value: number; trend: 'up' | 'down' | 'flat' | '' }) {
  const S = 124;
  const c = S / 2;
  const R = S / 2 - 3;
  const start = -150; // degrés, 0 = en haut
  const span = 300;
  const k = Math.min(1, Math.max(0, (value - 960) / 100));
  const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [c + r * Math.sin(a), c - r * Math.cos(a)];
  };
  const n = 50;
  const at = start + span * k;
  return (
    <View style={{ width: S, height: S, alignSelf: 'center' }}>
      <Svg width={S} height={S}>
        {Array.from({ length: n + 1 }, (_, i) => {
          const deg = start + (span * i) / n;
          const [x1, y1] = pt(deg, R);
          const [x2, y2] = pt(deg, R - 10);
          // partie « remplie » entre la tendance et la valeur, comme Météo
          const lit = trend === 'down' ? deg > at && deg < at + 30 : trend === 'up' ? deg < at && deg > at - 30 : false;
          return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lit ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)'} strokeWidth={2} />;
        })}
        {(() => {
          const [x1, y1] = pt(at, R + 2);
          const [x2, y2] = pt(at, R - 16);
          return <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WHITE} strokeWidth={5} strokeLinecap="round" />;
        })()}
      </Svg>
      <View style={styles.dialCenter} pointerEvents="none">
        {trend ? <T style={styles.dialArrow}>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '='}</T> : null}
        <T style={styles.dialValue}>{Math.round(value)}</T>
        <T style={styles.dialUnit}>hPa</T>
      </View>
      <T style={[styles.dialEnd, { left: 18 }]}>↓</T>
      <T style={[styles.dialEnd, { right: 18 }]}>↑</T>
    </View>
  );
}

const mm = (v: number) => (v < 0.05 ? '0' : v < 1 ? v.toFixed(1).replace('.', ',') : `${Math.round(v)}`);

export function Tiles({ forecast, obs, place }: { forecast: Forecast; obs: Observation | null; place: Place }) {
  const normal = useCached(`normal:${placeKey(place)}:${new Date().toDateString()}`, () => fetchNormal(place), 12 * 3600 * 1000);
  const model = forecast.current;
  // Les mesures des stations remplacent la prévision quand elles existent.
  const c = { ...model, humidity: obs?.humidity ?? model.humidity, pressure: obs?.pressure ?? model.pressure };
  const hours = upcomingHours(forecast.hourly);
  const now = hours[0];
  const today = forecast.daily[0];
  const tomorrow = forecast.daily[1];
  const nowSec = Date.now() / 1000;

  // UV : maintenant et pour le reste de la journée
  const uv = now?.uv ?? today?.uvMax ?? null;
  const endOfDay = today ? today.time + 86400 : nowSec;
  const rest = hours.filter((h) => h.time < endOfDay && h.uv !== null);
  const strong = rest.filter((h) => (h.uv ?? 0) >= 3);
  const uvNote =
    strong.length > 0
      ? `Protection conseillée de ${hour(strong[0].time)} à ${hour(strong[strong.length - 1].time + 3600)}.`
      : `${uvLabel(Math.max(uv ?? 0, ...rest.map((h) => h.uv ?? 0)))} pour le reste de la journée.`;

  // Soleil : prochain événement en titre, l'autre en bas
  const nextRise = today && nowSec < today.sunrise ? today.sunrise : tomorrow?.sunrise;
  const sunUp = !!today && nowSec >= today.sunrise && nowSec < today.sunset;
  const sunDay = today && nowSec < today.sunset ? today : tomorrow;

  // Ressenti
  const feels = c.apparent - c.temperature;
  const feelsNote =
    Math.abs(feels) < 1.5
      ? 'Similaire à la température réelle.'
      : feels < 0
        ? c.windSpeed >= 15
          ? 'Le vent rend la température ressentie plus fraîche.'
          : 'L’humidité rend la température ressentie plus fraîche.'
        : 'L’humidité rend la température ressentie plus chaude.';

  // Précipitations : dernières 24 h et 24 h à venir
  const past24 = forecast.hourly.filter((h) => h.time + 3600 <= nowSec && h.time >= nowSec - 24 * 3600).reduce((s, h) => s + h.precipitation, 0);
  const next24 = hours.slice(0, 24).reduce((s, h) => s + h.precipitation, 0);

  // Pression : tendance sur 3 h
  const p3 = hours[3]?.pressure;
  const trend = p3 === undefined ? '' : p3 - model.pressure > 0.8 ? 'up' : model.pressure - p3 > 0.8 ? 'down' : 'flat';

  const vis = now?.visibility ?? null;
  const visKm = vis !== null ? vis / 1000 : null;
  const diff = normal && today ? Math.round(today.tMax - normal.tMax) : null;

  return (
    <View style={styles.grid}>
      {sunDay ? (
        <Tile
          title={sunUp ? 'Coucher' : 'Lever'}
          icon={sunUp ? { ios: 'sunset.fill', android: 'wb_twilight' } : { ios: 'sunrise.fill', android: 'wb_twilight' }}
          value={time(sunUp ? today!.sunset : (nextRise ?? sunDay.sunrise))}
          note={sunUp ? `Lever : ${time(sunDay.sunrise)}` : `Coucher : ${time(sunDay.sunset)}`}
        >
          {today ? <SunArc sunrise={today.sunrise} sunset={today.sunset} /> : null}
        </Tile>
      ) : null}
      {uv !== null ? (
        <Tile title="Indice UV" metric="uv" icon={{ ios: 'sun.max.fill', android: 'light_mode' }} value={`${Math.round(uv)}`} sub={uvLabel(uv)} note={uvNote}>
          <Scale ratio={uv / 11} colors={['#3EC46D', '#B8D82A', '#F5D312', '#F28C1A', '#E5484D', '#C04BD8']} />
        </Tile>
      ) : null}
      <Tile title="Ressenti" metric="temp" icon={{ ios: 'thermometer.medium', android: 'thermostat' }} value={temp(c.apparent)} note={feelsNote} />
      {diff !== null && normal && today ? (
        <Tile
          title="Moyennes"
          metric="temp"
          icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'show_chart' }}
          value={`${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}°`}
          sub={diff === 0 ? 'par rapport aux temp. max. quotidiennes moyennes' : diff > 0 ? 'au-dessus de la temp. max. quotidienne moyenne' : 'en dessous de la temp. max. quotidienne moyenne'}
        >
          <View style={styles.avg}>
            <View style={styles.avgRow}>
              <T style={styles.avgKey}>Aujourd’hui</T>
              <T style={styles.avgVal}>Max. : {temp(today.tMax)}</T>
            </View>
            <View style={styles.avgRow}>
              <T style={styles.avgKey}>Moyenne</T>
              <T style={styles.avgVal}>Max. : {temp(normal.tMax)}</T>
            </View>
          </View>
        </Tile>
      ) : null}
      <Tile
        title="Précipitations"
        metric="rain"
        icon={{ ios: 'drop.fill', android: 'water_drop' }}
        value={`${mm(past24)} mm`}
        sub="dans les dernières 24 h"
        note={next24 < 0.5 ? 'Aucune précipitation prévue d’ici 24 h.' : `Prévisions : ${mm(next24)} mm d’ici 24 h.`}
      />
      {visKm !== null ? (
        <Tile
          title="Visibilité"
          metric="visibility"
          icon={{ ios: 'eye.fill', android: 'visibility' }}
          value={`${visKm >= 10 ? Math.round(visKm) : visKm.toFixed(1).replace('.', ',')} km`}
          note={
            visKm >= 20
              ? 'Vue parfaitement dégagée.'
              : visKm >= 10
                ? 'Vue dégagée.'
                : visKm >= 5
                  ? 'Légère brume.'
                  : visKm >= 1
                    ? 'Visibilité réduite par la brume.'
                    : 'Brouillard : visibilité très réduite.'
          }
        />
      ) : null}
      <Tile title="Humidité" metric="humidity" icon={{ ios: 'humidity.fill', android: 'humidity_percentage' }} value={`${Math.round(c.humidity)} %`} note={`Le point de rosée est de ${temp(c.dewPoint)}.`} />
      <Tile title="Pression" metric="pressure" icon={{ ios: 'gauge.with.dots.needle.33percent', android: 'speed' }}>
        <PressureDial value={c.pressure} trend={trend} />
      </Tile>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.6%', marginBottom: 10 },
  glass: { flex: 1, marginBottom: 0 },
  value: { fontSize: 36, fontWeight: '400', letterSpacing: 0.2, fontVariant: ['tabular-nums'], lineHeight: 42 },
  sub: { fontSize: 18, fontWeight: '600', lineHeight: 22, marginTop: 2 },
  middle: { flex: 1, justifyContent: 'center', minHeight: 8 },
  note: { fontSize: 15, lineHeight: 19 },
  bleed: { marginHorizontal: -16 },
  scale: { height: 10, justifyContent: 'center' },
  scaleBar: { height: 5, borderRadius: 2.5 },
  scaleDot: { position: 'absolute', width: 9, height: 9, borderRadius: 4.5, marginLeft: -4.5, backgroundColor: WHITE, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.4)' },
  avg: { marginTop: 'auto', gap: 2 },
  avgRow: { flexDirection: 'row', justifyContent: 'space-between' },
  avgKey: { fontSize: 15, color: DIM },
  avgVal: { fontSize: 15, fontWeight: '600' },
  dialCenter: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  dialArrow: { fontSize: 20, fontWeight: '600', lineHeight: 22 },
  dialValue: { fontSize: 21, fontWeight: '700', lineHeight: 25 },
  dialUnit: { fontSize: 15 },
  dialEnd: { position: 'absolute', bottom: -4, fontSize: 17, fontWeight: '600' },
});
