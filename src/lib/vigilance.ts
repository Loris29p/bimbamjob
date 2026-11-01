// Vigilances officielles de Météo-France (API « Données Publiques Vigilance »).
// Nécessite une clé gratuite à créer sur https://portail-api.meteofrance.fr
// puis à mettre dans le fichier .env : EXPO_PUBLIC_METEOFRANCE_API_KEY=...
const URL = 'https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours';

export const VIGILANCE_API_KEY = process.env.EXPO_PUBLIC_METEOFRANCE_API_KEY;

export const PHENOMENA: Record<string, { label: string; icon: string }> = {
  '1': { label: 'Vent violent', icon: '💨' },
  '2': { label: 'Pluie-inondation', icon: '🌧️' },
  '3': { label: 'Orages', icon: '⛈️' },
  '4': { label: 'Crues', icon: '🌊' },
  '5': { label: 'Neige-verglas', icon: '❄️' },
  '6': { label: 'Canicule', icon: '🥵' },
  '7': { label: 'Grand froid', icon: '🥶' },
  '8': { label: 'Avalanches', icon: '🏔️' },
  '9': { label: 'Vagues-submersion', icon: '🌊' },
};

export const COLORS: Record<number, { label: string; color: string; text: string }> = {
  1: { label: 'Vert', color: '#2E9E4F', text: '#fff' },
  2: { label: 'Jaune', color: '#F5D312', text: '#222' },
  3: { label: 'Orange', color: '#F28C1A', text: '#fff' },
  4: { label: 'Rouge', color: '#D7261E', text: '#fff' },
};

export type DepartmentVigilance = {
  period: 'J' | 'J1' | string;
  maxColor: number;
  phenomena: { id: string; color: number }[];
};

export async function fetchVigilance(department: string): Promise<DepartmentVigilance[]> {
  if (!VIGILANCE_API_KEY) throw new Error('NO_KEY');
  const res = await fetch(URL, { headers: { apikey: VIGILANCE_API_KEY, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Météo-France a répondu ${res.status}`);
  const json = await res.json();
  const periods: any[] = json?.product?.periods ?? [];
  const dep = department.padStart(2, '0');
  // Les départements côtiers ont un domaine « littoral » séparé (ex. 2910) pour vagues-submersion.
  const domainIds = [dep, `${dep}10`];

  return periods.map((p) => {
    const domains: any[] = (p?.timelaps?.domain_ids ?? []).filter((d: any) => domainIds.includes(String(d.domain_id)));
    const phenomena = new Map<string, number>();
    for (const d of domains) {
      for (const item of d.phenomenon_items ?? []) {
        const id = String(item.phenomenon_id);
        const color = Number(item.phenomenon_max_color_id ?? 1);
        phenomena.set(id, Math.max(color, phenomena.get(id) ?? 1));
      }
    }
    const list = [...phenomena.entries()].map(([id, color]) => ({ id, color })).sort((a, b) => b.color - a.color);
    return {
      period: String(p.echeance ?? ''),
      maxColor: Math.max(1, ...domains.map((d) => Number(d.max_color_id ?? 1))),
      phenomena: list,
    };
  });
}
