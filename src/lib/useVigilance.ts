import { useEffect, useState } from 'react';
import { fetchVigilance, VIGILANCE_API_KEY, type DepartmentVigilance } from './vigilance';

const cache = new Map<string, { at: number; data: DepartmentVigilance[] }>();

/** Vigilances Météo-France du département (null tant que rien n'est chargé ou sans clé API). */
export function useVigilance(department?: string) {
  const [data, setData] = useState<DepartmentVigilance[] | null>(() => (department ? cache.get(department)?.data ?? null : null));
  useEffect(() => {
    if (!department || !VIGILANCE_API_KEY) return;
    const hit = cache.get(department);
    if (hit && Date.now() - hit.at < 15 * 60 * 1000) {
      setData(hit.data);
      return;
    }
    fetchVigilance(department)
      .then((d) => {
        cache.set(department, { at: Date.now(), data: d });
        setData(d);
      })
      .catch(() => setData(null));
  }, [department]);
  return data;
}
