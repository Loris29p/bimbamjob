// Liste des lieux + recherche de communes.
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DIM, Icon, T } from '../components/ui';
import { temp, time } from '../lib/format';
import { searchCities } from '../lib/geocoding';
import { usePlaces } from '../lib/PlaceContext';
import { backgroundFor } from '../lib/sky';
import { placeKey, type Place } from '../lib/types';
import { useForecast } from '../lib/useForecast';
import { weatherLabel } from '../lib/weatherCodes';

function PlaceRow({ place, onPress, onLongPress }: { place: Place; onPress: () => void; onLongPress?: () => void }) {
  const { forecast } = useForecast(place);
  const c = forecast?.current;
  const today = forecast?.daily[0];
  const colors = c ? backgroundFor(c.weatherCode, c.isDay) : (['#2B5C9E', '#4D7FBF', '#7FA6D6'] as const);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      <LinearGradient colors={[colors[0], colors[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1 }}>
        <T style={styles.name} numberOfLines={1}>
          {place.isGps ? 'Ma position' : place.name}
        </T>
        <T style={styles.sub}>{place.isGps ? place.name : c ? time(c.time) : ''}</T>
        <T style={styles.cond}>{c ? weatherLabel(c.weatherCode, c.isDay) : ''}</T>
      </View>
      <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <T style={styles.temp}>{c ? temp(c.temperature) : '–'}</T>
        <T style={styles.sub}>{today ? `Max. ${temp(today.tMax)}  Min. ${temp(today.tMin)}` : ''}</T>
      </View>
    </Pressable>
  );
}

export default function Cities() {
  const insets = useSafeAreaInsets();
  const { places, setActiveIndex, addPlace, removePlace } = usePlaces();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Place & { label: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const searching = query.trim().length >= 2;

  useEffect(() => {
    if (!searching) return setResults([]);
    const id = setTimeout(() => {
      searchCities(query)
        .then((r) => {
          setResults(r);
          setError(null);
        })
        .catch(() => setError('Recherche indisponible'));
    }, 250);
    return () => clearTimeout(id);
  }, [query, searching]);

  const open = (index: number) => {
    setActiveIndex(index);
    router.back();
  };

  const confirmRemove = (p: Place) =>
    Alert.alert(p.name, 'Retirer cette ville de la liste ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => removePlace(p) },
    ]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <T style={styles.title}>Météo</T>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <T style={{ fontSize: 17, color: '#7CC0FF' }}>OK</T>
        </Pressable>
      </View>
      <View style={styles.search}>
        <Icon name={{ ios: 'magnifyingglass', android: 'search' }} size={16} color={DIM} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher une commune"
          placeholderTextColor={DIM}
          style={styles.input}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      {error ? <T style={{ color: '#FF8A80', marginBottom: 8 }}>{error}</T> : null}

      {searching ? (
        <FlatList
          data={results}
          keyExtractor={(p) => `${p.label}${placeKey(p)}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<T style={{ color: DIM }}>Aucune commune trouvée.</T>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.result}
              onPress={() => {
                setQuery('');
                open(addPlace(item));
              }}
            >
              <T style={{ fontSize: 17 }}>{item.label}</T>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={places}
          keyExtractor={placeKey}
          contentContainerStyle={{ gap: 10, paddingBottom: insets.bottom + 20 }}
          renderItem={({ item, index }) => (
            <PlaceRow place={item} onPress={() => open(index)} onLongPress={item.isGps ? undefined : () => confirmRemove(item)} />
          )}
          ListFooterComponent={places.length > 1 ? <T style={styles.hint}>Appui long sur une ville pour la retirer.</T> : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05080F', paddingHorizontal: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 34, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 10, marginBottom: 14 },
  input: { flex: 1, color: '#fff', fontSize: 17, paddingVertical: 9 },
  row: { flexDirection: 'row', borderRadius: 16, overflow: 'hidden', padding: 14, minHeight: 104 },
  name: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14, fontWeight: '500' },
  cond: { fontSize: 14, color: DIM, marginTop: 'auto' },
  temp: { fontSize: 46, fontWeight: '300' },
  result: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.2)' },
  hint: { color: DIM, fontSize: 12, textAlign: 'center', marginTop: 6 },
});
