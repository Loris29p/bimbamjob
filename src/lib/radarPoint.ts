// Le radar À TA POSITION : ce qu'il voit maintenant et ce qui arrive dans l'heure et demie.
// On lit les images RainViewer (mosaïque incluant les radars Météo-France) autour du lieu,
// on mesure le déplacement de la pluie entre l'image d'il y a 30 min et la dernière,
// puis on regarde « en amont » : la pluie qui sera sur toi dans m minutes est aujourd'hui
// à l'endroit d'où vient le vent de pluie. Le même principe que le radar prolongé de la carte,
// mais calculé directement sur le téléphone (décodage PNG en JavaScript, sans WebView).
import { decode } from 'fast-png';
import { RV_RAIN, RV_SNOW } from './rainviewerColors';

const Z = 7; // niveau le plus fin fourni par RainViewer (~0,8 km par pixel en France)
const TILE = 256;

export type RadarSample = { t: number; mmh: number; snow: boolean };
export type RadarPoint = {
  /** heure de la dernière image radar (unix, s) */
  frameTime: number;
  /** pluie au-dessus du lieu, de maintenant à +90 min, toutes les 5 min */
  series: RadarSample[];
  /** vitesse (km/h) et direction d'où arrive la pluie (degrés, 0 = nord), si mesurées */
  motion: { kmh: number; fromDeg: number } | null;
};

// ---- Couleur RainViewer → mm/h (et neige) ----
type Entry = { r: number; g: number; b: number; a: number; mmh: number; snow: boolean };
const TABLE: Entry[] = [];
function addTable(hex: string, snow: boolean) {
  for (let i = 0; i < hex.length; i += 8) {
    const [r, g, b, a] = [0, 2, 4, 6].map((k) => parseInt(hex.substr(i + k, 2), 16));
    if (!a) continue;
    const z = Math.pow(10, (i / 8 - 10) / 10); // dBZ → Z
    const f = a / 255;
    // pluie : Z = 200·R^1,6 (Marshall-Palmer) ; neige : Z = 2000·S² (équivalent en eau)
    TABLE.push({ r: r * f, g: g * f, b: b * f, a, snow, mmh: snow ? Math.sqrt(z / 2000) : Math.pow(z / 200, 1 / 1.6) });
  }
}
addTable(RV_RAIN, false);
addTable(RV_SNOW, true);

const lut = new Map<number, number>(); // rgba → mm/h (négatif = neige)
function valueOf(r: number, g: number, b: number, a: number) {
  if (!a) return 0;
  const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
  const hit = lut.get(key);
  if (hit !== undefined) return hit;
  const f = a / 255;
  let best: Entry | null = null;
  let bd = Infinity;
  for (const e of TABLE) {
    const d = (e.r - r * f) ** 2 + (e.g - g * f) ** 2 + (e.b - b * f) ** 2 + (e.a - a) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  const v = best ? (best.snow ? -best.mmh : best.mmh) : 0;
  lut.set(key, v);
  return v;
}

// ---- Champ radar 3 × 3 tuiles autour du lieu ----
type Field = { v: Float32Array; w: number; x0: number; y0: number; t: number };

async function tile(url: string): Promise<Float32Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const img = decode(new Uint8Array(await res.arrayBuffer()));
    const ch = img.channels;
    const out = new Float32Array(TILE * TILE);
    if (img.width !== TILE || ch < 4) return out;
    const d = img.data;
    for (let i = 0, j = 0; j < out.length; i += ch, j++) if (d[i + 3]) out[j] = valueOf(d[i], d[i + 1], d[i + 2], d[i + 3]);
    return out;
  } catch {
    return null;
  }
}

async function field(host: string, path: string, t: number, tx: number, ty: number): Promise<Field | null> {
  const w = TILE * 3;
  const v = new Float32Array(w * w);
  const parts = await Promise.all(
    [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => tile(`${host}${path}/${TILE}/${Z}/${tx + dx}/${ty + dy}/2/1_1.png`).then((a) => ({ a, dx, dy })))),
  );
  if (parts.every((p) => !p.a)) return null;
  for (const { a, dx, dy } of parts) {
    if (!a) continue;
    const ox = (dx + 1) * TILE;
    const oy = (dy + 1) * TILE;
    for (let y = 0; y < TILE; y++) v.set(a.subarray(y * TILE, y * TILE + TILE), (oy + y) * w + ox);
  }
  return { v, w, x0: (tx - 1) * TILE, y0: (ty - 1) * TILE, t };
}

