// Briques visuelles communes : carte translucide, icônes, textes blancs.
import { BlurView, type BlurTint } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Platform, StyleSheet, Text, View, type HostInstance, type StyleProp, type TextProps, type ViewStyle } from 'react-native';

/** Fourni par la page : défilement en cours, bord du haut (sous l'en-tête replié), contenu défilant. */
/** `version` change chaque fois que le contenu change de taille : les cartes se re-mesurent alors. */
export type PinInfo = { scrollY: Animated.Value; top: number; content: RefObject<HostInstance | null>; version: number };
export const PinContext = createContext<PinInfo | null>(null);

const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();
const CARD_RADIUS = 22;

/**
 * Matériau de fond fourni par iOS : « Liquid Glass » sur iOS 26 et plus,
 * flou système classique sinon (et simple voile sur Android/web).
 */
// Teinte sombre posée sur le verre : sans elle, le verre iOS 26 est trop clair sur un ciel gris
// et les textes blancs / gris deviennent illisibles.
export const GLASS_TINT = 'rgba(28,38,56,0.42)';

// `radius` doit être donné au verre lui-même : s'il est seulement découpé par un parent arrondi,
// iOS le dessine rectangulaire et le reflet lumineux du bord (signature du Liquid Glass) est coupé.
// `glassTint={null}` : verre d'origine, sans teinte (boutons flottants, comme dans Météo).
export function Material({
  style,
  tint = 'systemUltraThinMaterialDark',
  glass = 'regular',
  interactive,
  glassTint = GLASS_TINT,
  radius,
}: {
  style?: StyleProp<ViewStyle>;
  tint?: BlurTint;
  glass?: 'regular' | 'clear';
  interactive?: boolean;
  glassTint?: string | null;
  radius?: number;
}) {
  const shape = radius !== undefined ? { borderRadius: radius } : null;
  if (LIQUID)
    return <GlassView style={[StyleSheet.absoluteFill, shape, style]} glassEffectStyle={glass} isInteractive={interactive} tintColor={glassTint ?? undefined} colorScheme="dark" />;
  if (Platform.OS === 'ios') return <BlurView intensity={60} tint={tint} style={[StyleSheet.absoluteFill, shape, style]} />;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,20,40,0.35)' }, style]} />;
}
export const liquidGlass = LIQUID;

export const WHITE = '#FFFFFF';
export const DIM = 'rgba(235,235,245,0.6)'; // secondaryLabel iOS
export const LINE = 'rgba(235,235,245,0.18)'; // separator iOS
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

  // Re-mesure quand une carte au-dessus change de taille (données arrivées après coup) :
  // onLayout ne se déclenche pas dans ce cas car la position relative au parent ne change pas.
  useEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.version]);

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
      <Material radius={CARD_RADIUS} />
      {title ? (
        <Animated.View style={[styles.headerWrap, shift ? { transform: [{ translateY: shift }] } : null]}>
          {plate ? (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: plate }]}>
              {/* même matériau que la carte : le titre collé ne forme pas de bandeau sombre */}
              <Material radius={CARD_RADIUS} />
            </Animated.View>
          ) : null}
          <View style={styles.header}>
            {icon ? <Icon name={icon} size={14} color={DIM} /> : null}
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
    borderRadius: CARD_RADIUS,
    padding: 16,
    marginBottom: 10,
    // le verre a désormais la même forme arrondie que la carte : la découpe ne coupe plus son bord lumineux
    overflow: 'hidden',
    // le verre iOS 26 dessine déjà son propre bord lumineux
    backgroundColor: LIQUID ? 'transparent' : Platform.OS === 'ios' ? 'rgba(255,255,255,0.04)' : 'transparent',
    borderWidth: LIQUID ? 0 : StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerWrap: { marginHorizontal: -16, marginTop: -16, paddingHorizontal: 16, paddingTop: 16, marginBottom: 8, zIndex: 2, overflow: 'hidden' },
  // titre en petites capitales, sans trait dessous (comme l'app Météo)
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8 },
  title: { color: DIM, fontSize: 14, fontWeight: '600', letterSpacing: 0 },
});
