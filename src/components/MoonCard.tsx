import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { moonInfo } from '../lib/moon';
import { DIM, Glass, LINE, T } from './ui';

/** Dessin de la lune éclairée selon la phase (0 = nouvelle, 0,5 = pleine). */
function MoonDrawing({ fraction, size }: { fraction: number; size: number }) {
  const r = size / 2;
  const k = Math.cos(2 * Math.PI * fraction); // 1 → -1 → 1
  const rx = Math.abs(k) * r;
  const waxing = fraction < 0.5;
  // Contour éclairé : demi-cercle côté lumière + ellipse du terminateur
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = waxing === k > 0 ? 0 : 1;
  const d = `M ${r} 0 A ${r} ${r} 0 0 ${sweepOuter} ${r} ${size} A ${rx} ${r} 0 0 ${sweepInner} ${r} 0 Z`;
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={r - 0.5} fill="#2A3142" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      <Path d={d} fill="#E8E4D8" />
    </Svg>
  );
}

export function MoonCard() {
  const m = moonInfo();
  const rows = [
    ['Éclairement', `${Math.round(m.illumination * 100)} %`],
    ['Pleine lune', m.daysToFull === 0 ? 'Aujourd’hui' : `dans ${m.daysToFull} j`],
    ['Nouvelle lune', m.daysToNew === 0 ? 'Aujourd’hui' : `dans ${m.daysToNew} j`],
  ];
  return (
    <Glass title={m.name} icon={{ ios: 'moon.fill', android: 'dark_mode' }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          {rows.map(([k, v], i) => (
            <View key={k} style={[styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE }]}>
              <T style={{ fontSize: 15 }}>{k}</T>
              <T style={{ fontSize: 15, color: DIM }}>{v}</T>
            </View>
          ))}
        </View>
        <MoonDrawing fraction={m.fraction} size={96} />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
});
