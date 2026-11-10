// Frise de lecture de la carte (lecture / pause, 3 h – 12 h, piste horaire), en natif
// pour profiter du vrai « Liquid Glass » d'iOS 26 au-dessus de la carte (WebView).
import { LinearGradient } from 'expo-linear-gradient';
import { hourOf, timeOf as fmtTime } from '../lib/format';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { tap, tick } from '../lib/hig';
import { GlassFill, LAYER_NAMES, glassShadow, mapColors, type MapLayer } from './MapGlass';
import { Icon } from './ui';

/** État envoyé par la carte (WebView). */
export type TimelineMeta = {
  mode: '3h' | '12h';
  showModes: boolean;
  ticks: { t: number; f: number }[]; // heures candidates à un libellé
  grads: number[];
  nowF: number; // position de « maintenant » sur la piste
};
/** Source de l'image de pluie affichée : radar observé, radar prolongé (prévision immédiate) ou modèle AROME. */
export type RainSource = 'radar' | 'nc' | 'arome' | '';
export type TimelinePos = { f: number; t: number; empty: boolean; playing: boolean; src?: RainSource; unavailable?: boolean };
const SOURCE_TITLES: Record<Exclude<RainSource, ''>, string> = { radar: 'Radar', nc: 'Radar prolongé', arome: 'Prévision AROME' };

type Props = {
  dark: boolean;
  layer: MapLayer;
  meta: TimelineMeta | null;
  pos: TimelinePos | null;
  bottom: number;
  onPlay: () => void;
  onMode: (m: '3h' | '12h') => void;
  onSeek: (f: number) => void;
};

const MODES: { m: '3h' | '12h'; label: string }[] = [
  { m: '3h', label: '3 h' },
  { m: '12h', label: '12 h' },
];
const LABEL_W = 58;
const BUBBLE_W = 64;
const TRACK_H = 10;
const NEAR = 450; // à moins de 7 min 30 de l'heure actuelle, on parle de « maintenant »

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
// heure au format du téléphone (24 h ou AM/PM)
const timeAt = (t: number) => fmtTime(new Date(Math.round(t / 60) * 60000));

function heading(layer: MapLayer, pos: TimelinePos | null) {
  if (!pos) return { title: 'Chargement…', sub: '' };
  if (pos.unavailable) return { title: 'Indisponible', sub: 'Réessaie dans quelques minutes' };
  const now = Date.now() / 1000;
  const d = new Date(pos.t * 1000);
  // Pluie : on dit d'où vient l'image (radar observé, radar prolongé ou modèle AROME)
  const title = layer !== 'rain' ? LAYER_NAMES[layer] : pos.src ? SOURCE_TITLES[pos.src] : pos.t < now - NEAR ? 'Radar' : 'Prévision';
  // Près de « maintenant » : la date complète. Sinon l'heure EN PREMIER (avec une date courte),
  // pour qu'elle ne soit jamais coupée par le sélecteur 3 h / 12 h.
  if (Math.abs(pos.t - now) <= NEAR) return { title, sub: `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}` };
  return { title, sub: `${timeAt(pos.t)} · ${JOURS[d.getDay()].toLowerCase()} ${d.getDate()} ${MOIS_COURT[d.getMonth()]}` };
}

