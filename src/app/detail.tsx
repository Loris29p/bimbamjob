// Détail d'un indicateur : choix du jour, graphique sur 24 h, synthèse.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chart, interp } from '../components/Chart';
import { DIM, Icon, T } from '../components/ui';
import { hoursOfDay, startOfDay, type DayPoint } from '../lib/forecast';
import { hour, temp } from '../lib/format';
import { METRICS, type MetricId } from '../lib/metrics';
import { usePlaces } from '../lib/PlaceContext';
import { symbolFor } from '../lib/sky';
import { useForecast } from '../lib/useForecast';
import { uvLabel } from '../lib/weatherCodes';

const LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function niceRange(vals: number[], pad: number, step: number): [number, number] {
  const lo = Math.floor((Math.min(...vals) - pad) / step) * step;
  const hi = Math.ceil((Math.max(...vals) + pad) / step) * step;
  return [lo, hi === lo ? lo + step : hi];
}

export default function Detail() {
  const { metric = 'temp' } = useLocalSearchParams<{ metric?: MetricId }>();
  const m = METRICS[metric] ?? METRICS.temp;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { places, activeIndex } = usePlaces();
  const { forecast } = useForecast(places[activeIndex] ?? null);
  const [dayIdx, setDayIdx] = useState(0);
  const [second, setSecond] = useState(false);

  const days = useMemo(() => (forecast?.daily ?? []).filter((d) => hoursOfDay(forecast!.hourly, startOfDay(d.time)).length >= 20).slice(0, 10), [forecast]);
  const day: DayPoint | undefined = days[dayIdx];
  const dayStart = day ? startOfDay(day.time) : 0;
  const hours = forecast && day ? hoursOfDay(forecast.hourly, dayStart) : [];
  const nowSec = Date.now() / 1000;
  const isToday = dayIdx === 0;

  const getter = second && m.get2 && metric !== 'rain' && metric !== 'humidity' ? m.get2 : m.get;
  const main = hours.map((h) => ({ t: h.time, v: getter(h) })).filter((p): p is { t: number; v: number } => p.v !== null);
  const alt = metric === 'wind' && m.get2 ? hours.map((h) => ({ t: h.time, v: m.get2!(h) ?? 0 })) : [];

  if (!forecast || !day || main.length < 2) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
        <Header title={m.title} icon={m.icon} />
        <T style={{ color: DIM, marginTop: 20 }}>Données indisponibles pour cet indicateur.</T>
      </View>
    );
  }

  const values = [...main.map((p) => p.v), ...alt.map((p) => p.v)];
  const [yMin, yMax] = m.fixedRange ?? (metric === 'temp' ? niceRange(values, 2, 3) : metric === 'pressure' ? niceRange(values, 2, 5) : niceRange([0, ...values], 0, 10));
  // Graduations « rondes » (1, 2, 3, 5, 10, 20…) pour 4 à 6 lignes
  const raw = (yMax - yMin) / 5;
  const step = [1, 2, 3, 5, 10, 20, 25, 50].find((s) => s >= raw) ?? Math.ceil(raw / 50) * 50;
  const lo = Math.floor(yMin / step) * step;
  const ticks: number[] = [];
  for (let v = lo; ; v += step) {
    ticks.push(Math.round(v * 10) / 10);
    if (v >= yMax - 1e-6 || ticks.length > 12) break;
  }

  const hiP = main.reduce((a, b) => (b.v > a.v ? b : a));
  const loP = main.reduce((a, b) => (b.v < a.v ? b : a));
  const nowVal = isToday ? interp(main, nowSec) : NaN;
  const fmt = (v: number) => (metric === 'temp' ? temp(v) : metric === 'visibility' ? `${v.toFixed(v < 10 ? 1 : 0)} km` : `${Math.round(v)}${m.unit}`);

  let headline = Number.isFinite(nowVal) ? fmt(nowVal) : `${fmt(hiP.v)}`;
  let sub = `Max. ${fmt(hiP.v)} vers ${hour(hiP.t)} · min. ${fmt(loP.v)} vers ${hour(loP.t)}`;
  if (metric === 'uv') {
    const v = Number.isFinite(nowVal) ? nowVal : hiP.v;
    headline = `${Math.round(v)} ${uvLabel(v)}`;
  }
  if (metric === 'rain') {
    const mm = hours.reduce((s, h) => s + h.precipitation, 0);
    headline = `${mm < 0.1 ? 0 : mm.toFixed(1)} mm`;
    sub = `Risque maximal : ${Math.round(hiP.v)} %${hiP.v >= 20 ? ` vers ${hour(hiP.t)}` : ''}`;
  }

  // Comparaison avec la veille (aujourd'hui seulement)
  let compare: string | null = null;
  const y = forecast.yesterday;
  if (isToday && y) {
    if (metric === 'temp') {
      const d = Math.round(day.tMax - y.tMax);
      compare = d === 0 ? 'Maximale identique à celle d’hier.' : `Maximale ${Math.abs(d)}° plus ${d > 0 ? 'élevée' : 'basse'} qu’hier (${temp(y.tMax)}).`;
    } else if (metric === 'uv' && y.uvMax !== null && day.uvMax !== null) {
      const d = Math.round(day.uvMax) - Math.round(y.uvMax);
      compare = d === 0 ? 'UV maximal identique à hier.' : `UV maximal ${d > 0 ? 'plus fort' : 'plus faible'} qu’hier (${Math.round(y.uvMax)}).`;
    } else if (metric === 'rain') {
      compare = `Hier : ${y.precipitationSum < 0.1 ? 'pas de pluie' : `${y.precipitationSum.toFixed(1)} mm`}.`;
    } else if (metric === 'wind') {
      compare = `Rafales max. hier : ${Math.round(y.windGustsMax)} km/h, aujourd’hui : ${Math.round(day.windGustsMax)} km/h.`;
    }
  }

  const d = new Date(day.time * 1000);
  const chartW = width - 32;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 30 }}>
      <Header title={m.title} icon={m.icon} />

      <View style={styles.days}>
        {days.map((dd, i) => {
          const date = new Date(dd.time * 1000);
          const sel = i === dayIdx;
          return (
            <Pressable key={dd.time} onPress={() => setDayIdx(i)} style={styles.dayCol} hitSlop={4}>
              <T style={styles.dayLetter}>{LETTERS[date.getDay()]}</T>
              <View style={[styles.dayNum, sel && styles.daySel]}>
                <T style={[styles.dayNumText, sel && { color: '#0B1520', fontWeight: '700' }]}>{date.getDate()}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <T style={styles.date}>{`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`}</T>

      <View style={styles.sep} />
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <T style={styles.big}>{headline}</T>
          <T style={styles.sub}>{sub}</T>
        </View>
        <Icon name={symbolFor(day.weatherCode)} size={40} multicolor />
      </View>

      <Chart
        width={chartW}
        dayStart={dayStart}
        series={metric === 'rain' ? [] : [{ values: main, color: m.color }, ...(alt.length ? [{ values: alt, color: 'rgba(255,255,255,0.7)', dashed: true, fill: false }] : [])]}
        bars={metric === 'rain' ? main : undefined}
        barColor={m.color}
        yMin={ticks[0]}
        yMax={ticks[ticks.length - 1]}
        yTicks={ticks}
        formatY={(v) => (metric === 'temp' ? `${Math.round(v)}°` : metric === 'pressure' ? `${Math.round(v)}` : `${Math.round(v)}`)}
        now={isToday ? nowSec : undefined}
        bands={metric === 'uv' ? [{ from: 0.2, to: 3, label: 'Faible' }, { from: 3, to: 6, label: 'Modéré' }, { from: 6, to: 8, label: 'Élevé' }, { from: 8, to: 11, label: 'Très élevé' }] : undefined}
      />

      {metric === 'wind' ? <T style={styles.legend}>Trait plein : vent moyen · pointillés : rafales</T> : null}

      {metric === 'temp' ? (
        <View style={styles.segment}>
          {['Réelle', 'Ressentie'].map((label, i) => (
            <Pressable key={label} onPress={() => setSecond(i === 1)} style={[styles.segItem, second === (i === 1) && styles.segOn]}>
              <T style={{ fontWeight: '600' }}>{label}</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      {metric === 'rain' ? (
        <View style={styles.box}>
          <T style={styles.boxTitle}>Quantité heure par heure</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {hours
              .filter((h) => h.precipitation >= 0.1)
              .map((h) => (
                <T key={h.time} style={styles.chip}>
                  {hour(h.time)} : {h.precipitation.toFixed(1)} mm
                </T>
              ))}
            {hours.every((h) => h.precipitation < 0.1) ? <T style={{ color: DIM }}>Pas de pluie prévue ce jour-là.</T> : null}
          </View>
        </View>
      ) : null}

      {compare ? (
        <View style={styles.box}>
          <T style={styles.boxTitle}>Par rapport à hier</T>
          <T style={{ fontSize: 16 }}>{compare}</T>
        </View>
      ) : null}

      <View style={styles.box}>
        <T style={styles.boxTitle}>À propos</T>
        <T style={{ color: DIM, lineHeight: 20 }}>{m.about}</T>
        {!day.meteoFrance ? <T style={{ color: DIM, marginTop: 6 }}>Pour ce jour, il s’agit d’une tendance (modèle ECMWF), moins précise.</T> : null}
      </View>
    </ScrollView>
  );
}

function Header({ title, icon }: { title: string; icon: (typeof METRICS)['temp']['icon'] }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.close} hitSlop={10}>
        <Icon name={{ ios: 'xmark', android: 'close' }} size={16} />
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={20} />
        <T style={styles.title}>{title}</T>
      </View>
      <View style={{ width: 36 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#141A24', paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLetter: { fontSize: 12, color: DIM, fontWeight: '600' },
  dayNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: '#7CC0FF' },
  dayNumText: { fontSize: 17 },
  date: { textAlign: 'center', fontSize: 15, marginTop: 8, color: DIM },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  big: { fontSize: 34, fontWeight: '600' },
  sub: { color: DIM, fontSize: 14, marginTop: 2 },
  legend: { color: DIM, fontSize: 12, marginTop: 6 },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, marginTop: 14 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  box: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, marginTop: 14 },
  boxTitle: { fontSize: 13, fontWeight: '700', color: DIM, marginBottom: 8, textTransform: 'uppercase' },
  chip: { backgroundColor: 'rgba(90,200,250,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13 },
});
