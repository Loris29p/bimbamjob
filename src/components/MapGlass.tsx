// Commandes posées sur la carte (bouton fermer, calques, légende, menus) en « Liquid Glass » natif.
// iOS 26 : vrai verre ; iOS plus ancien : flou système ; Android : panneau opaque.
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { SymbolViewProps } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tick } from '../lib/hig';
import { Icon } from './ui';

export const LIQUID_MAP = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function mapColors(dark: boolean) {
  return {
    text: dark ? '#FFFFFF' : '#1C1C1E',
    sub: dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
    fill: dark ? 'rgba(255,255,255,0.14)' : 'rgba(120,120,128,0.14)',
    line: dark ? 'rgba(255,255,255,0.15)' : 'rgba(60,60,67,0.15)',
  };
}

/** Fond en verre qui remplit son parent (le parent porte l'arrondi). */
export function GlassFill({ dark, radius, interactive }: { dark: boolean; radius: number; interactive?: boolean }) {
  const style = [StyleSheet.absoluteFill, { borderRadius: radius }];
  if (LIQUID_MAP) return <GlassView style={style} glassEffectStyle="regular" isInteractive={interactive} colorScheme={dark ? 'dark' : 'light'} />;
  if (Platform.OS === 'ios') return <BlurView intensity={80} tint={dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} style={[style, { overflow: 'hidden' }]} />;
  return <View style={[style, { backgroundColor: dark ? 'rgba(28,32,40,0.94)' : 'rgba(255,255,255,0.96)' }]} />;
}

/** Ombre douce et bord fin quand le verre natif n'est pas disponible (il dessine déjà les siens). */
export const glassShadow: ViewStyle = LIQUID_MAP
  ? {}
  : { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 3 }, elevation: 5 };

type IconName = SymbolViewProps['name'];
const SIZE = 48;

/** Bouton rond en verre. */
export function GlassCircle({ dark, icon, label, onPress, style }: { dark: boolean; icon: IconName; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const c = mapColors(dark);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => [styles.circle, glassShadow, { opacity: pressed && !LIQUID_MAP ? 0.7 : 1 }, style]}>
      <GlassFill dark={dark} radius={SIZE / 2} interactive />
      <Icon name={icon} size={20} color={c.text} />
    </Pressable>
  );
}

/** Colonne de boutons dans une même capsule de verre (calques / position). */
export function GlassPill({ dark, items, style }: { dark: boolean; items: { icon: IconName; label: string; onPress: () => void }[]; style?: StyleProp<ViewStyle> }) {
  const c = mapColors(dark);
  return (
    <View style={[styles.pill, glassShadow, style]}>
      <GlassFill dark={dark} radius={SIZE / 2} interactive />
      {items.map((it) => (
        <Pressable key={it.label} onPress={it.onPress} accessibilityRole="button" accessibilityLabel={it.label} style={({ pressed }) => [styles.pillItem, { opacity: pressed ? 0.5 : 1 }]}>
          <Icon name={it.icon} size={22} color={c.text} />
        </Pressable>
      ))}
    </View>
  );
}

