// Réglages des alertes « pluie dans l'heure » : feuille en verre, ajustée à son contenu,
// avec des tuiles à choisir (même langage visuel que les cartes de l'écran principal).
import type { SymbolViewProps } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DIM, Icon, Material, RAIN_BLUE, T } from '../components/ui';
import { tick } from '../lib/hig';
import { getAlertPrefs, onAlertPrefs, setAlertPrefs, type AlertPrefs } from '../lib/notifications';

type Tile<K> = { key: K; icon: SymbolViewProps['name']; title: string; note: string };

const SCOPES: Tile<'gps' | 'all'>[] = [
  { key: 'gps', icon: { ios: 'location.fill', android: 'near_me' }, title: 'Ma position', note: 'Là où tu es' },
  { key: 'all', icon: { ios: 'list.bullet', android: 'list' }, title: 'Toutes mes villes', note: 'Position + ta liste' },
];
const LEVELS: Tile<AlertPrefs['level']>[] = [
  { key: 'light', icon: { ios: 'cloud.drizzle.fill', android: 'grain' }, title: 'Dès la bruine', note: 'Quelques gouttes suffisent' },
  { key: 'rain', icon: { ios: 'cloud.heavyrain.fill', android: 'umbrella' }, title: 'Vraie pluie', note: 'Quand le parapluie sert' },
];

function Tiles<K extends string>({ label, items, value, onPick }: { label: string; items: Tile<K>[]; value: K; onPick: (k: K) => void }) {
  return (
    <>
      <T style={styles.label}>{label}</T>
      <View style={styles.tiles}>
        {items.map((it) => {
          const on = value === it.key;
          return (
            <Pressable
              key={it.key}
              onPress={() => {
                tick();
                onPick(it.key);
              }}
              style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { transform: [{ scale: 0.97 }] }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Material radius={18} />
              <View style={[styles.tileIcon, on && { backgroundColor: RAIN_BLUE }]}>
                <Icon name={it.icon} size={18} color={on ? '#0B1520' : '#fff'} />
              </View>
              <T style={styles.tileTitle}>{it.title}</T>
              <T style={styles.tileNote}>{it.note}</T>
            </Pressable>
          );
        })}
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
    <View style={[styles.screen, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Icon name={{ ios: 'bell.badge.fill', android: 'notifications_active' }} size={26} color="#0B1520" />
        </View>
        <T style={styles.title}>Alertes pluie</T>
        <T style={styles.subtitle}>Un rappel quand la pluie arrive dans l’heure, d’après le radar et Météo-France.</T>
      </View>

      <View style={styles.switchRow}>
        <Material radius={18} />
        <T style={styles.switchText}>{on ? 'Activées' : 'Désactivées'}</T>
        <Switch
          value={on}
          trackColor={{ true: RAIN_BLUE }}
          onValueChange={(v) => {
            tick();
            setAlertPrefs({ ...p, scope: v ? lastScope : 'off' });
          }}
        />
      </View>

      {on ? (
        <>
          <Tiles
            label="Pour"
            items={SCOPES}
            value={p.scope as 'gps' | 'all'}
            onPick={(k) => {
              setLastScope(k);
              setAlertPrefs({ ...p, scope: k });
            }}
          />
          <Tiles label="Prévenir" items={LEVELS} value={p.level} onPick={(k) => setAlertPrefs({ ...p, level: k })} />
          <T style={styles.foot}>Vérifiées à l’ouverture de l’app pour l’instant.</T>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 28 },
  hero: { alignItems: 'center', marginBottom: 20 },
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: RAIN_BLUE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, color: DIM, textAlign: 'center', marginTop: 6, paddingHorizontal: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 12 },
  switchText: { flex: 1, fontSize: 17, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: DIM, marginTop: 20, marginBottom: 8, marginLeft: 4 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 18, overflow: 'hidden', padding: 14, borderWidth: 2, borderColor: 'transparent' },
  tileOn: { borderColor: RAIN_BLUE },
  tileIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileTitle: { fontSize: 16, fontWeight: '600' },
  tileNote: { fontSize: 13, color: DIM, marginTop: 2 },
  foot: { fontSize: 13, color: DIM, textAlign: 'center', marginTop: 18 },
});
