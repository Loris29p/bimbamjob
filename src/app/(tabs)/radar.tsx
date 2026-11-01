import { useColorScheme, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { usePlace } from '../../lib/PlaceContext';
import { radarHtml } from '../../lib/radarHtml';

export default function RadarScreen() {
  const { place } = usePlace();
  const dark = useColorScheme() === 'dark';
  const lat = place?.latitude ?? 46.6;
  const lon = place?.longitude ?? 2.4;
  return (
    <View style={{ flex: 1 }}>
      <WebView
        key={`${lat},${lon},${dark}`}
        originWhitelist={['*']}
        source={{ html: radarHtml(lat, lon, dark), baseUrl: 'https://localhost' }}
        style={{ flex: 1 }}
      />
    </View>
  );
}
