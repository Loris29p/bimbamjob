// Briques visuelles communes : carte translucide, icônes, textes blancs.
import { BlurView } from 'expo-blur';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Platform, StyleSheet, Text, View, type HostInstance, type StyleProp, type TextProps, type ViewStyle } from 'react-native';

/** Fourni par la page : défilement en cours, bord du haut (sous l'en-tête replié), contenu défilant. */
export type PinInfo = { scrollY: Animated.Value; top: number; content: RefObject<HostInstance | null> };
export const PinContext = createContext<PinInfo | null>(null);

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
  const pin = useContext(PinContext);
  const ref = useRef<HostInstance>(null);
  const [geo, setGeo] = useState<{ y: number; h: number } | null>(null);

  // Position de la carte dans le contenu défilant (pour coller son titre en haut)
  const measure = () => {
    if (!pin?.content.current || !ref.current) return;
    ref.current.measureLayout(
      pin.content.current,
      (_x: number, y: number, _w: number, h: number) => setGeo((g) => (g && Math.abs(g.y - y) < 1 && Math.abs(g.h - h) < 1 ? g : { y, h })),
      () => {},
    );
  };

  // Quand la carte atteint le bord du haut, son titre reste collé pendant que la carte se replie dessous.
  const HEADER = 44;
  const range = geo ? Math.max(0, geo.h - HEADER - 20) : 0;
  const start = geo && pin ? geo.y - pin.top : 0;
  const shift =
    pin && geo && title && range > 0
      ? pin.scrollY.interpolate({ inputRange: [start, start + range], outputRange: [0, range], extrapolate: 'clamp' })
      : null;
  const plate =
    pin && geo && title && range > 0 ? pin.scrollY.interpolate({ inputRange: [start, start + 12], outputRange: [0, 1], extrapolate: 'clamp' }) : null;

  return (
    <View ref={ref} onLayout={measure} style={[styles.card, style]}>
      {Platform.OS === 'ios' ? <BlurView intensity={60} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} /> : null}
      {title ? (
        <Animated.View style={[styles.headerWrap, shift ? { transform: [{ translateY: shift }] } : null]}>
          {plate ? (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: plate }]}>
              {Platform.OS === 'ios' ? <BlurView intensity={80} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} /> : null}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(40,52,70,0.35)' }]} />
            </Animated.View>
          ) : null}
          <View style={styles.header}>
            {icon ? <Icon name={icon} size={13} color={DIM} /> : null}
            <T style={styles.title}>{title.toUpperCase()}</T>
          </View>
        </Animated.View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.04)' : 'rgba(10,20,40,0.3)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerWrap: { marginHorizontal: -16, marginTop: -16, paddingHorizontal: 16, paddingTop: 16, marginBottom: 10, zIndex: 2, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.2)' },
  title: { color: DIM, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
});
