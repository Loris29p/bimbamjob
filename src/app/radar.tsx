import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Icon } from '../components/ui';
import { usePlaces } from '../lib/PlaceContext';
import { radarHtml } from '../lib/radarHtml';

export default function Radar() {
  const insets = useSafeAreaInsets();
  const { places, activeIndex } = usePlaces();
  const p = places[activeIndex];
  return (
    <View style={{ flex: 1, backgroundColor: '#0B1520' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: radarHtml(p?.latitude ?? 46.6, p?.longitude ?? 2.4, true), baseUrl: 'https://localhost' }}
        style={{ flex: 1, backgroundColor: '#0B1520' }}
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
