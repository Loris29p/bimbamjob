import { useColorScheme } from 'react-native';

const light = {
  bg: '#EEF3F8',
  card: '#FFFFFF',
  text: '#13212F',
  muted: '#5E6E7E',
  border: '#DCE3EA',
  accent: '#1F6FEB',
  rain: ['#E6EEF6', '#7FB3F0', '#2D7BE0', '#0B3F9A'],
};
const dark: typeof light = {
  bg: '#0B1520',
  card: '#13212F',
  text: '#EAF1F8',
  muted: '#93A4B5',
  border: '#22364A',
  accent: '#5AA2FF',
  rain: ['#1B2C3D', '#4D8FD9', '#3E86F0', '#9CC6FF'],
};

export type Theme = typeof light;
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
