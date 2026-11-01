// État partagé : lieu affiché, favoris, prévisions en cache.
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchForecast, minutesUntilRain, type Forecast } from './forecast';
import { reverseGeocode } from './geocoding';
import { notifyRain } from './notifications';
import { loadFavorites, loadSelected, saveFavorites, saveSelected } from './storage';
import type { Place } from './types';

type Ctx = {
  place: Place | null;
  /** true quand le lieu vient du GPS */
  usingGps: boolean;
  forecast: Forecast | null;
  loading: boolean;
  error: string | null;
  favorites: Place[];
  selectPlace: (p: Place) => void;
  useMyLocation: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleFavorite: (p: Place) => void;
  isFavorite: (p: Place) => boolean;
};

const PlaceContext = createContext<Ctx | null>(null);

const samePlace = (a: Place, b: Place) =>
  Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;

const DEFAULT_PLACE: Place = { name: 'Paris', department: '75', latitude: 48.8566, longitude: 2.3522 };

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<Place | null>(null);
  const [usingGps, setUsingGps] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Place[]>([]);

  const load = useCallback(async (p: Place) => {
    setLoading(true);
    setError(null);
    try {
      const f = await fetchForecast(p);
      setForecast(f);
      const mins = minutesUntilRain(f.minutely);
      if (mins !== null && mins > 0) notifyRain(p.name, mins);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger la météo');
    } finally {
      setLoading(false);
    }
  }, []);

  const useMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Localisation refusée : choisis une ville dans l’onglet « Villes ».');
      return;
    }
    setLoading(true);
    try {
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const p = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setPlace(p);
      setUsingGps(true);
      saveSelected(null);
      await load(p);
    } catch {
      setError('Position introuvable');
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    (async () => {
      setFavorites(await loadFavorites());
      const saved = await loadSelected();
      if (saved) {
        setPlace(saved);
        load(saved);
        return;
      }
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted || perm.canAskAgain) {
        await useMyLocation();
      } else {
        setPlace(DEFAULT_PLACE);
        load(DEFAULT_PLACE);
      }
    })();
  }, [load, useMyLocation]);

  const selectPlace = useCallback(
    (p: Place) => {
      setPlace(p);
      setUsingGps(false);
      saveSelected(p);
      load(p);
    },
    [load],
  );

  const refresh = useCallback(async () => {
    if (place) await load(place);
  }, [place, load]);

  const toggleFavorite = useCallback((p: Place) => {
    setFavorites((list) => {
      const next = list.some((f) => samePlace(f, p)) ? list.filter((f) => !samePlace(f, p)) : [...list, p];
      saveFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((p: Place) => favorites.some((f) => samePlace(f, p)), [favorites]);

  const value = useMemo(
    () => ({ place, usingGps, forecast, loading, error, favorites, selectPlace, useMyLocation, refresh, toggleFavorite, isFavorite }),
    [place, usingGps, forecast, loading, error, favorites, selectPlace, useMyLocation, refresh, toggleFavorite, isFavorite],
  );

  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>;
}

export function usePlace() {
  const ctx = useContext(PlaceContext);
  if (!ctx) throw new Error('usePlace doit être utilisé dans <PlaceProvider>');
  return ctx;
}
