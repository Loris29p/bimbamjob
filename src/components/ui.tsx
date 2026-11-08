// Briques visuelles communes : carte translucide, icônes, textes blancs.
import { BlurView } from 'expo-blur';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';

export const WHITE = '#FFFFFF';
export const DIM = 'rgba(255,255,255,0.62)';
export const LINE = 'rgba(255,255,255,0.22)';
export const RAIN_BLUE = '#8FD3FF';

export function T({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[{ color: WHITE }, style]} />;
}

type IconProps = { name: SymbolViewProps['name']; size?: number; color?: string; multicolor?: boolean; style?: StyleProp<ViewStyle> };

export function Icon({ name, size = 18, color = WHITE, multicolor, style }: IconProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      type={multicolor ? 'multicolor' : 'monochrome'}
      style={[{ width: size, height: size }, style]}
      fallback={<View style={{ width: size, height: size }} />}
    />
  );
}

export function Glass({ title, icon, children, style }: { title?: string; icon?: SymbolViewProps['name']; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      {Platform.OS === 'ios' ? <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      {title ? (
        <View style={styles.header}>
          {icon ? <Icon name={icon} size={13} color={DIM} /> : null}
          <T style={styles.title}>{title.toUpperCase()}</T>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(20,30,50,0.12)' : 'rgba(10,20,40,0.28)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { color: DIM, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.4 },
});
