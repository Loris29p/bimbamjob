import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useVigilance } from '../lib/useVigilance';
import { COLORS, PHENOMENA } from '../lib/vigilance';
import { Glass, Icon, T } from './ui';

export function VigilanceBanner({ department }: { department?: string }) {
  const data = useVigilance(department);
  const today = data?.[0];
  if (!today || today.maxColor < 2) return null;
  const color = COLORS[today.maxColor];
  const list = today.phenomena.filter((p) => p.color >= 2);
  return (
    <Pressable onPress={() => router.push({ pathname: '/vigilance', params: { department } })}>
      <Glass title="Vigilance Météo-France" icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning' }}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: color.color }]} />
          <T style={styles.text}>
            Vigilance {color.label.toLowerCase()} : {list.map((p) => PHENOMENA[p.id]?.label.toLowerCase() ?? p.id).join(', ')}
          </T>
          <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={14} />
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  text: { flex: 1, fontSize: 16, fontWeight: '600' },
});
