// Fond vivant : dégradé selon le ciel + nuages qui dérivent, pluie, neige, étoiles, éclairs.
// Animations natives (useNativeDriver) pour rester fluide.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { backgroundFor, skyOf } from '../lib/sky';

const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

function useLoop(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [v, duration, delay]);
  return v;
}

function Cloud({ i, width, height, dark, count }: { i: number; width: number; height: number; dark: boolean; count: number }) {
  const w = width * (0.9 + rand(i) * 0.9);
  const top = height * (0.02 + rand(i + 7) * 0.45);
  const t = useLoop(70000 + rand(i + 3) * 60000, 0);
  // départ décalé pour que les nuages ne partent pas tous du même bord
  const offset = rand(i + 11);
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [-w + offset * (width + w), width + offset * (width + w)] });
  const op = (dark ? 0.14 : 0.3) * (0.6 + rand(i + 5) * 0.6) * Math.min(1, 0.5 + count / 8);
  return (
    <Animated.View style={{ position: 'absolute', top, left: -w, width: w, height: w * 0.42, transform: [{ translateX }], opacity: op }}>
      {/* nuage = plusieurs ellipses au bord très flou (dégradé radial) */}
      <Svg width={w} height={w * 0.42}>
        <Defs>
          <RadialGradient id={`p${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.55" stopColor="#fff" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w * 0.3} cy={w * 0.25} rx={w * 0.3} ry={w * 0.15} fill={`url(#p${i})`} />
        <Ellipse cx={w * 0.52} cy={w * 0.19} rx={w * 0.28} ry={w * 0.17} fill={`url(#p${i})`} />
        <Ellipse cx={w * 0.72} cy={w * 0.25} rx={w * 0.27} ry={w * 0.14} fill={`url(#p${i})`} />
      </Svg>
    </Animated.View>
  );
}

function Drop({ i, width, height, snow, heavy }: { i: number; width: number; height: number; snow: boolean; heavy: boolean }) {
  const dur = snow ? 7000 + rand(i) * 6000 : (heavy ? 650 : 900) + rand(i) * 500;
  const t = useLoop(dur, rand(i + 2) * dur);
  const x = rand(i + 4) * width;
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] });
  const translateX = snow ? t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 18 * (rand(i) - 0.5) * 2, 0] }) : t.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: snow ? 5 : 1.3,
        height: snow ? 5 : heavy ? 26 : 18,
        borderRadius: snow ? 3 : 1,
        backgroundColor: snow ? 'rgba(255,255,255,0.85)' : 'rgba(210,228,255,0.45)',
        transform: [{ translateY }, { translateX }, { rotate: snow ? '0deg' : '12deg' }],
      }}
    />
  );
}

function Star({ i, width, height }: { i: number; width: number; height: number }) {
  const t = useLoop(2500 + rand(i) * 4000, rand(i + 1) * 3000);
  const opacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 1, 0.25] });
  const size = 1 + rand(i + 2) * 1.8;
  return <Animated.View style={{ position: 'absolute', left: rand(i + 3) * width, top: rand(i + 4) * height * 0.6, width: size, height: size, borderRadius: size, backgroundColor: '#fff', opacity }} />;
}

function Lightning() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    const flash = () => {
      if (!alive) return;
      Animated.sequence([
        Animated.timing(v, { toValue: 0.55, duration: 60, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.1, duration: 80, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.4, duration: 50, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setTimeout(flash, 4000 + Math.random() * 9000));
    };
    const id = setTimeout(flash, 2500);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [v]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#E8EEFF', opacity: v }]} />;
}

export function SkyBackground({ code, isDay, cloudCover = 50, rate = 0 }: { code?: number; isDay?: boolean; cloudCover?: number; rate?: number }) {
  const { width, height } = useWindowDimensions();
  // Réglage iOS « Réduire les animations » : on garde le fond sans mouvement
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  const colors = code === undefined ? (['#2B5C9E', '#4D7FBF', '#7FA6D6'] as const) : backgroundFor(code, isDay !== false);
  const sky = code === undefined ? 'cloudy' : skyOf(code);
  const dark = isDay === false;
  const clouds = sky === 'clear' ? 0 : sky === 'partly' ? 3 : Math.max(4, Math.round(cloudCover / 14));
  const snow = sky === 'snow';
  const wet = sky === 'rain' || sky === 'storm' || snow;
  const drops = !wet ? 0 : snow ? 45 : rate >= 4 || sky === 'storm' ? 90 : 55;
  const stars = dark && (sky === 'clear' || sky === 'partly') ? 45 : 0;
  const ids = useMemo(
    () => (reduce ? { c: [], d: [], s: [] } : { c: [...Array(clouds).keys()], d: [...Array(drops).keys()], s: [...Array(stars).keys()] }),
    [clouds, drops, stars, reduce],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...colors]} style={StyleSheet.absoluteFill} />
      {ids.s.map((i) => (
        <Star key={`s${i}`} i={i} width={width} height={height} />
      ))}
      {ids.c.map((i) => (
        <Cloud key={`c${i}`} i={i} width={width} height={height} dark={dark} count={clouds} />
      ))}
      {ids.d.map((i) => (
        <Drop key={`d${i}`} i={i} width={width} height={height} snow={snow} heavy={sky === 'storm' || rate >= 4} />
      ))}
      {sky === 'storm' && !reduce ? <Lightning /> : null}
    </View>
  );
}

