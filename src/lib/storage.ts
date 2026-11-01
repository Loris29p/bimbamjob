import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from './types';

const FAVORITES = 'favorites';
const SELECTED = 'selected';

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const loadFavorites = () => read<Place[]>(FAVORITES, []);
export const saveFavorites = (list: Place[]) => AsyncStorage.setItem(FAVORITES, JSON.stringify(list));
export const loadSelected = () => read<Place | null>(SELECTED, null);
export const saveSelected = (p: Place | null) =>
  p ? AsyncStorage.setItem(SELECTED, JSON.stringify(p)) : AsyncStorage.removeItem(SELECTED);
