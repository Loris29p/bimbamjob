import { router } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { RadarTimeline, type TimelineMeta, type TimelinePos } from '../components/RadarTimeline';
import { Icon } from '../components/ui';
import { usePlaces } from '../lib/PlaceContext';
import { radarHtml } from '../lib/radarHtml';

export default function Radar() {
  const insets = useSafeAreaInsets();
  const { places, activeIndex } = usePlaces();
  const p = places[activeIndex];
  // fond de carte clair ou sombre selon le réglage de l'iPhone
  const dark = useColorScheme() !== 'light';
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const [meta, setMeta] = useState<TimelineMeta | null>(null);
  const [pos, setPos] = useState<TimelinePos | null>(null);

  const lat = p?.latitude ?? 46.6;
  const lon = p?.longitude ?? 2.4;
  const html = useMemo(() => radarHtml(lat, lon, dark, { top: insets.top, bottom: insets.bottom }), [lat, lon, dark, insets.top, insets.bottom]);

  // La frise native pilote la carte : on appelle les fonctions exposées par la page (window.rn).
  const run = (js: string) => web.current?.injectJavaScript(`window.rn&&${js};true;`);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'meta') setMeta(m);
      else if (m.type === 'pos') setPos(m);
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0B1520' : '#EEF3F8' }}>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: '#0B1520' }}
      />
      <RadarTimeline
        dark={dark}
        meta={meta}
        pos={pos}
        bottom={insets.bottom + 10}
        onPlay={() => run('rn.play()')}
        onMode={(m) => run(`rn.mode(${JSON.stringify(m)})`)}
        onSeek={(f) => run(`rn.seek(${f.toFixed(4)})`)}
      />
      <Pressable onPress={() => router.back()} style={[styles.close, { top: insets.top + 8 }]} hitSlop={10}>
        <Icon name={{ ios: 'xmark', android: 'close' }} size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { position: 'absolute', left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(20,28,40,0.86)', alignItems: 'center', justifyContent: 'center' },
});
