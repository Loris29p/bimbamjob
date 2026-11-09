import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import MapView, { Marker, Overlay, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { GlassCircle, GlassLegend, GlassMenu, GlassNote, GlassPill, LAYER_NAMES, type MapLayer } from '../components/MapGlass';
import { RadarTimeline, type TimelineMeta, type TimelinePos } from '../components/RadarTimeline';
import { Icon } from '../components/ui';
import { tick } from '../lib/hig';
import { mapEngineHtml, type MapView4 } from '../lib/mapEngineHtml';
import { usePlaces } from '../lib/PlaceContext';
import { symbolFor } from '../lib/sky';

const SIDE = 16;
// Comme l'app Météo d'Apple : on ouvre sur une vue large (≈ 11° de longitude, toute la France sur iPhone).
const HOME_SPAN = 11;

type Img = { uri: string; bounds: [[number, number], [number, number]] } | null;
type Mark = { lat: number; lon: number; text: string; rot?: number };
type PlacesInfo = { me: { temp: number | null; code: number | null; day: boolean }; others: (number | null)[] };

function regionAround(lat: number, lon: number, lonSpan: number, w: number, h: number): Region {
  return { latitude: lat, longitude: lon, longitudeDelta: lonSpan, latitudeDelta: lonSpan * (h / w) * Math.cos((lat * Math.PI) / 180) };
}
function viewOf(r: Region, w: number): MapView4 {
  return {
    n: r.latitude + r.latitudeDelta / 2,
    s: r.latitude - r.latitudeDelta / 2,
    w: r.longitude - r.longitudeDelta / 2,
    e: r.longitude + r.longitudeDelta / 2,
    zoom: Math.log2(((360 / r.longitudeDelta) * w) / 256),
  };
}

export default function Radar() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { places, activeIndex } = usePlaces();
  const p = places[activeIndex];
  // carte claire ou sombre selon le réglage de l'iPhone
  const dark = useColorScheme() === 'dark';
  const map = useRef<MapView>(null);
  const engine = useRef<ComponentRef<typeof WebView>>(null);
  const [meta, setMeta] = useState<TimelineMeta | null>(null);
  const [pos, setPos] = useState<TimelinePos | null>(null);
  const [note, setNote] = useState('');
  const [layer, setLayer] = useState<MapLayer>('rain');
  const [menu, setMenu] = useState<'layers' | 'places' | null>(null);
  const [img, setImg] = useState<Img>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [info, setInfo] = useState<PlacesInfo | null>(null);

  const lat = p?.latitude ?? 46.6;
  const lon = p?.longitude ?? 2.4;
  const here = p ? (p.isGps ? 'Ma position' : p.name) : 'France';
  const others = useMemo(
    () => places.filter((_, i) => i !== activeIndex).map((o) => ({ name: o.name, lat: o.latitude, lon: o.longitude })),
    [places, activeIndex],
  );
  const home = useMemo(() => regionAround(lat, lon, HOME_SPAN, width, height), [lat, lon, width, height]);
  // Le moteur ne se recharge que si le lieu ou la liste des villes change.
  const othersKey = JSON.stringify(others);
  const html = useMemo(
    () => mapEngineHtml(lat, lon, JSON.parse(othersKey), viewOf(home, width)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lon, othersKey],
  );

  // Les commandes natives pilotent le moteur : on appelle les fonctions exposées par la page (window.rn).
  const run = (js: string) => engine.current?.injectJavaScript(`window.rn&&${js};true;`);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'meta') setMeta(m);
      else if (m.type === 'pos') setPos(m);
      else if (m.type === 'msg') setNote(m.text);
      else if (m.type === 'img') setImg(m.img);
      else if (m.type === 'marks') setMarks(m.items);
      else if (m.type === 'places') setInfo(m);
    } catch {}
  };

  const top = insets.top + 8;
  const text = dark ? '#FFFFFF' : '#1C1C1E';
  const halo = dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)';
  const me = info?.me;
  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#000' : '#F2F2F7' }}>
      {/* heure et batterie lisibles sur la carte */}
      <StatusBar style={dark ? 'light' : 'dark'} />
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={home}
        mapType="mutedStandard"
        userInterfaceStyle={dark ? 'dark' : 'light'}
        pitchEnabled={false}
        rotateEnabled={false}
        showsCompass={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        toolbarEnabled={false}
        onRegionChangeComplete={(r) => run(`rn.view(${JSON.stringify(viewOf(r, width))})`)}
      >
        {/* Pluie (radar ou prévision) ou autre calque : une image posée sur la carte */}
        {img ? <Overlay image={{ uri: img.uri }} bounds={img.bounds} /> : null}

        {marks.map((m, i) => (
          <Marker key={`m${i}`} coordinate={{ latitude: m.lat, longitude: m.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.mark}>
              {m.rot != null ? <Text style={[styles.markText, { transform: [{ rotate: `${m.rot}deg` }] }]}>↑</Text> : null}
              <Text style={styles.markText}>{m.text}</Text>
            </View>
          </Marker>
        ))}

        {others.map((o, i) => (
          <Marker key={`o${i}`} coordinate={{ latitude: o.lat, longitude: o.lon }} anchor={{ x: 0.5, y: 17 / 58 }}>
            <View style={styles.place}>
              <View style={styles.placeDot}>
                <Text style={styles.placeTemp}>{info?.others[i] != null ? Math.round(info.others[i]!) : '–'}</Text>
              </View>
              <Text style={[styles.name, { color: text, textShadowColor: halo }]} numberOfLines={1}>
                {o.name}
              </Text>
            </View>
          </Marker>
        ))}

        {/* Lieu affiché : bulle avec température et temps (la pointe est sur le lieu) */}
        <Marker coordinate={{ latitude: lat, longitude: lon }} anchor={{ x: 0.5, y: 77 / 108 }} zIndex={10}>
          <View style={styles.me}>
            <View style={styles.bubble}>
              <Text style={styles.bubbleTemp}>{me?.temp != null ? `${Math.round(me.temp)}°` : '–'}</Text>
              {me?.code != null ? <Icon name={symbolFor(me.code, me.day)} size={24} color="#FFFFFF" /> : null}
            </View>
            <View style={styles.tail} />
            <Text style={[styles.name, { color: text, textShadowColor: halo }]} numberOfLines={1}>
              {here}
            </Text>
          </View>
        </Marker>
      </MapView>

      {/* Moteur invisible : télécharge radar et prévision, fabrique les images de pluie */}
      <View style={styles.engine} pointerEvents="none">
        <WebView ref={engine} originWhitelist={['*']} source={{ html, baseUrl: 'https://localhost' }} onMessage={onMessage} style={{ flex: 1 }} />
      </View>

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
          { icon: { ios: 'location', android: 'near_me' }, label: 'Ma position', onPress: () => (tick(), setMenu(null), map.current?.animateToRegion(home, 600)) },
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
            if (pl) map.current?.animateToRegion(regionAround(pl.latitude, pl.longitude, 1.4, width, height), 600);
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
  engine: { position: 'absolute', width: 2, height: 2, left: 0, top: 0, opacity: 0 },
  me: { width: 160, height: 108, alignItems: 'center' },
  bubble: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#97A3B1',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  bubbleTemp: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 24, marginLeft: 4, letterSpacing: -0.5 },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -2,
  },
  name: { marginTop: 5, fontSize: 13, fontWeight: '600', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
  place: { width: 160, height: 58, alignItems: 'center' },
  placeDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#545C68',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  placeTemp: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
    height: 34,
    paddingHorizontal: 4,
    borderRadius: 17,
    backgroundColor: 'rgba(70,80,95,0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  markText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
