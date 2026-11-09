// Détail d'un indicateur : choix du jour, graphique sur 24 h, synthèse.
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chart, interp } from '../components/Chart';
import { DIM, Icon, T } from '../components/ui';
import { hoursOfDay, startOfDay, type DayPoint, type HourPoint } from '../lib/forecast';
import { hour, temp } from '../lib/format';
import { tick } from '../lib/hig';
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
  const params = useLocalSearchParams<{ metric?: MetricId }>();
  const [metric, setMetric] = useState<MetricId>(params.metric && METRICS[params.metric] ? params.metric : 'temp');
  const [menu, setMenu] = useState(false);
  const m = METRICS[metric];
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
        <Header title={m.title} icon={m.icon} onTitle={() => setMenu((v) => !v)} />
        {menu ? <FloatingMenu top={insets.top + 64} current={metric} onClose={() => setMenu(false)} onPick={(id) => { setMetric(id); setMenu(false); }} /> : null}
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
  let compare: string | null = null; // eslint-disable-line prefer-const
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

  // Intensité de pluie heure par heure (mm/h)
  const intensity = hours.map((h) => ({ t: h.time, v: h.precipitation }));
  const rainMax = Math.max(3, Math.ceil(Math.max(0, ...intensity.map((p) => p.v)) * 1.2));
  const rainTicks = rainMax <= 4 ? [0, 1, 2, 3, 4].filter((v) => v <= rainMax) : rainMax <= 10 ? [0, 2, 4, 6, 8, 10].filter((v) => v <= rainMax) : [0, 5, 10, 15, 20, 25, 30].filter((v) => v <= rainMax);

  // Même journée, la veille (pour les moyennes à comparer)
  const yHours = hoursOfDay(forecast.hourly, dayStart - 86400);
  const avg = (list: typeof hours, f: (h: (typeof hours)[number]) => number | null) => {
    const v = list.map(f).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  // Cumuls de pluie autour de maintenant
  const sumRain = (from: number, to: number) => forecast.hourly.filter((h) => h.time >= from && h.time < to).reduce((acc, h) => acc + h.precipitation, 0);
  const rainPast24 = sumRain(nowSec - 86400, nowSec);
  const rainNext24 = sumRain(nowSec, nowSec + 86400);
  const mmText = (mm: number) => (mm < 0.1 ? '0 mm' : mm < 1 ? '< 1 mm' : `${Math.round(mm)} mm`);

  // Barres de comparaison aujourd'hui / hier
  let comparison: { label: string; value: string; ratio: number; today: boolean }[] | null = null;
  if (isToday && y) {
    const pair = (a: number | null, b: number | null, f: (v: number) => string) => {
      if (a === null || b === null) return null;
      const max = Math.max(a, b, 1e-6);
      return [
        { label: 'Aujourd’hui', value: f(a), ratio: a / max, today: true },
        { label: 'Hier', value: f(b), ratio: b / max, today: false },
      ];
    };
    if (metric === 'temp') comparison = pair(day.tMax, y.tMax, (v) => `max. ${temp(v)}`);
    else if (metric === 'uv') comparison = pair(day.uvMax, y.uvMax, (v) => `${Math.round(v)}`);
    else if (metric === 'wind') comparison = pair(day.windGustsMax, y.windGustsMax, (v) => `${Math.round(v)} km/h`);
    else if (metric === 'rain') comparison = pair(day.precipitationSum, y.precipitationSum, (v) => mmText(v));
    else if (metric === 'humidity') comparison = pair(avg(hours, (h) => h.humidity), avg(yHours, (h) => h.humidity), (v) => `moy. ${Math.round(v)} %`);
    else if (metric === 'visibility') comparison = pair(avg(hours, (h) => (h.visibility === null ? null : h.visibility / 1000)), avg(yHours, (h) => (h.visibility === null ? null : h.visibility / 1000)), (v) => `moy. ${Math.round(v)} km`);
    else if (metric === 'pressure') comparison = pair(avg(hours, (h) => h.pressure), avg(yHours, (h) => h.pressure), (v) => `${Math.round(v)} hPa`);
  }
  if (!compare && comparison) {
    const [a, b] = comparison;
    const diff = a.ratio - b.ratio;
    compare = Math.abs(diff) < 0.03 ? 'Assez semblable à hier.' : diff > 0 ? 'En hausse par rapport à hier.' : 'En baisse par rapport à hier.';
  }

  // Phrase de synthèse de la journée
  let summary = '';
  const span = `entre ${fmt(loP.v)} et ${fmt(hiP.v)}`;
  if (metric === 'temp') {
    const feels = hours.map((h) => h.apparent);
    summary = `${isToday && Number.isFinite(nowVal) ? `Il fait ${fmt(nowVal)} en ce moment. ` : ''}Températures ${span} sur la journée, ressenti entre ${temp(Math.min(...feels))} et ${temp(Math.max(...feels))}. Le plus chaud vers ${hour(hiP.t)}.`;
  } else if (metric === 'wind') {
    const gusts = Math.max(...hours.map((h) => h.windGusts));
    summary = `${isToday && Number.isFinite(nowVal) ? `Vent de ${fmt(nowVal)} en ce moment. ` : ''}Vent moyen ${span}, rafales jusqu’à ${Math.round(gusts)} km/h${gusts >= 60 ? ' : prudence' : ''}.`;
  } else if (metric === 'rain') {
    const wet = hours.filter((h) => h.precipitation >= 0.1);
    summary = wet.length ? `Pluie attendue de ${hour(wet[0].time)} à ${hour(wet[wet.length - 1].time + 3600)} environ, ${mmText(wet.reduce((a, h) => a + h.precipitation, 0))} au total.` : 'Pas de pluie significative prévue ce jour-là.';
  } else if (metric === 'uv') {
    summary = hiP.v < 3 ? 'Indice faible toute la journée, pas de protection particulière.' : `Indice maximal de ${Math.round(hiP.v)} vers ${hour(hiP.t)} : protection conseillée en milieu de journée.`;
  } else if (metric === 'humidity') {
    const dew = hours.map((h) => h.dewPoint);
    const dmax = Math.max(...dew);
    summary = `Humidité ${span}. Point de rosée entre ${temp(Math.min(...dew))} et ${temp(dmax)}${dmax >= 16 ? ' : air lourd' : dmax <= 5 ? ' : air plutôt sec' : ''}.`;
  } else if (metric === 'pressure') {
    const first = main[0].v;
    const last = main[main.length - 1].v;
    summary = `Pression ${span}, ${Math.abs(last - first) < 2 ? 'assez stable' : last > first ? 'en hausse' : 'en baisse'} sur la journée.`;
  } else if (metric === 'visibility') {
    summary = loP.v < 1 ? `Brouillard possible vers ${hour(loP.t)} (visibilité sous 1 km).` : `Visibilité ${span}. Au plus bas, elle sera ${visWord(loP.v)} vers ${hour(loP.t)}.`;
  }

  const d = new Date(day.time * 1000);
  const chartW = width - 32;

  return (
    <View style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 30 }}>
      <Header title={m.title} icon={m.icon} onTitle={() => setMenu((v) => !v)} />

      <View style={styles.days}>
        {days.map((dd, i) => {
          const date = new Date(dd.time * 1000);
          const sel = i === dayIdx;
          return (
            <Pressable key={dd.time} onPress={() => { if (i !== dayIdx) tick(); setDayIdx(i); }} style={styles.dayCol} hitSlop={4}>
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

      <TopRow hours={hours} metric={metric} width={chartW} dayStart={dayStart} />
      {metric === 'rain' ? (
        <>
          <Chart
            width={chartW}
            dayStart={dayStart}
            series={[]}
            bars={intensity}
            barColor="#5AC8FA"
            yMin={0}
            yMax={rainMax}
            yTicks={rainTicks}
            formatY={(v) => (v === 0 ? '0' : `${v}`)}
            now={isToday ? nowSec : undefined}
            formatValue={(v) => `${v.toFixed(1)} mm/h · ${rainWord(v)}`}
            bands={[{ from: 0.3, to: 2.5, label: 'Légère' }, { from: 2.5, to: 7.6, label: 'Modérée' }, { from: 7.6, to: 50, label: 'Forte' }].filter((b) => b.from < rainMax)}
          />
          <T style={styles.subTitle}>Risque de pluie</T>
          <Chart
            width={chartW}
            height={170}
            dayStart={dayStart}
            series={[{ values: main, color: m.color }]}
            yMin={0}
            yMax={100}
            yTicks={[0, 25, 50, 75, 100]}
            formatY={(v) => `${v} %`}
            now={isToday ? nowSec : undefined}
            formatValue={(v) => `${Math.round(v)} %`}
          />
        </>
      ) : (
        <Chart
          width={chartW}
          dayStart={dayStart}
          series={[{ values: main, color: m.color }, ...(alt.length ? [{ values: alt, color: 'rgba(255,255,255,0.7)', dashed: true, fill: false }] : [])]}
          barColor={m.color}
          yMin={ticks[0]}
          yMax={ticks[ticks.length - 1]}
          yTicks={ticks}
          formatY={(v) => (metric === 'temp' ? `${Math.round(v)}°` : `${Math.round(v)}`)}
          now={isToday ? nowSec : undefined}
          formatValue={(v) => fmt(v)}
          bands={metric === 'uv' ? [{ from: 0.2, to: 3, label: 'Faible' }, { from: 3, to: 6, label: 'Modéré' }, { from: 6, to: 8, label: 'Élevé' }, { from: 8, to: 11, label: 'Très élevé' }] : undefined}
        />
      )}

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

      {summary ? (
        <View style={styles.box}>
          <T style={styles.boxTitle}>En résumé</T>
          <T style={{ fontSize: 16, lineHeight: 22 }}>{summary}</T>
        </View>
      ) : null}

      {metric === 'rain' ? (
        <View style={styles.box}>
          <T style={styles.boxTitle}>Cumuls de pluie</T>
          <View style={styles.kv}>
            <T style={{ fontSize: 16 }}>24 dernières heures</T>
            <T style={styles.kvVal}>{mmText(rainPast24)}</T>
          </View>
          <View style={[styles.kv, styles.kvBorder]}>
            <T style={{ fontSize: 16 }}>24 prochaines heures</T>
            <T style={styles.kvVal}>{mmText(rainNext24)}</T>
          </View>
        </View>
      ) : null}

      {comparison ? (
        <View style={styles.box}>
          <T style={styles.boxTitle}>Par rapport à hier</T>
          <T style={{ fontSize: 16, marginBottom: 12 }}>{compare}</T>
          {comparison.map((row) => (
            <View key={row.label} style={styles.cmpRow}>
              <T style={styles.cmpLabel}>{row.label}</T>
              <View style={styles.cmpTrack}>
                <View style={[styles.cmpFill, { width: `${Math.max(4, row.ratio * 100)}%`, backgroundColor: row.today ? m.color : 'rgba(255,255,255,0.35)' }]} />
              </View>
              <T style={styles.cmpVal}>{row.value}</T>
            </View>
          ))}
        </View>
      ) : compare ? (
        <View style={styles.box}>
          <T style={styles.boxTitle}>Par rapport à hier</T>
          <T style={{ fontSize: 16 }}>{compare}</T>
        </View>
      ) : null}

      {metric === 'wind' ? (
        <View style={styles.box}>
          <T style={styles.boxTitle}>Échelle de Beaufort</T>
          {BEAUFORT.map(([force, label, range, color]) => {
            const active = Number.isFinite(nowVal) && beaufortOf(nowVal) === force;
            return (
              <View key={force} style={[styles.bfRow, active && styles.bfActive]}>
                <View style={[styles.bfDot, { backgroundColor: color }]} />
                <T style={styles.bfForce}>{force}</T>
                <T style={{ flex: 1, fontSize: 15, color: active ? '#fff' : DIM }}>{label}</T>
                <T style={{ fontSize: 15, color: active ? '#fff' : DIM }}>{range}</T>
              </View>
            );
          })}
        </View>
      ) : null}


      <View style={styles.box}>
        <T style={styles.boxTitle}>À propos</T>
        <T style={{ color: DIM, lineHeight: 20 }}>{m.about}</T>
        {!day.meteoFrance ? <T style={{ color: DIM, marginTop: 6 }}>Pour ce jour, il s’agit d’une tendance (modèle ECMWF), moins précise.</T> : null}
      </View>
    </ScrollView>
      {menu ? (
        <FloatingMenu top={insets.top + 64} current={metric} onClose={() => setMenu(false)} onPick={(id) => { tick(); setMetric(id); setSecond(false); setMenu(false); }} />
      ) : null}
    </View>
  );
}

function Header({ title, icon, onTitle }: { title: string; icon: (typeof METRICS)['temp']['icon']; onTitle: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.close} hitSlop={10}>
        <Icon name={{ ios: 'xmark', android: 'close' }} size={16} />
      </Pressable>
      <Pressable onPress={onTitle} style={styles.titleBtn} hitSlop={8}>
        <Icon name={icon} size={18} />
        <T style={styles.title}>{title}</T>
        <Icon name={{ ios: 'chevron.down', android: 'expand_more' }} size={13} color={DIM} />
      </Pressable>
      <View style={{ width: 36 }} />
    </View>
  );
}

/** Rangée de repères toutes les 2 h au-dessus du graphique. */
function TopRow({ hours, metric, width, dayStart }: { hours: HourPoint[]; metric: MetricId; width: number; dayStart: number }) {
  const slots = Array.from({ length: 12 }, (_, i) => hours.find((h) => h.time >= dayStart + i * 7200) ?? null);
  const w = (width - 34) / 12;
  const nowSec = Date.now() / 1000;
  return (
    <View style={{ flexDirection: 'row', width: width - 34, marginBottom: 4 }}>
      {slots.map((h, i) => {
        if (!h) return <View key={i} style={{ width: w }} />;
        const past = h.time + 7200 < nowSec;
        let content: ReactNode = null;
        if (metric === 'temp') content = <Icon name={symbolFor(h.weatherCode, h.isDay)} size={17} multicolor />;
        else if (metric === 'wind')
          content = (
            <View style={{ transform: [{ rotate: `${h.windDirection + 180}deg` }] }}>
              <Icon name={{ ios: 'arrow.up', android: 'arrow_upward' }} size={13} />
            </View>
          );
        else if (metric === 'pressure') {
          const next = hours.find((x) => x.time >= h.time + 7200);
          const d = next ? next.pressure - h.pressure : 0;
          content = <T style={styles.topTxt}>{Math.abs(d) < 0.5 ? '=' : d > 0 ? '↑' : '↓'}</T>;
        } else if (metric === 'rain') content = <T style={styles.topTxt}>{h.precipitationProbability !== null ? `${h.precipitationProbability}` : ''}</T>;
        else if (metric === 'humidity') content = <T style={styles.topTxt}>{Math.round(h.humidity)}</T>;
        else if (metric === 'uv') content = <T style={styles.topTxt}>{h.uv !== null ? Math.round(h.uv) : ''}</T>;
        else if (metric === 'visibility') content = <T style={styles.topTxt}>{h.visibility !== null ? Math.round(h.visibility / 1000) : ''}</T>;
        return (
          <View key={i} style={{ width: w, alignItems: 'center', opacity: past ? 0.5 : 1 }}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

function rainWord(mmh: number) {
  if (mmh < 0.1) return 'sec';
  if (mmh < 2.5) return 'pluie légère';
  if (mmh < 7.6) return 'pluie modérée';
  return 'forte pluie';
}

function visWord(km: number) {
  if (km < 1) return 'très réduite (brouillard)';
  if (km < 4) return 'réduite (brume)';
  if (km < 10) return 'moyenne';
  if (km < 20) return 'bonne';
  return 'excellente';
}

const ORDER: MetricId[] = ['temp', 'rain', 'wind', 'uv', 'humidity', 'pressure', 'visibility'];

/** Menu flottant iOS : par-dessus le contenu, fermé en touchant ailleurs. */
function FloatingMenu({ top, current, onPick, onClose }: { top: number; current: MetricId; onPick: (id: MetricId) => void; onClose: () => void }) {
  return (
    <Pressable style={[StyleSheet.absoluteFill, { zIndex: 10 }]} onPress={onClose}>
      <View style={[styles.floating, { top }]}>
        {Platform.OS === 'ios' ? <BlurView intensity={80} tint="systemThickMaterialDark" style={StyleSheet.absoluteFill} /> : null}
        <MetricMenu current={current} onPick={onPick} />
      </View>
    </Pressable>
  );
}

function MetricMenu({ current, onPick }: { current: MetricId; onPick: (id: MetricId) => void }) {
  return (
    <View style={styles.menu}>
      {ORDER.map((id, i) => (
        <Fragment key={id}>
          {i > 0 ? <View style={styles.menuSep} /> : null}
          <Pressable onPress={() => onPick(id)} style={styles.menuItem}>
            <Icon name={METRICS[id].icon} size={17} />
            <T style={{ flex: 1, fontSize: 16 }}>{METRICS[id].title}</T>
            {id === current ? <Icon name={{ ios: 'checkmark', android: 'check' }} size={15} /> : null}
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

// Échelle de Beaufort (force, désignation, vitesse en km/h, couleur)
const BEAUFORT: [number, string, string, string][] = [
  [0, 'Calme', '< 1', '#8EC5FF'],
  [1, 'Très légère brise', '1 – 5', '#7CC9E8'],
  [2, 'Légère brise', '6 – 11', '#6CCFC9'],
  [3, 'Petite brise', '12 – 19', '#6FD3A0'],
  [4, 'Jolie brise', '20 – 28', '#8AD46E'],
  [5, 'Bonne brise', '29 – 38', '#B5D352'],
  [6, 'Vent frais', '39 – 49', '#E2CB3E'],
  [7, 'Grand frais', '50 – 61', '#F2AF3A'],
  [8, 'Coup de vent', '62 – 74', '#F28C34'],
  [9, 'Fort coup de vent', '75 – 88', '#EE6A30'],
  [10, 'Tempête', '89 – 102', '#E5482E'],
  [11, 'Violente tempête', '103 – 117', '#D2304A'],
  [12, 'Ouragan', '≥ 118', '#B4246B'],
];
const LIMITS = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
function beaufortOf(kmh: number) {
  const i = LIMITS.findIndex((l) => kmh < l);
  return i === -1 ? 12 : i;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1C1C1E', paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  titleBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)' },
  menu: { overflow: 'hidden' },
  floating: { position: 'absolute', alignSelf: 'center', width: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: Platform.OS === 'ios' ? 'rgba(60,60,67,0.35)' : '#2C2C2E', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  menuSep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.15)', marginLeft: 43 },
  topTxt: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  subTitle: { fontSize: 17, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  kvBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
  kvVal: { fontSize: 16, fontWeight: '700', color: '#5AC8FA' },
  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  cmpLabel: { width: 92, fontSize: 15 },
  cmpTrack: { flex: 1, height: 22, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  cmpFill: { height: '100%', borderRadius: 6 },
  cmpVal: { width: 78, textAlign: 'right', fontSize: 15, fontWeight: '700' },
  bfRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 8 },
  bfActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  bfDot: { width: 12, height: 12, borderRadius: 6 },
  bfForce: { width: 22, fontSize: 15, fontWeight: '700' },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLetter: { fontSize: 12, color: DIM, fontWeight: '600' },
  dayNum: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: '#64D2FF' },
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
  box: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 16, marginTop: 16 },
  boxTitle: { fontSize: 13, fontWeight: '600', color: DIM, marginBottom: 8, textTransform: 'uppercase', letterSpacing: -0.08 },
  chip: { backgroundColor: 'rgba(90,200,250,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13 },
});
