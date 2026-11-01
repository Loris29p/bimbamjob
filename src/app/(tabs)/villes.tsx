import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchCities } from '../../lib/geocoding';
import { usePlace } from '../../lib/PlaceContext';
import { useTheme } from '../../lib/theme';
import type { Place } from '../../lib/types';

export default function CitiesScreen() {
  const t = useTheme();
  const { favorites, selectPlace, useMyLocation, toggleFavorite } = usePlace();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Place & { label: string })[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      searchCities(query)
        .then((r) => {
          setResults(r);
          setError(null);
        })
        .catch(() => setError('Recherche indisponible'));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const choose = (p: Place) => {
    selectPlace(p);
    setQuery('');
    router.navigate('/');
  };

  const showingSearch = query.trim().length >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher une commune…"
        placeholderTextColor={t.muted}
        style={[styles.input, { backgroundColor: t.card, color: t.text, borderColor: t.border }]}
        autoCorrect={false}
      />
      <Pressable
        onPress={async () => {
          await useMyLocation();
          router.navigate('/');
        }}
        style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}
      >
        <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>📍 Utiliser ma position</Text>
      </Pressable>

      {error ? <Text style={{ color: '#E5484D', marginBottom: 8 }}>{error}</Text> : null}
      <Text style={[styles.section, { color: t.muted }]}>{showingSearch ? 'Résultats' : 'Favoris'}</Text>

      <FlatList
        data={showingSearch ? results : favorites}
        keyExtractor={(p) => `${p.latitude},${p.longitude}`}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ color: t.muted }}>
            {showingSearch ? 'Aucune commune trouvée.' : 'Aucun favori. Touche ☆ sur l’écran Météo pour en ajouter.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => choose(item)} style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>{'label' in item ? (item as { label: string }).label : item.name}</Text>
            {!showingSearch ? (
              <Pressable onPress={() => toggleFavorite(item)} hitSlop={10}>
                <Text style={{ color: t.muted, fontSize: 18 }}>✕</Text>
              </Pressable>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginVertical: 8 },
});
