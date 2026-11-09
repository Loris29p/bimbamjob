// Cartes larges du bas de page, sur le modèle de l'app Météo d'iOS :
// vent (boussole) et liens de fin de page. L'aperçu de la carte est dans RadarPreview.
import { router } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Place } from '../lib/types';
import { windDirection } from '../lib/weatherCodes';
import { DIM, Glass, Icon, LINE, T } from './ui';

// ---------- Vent : valeurs à gauche, boussole à droite ----------

function Compass({ deg, speed }: { deg: number; speed: number }) {
  const S = 150;
  const c = S / 2;
  const R = S / 2 - 4;
  const pt = (a: number, r: number) => [c + r * Math.sin(a), c - r * Math.cos(a)];
  const ticks = Array.from({ length: 180 }, (_, i) => (i * 2 * Math.PI) / 180);
  // Le vent vient de `deg` : rond côté origine, pointe vers où il souffle.
  const a = (deg * Math.PI) / 180;
  const [tx, ty] = pt(a, R - 12);
  const [hx, hy] = pt(a + Math.PI, R - 12);
  const [ix, iy] = pt(a, 26);
  const [jx, jy] = pt(a + Math.PI, 26);
  const head = (side: number) => pt(a + Math.PI + side * 0.16, R - 26);
  const [l1x, l1y] = head(1);
  const [l2x, l2y] = head(-1);
  return (
    <View style={{ width: S, height: S }}>
      <Svg width={S} height={S}>
        {ticks.map((t, i) => {
          const near = [0, 90, 180, 270].some((q) => Math.abs(((i * 2 - q + 540) % 360) - 180) < 9);
          if (near) return null; // place pour les lettres N, E, S, O
          const [x1, y1] = pt(t, R);
          const [x2, y2] = pt(t, R - (i % 15 === 0 ? 9 : 6));
          return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.28)" strokeWidth={i % 15 === 0 ? 1.4 : 0.8} />;
        })}
        {[
          ['N', 0],
          ['E', 90],
          ['S', 180],
          ['O', 270],
        ].map(([l, q]) => {
          const [x, y] = pt(((q as number) * Math.PI) / 180, R - 4);
          return (
            <SvgText key={l} x={x} y={y + 5} fill="rgba(255,255,255,0.8)" fontSize={14} fontWeight="600" fontFamily="System" textAnchor="middle">
              {l}
            </SvgText>
          );
        })}
        {/* flèche coupée au centre pour laisser la place à la vitesse */}
        <Line x1={tx} y1={ty} x2={ix} y2={iy} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        <Line x1={jx} y1={jy} x2={hx} y2={hy} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        <Path d={`M${l1x},${l1y} L${hx},${hy} L${l2x},${l2y}`} stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Circle cx={tx} cy={ty} r={7} fill="#fff" />
      </Svg>
      <View style={styles.compassCenter} pointerEvents="none">
        <T style={styles.compassSpeed}>{Math.round(speed)}</T>
        <T style={styles.compassUnit}>km/h</T>
      </View>
    </View>
  );
}

export function WindCard({ speed, gusts, direction }: { speed: number; gusts: number; direction: number }) {
  const rows: [string, string][] = [
    ['Vent', `${Math.round(speed)} km/h`],
    ['Rafales', `${Math.round(gusts)} km/h`],
    ['Direction', `${Math.round(direction)}° ${windDirection(direction)}`],
  ];
  return (
    <Pressable onPress={() => router.push({ pathname: '/detail', params: { metric: 'wind' } })}>
      <Glass title="Vent" icon={{ ios: 'wind', android: 'air' }}>
        <View style={styles.windRow}>
          <View style={{ flex: 1 }}>
            {rows.map(([k, v], i) => (
              <View key={k} style={[styles.line, i > 0 && styles.lineBorder]}>
                <T style={styles.lineKey}>{k}</T>
                <T style={styles.lineValue} numberOfLines={1}>
                  {v}
                </T>
              </View>
            ))}
          </View>
          <Compass deg={direction} speed={speed} />
        </View>
      </Glass>
    </Pressable>
  );
}

// ---------- Fin de page ----------

export function PageFooter({ place, sources }: { place: Place; sources: string }) {
  const openMaps = () => {
    const q = encodeURIComponent(place.name);
    const url =
      Platform.OS === 'ios'
        ? `maps://?ll=${place.latitude},${place.longitude}&q=${q}`
        : `geo:${place.latitude},${place.longitude}?q=${place.latitude},${place.longitude}(${q})`;
    Linking.openURL(url).catch(() => {});
  };
  return (
    <View style={styles.footer}>
      <View style={styles.footRow}>
        <View style={{ flex: 1 }}>
          <T style={styles.footTitle}>{place.isGps ? 'Météo pour ma position' : `Météo pour ${place.name}`}</T>
          <T style={styles.footSub}>{place.department ? `${place.name} (${place.department})` : place.name}</T>
        </View>
        <Icon name={{ ios: 'info.circle', android: 'info' }} size={22} color={DIM} />
      </View>
      <Pressable onPress={openMaps} style={({ pressed }) => [styles.footRow, pressed && { opacity: 0.6 }]} accessibilityRole="link">
        <T style={[styles.footTitle, { flex: 1, color: DIM }]}>Afficher dans Plans</T>
        <Icon name={{ ios: 'arrow.up.forward.square.fill', android: 'open_in_new' }} size={22} color={DIM} />
      </Pressable>
      <T style={styles.sources}>{sources}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  windRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  lineBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  lineKey: { fontSize: 17 },
  lineValue: { fontSize: 17, color: DIM, fontVariant: ['tabular-nums'] },
  compassCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  compassSpeed: { fontSize: 22, fontWeight: '700', lineHeight: 24 },
  compassUnit: { fontSize: 15, fontWeight: '500' },
  footer: { marginTop: 14, paddingHorizontal: 16 },
  footRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE, gap: 10 },
  footTitle: { fontSize: 17 },
  footSub: { fontSize: 15, color: DIM, marginTop: 2 },
  sources: { fontSize: 12, color: DIM, textAlign: 'center', paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
});
