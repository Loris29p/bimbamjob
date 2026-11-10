// Carte « Pluie » : la réponse (parapluie ou pas), la courbe d'intensité sur 3 h au quart d'heure
// (AROME, Météo-France) et un rappel « préviens-moi » quand la pluie s'arrête ou arrive.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { upcomingMinutely, type HourPoint, type Minutely } from '../lib/forecast';
import { time } from '../lib/format';
import { tap } from '../lib/hig';
import { cancelReminder, pendingReminder, scheduleReminder } from '../lib/notifications';
import { umbrellaVerdict } from '../lib/umbrella';
import { DIM, Glass, Icon, LINE, RAIN_BLUE, T } from './ui';

const CHART_H = 96;
const BANDS = ['Faible', 'Modérée', 'Forte'];
const DOT = { yes: RAIN_BLUE, maybe: '#FFD60A', no: '#30D158' } as const;

/** mm/h → hauteur 0..1, une bande par niveau (faible < 2,5 · modérée < 7,6 · forte au-delà). */
function level(mmh: number) {
  if (mmh < 0.2) return 0;
  if (mmh < 2.5) return (mmh / 2.5) / 3;
  if (mmh < 7.6) return 1 / 3 + ((mmh - 2.5) / 5.1) / 3;
  return 2 / 3 + Math.min(1, (mmh - 7.6) / 12) / 3;
}

/** Courbe lissée (sans dépassement) passant par les milieux des points. */
function smoothPath(pts: { x: number; y: number }[]) {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${pts[i].x},${pts[i].y} ${mx},${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last.x},${last.y}`;
}

export function RainCard({ minutely, hourly, placeName, placeId }: { minutely: Minutely; hourly: HourPoint[]; placeName: string; placeId: string }) {
  const slots = upcomingMinutely(minutely).slice(0, 13);
  const verdict = umbrellaVerdict(minutely, hourly, placeName);
  const [width, setWidth] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const reminderKey = `rain:${placeId}`;

  useEffect(() => {
    pendingReminder(reminderKey).then(setPending);
  }, [reminderKey, verdict?.reminder?.at]);

  if (!verdict) return null;

  const onReminder = async () => {
    tap();
    if (pending !== null) {
      await cancelReminder(reminderKey);
      setPending(null);
    } else if (verdict.reminder) {
      const r = verdict.reminder;
      if (await scheduleReminder(reminderKey, `🌂 ${placeName}`, r.body, r.at)) setPending(r.at);
    }
  };

  const pts = slots.map((s, i) => ({
    x: slots.length > 1 ? (i / (slots.length - 1)) * width : 0,
    y: CHART_H - level(s.precipitation * 4) * CHART_H,
  }));
  const dry = slots.every((s) => s.precipitation * 4 < 0.2);
  const line = width > 0 && pts.length > 1 ? smoothPath(pts) : null;

  return (
    <Glass title="Pluie" icon={{ ios: 'umbrella.fill', android: 'umbrella' }}>
      <View style={styles.verdictRow}>
        <View style={[styles.dot, { backgroundColor: DOT[verdict.need] }]} />
        <T style={styles.title}>{verdict.title}</T>
      </View>
      <T style={styles.detail}>{verdict.detail}</T>

      {slots.length > 1 ? (
        <>
          <View style={styles.chartRow}>
            <View style={styles.bandLabels}>
              {[...BANDS].reverse().map((b) => (
                <T key={b} style={styles.bandLabel}>
                  {b}
                </T>
              ))}
            </View>
            <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
              {[1, 2].map((k) => (
                <View key={k} style={[styles.grid, { top: (k * CHART_H) / 3 }]} />
              ))}
              {line ? (
                <Svg width={width} height={CHART_H} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={RAIN_BLUE} stopOpacity={0.7} />
                      <Stop offset="1" stopColor={RAIN_BLUE} stopOpacity={0.12} />
                    </LinearGradient>
                  </Defs>
                  {!dry ? <Path d={`${line} L${width},${CHART_H} L0,${CHART_H} Z`} fill="url(#rainFill)" /> : null}
                  <Path d={line} stroke={RAIN_BLUE} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                </Svg>
              ) : null}
            </View>
          </View>
          {/* une étiquette par heure */}
          <View style={styles.axis}>
            {slots.map((s, i) =>
              i % 4 === 0 ? (
                <T key={s.time} numberOfLines={1} style={[styles.label, { left: `${(i / (slots.length - 1)) * 100}%`, transform: [{ translateX: i === 0 ? 0 : i === slots.length - 1 ? -44 : -22 }] }]}>
                  {i === 0 ? 'Maint.' : time(s.time)}
                </T>
              ) : null,
            )}
          </View>
        </>
      ) : null}

      {verdict.reminder || pending !== null ? (
        <Pressable onPress={onReminder} style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}>
          <Icon name={pending !== null ? { ios: 'bell.slash', android: 'notifications_off' } : { ios: 'bell', android: 'notifications' }} size={15} />
          <T style={styles.buttonText}>{pending !== null ? `Rappel prévu${pending > 0 ? ` à ${time(pending)}` : ''} · Annuler` : verdict.reminder!.label}</T>
        </Pressable>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 20, fontWeight: '600' },
  detail: { fontSize: 15, color: DIM, marginTop: 4, marginBottom: 14 },
  chartRow: { flexDirection: 'row', gap: 8 },
  bandLabels: { width: 50, height: CHART_H, justifyContent: 'space-around' },
  bandLabel: { fontSize: 11, color: DIM },
  chart: { flex: 1, height: CHART_H, borderBottomWidth: 1, borderBottomColor: LINE },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: LINE },
  axis: { height: 18, marginTop: 4, marginLeft: 58 },
  label: { position: 'absolute', width: 44, fontSize: 12, color: DIM },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
