// Aperçu de la météo d'une commune avant de l'ajouter à la liste.
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../components/ui';
import { WeatherPage } from '../components/WeatherPage';
import { usePlaces } from '../lib/PlaceContext';
import type { Place } from '../lib/types';

export default function Apercu() {
  const p = useLocalSearchParams<{ name: string; department?: string; lat: string; lon: string }>();
  const insets = useSafeAreaInsets();
  const { addPlace, setActiveIndex } = usePlaces();
  const place: Place = { name: p.name, department: p.department || undefined, latitude: Number(p.lat), longitude: Number(p.lon) };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1520' }}>
      <WeatherPage place={place} bottomInset={insets.bottom} />
      <View style={[styles.bar, { top: insets.top + 6 }]}>
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <T style={styles.btn}>Annuler</T>
        </Pressable>
        <Pressable
          hitSlop={10}
          onPress={() => {
            setActiveIndex(addPlace(place));
            router.dismissTo('/');
          }}
        >
          <T style={[styles.btn, { fontWeight: '700' }]}>Ajouter</T>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  btn: { fontSize: 17, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 4 },
});
