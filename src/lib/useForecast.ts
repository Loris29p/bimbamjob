// Récupère (et met en cache 10 min) les prévisions d'un lieu.
import { useCallback, useEffect, useState } from 'react';
import { fetchForecast, type Forecast } from './forecast';
import { placeKey, type Place } from './types';

const TTL = 10 * 60 * 1000;
const cache = new Map<string, Forecast>();
const inflight = new Map<string, Promise<Forecast>>();

function load(place: Place, force = false) {
  const key = placeKey(place);
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.fetchedAt < TTL) return Promise.resolve(cached);
  const running = inflight.get(key);
  if (running) return running;
  const p = fetchForecast(place)
    .then((f) => {
      cache.set(key, f);
      return f;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function useForecast(place: Place | null) {
  const key = place ? placeKey(place) : '';
  const [forecast, setForecast] = useState<Forecast | null>(() => (key ? cache.get(key) ?? null : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (force: boolean) => {
      if (!place) return;
      setLoading(true);
      setError(null);
      try {
        setForecast(await load(place, force));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Impossible de charger la météo');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    setForecast(key ? cache.get(key) ?? null : null);
    run(false);
  }, [key, run]);

  const refresh = useCallback(() => run(true), [run]);
  return { forecast, loading, error, refresh };
}