export function RadarTimeline({ dark, layer, meta, pos, bottom, onPlay, onMode, onSeek }: Props) {
  const c = mapColors(dark);
  const [w, setW] = useState(0);
  // Pendant que le doigt glisse, on affiche sa position sans attendre la carte.
  const [drag, setDrag] = useState<number | null>(null);
  const f = drag ?? pos?.f ?? 0;
  const { title, sub } = heading(layer, pos);

  const seekAt = (e: GestureResponderEvent) => {
    if (!w) return;
    const v = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
    setDrag(v);
    onSeek(v);
  };

  // Curseur du sélecteur 3 h / 12 h qui glisse d'un segment à l'autre
  const [segW, setSegW] = useState(0);
  const [thumb] = useState(() => new Animated.Value(0));
  const modeIdx = meta?.mode === '12h' ? 1 : 0;
  useEffect(() => {
    Animated.spring(thumb, { toValue: modeIdx, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  }, [modeIdx, thumb]);

  // Libellés sous la piste : « Maint. » d'abord, puis les heures qui ne le chevauchent pas.
  const labels: { key: string; text: string; x: number; now: boolean }[] = [];
  if (w && meta) {
    const place = (x: number) => Math.max(0, Math.min(w - LABEL_W, x - LABEL_W / 2));
    const nowX = meta.nowF * w;
    const showNow = meta.nowF > 0 && meta.nowF < 1;
    if (showNow) labels.push({ key: 'now', text: 'Maint.', x: place(nowX), now: true });
    for (const t of meta.ticks) {
      const x = place(t.f * w);
      if (labels.some((l) => Math.abs(l.x - x) < LABEL_W * 0.95)) continue;
      const d = new Date(t.t * 1000);
      labels.push({ key: String(t.t), text: meta.mode === '12h' ? hourOf(d) : fmtTime(d), x, now: false });
    }
  }

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={[styles.panel, glassShadow]}>
        <GlassFill dark={dark} radius={32} />
        <View style={styles.top}>
          <Pressable
            onPress={() => {
              tap();
              onPlay();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={pos?.playing ? 'Pause' : 'Lecture'}
            style={({ pressed }) => [styles.play, { backgroundColor: c.fill, opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={pos?.playing ? { ios: 'pause.fill', android: 'pause' } : { ios: 'play.fill', android: 'play_arrow' }} size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.sub, { color: c.sub }]} numberOfLines={1}>
              {sub}
            </Text>
          </View>
          {meta?.showModes ? (
            <View style={[styles.seg, { backgroundColor: c.fill }]} onLayout={(e) => setSegW((e.nativeEvent.layout.width - 8) / 2)}>
              {segW ? (
                <Animated.View
                  style={[
                    styles.segThumb,
                    { width: segW, backgroundColor: dark ? 'rgba(255,255,255,0.3)' : '#FFFFFF' },
                    { transform: [{ translateX: thumb.interpolate({ inputRange: [0, 1], outputRange: [0, segW] }) }] },
                  ]}
                />
              ) : null}
              {MODES.map(({ m, label }) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    if (m === meta.mode) return;
                    tick();
                    onMode(m);
                  }}
                  style={styles.segItem}
                  accessibilityRole="button"
                  accessibilityState={{ selected: m === meta.mode }}
                >
                  <Text style={[styles.segText, { color: c.text }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Piste : partie écoulée pleine, graduations horaires sur la partie restante */}
        {/* Pendant le glissement du doigt : l'heure exacte suit le doigt, au-dessus de la piste */}
        {drag != null && pos && w ? (
          <View pointerEvents="none" style={[styles.bubble, { left: 18 + Math.max(0, Math.min(w - BUBBLE_W, drag * w - BUBBLE_W / 2)), backgroundColor: c.text }]}>
            <Text style={[styles.bubbleText, { color: dark ? '#000' : '#FFF' }]}>{timeAt(pos.t)}</Text>
          </View>
        ) : null}
        <View
          style={styles.hit}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => {
            tick();
            seekAt(e);
          }}
          onResponderMove={seekAt}
          onResponderRelease={() => setDrag(null)}
          onResponderTerminate={() => setDrag(null)}
          accessibilityRole="adjustable"
          accessibilityLabel="Heure affichée"
          accessibilityValue={{ text: sub }}
        >
          <View style={[styles.track, { backgroundColor: c.fill }]}>
            {meta?.grads.map((g, i) => (g > f + 0.012 && g < 0.995 ? <View key={i} style={[styles.grad, { left: `${g * 100}%`, backgroundColor: c.sub }]} /> : null))}
            <View style={[styles.fill, { width: Math.max(TRACK_H, f * w), backgroundColor: c.text }]} />
          </View>
        </View>

        <View style={styles.ticks}>
          {labels.map((l) => (
            <Text key={l.key} style={[styles.tick, { left: l.x, color: l.now ? c.text : c.sub, fontWeight: l.now ? '700' : '600' }]} numberOfLines={1}>
              {l.text}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

// Légende de la pluie, avec les intensités en mm/h : mêmes seuils et mêmes couleurs que la
// palette du moteur de la carte (STOPS / SNOW dans mapEngineHtml.ts). Rien n'est dessiné sous 0,2 mm/h.
const RAIN_CLASSES = [
  { label: 'Très fortes', value: '> 15' },
  { label: 'Fortes', value: '7,6–15' },
  { label: 'Modérées', value: '2,5–7,6' },
  { label: 'Faibles', value: '0,2–2,5' },
];
const RAIN_COLORS: [string, string, ...string[]] = ['#FFF27A', '#C77DFF', '#7A5CF0', '#4E7CF5', '#8CBEFF'];
const SNOW_COLORS: [string, string] = ['#FA82D7', '#F6E4FF'];

/** Légende du calque « Précipitations » (les autres calques gardent GlassLegend). */
export function RainLegend({ dark, style }: { dark: boolean; style?: StyleProp<ViewStyle> }) {
  const c = mapColors(dark);
  return (
    <View style={[styles.legend, glassShadow, style]} pointerEvents="none">
      <GlassFill dark={dark} radius={20} />
      <Text style={[styles.legendTitle, { color: c.text }]}>
        Précipitations <Text style={[styles.legendUnit, { color: c.sub }]}>mm/h</Text>
      </Text>
      <View style={[styles.legendLine, { backgroundColor: c.line }]} />
      <View style={styles.legendRow}>
        <LinearGradient colors={RAIN_COLORS} style={styles.legendBar} />
        <View style={styles.legendLabels}>
          {RAIN_CLASSES.map((k) => (
            <Text key={k.label} style={[styles.legendLabel, { color: c.sub }]}>
              {k.label} <Text style={[styles.legendValue, { color: c.text }]}>{k.value}</Text>
            </Text>
          ))}
          <View style={styles.snowRow}>
            <LinearGradient colors={SNOW_COLORS} style={styles.snowChip} />
            <Text style={[styles.legendLabel, { color: c.sub }]}>Neige (radar)</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { borderRadius: 20, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  legendTitle: { fontSize: 16, fontWeight: '600' },
  legendUnit: { fontSize: 13, fontWeight: '500' },
  legendLine: { height: StyleSheet.hairlineWidth, marginHorizontal: -14, marginTop: 10, marginBottom: 10 },
  legendRow: { flexDirection: 'row', gap: 10 },
  legendBar: { width: 4, borderRadius: 2, marginBottom: 30 },
  legendLabels: { gap: 10, paddingVertical: 2 },
  legendLabel: { fontSize: 14 },
  legendValue: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  snowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: -14, marginTop: 4 },
  snowChip: { width: 4, height: 16, borderRadius: 2 },
  wrap: { position: 'absolute', left: 16, right: 16 },
  panel: { borderRadius: 32, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  sub: { fontSize: 15, marginTop: 1, letterSpacing: -0.2 },
  seg: { flexDirection: 'row', borderRadius: 24, padding: 4, minWidth: 128 },
  segThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 20 },
  segItem: { flex: 1, height: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 17, fontWeight: '500' },
  hit: { height: 34, justifyContent: 'center', marginTop: 6 },
  track: { height: TRACK_H, borderRadius: TRACK_H / 2, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: TRACK_H / 2 },
  grad: { position: 'absolute', top: 2, width: 2, height: TRACK_H - 4, marginLeft: -1, borderRadius: 1, opacity: 0.7 },
  ticks: { height: 20 },
  bubble: { position: 'absolute', top: -34, width: BUBBLE_W, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubbleText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tick: { position: 'absolute', width: LABEL_W, fontSize: 13, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
