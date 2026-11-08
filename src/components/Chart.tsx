// Graphique sur 24 h (courbe aire ou barres), dessiné en SVG.
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

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
  /** Instant courant (si la journée affichée est aujourd'hui) */
  now?: number;
  bands?: { from: number; to: number; label: string }[];
};

const AXIS = 34;
const BOTTOM = 18;
const TOP = 10;

export function Chart({ width, height = 220, dayStart, series, bars, barColor = '#5AC8FA', yMin, yMax, yTicks, formatY, now, bands }: Props) {
  const w = width - AXIS;
  const h = height - BOTTOM;
  const x = (t: number) => ((t - dayStart) / (24 * 3600)) * w;
  const y = (v: number) => h - ((v - yMin) / Math.max(1e-6, yMax - yMin)) * (h - TOP);

  const path = (pts: { t: number; v: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          {series.map((s, i) => (
            <LinearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={s.color} stopOpacity={0.45} />
              <Stop offset="1" stopColor={s.color} stopOpacity={0.03} />
            </LinearGradient>
          ))}
        </Defs>

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
          return <Rect key={b.t} x={x(b.t) + 1.5} y={top} width={bw} height={Math.max(0, h - top)} rx={2} fill={barColor} opacity={now !== undefined && b.t + 3600 < now ? 0.45 : 1} />;
        })}

        {series.map((s, i) =>
          s.values.length > 1 ? (
            <Path
              key={`f${i}`}
              d={`${path(s.values)} L${x(s.values[s.values.length - 1].t)},${h} L${x(s.values[0].t)},${h} Z`}
              fill={s.fill === false ? 'none' : `url(#g${i})`}
            />
          ) : null,
        )}
        {series.map((s, i) =>
          s.values.length > 1 ? (
            <Path key={`p${i}`} d={path(s.values)} stroke={s.color} strokeWidth={2.5} fill="none" strokeDasharray={s.dashed ? '6,5' : undefined} strokeLinecap="round" />
          ) : null,
        )}

        {now !== undefined && now >= dayStart && now <= dayStart + 24 * 3600 ? (
          <>
            <Line x1={x(now)} x2={x(now)} y1={0} y2={h} stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
            {series[0] ? <NowDot x={x(now)} y={y(interp(series[0].values, now))} /> : null}
          </>
        ) : null}
      </Svg>
    </View>
  );
}

function NowDot({ x, y }: { x: number; y: number }) {
  if (!Number.isFinite(y)) return null;
  return <Circle cx={x} cy={y} r={5} fill="#fff" stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />;
}

export function interp(values: { t: number; v: number }[], t: number) {
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1];
    const b = values[i];
    if (t >= a.t && t <= b.t) return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
  }
  return NaN;
}

