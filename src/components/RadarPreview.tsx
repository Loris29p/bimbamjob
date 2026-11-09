// Carte « Précipitations » : petite carte Apple Plans avec le dernier radar, ouvre la carte plein écran.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import type { Place } from '../lib/types';
import { useCached } from '../lib/useAsync';
import { Glass } from './ui';

async function latestRadar() {
  const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  const d = await r.json();
  const past = d.radar?.past ?? [];
  const last = past[past.length - 1];
  return last ? `${d.host}${last.path}/256/{z}/{x}/{y}/2/1_1.png` : null;
}

export function RadarPreview({ place, temperature }: { place: Place; temperature: number }) {
  const { width } = useWindowDimensions();
  const size = width - 32 - 32; // carte (marges 16) moins son remplissage
  const tiles = useCached(`radar:${Math.floor(Date.now() / 600000)}`, latestRadar, 10 * 60 * 1000);
  return (
    <Pressable onPress={() => router.push('/radar')} accessibilityRole="button" accessibilityLabel="Ouvrir la carte des précipitations">
      <Glass title="Précipitations" icon={{ ios: 'umbrella.fill', android: 'umbrella' }}>
        <View style={[styles.mapBox, { height: size }]} pointerEvents="none">
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 2.6, longitudeDelta: 2.6 / Math.cos((place.latitude * Math.PI) / 180) }}
            mapType="mutedStandard"
            userInterfaceStyle="dark"
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            showsCompass={false}
            showsPointsOfInterests={false}
            showsBuildings={false}
            toolbarEnabled={false}
          >
            {/* RainViewer ne fournit pas plus fin que le niveau 7 : on agrandit au-delà */}
            {tiles ? <UrlTile urlTemplate={tiles} maximumNativeZ={7} maximumZ={12} opacity={0.85} zIndex={1} /> : null}
            <Marker coordinate={{ latitude: place.latitude, longitude: place.longitude }} anchor={{ x: 0.5, y: 0.5 }} zIndex={2}>
              <View style={styles.pin} collapsable={false}>
                <View style={styles.pinDot}>
                  <Text style={styles.pinTemp}>{Math.round(temperature)}</Text>
                </View>
                <Text style={styles.pinName} numberOfLines={1}>
                  {place.isGps ? 'Ma position' : place.name}
                </Text>
              </View>
            </Marker>
          </MapView>
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mapBox: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#2C2C2E' },
  pin: { width: 120, alignItems: 'center' },
  pinDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3A3F4A', borderWidth: 2, borderColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  pinTemp: { color: '#fff', fontSize: 18, fontWeight: '700' },
  pinName: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
});
