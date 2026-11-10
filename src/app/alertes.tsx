// Réglages des alertes « pluie dans l'heure » : écran clair façon Réglages iOS (au lieu d'un menu).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DIM, Icon, LINE, T } from '../components/ui';
import { tick } from '../lib/hig';
import { getAlertPrefs, onAlertPrefs, setAlertPrefs, type AlertPrefs } from '../lib/notifications';

type Choice<K> = { key: K; title: string; note: string };

const SCOPES: Choice<'gps' | 'all'>[] = [
  { key: 'gps', title: 'Ma position', note: 'Là où tu te trouves.' },
  { key: 'all', title: 'Toutes mes villes', note: 'Ta position et chaque ville de ta liste.' },
];
const LEVELS: Choice<AlertPrefs['level']>[] = [
  { key: 'light', title: 'Dès la bruine', note: 'Même quelques gouttes (à partir de 0,2 mm/h).' },
  { key: 'rain', title: 'Seulement la vraie pluie', note: 'Quand il faut vraiment un parapluie (à partir de 1 mm/h).' },
];

function Group<K extends string>({ label, items, value, onPick }: { label: string; items: Choice<K>[]; value: K; onPick: (k: K) => void }) {
  return (
    <>
      <T style={styles.groupLabel}>{label}</T>
      <View style={styles.group}>
        {items.map((it, i) => (
          <Pressable
            key={it.key}
            onPress={() => {
              tick();
              onPick(it.key);
            }}
            style={({ pressed }) => [styles.row, i > 0 && styles.sep, pressed && { opacity: 0.6 }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === it.key }}
          >
            <View style={{ flex: 1 }}>
              <T style={styles.rowTitle}>{it.title}</T>
              <T style={styles.rowNote}>{it.note}</T>
            </View>
            {value === it.key ? <Icon name={{ ios: 'checkmark', android: 'check' }} size={17} color="#0A84FF" /> : null}
          </Pressable>
        ))}
      </View>
    </>
  );
}

export default function Alertes() {
  const insets = useSafeAreaInsets();
  const [p, setP] = useState<AlertPrefs | null>(null);
  // dernière zone choisie, pour la retrouver quand on réactive
  const [lastScope, setLastScope] = useState<'gps' | 'all'>('gps');
  useEffect(() => {
    getAlertPrefs().then((v) => {
      setP(v);
      if (v.scope !== 'off') setLastScope(v.scope);
    });
    return onAlertPrefs(setP);
  }, []);
  if (!p) return null;
  const on = p.scope !== 'off';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
      <View style={styles.head}>
        <T style={styles.title}>Alertes pluie</T>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <T style={styles.done}>OK</T>
        </Pressable>
      </View>
      <T style={styles.intro}>Rainy te prévient quand la pluie arrive dans l’heure, d’après le radar et la prévision Météo-France.</T>

      <View style={[styles.group, styles.row]}>
        <T style={[styles.rowTitle, { flex: 1 }]}>Me prévenir quand il va pleuvoir</T>
        <Switch
          value={on}
          onValueChange={(v) => {
            tick();
            setAlertPrefs({ ...p, scope: v ? lastScope : 'off' });
          }}
        />
      </View>

      {on ? (
        <>
          <Group
            label="Pour quels lieux"
            items={SCOPES}
            value={p.scope as 'gps' | 'all'}
            onPick={(k) => {
              setLastScope(k);
              setAlertPrefs({ ...p, scope: k });
            }}
          />
          <Group label="À partir de quelle pluie" items={LEVELS} value={p.level} onPick={(k) => setAlertPrefs({ ...p, level: k })} />
          <T style={styles.foot}>
            Pour l’instant, la vérification se fait quand tu ouvres l’app. Les alertes app fermée arriveront avec une prochaine version.
          </T>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1520' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  done: { fontSize: 17, fontWeight: '600', color: '#0A84FF' },
  intro: { fontSize: 15, color: DIM, marginBottom: 20 },
  groupLabel: { fontSize: 13, color: DIM, textTransform: 'uppercase', marginTop: 24, marginBottom: 6, marginLeft: 16 },
  group: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, minHeight: 44 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  rowTitle: { fontSize: 17 },
  rowNote: { fontSize: 13, color: DIM, marginTop: 2 },
  foot: { fontSize: 13, color: DIM, marginTop: 12, marginHorizontal: 16 },
});
