// Petit cache générique pour les données secondaires (qualité de l'air…).
import { useEffect, useState } from 'react';

const store = new Map<string, { at: number; value: unknown }>();

export function useCached<T>(key: string | null, loader: () => Promise<T>, ttlMs = 15 * 60 * 1000) {
  const [value, setValue] = useState<T | null>(() => (key ? ((store.get(key)?.value as T) ?? null) : null));
  useEffect(() => {
    if (!key) return;
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      setValue(hit.value as T);
      return;
    }
    let alive = true;
    loader()
      .then((v) => {
        store.set(key, { at: Date.now(), value: v });
        if (alive) setValue(v);
      })
      .catch(() => alive && setValue(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}
