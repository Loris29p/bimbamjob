import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from './types';

const FAVORITES = 'favorites';

export async function loadFavorites(): Promise<Place[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES);
    return raw ? (JSON.parse(raw) as Place[]) : [];
  } catch {
    return [];
  }
}
export const saveFavorites = (list: Place[]) => AsyncStorage.setItem(FAVORITES, JSON.stringify(list));
