// Lune : phase en titre, valeurs à gauche, dessin de la lune à droite (comme l'app Météo).
import type { SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { time } from '../lib/format';
import { moonInfo, nextMoonrise } from '../lib/moon';
import type { Place } from '../lib/types';
import { DIM, Glass, LINE, T } from './ui';

const PHASE_ICONS: SymbolViewProps['name'][] = [
  { ios: 'moonphase.new.moon', android: 'dark_mode' },
  { ios: 'moonphase.waxing.crescent', android: 'dark_mode' },
  { ios: 'moonphase.first.quarter', android: 'dark_mode' },
  { ios: 'moonphase.waxing.gibbous', android: 'dark_mode' },
  { ios: 'moonphase.full.moon', android: 'dark_mode' },
  { ios: 'moonphase.waning.gibbous', android: 'dark_mode' },
  { ios: 'moonphase.last.quarter', android: 'dark_mode' },
  { ios: 'moonphase.waning.crescent', android: 'dark_mode' },
];

// quelques « mers » sombres pour donner du relief à la lune
const MARIA: [number, number, number][] = [
  [0.36, 0.34, 0.13],
  [0.58, 0.3, 0.1],
  [0.47, 0.5, 0.09],
  [0.66, 0.55, 0.12],
  [0.4, 0.7, 0.08],
  [0.62, 0.74, 0.06],
];

/** Lune éclairée selon la phase (0 = nouvelle, 0,5 = pleine), face cachée gris foncé. */
function MoonDrawing({ fraction, size }: { fraction: number; size: number }) {
  const r = size / 2;
  const k = Math.cos(2 * Math.PI * fraction); // 1 → -1 → 1
  const rx = Math.abs(k) * r;
  const waxing = fraction < 0.5;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = waxing === k > 0 ? 0 : 1;
  const lit = `M ${r} 0 A ${r} ${r} 0 0 ${sweepOuter} ${r} ${size} A ${rx} ${r} 0 0 ${sweepInner} ${r} 0 Z`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="moonDark" cx="45%" cy="40%" r="60%">
          <Stop offset="0" stopColor="#5B6170" />
          <Stop offset="1" stopColor="#3A3F4B" />
        </RadialGradient>
        <RadialGradient id="moonLit" cx="45%" cy="40%" r="65%">
          <Stop offset="0" stopColor="#F2F0E8" />
          <Stop offset="1" stopColor="#C9C6BC" />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill="url(#moonDark)" />
      {fraction > 0.01 && fraction < 0.99 ? <Path d={lit} fill="url(#moonLit)" /> : null}
      {MARIA.map(([x, y, s], i) => (
        <Circle key={i} cx={x * size} cy={y * size} r={s * size} fill="#000" opacity={0.07} />
      ))}
    </Svg>
  );
}

export function MoonCard({ place }: { place: Place }) {
  const m = moonInfo();
  const rise = nextMoonrise(place.latitude, place.longitude);
  const phaseIndex = Math.round(m.fraction * 8) % 8;
  const rows = [
    ['Illumination', `${Math.round(m.illumination * 100)} %`],
    ['Prochain lever', rise ? time(rise) : '–'],
    ['Prochaine pleine lune', m.daysToFull === 0 ? 'Aujourd’hui' : `${m.daysToFull} j`],
  ];
  return (
    <Glass title={m.name} icon={PHASE_ICONS[phaseIndex]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          {rows.map(([k, v], i) => (
            <View key={k} style={[styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE }]}>
              <T style={styles.key} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {k}
              </T>
              <T style={styles.value} numberOfLines={1}>
                {v}
              </T>
            </View>
          ))}
        </View>
        <MoonDrawing fraction={m.fraction} size={124} />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, gap: 8 },
  key: { fontSize: 17, flexShrink: 1 },
  value: { fontSize: 17, color: DIM, fontVariant: ['tabular-nums'] },
});
