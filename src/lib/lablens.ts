// LabLens core types + track-table math.
// There is NO simulator in this codebase anymore: every number shown for a
// real clip/upload is computed from SAM 3.1 boxes persisted per experiment
// (see src/lib/store.ts, src/lib/tracking.ts).

export type Subject = "colonies" | "seeds" | "mold";

export interface LabConfig {
  id: string;
  subject: Subject;
  title: string;
  prompt: string;
  plateDiameterMm: number;
}

export interface TrackPoint {
  track_id: number;
  frame: number;
  t_min: number; // video-seconds for real analyses
  x: number; // centroid 0..1
  y: number;
  area_px: number;
  area_mm2: number; // 0 when uncalibrated
  solidity: number; // 0 = unknown (box-only tracks)
  confidence: number;
}

export interface LabAlert {
  id: string;
  type: "contamination" | "merge" | "quality" | "growth";
  track_id: number | null;
  frame: number;
  t_min: number;
  title: string;
  detail: string;
  confidence: number;
  needsWonder: boolean;
}

export interface RealClip {
  id: string;
  title: string;
  src: string;
  duration: string;
  concept: string;
  prompt: string;
  credit: string;
  creditUrl: string;
  license: string;
  licenseUrl: string;
}

// Real, downloadable, license-clear time-lapses bundled in /public/real.
export const REAL_CLIPS: RealClip[] = [
  {
    id: "real-tomato",
    title: "Tomato seedlings germinating — 11 s",
    src: "/real/tomato-seedlings.webm",
    duration: "11 s · 1920×1080 · 1.4 MB",
    concept: "seedling",
    prompt: "count germinated seedlings and track each one's growth",
    credit: "Quasipodo via Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Germination_of_two_little_plants.webm",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
  },
  {
    id: "real-lettuce",
    title: "Lettuce emerging — 19 s",
    src: "/real/lettuce-emerging.webm",
    duration: "19 s · 1280×720 · 4.8 MB",
    concept: "seedling",
    prompt: "count seedlings and track emergence growth",
    credit: "Dwight Sipler via Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Timelapse_of_lettuce_emerging.webm",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
  },
  {
    id: "real-lentil",
    title: "Lentil microgreens overnight — 11 s",
    src: "/real/lentil-microgreens.webm",
    duration: "11 s · 1620×1080 · 2.2 MB",
    concept: "sprouts",
    prompt: "count sprouts and track each one's growth",
    credit: "Always Shooting via Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Lentil_microgreens_growth_time_lapse.webm",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
  },
];

export function getRealClip(id: string): RealClip | null {
  return REAL_CLIPS.find((c) => c.id === id) ?? null;
}

// ---------- track-table math (computed, never invented) ----------
export function countAtFrame(tracks: TrackPoint[], frame: number): number {
  return tracks.filter((t) => t.frame === frame).length;
}

export function countsOverTime(tracks: TrackPoint[]): { frame: number; t_min: number; count: number }[] {
  const frames = [...new Set(tracks.map((t) => t.frame))].sort((a, b) => a - b);
  return frames.map((f) => ({
    frame: f,
    t_min: tracks.find((t) => t.frame === f)?.t_min ?? f,
    count: countAtFrame(tracks, f),
  }));
}

// Slope of log(area) vs t_min in t_min's own unit (real analyses: per second).
// Uses area_mm2 when calibrated, otherwise area_px — slope is scale-invariant.
export function fitRatePerUnit(points: TrackPoint[]): number {
  if (points.length < 3) return 0;
  const xs = points.map((p) => p.t_min);
  const ys = points.map((p) => Math.log(Math.max(1e-9, p.area_mm2 > 0 ? p.area_mm2 : p.area_px)));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  return den === 0 ? 0 : num / den;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function toCSV(tracks: TrackPoint[]): string {
  const head = "track_id,frame,t_min,x,y,area_px,area_mm2,solidity,confidence";
  const rows = tracks.map((p) =>
    [p.track_id, p.frame, p.t_min, p.x.toFixed(4), p.y.toFixed(4), Math.round(p.area_px), p.area_mm2.toFixed(2), p.solidity.toFixed(2), p.confidence].join(",")
  );
  return [head, ...rows].join("\n");
}
