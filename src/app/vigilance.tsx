import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DIM, Glass, T } from '../components/ui';
import { COLORS, fetchVigilance, PHENOMENA, type DepartmentVigilance } from '../lib/vigilance';

const PERIOD_LABEL: Record<string, string> = { J: "Aujourd'hui", J1: 'Demain' };

export default function Vigilance() {
  const { department } = useLocalSearchParams<{ department?: string }>();
  const [data, setData] = useState<DepartmentVigilance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!department) return;
    try {
      setData(await fetchVigilance(department));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }, [department]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={{ backgroundColor: '#101826' }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.top}>
        <T style={styles.title}>Vigilance {department ? `(${department})` : ''}</T>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <T style={{ color: '#7CC0FF', fontSize: 17 }}>Fermer</T>
        </Pressable>
      </View>
      {error === 'NO_KEY' ? (
        <Glass>
          <T style={{ lineHeight: 21 }}>
            Ajoute une clé gratuite de l’API Météo-France « Données Publiques Vigilance » dans le fichier .env :{'\n'}
            EXPO_PUBLIC_METEOFRANCE_API_KEY=ta_cle
          </T>
        </Glass>
      ) : error ? (
        <T style={{ color: '#FF8A80' }}>{error}</T>
      ) : !data ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : (
        data.map((p) => {
          const c = COLORS[p.maxColor] ?? COLORS[1];
          const active = p.phenomena.filter((ph) => ph.color > 1);
          return (
            <Glass key={p.period} title={PERIOD_LABEL[p.period] ?? p.period}>
              <View style={[styles.badge, { backgroundColor: c.color }]}>
                <T style={{ color: c.text, fontWeight: '700' }}>Vigilance {c.label.toLowerCase()}</T>
              </View>
              {active.length === 0 ? (
                <T style={{ color: DIM, marginTop: 10 }}>Pas de vigilance particulière.</T>
              ) : (
                active.map((ph) => {
                  const col = COLORS[ph.color] ?? COLORS[1];
                  return (
                    <View key={ph.id} style={styles.row}>
                      <T style={{ fontSize: 20 }}>{PHENOMENA[ph.id]?.icon ?? '⚠️'}</T>
                      <T style={{ flex: 1, fontSize: 16 }}>{PHENOMENA[ph.id]?.label ?? ph.id}</T>
                      <View style={[styles.pill, { backgroundColor: col.color }]}>
                        <T style={{ color: col.text, fontWeight: '600' }}>{col.label}</T>
                      </View>
                    </View>
                  );
                })
              )}
            </Glass>
          );
        })
      )}
      <Pressable onPress={() => Linking.openURL('https://vigilance.meteofrance.fr')} style={styles.link}>
        <T style={{ color: '#7CC0FF', fontWeight: '600' }}>Carte officielle sur vigilance.meteofrance.fr</T>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  pill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  link: { padding: 14, alignItems: 'center' },
});
