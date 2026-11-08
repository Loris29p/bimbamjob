// Ambiance visuelle : dégradé de fond et symboles selon le temps qu'il fait.
import type { SymbolViewProps } from 'expo-symbols';

type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow';

export function skyOf(code: number): Sky {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain';
}

const BACKGROUNDS: Record<Sky, { day: [string, string, string]; night: [string, string, string] }> = {
  clear: { day: ['#1E6FD9', '#4C9BEA', '#8EC5F4'], night: ['#060B1F', '#14204A', '#2B3A6B'] },
  partly: { day: ['#3A78C9', '#6A9ED8', '#A7C6E8'], night: ['#0D1430', '#1F2B52', '#3A4670'] },
  cloudy: { day: ['#5B6E86', '#7D8EA3', '#A6B3C2'], night: ['#1A2030', '#2B3244', '#434B5E'] },
  fog: { day: ['#7C8794', '#9AA4AE', '#BFC6CC'], night: ['#22272E', '#363C45', '#4F565F'] },
  rain: { day: ['#3D4E63', '#566A82', '#7C8DA2'], night: ['#111824', '#1E2838', '#303C50'] },
  storm: { day: ['#262B3A', '#3C4256', '#5A6075'], night: ['#0B0D16', '#1A1D2B', '#2D3142'] },
  snow: { day: ['#6F8BAA', '#9DB3CA', '#D2DEEA'], night: ['#1A2638', '#2D3D55', '#4A5B75'] },
};

export function backgroundFor(code: number, isDay: boolean) {
  const b = BACKGROUNDS[skyOf(code)];
  return isDay ? b.day : b.night;
}

type SymbolName = SymbolViewProps['name'];

export function symbolFor(code: number, isDay = true): SymbolName {
  if (code === 0) return isDay ? { ios: 'sun.max.fill', android: 'clear_day' } : { ios: 'moon.stars.fill', android: 'bedtime' };
  if (code <= 2)
    return isDay
      ? { ios: 'cloud.sun.fill', android: 'partly_cloudy_day' }
      : { ios: 'cloud.moon.fill', android: 'partly_cloudy_night' };
  if (code === 3) return { ios: 'cloud.fill', android: 'cloud' };
  if (code === 45 || code === 48) return { ios: 'cloud.fog.fill', android: 'foggy' };
  if (code >= 51 && code <= 55) return { ios: 'cloud.drizzle.fill', android: 'rainy_light' };
  if (code === 56 || code === 57 || code === 66 || code === 67) return { ios: 'cloud.sleet.fill', android: 'weather_mix' };
  if (code === 65 || code === 82) return { ios: 'cloud.heavyrain.fill', android: 'rainy_heavy' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { ios: 'cloud.snow.fill', android: 'weather_snowy' };
  if (code >= 95) return { ios: 'cloud.bolt.rain.fill', android: 'thunderstorm' };
  if (code === 80 || code === 81) return isDay ? { ios: 'cloud.sun.rain.fill', android: 'rainy' } : { ios: 'cloud.moon.rain.fill', android: 'rainy' };
  return { ios: 'cloud.rain.fill', android: 'rainy' };
}

/** Couleur associée à une température (barres des prévisions sur plusieurs jours). */
export function tempColor(t: number) {
  const stops: [number, [number, number, number]][] = [
    [-5, [94, 92, 230]],
    [5, [90, 200, 250]],
    [12, [125, 214, 160]],
    [18, [255, 214, 10]],
    [25, [255, 159, 10]],
    [32, [255, 69, 58]],
  ];
  if (t <= stops[0][0]) return `rgb(${stops[0][1].join(',')})`;
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(',')})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(',')})`;
}
