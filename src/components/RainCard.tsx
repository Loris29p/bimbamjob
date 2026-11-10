// Carte « Pluie » : la réponse (parapluie ou pas), d'où elle vient, la courbe d'intensité sur 3 h
// au quart d'heure (AROME, Météo-France) qu'on peut parcourir au doigt, et un rappel « préviens-moi ».
import { useContext, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { upcomingMinutely, type Minutely } from '../lib/forecast';
import { time } from '../lib/format';
import { tap, tick } from '../lib/hig';
import { cancelReminder, getAlertPrefs, onAlertPrefs, pendingReminder, scheduleReminder, type AlertPrefs } from '../lib/notifications';
import type { FusionInfo } from '../lib/rainFusion';
import { windFrom } from '../lib/weatherCodes';
import { HEAVY_MMH, INTENSITY_LABELS, MODERATE_MMH, RAIN_MMH, intensity } from '../lib/rain';
import type { UmbrellaVerdict } from '../lib/umbrella';
import { DIM, Glass, Icon, LINE, RAIN_BLUE, ScrollLockContext, T } from './ui';

const CHART_H = 96;
const SLOTS = 12; // 3 h
const BANDS = ['Faible', 'Modérée', 'Forte'];
const TONE = { rain: RAIN_BLUE, snow: '#E5E5EA', storm: '#FF9F0A', maybe: '#FFD60A', dry: '#30D158' } as const;

/** mm/h → hauteur 0..1, une bande par niveau (faible · modérée · forte). */
function level(mmh: number) {
  if (mmh < RAIN_MMH) return 0;
  if (mmh < MODERATE_MMH) return ((mmh - RAIN_MMH) / (MODERATE_MMH - RAIN_MMH)) / 3 + 0.02;
  if (mmh < HEAVY_MMH) return 1 / 3 + ((mmh - MODERATE_MMH) / (HEAVY_MMH - MODERATE_MMH)) / 3;
  return 2 / 3 + Math.min(1, (mmh - HEAVY_MMH) / 12) / 3;
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

const mm = (v: number) => (v < 0.1 ? '0 mm' : `${v.toFixed(1).replace('.', ',')} mm`);
const mmh = (v: number) => `${v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)} mm/h`;

const SCOPE_LABEL = { gps: 'ma position', all: 'toutes mes villes', off: 'désactivées' } as const;
const LEVEL_LABEL = { light: 'dès la bruine', rain: 'vraie pluie seulement' } as const;

function useAlertPrefs() {
  const [p, setP] = useState<AlertPrefs | null>(null);
  useEffect(() => {
    getAlertPrefs().then(setP);
    return onAlertPrefs(setP);
  }, []);
  return p;
}

export function RainCard({ verdict, minutely, placeName, placeId, info }: { verdict: UmbrellaVerdict; minutely: Minutely; placeName: string; placeId: string; info?: FusionInfo }) {
  const alerts = useAlertPrefs();
  const lockScroll = useContext(ScrollLockContext);
  const [width, setWidth] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const reminderKey = `rain:${placeId}`;

  // Débit par tranche ; la tranche en cours suit la réponse (mesure de station comprise).
  const slots = useMemo(() => {
    const list = upcomingMinutely(minutely)
      .slice(0, SLOTS)
      .map((s) => ({ time: s.time, mmh: s.precipitation * 4 }));
    if (list[0] && verdict.now.source === 'station') list[0] = { ...list[0], mmh: verdict.now.mmh };
    return list;
  }, [minutely, verdict.now]);

  useEffect(() => {
    pendingReminder(reminderKey).then(setPending);
  }, [reminderKey]);

  // La prévision a changé : on déplace le rappel en attente (ou on l'annule s'il n'a plus lieu d'être).
  const at = verdict.reminder?.at;
  useEffect(() => {
    if (pending === null || pending === 0) return;
    if (at === undefined) {
      cancelReminder(reminderKey).then(() => setPending(null));
    } else if (Math.abs(at - pending) > 120) {
      scheduleReminder(reminderKey, `☂️ ${placeName}`, verdict.reminder!.body, at).then((ok) => setPending(ok ? at : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const n = slots.length;
  const pan = useMemo(() => {
    const cur = { last: -1 };
    const toIndex = (x: number) => Math.max(0, Math.min(n - 1, Math.floor((x / Math.max(1, width)) * n)));
    return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // une fois le doigt posé sur la courbe, on ne le rend pas au défilement
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const i = toIndex(e.nativeEvent.locationX);
          cur.last = i;
          tick();
          lockScroll(true);
          setScrub(i);
        },
        onPanResponderMove: (e) => {
          const i = toIndex(e.nativeEvent.locationX);
          if (i !== cur.last) tick();
          cur.last = i;
          setScrub(i);
        },
        onPanResponderRelease: () => {
          lockScroll(false);
          setScrub(null);
        },
        onPanResponderTerminate: () => {
          lockScroll(false);
          setScrub(null);
        },
      });
  }, [n, width, lockScroll]);

  const onReminder = async () => {
    tap();
    if (pending !== null) {
      await cancelReminder(reminderKey);
      setPending(null);
    } else if (verdict.reminder) {
      const r = verdict.reminder;
      if (await scheduleReminder(reminderKey, `☂️ ${placeName}`, r.body, r.at)) setPending(r.at);
    }
  };

  const xAt = (i: number) => ((i + 0.5) / Math.max(1, n)) * width;
  const yAt = (v: number) => CHART_H - level(v) * CHART_H;
  const pts = n > 1 ? [{ x: 0, y: yAt(slots[0].mmh) }, ...slots.map((s, i) => ({ x: xAt(i), y: yAt(s.mmh) })), { x: width, y: yAt(slots[n - 1].mmh) }] : [];
  const dry = slots.every((s) => s.mmh < RAIN_MMH);
  const line = width > 0 && pts.length > 1 ? smoothPath(pts) : null;
  const color = TONE[verdict.tone];

  const st = verdict.now.station;
  const source =
    verdict.now.source === 'station' && st
      ? `${verdict.now.wet ? 'Pluie mesurée' : 'Mesure'} à ${st.name} (${st.distanceKm < 1 ? '< 1' : Math.round(st.distanceKm)} km) · il y a ${st.ageMin} min`
      : verdict.now.source === 'radar' && info?.ageMin != null
        ? `Radar · image d'il y a ${info.ageMin} min${info.motion ? ` · la pluie arrive ${windFrom(info.motion.fromDeg)} à ${Math.round(info.motion.kmh)} km/h` : ''}`
        : null;

  // Lecture au doigt : heure, intensité, cumul d'ici là
  const sel = scrub !== null ? slots[scrub] : null;
  const cumul = scrub !== null ? slots.slice(0, scrub + 1).reduce((a, s) => a + s.mmh / 4, 0) : 0;

  return (
    <Glass title="Pluie" icon={{ ios: 'umbrella.fill', android: 'umbrella' }}>
      <View style={styles.verdictRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <T style={styles.title}>{verdict.title}</T>
      </View>
      <T style={styles.detail}>{verdict.detail}</T>
      {source ? <T style={styles.source}>{source}</T> : null}
      {verdict.confidence && verdict.need !== 'no' ? (
        <View style={styles.confRow}>
          <Icon name={verdict.confidence.high ? { ios: 'checkmark.seal.fill', android: 'verified' } : { ios: 'exclamationmark.triangle.fill', android: 'warning' }} size={12} color={verdict.confidence.high ? '#30D158' : '#FFD60A'} />
          <T style={styles.source}>{verdict.confidence.text}</T>
        </View>
      ) : null}

      {verdict.dryWindow ? (
        <View style={styles.chip}>
          <Icon name={{ ios: 'sun.max.fill', android: 'wb_sunny' }} size={13} color="#FFD60A" />
          <T style={styles.chipText}>
            {verdict.dryWindow.to ? `Créneau sec : ${time(verdict.dryWindow.from)} → ${time(verdict.dryWindow.to)}` : `Au sec à partir de ${time(verdict.dryWindow.from)}`}
          </T>
        </View>
      ) : null}

      {n > 1 ? (
        <>
          <View style={styles.readout}>
            {sel ? (
              <T style={styles.readoutText}>
                {`${time(sel.time)} · ${sel.mmh < RAIN_MMH ? 'sec' : `${INTENSITY_LABELS[intensity(sel.mmh)]}, ${mmh(sel.mmh)}`} · ${mm(cumul)} d'ici là`}
              </T>
            ) : (
              <T style={[styles.readoutText, { color: DIM }]}>{verdict.nextHourMm >= 0.1 ? `Prochaine heure : ${mm(verdict.nextHourMm)} · glisse le doigt sur la courbe` : dry ? 'Pas de pluie dans les 3 prochaines heures' : 'Glisse le doigt sur la courbe'}</T>
            )}
          </View>
          <View style={styles.chartRow}>
            <View style={styles.bandLabels}>
              {[...BANDS].reverse().map((b) => (
                <T key={b} style={styles.bandLabel}>
                  {b}
                </T>
              ))}
            </View>
            <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
              {[1, 2].map((k) => (
                <View key={k} style={[styles.grid, { top: (k * CHART_H) / 3 }]} />
              ))}
              {line ? (
                <Svg width={width} height={CHART_H} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Defs>
                    <LinearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={RAIN_BLUE} stopOpacity={0.7} />
                      <Stop offset="1" stopColor={RAIN_BLUE} stopOpacity={0.12} />
                    </LinearGradient>
                  </Defs>
                  {!dry ? <Path d={`${line} L${width},${CHART_H} L0,${CHART_H} Z`} fill="url(#rainFill)" /> : null}
                  <Path d={line} stroke={RAIN_BLUE} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                  {scrub !== null ? (
                    <>
                      <Line x1={xAt(scrub)} x2={xAt(scrub)} y1={0} y2={CHART_H} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
                      <Circle cx={xAt(scrub)} cy={yAt(slots[scrub].mmh)} r={5} fill="#fff" stroke={RAIN_BLUE} strokeWidth={2} />
                    </>
                  ) : null}
                </Svg>
              ) : null}
            </View>
          </View>
          {/* une étiquette par heure */}
          <View style={styles.axis}>
            {slots.map((s, i) =>
              i % 4 === 0 ? (
                <T key={s.time} numberOfLines={1} style={[styles.label, { left: `${(i / n) * 100}%` }]}>
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
      {alerts ? (
        <Pressable onPress={() => router.push('/alertes')} style={styles.alertsRow} accessibilityRole="button">
          <Icon name={{ ios: alerts.scope === 'off' ? 'bell.slash' : 'bell.badge', android: 'notifications' }} size={13} color={DIM} />
          <T style={styles.alertsText}>
            {alerts.scope === 'off' ? 'Alertes pluie désactivées' : `Alertes pluie : ${SCOPE_LABEL[alerts.scope]}, ${LEVEL_LABEL[alerts.level]}`}
          </T>
          <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={11} color={DIM} />
        </Pressable>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 20, fontWeight: '600', flexShrink: 1 },
  detail: { fontSize: 15, color: DIM, marginTop: 4 },
  source: { fontSize: 12, color: DIM, marginTop: 4 },
  chip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  chipText: { fontSize: 13, fontWeight: '600' },
  readout: { height: 20, marginTop: 12, marginBottom: 4, justifyContent: 'center' },
  readoutText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chartRow: { flexDirection: 'row', gap: 8 },
  bandLabels: { width: 50, height: CHART_H, justifyContent: 'space-around' },
  bandLabel: { fontSize: 11, color: DIM },
  chart: { flex: 1, height: CHART_H, borderBottomWidth: 1, borderBottomColor: LINE },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: LINE },
  axis: { height: 18, marginTop: 4, marginLeft: 58 },
  label: { position: 'absolute', width: 48, fontSize: 12, color: DIM },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  alertsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  alertsText: { flex: 1, fontSize: 13, color: DIM },
});
