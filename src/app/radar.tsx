import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { GlassCircle, GlassLegend, GlassMenu, GlassNote, GlassPill, LAYER_NAMES, type MapLayer } from '../components/MapGlass';
import { RadarTimeline, type TimelineMeta, type TimelinePos } from '../components/RadarTimeline';
import { tick } from '../lib/hig';
import { usePlaces } from '../lib/PlaceContext';
import { radarHtml } from '../lib/radarHtml';

const SIDE = 16;

export default function Radar() {
  const insets = useSafeAreaInsets();
  const { places, activeIndex } = usePlaces();
  const p = places[activeIndex];
  // fond de carte clair ou sombre selon le réglage de l'iPhone
  const dark = useColorScheme() === 'dark';
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const [meta, setMeta] = useState<TimelineMeta | null>(null);
  const [pos, setPos] = useState<TimelinePos | null>(null);
  const [note, setNote] = useState('');
  const [layer, setLayer] = useState<MapLayer>('rain');
  const [menu, setMenu] = useState<'layers' | 'places' | null>(null);

  const lat = p?.latitude ?? 46.6;
  const lon = p?.longitude ?? 2.4;
  const here = p ? (p.isGps ? 'Ma position' : p.name) : 'France';
  const others = useMemo(
    () => places.filter((_, i) => i !== activeIndex).map((o) => ({ name: o.name, lat: o.latitude, lon: o.longitude })),
    [places, activeIndex],
  );
  const html = useMemo(() => radarHtml(lat, lon, dark, here, others), [lat, lon, dark, here, others]);

  // Les commandes natives pilotent la carte : on appelle les fonctions exposées par la page (window.rn).
  const run = (js: string) => web.current?.injectJavaScript(`window.rn&&${js};true;`);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'meta') setMeta(m);
      else if (m.type === 'pos') setPos(m);
      else if (m.type === 'msg') setNote(m.text);
    } catch {}
  };

  const top = insets.top + 8;
  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0B1520' : '#EEF3F8' }}>
      {/* heure et batterie lisibles sur la carte claire */}
      <StatusBar style={dark ? 'light' : 'dark'} />
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: dark ? '#0B1520' : '#EEF3F8' }}
      />

      {/* Un toucher hors d'un menu le referme */}
      {menu ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} accessibilityLabel="Fermer le menu" /> : null}

      <GlassCircle dark={dark} icon={{ ios: 'xmark', android: 'close' }} label="Fermer" onPress={() => router.back()} style={[styles.abs, { top, left: SIDE }]} />
      <GlassLegend dark={dark} layer={layer} style={[styles.abs, { top: top + 48 + 14, left: SIDE }]} />
      {note ? <GlassNote dark={dark} text={note} style={[styles.abs, { top: top + 6, left: SIDE + 60, right: SIDE + 60 }]} /> : null}

      <GlassPill
        dark={dark}
        style={[styles.abs, { top, right: SIDE }]}
        items={[
          { icon: { ios: 'square.2.layers.3d.fill', android: 'layers' }, label: 'Calques', onPress: () => (tick(), setMenu(menu === 'layers' ? null : 'layers')) },
          { icon: { ios: 'location', android: 'near_me' }, label: 'Ma position', onPress: () => (tick(), setMenu(null), run('rn.locate()')) },
        ]}
      />
      <GlassCircle
        dark={dark}
        icon={{ ios: 'list.bullet', android: 'list' }}
        label="Villes"
        onPress={() => (tick(), setMenu(menu === 'places' ? null : 'places'))}
        style={[styles.abs, { top: top + 108 + 12, right: SIDE }]}
      />

      {menu === 'layers' ? (
        <GlassMenu
          dark={dark}
          style={[styles.abs, { top, right: SIDE + 48 + 10 }]}
          items={(Object.keys(LAYER_NAMES) as MapLayer[]).map((l) => ({ key: l, label: LAYER_NAMES[l], selected: l === layer }))}
          onSelect={(k) => {
            setMenu(null);
            setLayer(k as MapLayer);
            run(`rn.layer(${JSON.stringify(k)})`);
          }}
        />
      ) : null}
      {menu === 'places' ? (
        <GlassMenu
          dark={dark}
          style={[styles.abs, { top: top + 120, right: SIDE + 48 + 10 }]}
          items={places.map((pl, i) => ({ key: String(i), label: pl.isGps ? 'Ma position' : pl.name, selected: i === activeIndex }))}
          onSelect={(k) => {
            setMenu(null);
            const pl = places[+k];
            if (pl) run(`rn.go(${pl.latitude},${pl.longitude})`);
          }}
        />
      ) : null}

      <RadarTimeline
        dark={dark}
        layer={layer}
        meta={meta}
        pos={pos}
        bottom={insets.bottom + 8}
        onPlay={() => run('rn.play()')}
        onMode={(m) => run(`rn.mode(${JSON.stringify(m)})`)}
        onSeek={(f) => run(`rn.seek(${f.toFixed(4)})`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
});
