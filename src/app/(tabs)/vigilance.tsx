import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { usePlace } from '../../lib/PlaceContext';
import { useTheme } from '../../lib/theme';
import { COLORS, fetchVigilance, PHENOMENA, type DepartmentVigilance } from '../../lib/vigilance';

const PERIOD_LABEL: Record<string, string> = { J: "Aujourd'hui", J1: 'Demain' };

export default function VigilanceScreen() {
  const t = useTheme();
  const { place } = usePlace();
  const [data, setData] = useState<DepartmentVigilance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dep = place?.department;

  const load = useCallback(async () => {
    if (!dep) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchVigilance(dep));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [dep]);

  useEffect(() => {
    load();
  }, [load]);

  const official = (
    <Pressable onPress={() => Linking.openURL('https://vigilance.meteofrance.fr')} style={[styles.link, { borderColor: t.accent }]}>
      <Text style={{ color: t.accent, fontWeight: '600' }}>Voir la carte officielle sur vigilance.meteofrance.fr</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={[styles.title, { color: t.text }]}>
        {place?.name ?? '—'}
        {dep ? ` (${dep})` : ''}
      </Text>

      {!dep ? (
        <Card>
          <Text style={{ color: t.text }}>Département inconnu pour ce lieu. Choisis une ville dans l’onglet « Villes ».</Text>
        </Card>
      ) : error === 'NO_KEY' ? (
        <Card title="Clé Météo-France requise">
          <Text style={{ color: t.text, lineHeight: 21 }}>
            Les vigilances viennent de l’API officielle de Météo-France. Crée une clé gratuite sur portail-api.meteofrance.fr
            (API « Données Publiques Vigilance »), puis ajoute-la dans le fichier .env du projet :{'\n\n'}
            EXPO_PUBLIC_METEOFRANCE_API_KEY=ta_cle
          </Text>
        </Card>
      ) : error ? (
        <Card>
          <Text style={{ color: '#E5484D' }}>{error}</Text>
        </Card>
      ) : !data ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
      ) : (
        data.map((p) => {
          const c = COLORS[p.maxColor] ?? COLORS[1];
          const active = p.phenomena.filter((ph) => ph.color > 1);
          return (
            <Card key={p.period} title={PERIOD_LABEL[p.period] ?? p.period}>
              <View style={[styles.badge, { backgroundColor: c.color }]}>
                <Text style={[styles.badgeText, { color: c.text }]}>Vigilance {c.label.toLowerCase()}</Text>
              </View>
              {active.length === 0 ? (
                <Text style={{ color: t.muted, marginTop: 10 }}>Pas de vigilance particulière.</Text>
              ) : (
                active.map((ph) => {
                  const info = PHENOMENA[ph.id] ?? { label: `Phénomène ${ph.id}`, icon: '⚠️' };
                  const col = COLORS[ph.color] ?? COLORS[1];
                  return (
                    <View key={ph.id} style={styles.row}>
                      <Text style={{ fontSize: 20 }}>{info.icon}</Text>
                      <Text style={{ color: t.text, flex: 1, fontSize: 16 }}>{info.label}</Text>
                      <View style={[styles.pill, { backgroundColor: col.color }]}>
                        <Text style={{ color: col.text, fontWeight: '600' }}>{col.label}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </Card>
          );
        })
      )}
      {official}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  pill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  link: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 4 },
});
