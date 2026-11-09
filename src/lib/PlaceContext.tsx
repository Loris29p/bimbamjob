// Lieux affichés : position GPS (si autorisée) puis villes enregistrées.
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { reverseGeocode } from './geocoding';
import { loadFavorites, saveFavorites } from './storage';
import { placeKey, type Place } from './types';

type Ctx = {
  places: Place[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  addPlace: (p: Place) => number;
  removePlace: (p: Place) => void;
  movePlace: (p: Place, dir: -1 | 1) => void;
  locate: () => Promise<void>;
  ready: boolean;
};

const PlaceContext = createContext<Ctx | null>(null);
const PARIS: Place = { name: 'Paris', department: '75', latitude: 48.8566, longitude: 2.3522 };

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [gps, setGps] = useState<Place | null>(null);
  const [saved, setSaved] = useState<Place[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);

  const locate = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const p = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setGps({ ...p, isGps: true });
    } catch {
      // pas de position : on affiche les villes enregistrées
    }
  }, []);

  useEffect(() => {
    (async () => {
      setSaved(await loadFavorites());
      await locate();
      setReady(true);
    })();
  }, [locate]);

  const places = useMemo(() => {
    const list = gps ? [gps, ...saved] : saved;
    return list.length ? list : [PARIS];
  }, [gps, saved]);

  const addPlace = useCallback(
    (p: Place) => {
      const existing = places.findIndex((x) => placeKey(x) === placeKey(p));
      if (existing >= 0) return existing;
      const next = [...saved, { ...p, isGps: false }];
      setSaved(next);
      saveFavorites(next);
      return (gps ? 1 : 0) + next.length - 1;
    },
    [places, saved, gps],
  );

  const removePlace = useCallback((p: Place) => {
    setSaved((list) => {
      const next = list.filter((x) => placeKey(x) !== placeKey(p));
      saveFavorites(next);
      return next;
    });
    setActiveIndex(0);
  }, []);

  const movePlace = useCallback((p: Place, dir: -1 | 1) => {
    setSaved((list) => {
      const i = list.findIndex((x) => placeKey(x) === placeKey(p));
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      saveFavorites(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ places, activeIndex: Math.min(activeIndex, places.length - 1), setActiveIndex, addPlace, removePlace, movePlace, locate, ready }),
    [places, activeIndex, addPlace, removePlace, movePlace, locate, ready],
  );
  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>;
}

export function usePlaces() {
  const ctx = useContext(PlaceContext);
  if (!ctx) throw new Error('usePlaces doit être utilisé dans <PlaceProvider>');
  return ctx;
}