const abs = (x: number) => (x < 0 ? -x : x);

/** Déplacement (pixels) qui fait le mieux coïncider A avec B, autour du point (cx, cy). */
function motion(A: Field, B: Field, cx: number, cy: number): { dx: number; dy: number } | null {
  const S = 4; // on compare sur une grille réduite (1 point sur 4)
  const R = 16; // jusqu'à 64 px ≈ 50 km en 30 min (~100 km/h)
  const H = 24; // fenêtre de ±96 px autour du lieu
  let echoes = 0;
  for (let y = -H; y <= H; y++) for (let x = -H; x <= H; x++) if (abs(B.v[(cy + y * S) * B.w + cx + x * S]) > 0.2) echoes++;
  if (echoes < 30) return null; // trop peu de pluie pour mesurer un mouvement
  let best = Infinity;
  let bx = 0;
  let by = 0;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      let s = 0;
      let n = 0;
      for (let y = -H + R; y <= H - R; y += 2)
        for (let x = -H + R; x <= H - R; x += 2) {
          const p = abs(A.v[(cy + (y - dy) * S) * A.w + cx + (x - dx) * S]);
          const q = abs(B.v[(cy + y * S) * B.w + cx + x * S]);
          if (p || q) {
            s += abs(p - q);
            n++;
          }
        }
      if (!n) continue;
      const score = s / n + 0.02 * (dx * dx + dy * dy); // légère préférence pour les petits déplacements
      if (score < best) {
        best = score;
        bx = dx;
        by = dy;
      }
    }
  return { dx: bx * S, dy: by * S };
}

/** Moyenne sur 3 × 3 pixels (~2,5 km) : mm/h et part de neige. */
function sample(F: Field, x: number, y: number) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 1 || iy < 1 || ix >= F.w - 1 || iy >= F.w - 1) return null;
  let sum = 0;
  let snow = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const v = F.v[(iy + j) * F.w + ix + i];
      sum += abs(v);
      if (v < 0) snow++;
    }
  return { mmh: sum / 9, snow: snow >= 3 };
}

export async function fetchRadarPoint(lat: number, lon: number): Promise<RadarPoint | null> {
  const maps = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
  const past: { time: number; path: string }[] = maps?.radar?.past ?? [];
  if (past.length < 1) return null;
  const last = past[past.length - 1];
  const prev = past.length >= 4 ? past[past.length - 4] : past[0];

  // position du lieu en pixels « monde » au niveau Z
  const n = Math.pow(2, Z);
  const r = (lat * Math.PI) / 180;
  const gx = ((lon + 180) / 360) * n * TILE;
  const gy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * TILE;
  const tx = Math.floor(gx / TILE);
  const ty = Math.floor(gy / TILE);

  const [B, A] = await Promise.all([field(maps.host, last.path, last.time, tx, ty), prev !== last ? field(maps.host, prev.path, prev.time, tx, ty) : null]);
  if (!B) return null;
  const cx = Math.round(gx - B.x0);
  const cy = Math.round(gy - B.y0);

  const mv = A ? motion(A, B, cx, cy) : null;
  const dt = Math.max(60, B.t - (A?.t ?? B.t));
  const vx = mv ? mv.dx / dt : 0; // pixels par seconde
  const vy = mv ? mv.dy / dt : 0;
  const kmPerPx = (40075.016 * Math.cos(r)) / (n * TILE);

  const now = Date.now() / 1000;
  const series: RadarSample[] = [];
  for (let m = 0; m <= 90; m += 5) {
    const t = now + m * 60;
    const lead = t - B.t;
    // Sans mouvement mesurable, on ne prolonge pas au-delà de 30 min (la pluie a pu bouger).
    if (!mv && lead > 30 * 60) break;
    const s = sample(B, cx - vx * lead, cy - vy * lead);
    if (!s) break; // la pluie viendrait d'au-delà de la zone lue
    series.push({ t, ...s });
  }
  const speed = Math.hypot(vx, vy) * 3600 * kmPerPx;
  return {
    frameTime: B.t,
    series,
    motion: mv && speed > 3 ? { kmh: speed, fromDeg: ((Math.atan2(-vx, vy) * 180) / Math.PI + 360) % 360 } : null,
  };
}