/** Menu flottant en verre (choix du calque, des villes). */
export function GlassMenu({
  dark,
  items,
  onSelect,
  style,
}: {
  dark: boolean;
  items: { key: string; label: string; detail?: string; selected?: boolean }[];
  onSelect: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = mapColors(dark);
  return (
    <View style={[styles.menu, glassShadow, style]}>
      <GlassFill dark={dark} radius={22} />
      {items.map((it, i) => (
        <Pressable
          key={it.key}
          onPress={() => {
            tick();
            onSelect(it.key);
          }}
          accessibilityRole="menuitem"
          accessibilityState={{ selected: !!it.selected }}
          style={({ pressed }) => [styles.menuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }, pressed && { backgroundColor: c.fill }]}
        >
          <View style={styles.check}>{it.selected ? <Icon name={{ ios: 'checkmark', android: 'check' }} size={14} color={c.text} /> : null}</View>
          <Text style={[styles.menuText, { color: c.text }]} numberOfLines={1}>
            {it.label}
          </Text>
          {it.detail ? <Text style={[styles.menuDetail, { color: c.sub }]}>{it.detail}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

export type MapLayer = 'rain' | 'temp' | 'wind' | 'air';
export const LAYER_NAMES: Record<MapLayer, string> = { rain: 'Précipitations', temp: 'Température', wind: 'Vent', air: 'Qualité de l’air' };
// Couleurs de haut en bas, comme les libellés
const LEGENDS: Record<MapLayer, { labels: string[]; colors: [string, string, ...string[]] }> = {
  rain: { labels: ['Extrêmes', 'Fortes', 'Modérées', 'Faibles'], colors: ['#FFF27A', '#C77DFF', '#7A5CF0', '#4E7CF5'] },
  temp: { labels: ['35°', '20°', '5°', '-10°'], colors: ['rgb(230,50,50)', 'rgb(250,210,70)', 'rgb(110,210,190)', 'rgb(94,92,230)'] },
  wind: { labels: ['80+', '50', '25', '0'], colors: ['rgb(225,60,60)', 'rgb(230,210,80)', 'rgb(120,210,150)', 'rgb(120,180,250)'] },
  air: { labels: ['Mauvaise', 'Dégradée', 'Moyenne', 'Bonne'], colors: ['rgb(150,0,50)', 'rgb(255,80,80)', 'rgb(240,230,65)', 'rgb(80,240,230)'] },
};

/** Légende du calque affiché. */
export function GlassLegend({ dark, layer, style }: { dark: boolean; layer: MapLayer; style?: StyleProp<ViewStyle> }) {
  const c = mapColors(dark);
  const g = LEGENDS[layer];
  return (
    <View style={[styles.legend, glassShadow, style]} pointerEvents="none">
      <GlassFill dark={dark} radius={20} />
      <Text style={[styles.legendTitle, { color: c.text }]}>{layer === 'wind' ? 'Vent (km/h)' : LAYER_NAMES[layer]}</Text>
      <View style={[styles.legendLine, { backgroundColor: c.line }]} />
      <View style={styles.legendRow}>
        <LinearGradient colors={g.colors} style={styles.legendBar} />
        <View style={styles.legendLabels}>
          {g.labels.map((l) => (
            <Text key={l} style={[styles.legendLabel, { color: c.sub }]}>
              {l}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Petit bandeau d'information (service indisponible…). */
export function GlassNote({ dark, text, style }: { dark: boolean; text: string; style?: StyleProp<ViewStyle> }) {
  const c = mapColors(dark);
  return (
    <View style={[styles.note, glassShadow, style]} pointerEvents="none">
      <GlassFill dark={dark} radius={16} />
      <Text style={[styles.noteText, { color: c.text }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  pill: { width: SIZE, borderRadius: SIZE / 2, paddingVertical: 4 },
  pillItem: { height: 50, alignItems: 'center', justifyContent: 'center' },
  menu: { borderRadius: 22, paddingVertical: 4, minWidth: 210 },
  menuItem: { flexDirection: 'row', alignItems: 'center', minHeight: 46, paddingHorizontal: 14, gap: 8 },
  check: { width: 16, alignItems: 'center' },
  menuText: { flex: 1, fontSize: 16 },
  menuDetail: { fontSize: 15, fontVariant: ['tabular-nums'] },
  legend: { borderRadius: 20, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  legendTitle: { fontSize: 16, fontWeight: '600' },
  legendLine: { height: StyleSheet.hairlineWidth, marginHorizontal: -14, marginTop: 10, marginBottom: 10 },
  legendRow: { flexDirection: 'row', gap: 10 },
  legendBar: { width: 4, borderRadius: 2 },
  legendLabels: { gap: 14, paddingVertical: 2 },
  legendLabel: { fontSize: 15 },
  note: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  noteText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
