// Frise de lecture de la carte (lecture / pause, 3 h – 12 h, piste horaire), en natif
// pour profiter du vrai « Liquid Glass » d'iOS 26 au-dessus de la carte (WebView).
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { tick, tap } from '../lib/hig';
import { Icon } from './ui';

const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();

/** État envoyé par la carte (WebView). */
export type TimelineMeta = {
  mode: '3h' | '12h';
  showModes: boolean;
  ticks: { l: string; f: number; now: boolean }[];
  grads: number[];
};
export type TimelinePos = { f: number; title: string; sub: string; playing: boolean };

type Props = {
  dark: boolean;
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
const LABEL_W = 56;
const TRACK_H = 12;

export function RadarTimeline({ dark, meta, pos, bottom, onPlay, onMode, onSeek }: Props) {
  const text = dark ? '#FFFFFF' : '#13212F';
  const sub = dark ? 'rgba(235,235,245,0.6)' : 'rgba(19,33,47,0.5)';
  const [w, setW] = useState(0);
  // Pendant que le doigt glisse, on affiche sa position sans attendre la carte.
  const [drag, setDrag] = useState<number | null>(null);
  const f = drag ?? pos?.f ?? 0;

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

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.panel}>
        <Background dark={dark} />
        <View style={styles.top}>
          <Pressable
            onPress={() => {
              tap();
              onPlay();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={pos?.playing ? 'Pause' : 'Lecture'}
            style={({ pressed }) => [styles.play, { backgroundColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(19,33,47,0.1)', opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={pos?.playing ? { ios: 'pause.fill', android: 'pause' } : { ios: 'play.fill', android: 'play_arrow' }} size={18} color={text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]} numberOfLines={1}>
              {pos?.title ?? 'Chargement…'}
            </Text>
            <Text style={[styles.sub, { color: sub }]} numberOfLines={1}>
              {pos?.sub ?? ''}
            </Text>
          </View>
          {meta?.showModes ? (
            <View style={[styles.seg, { backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(19,33,47,0.08)' }]} onLayout={(e) => setSegW((e.nativeEvent.layout.width - 6) / 2)}>
              {segW ? (
                <Animated.View
                  style={[
                    styles.segThumb,
                    { width: segW, backgroundColor: dark ? 'rgba(255,255,255,0.28)' : '#FFFFFF' },
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
                  <Text style={[styles.segText, { color: text, fontWeight: m === meta.mode ? '600' : '500' }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Piste : partie écoulée pleine, graduations horaires sur la partie restante */}
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
          accessibilityValue={{ text: pos?.sub }}
        >
          <View style={[styles.track, { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(19,33,47,0.1)' }]}>
            {meta?.grads.map((g, i) => (g > f + 0.01 && g < 0.995 ? <View key={i} style={[styles.grad, { left: `${g * 100}%`, backgroundColor: sub }]} /> : null))}
            <View style={[styles.fill, { width: Math.max(TRACK_H, f * w), backgroundColor: text }]} />
          </View>
        </View>

        <View style={styles.ticks}>
          {w
            ? meta?.ticks.map((t, i) => {
                const left = Math.max(0, Math.min(w - LABEL_W, t.f * w - LABEL_W / 2));
                const align = t.f * w < LABEL_W / 2 ? 'left' : t.f * w > w - LABEL_W / 2 ? 'right' : 'center';
                return (
                  <Text key={i} style={[styles.tick, { left, textAlign: align, color: t.now ? text : sub, fontWeight: t.now ? '700' : '600' }]} numberOfLines={1}>
                    {t.l}
                  </Text>
                );
              })
            : null}
        </View>
      </View>
    </View>
  );
}

function Background({ dark }: { dark: boolean }) {
  if (LIQUID) return <GlassView style={[StyleSheet.absoluteFill, styles.round]} glassEffectStyle="regular" colorScheme={dark ? 'dark' : 'light'} />;
  if (Platform.OS === 'ios') return <BlurView intensity={70} tint={dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} style={[StyleSheet.absoluteFill, styles.round]} />;
  return <View style={[StyleSheet.absoluteFill, styles.round, { backgroundColor: dark ? 'rgba(20,28,40,0.92)' : 'rgba(255,255,255,0.94)' }]} />;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  round: { borderRadius: 30 },
  panel: {
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    overflow: LIQUID ? 'visible' : 'hidden',
    shadowColor: '#000',
    shadowOpacity: LIQUID ? 0 : 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  sub: { fontSize: 14, marginTop: 1 },
  seg: { flexDirection: 'row', borderRadius: 22, padding: 3, minWidth: 120 },
  segThumb: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 19 },
  segItem: { flex: 1, height: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15 },
  hit: { height: 32, justifyContent: 'center', marginTop: 8 },
  track: { height: TRACK_H, borderRadius: TRACK_H / 2, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: TRACK_H / 2 },
  grad: { position: 'absolute', top: 2, width: 2, height: TRACK_H - 4, marginLeft: -1, borderRadius: 1, opacity: 0.8 },
  ticks: { height: 18, marginTop: 2 },
  tick: { position: 'absolute', width: LABEL_W, fontSize: 12, fontVariant: ['tabular-nums'] },
});
