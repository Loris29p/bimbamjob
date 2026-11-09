// Graphique sur 24 h (courbe ou barres) en SVG.
// - Heures passées en pointillés et plus pâles, avenir en trait plein.
// - On pose le doigt et on glisse pour lire la valeur heure par heure.
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { tick } from '../lib/hig';
import { T } from './ui';

export type Series = { values: { t: number; v: number }[]; color: string; dashed?: boolean; fill?: boolean };

type Props = {
  width: number;
  height?: number;
  dayStart: number;
  series: Series[];
  bars?: { t: number; v: number }[];
  barColor?: string;
  yMin: number;
  yMax: number;
  yTicks: number[];
  formatY: (v: number) => string;
  /** Texte affiché pendant la lecture au doigt */
  formatValue?: (v: number, t: number) => string;
  /** Instant courant (si la journée affichée est aujourd'hui) */
  now?: number;
  bands?: { from: number; to: number; label: string }[];
};

const AXIS = 34;
const BOTTOM = 18;
const TOP = 10;

export function interp(values: { t: number; v: number }[], t: number) {
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1];
    const b = values[i];
    if (t >= a.t && t <= b.t) return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
  }
  return NaN;
}

export function Chart({ width, height = 220, dayStart, series, bars, barColor = '#5AC8FA', yMin, yMax, yTicks, formatY, formatValue, now, bands }: Props) {
  const w = width - AXIS;
  const h = height - BOTTOM;
  const x = (t: number) => ((t - dayStart) / (24 * 3600)) * w;
  const y = (v: number) => h - ((v - yMin) / Math.max(1e-6, yMax - yMin)) * (h - TOP);
  const path = (pts: { t: number; v: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const cut = now !== undefined && now > dayStart && now < dayStart + 86400 ? now : null;

  // Lecture au doigt
  const [scrub, setScrubRaw] = useState<number | null>(null);
  // petit retour haptique à chaque nouvelle heure pendant la lecture au doigt
  const lastHour = useRef<number | null>(null);
  const setScrub = (t: number | null) => {
    const h = t === null ? null : Math.floor(t / 3600);
    if (h !== null && h !== lastHour.current) tick();
    lastHour.current = h;
    setScrubRaw(t);
  };
  const setRef = useRef(setScrub);
  setRef.current = setScrub;
  const toTime = (px: number) => dayStart + Math.max(0, Math.min(1, px / w)) * 86400;
  const xRef = useRef(toTime);
  xRef.current = toTime;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => setRef.current(xRef.current(e.nativeEvent.locationX)),
        onPanResponderMove: (e) => setRef.current(xRef.current(e.nativeEvent.locationX)),
        onPanResponderRelease: () => setRef.current(null),
        onPanResponderTerminate: () => setRef.current(null),
      }),
    [],
  );

  const main = series[0]?.values ?? bars ?? [];
  const scrubVal = scrub === null ? NaN : bars && !series.length ? bars.find((b) => scrub >= b.t && scrub < b.t + 3600)?.v ?? NaN : interp(main, scrub);
  const hh = (t: number) => {
    const d = new Date(t * 1000);
    return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <View>
      <View style={styles.readout}>
        {scrub !== null && Number.isFinite(scrubVal) ? (
          <T style={styles.readText}>
            {hh(scrub)} · {formatValue ? formatValue(scrubVal, scrub) : formatY(scrubVal)}
          </T>
        ) : (
          <T style={styles.hint}>Glisse le doigt sur le graphique pour lire les valeurs</T>
        )}
      </View>
      <View style={{ width, height }} {...pan.panHandlers}>
        <Svg width={width} height={height}>
          <Defs>
            {series.map((s, i) => (
              <LinearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={s.color} stopOpacity={0.45} />
                <Stop offset="1" stopColor={s.color} stopOpacity={0.03} />
              </LinearGradient>
            ))}
          </Defs>

          {/* Partie passée de la journée, légèrement assombrie */}
          {cut !== null ? <Rect x={0} y={0} width={x(cut)} height={h} fill="rgba(0,0,0,0.18)" /> : null}

          {bands?.map((b) => (
            <SvgText key={b.label} x={6} y={y(b.from) - 4} fill="rgba(255,255,255,0.5)" fontSize={11}>
              {b.label}
            </SvgText>
          ))}
          {yTicks.map((v) => (
            <Line key={`y${v}`} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          ))}
          {yTicks.map((v) => (
            <SvgText key={`l${v}`} x={w + 6} y={y(v) + 4} fill="rgba(255,255,255,0.6)" fontSize={11}>
              {formatY(v)}
            </SvgText>
          ))}
          {[0, 6, 12, 18].map((hr) => (
            <Line key={`x${hr}`} x1={x(dayStart + hr * 3600)} x2={x(dayStart + hr * 3600)} y1={0} y2={h} stroke="rgba(255,255,255,0.1)" strokeDasharray="2,3" />
          ))}
          {[0, 6, 12, 18].map((hr) => (
            <SvgText key={`t${hr}`} x={x(dayStart + hr * 3600) + 3} y={height - 4} fill="rgba(255,255,255,0.6)" fontSize={11}>
              {`${hr} h`}
            </SvgText>
          ))}

          {bars?.map((b) => {
            const bw = Math.max(2, w / 24 - 3);
            const top = y(Math.max(yMin, b.v));
            const past = cut !== null && b.t + 3600 <= cut;
            return <Rect key={b.t} x={x(b.t) + 1.5} y={top} width={bw} height={Math.max(0, h - top)} rx={2} fill={barColor} opacity={past ? 0.4 : 1} />;
          })}

          {series.map((s, i) => {
            if (s.values.length < 2) return null;
            const past = cut !== null ? s.values.filter((p) => p.t <= cut + 3600) : [];
            const future = cut !== null ? s.values.filter((p) => p.t >= cut - 3600) : s.values;
            const area = `${path(s.values)} L${x(s.values[s.values.length - 1].t)},${h} L${x(s.values[0].t)},${h} Z`;
            return (
              <G key={`s${i}`}>
                {s.fill !== false ? <Path d={area} fill={`url(#g${i})`} /> : null}
                {past.length > 1 ? (
                  <Path d={path(past)} stroke={s.color} strokeOpacity={0.55} strokeWidth={2.5} fill="none" strokeDasharray="5,5" strokeLinecap="round" />
                ) : null}
                {future.length > 1 ? (
                  <Path d={path(future)} stroke={s.color} strokeWidth={2.5} fill="none" strokeDasharray={s.dashed ? '6,5' : undefined} strokeLinecap="round" />
                ) : null}
              </G>
            );
          })}

          {cut !== null ? (
            <>
              <Line x1={x(cut)} x2={x(cut)} y1={0} y2={h} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
              {series[0] && Number.isFinite(interp(series[0].values, cut)) ? (
                <Circle cx={x(cut)} cy={y(interp(series[0].values, cut))} r={5} fill="#fff" stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />
              ) : null}
            </>
          ) : null}

          {scrub !== null ? (
            <>
              <Line x1={x(scrub)} x2={x(scrub)} y1={0} y2={h} stroke="#fff" strokeWidth={1.5} />
              {Number.isFinite(scrubVal) && series.length ? <Circle cx={x(scrub)} cy={y(scrubVal)} r={6} fill="#fff" /> : null}
            </>
          ) : null}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { height: 22, justifyContent: 'center', marginBottom: 4 },
  readText: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
});
