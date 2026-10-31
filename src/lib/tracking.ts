// Pure box-linking: turn per-frame SAM boxes into persistent tracks.
// No DOM / no fetch — unit-tested in tests/tracking.test.mjs.

export interface FrameBox {
  id: number; // SAM's per-frame id (unstable across frames — never trust it)
  frame: number; // sampled-frame index 0..N-1
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number; // source frame width px
  h: number; // source frame height px
  c?: number; // SAM confidence when provided
}

export interface LinkedPoint {
  track_id: number;
  frame: number;
  t_min: number;
  x: number; // centroid, 0..1 normalised
  y: number;
  area_px: number;
  area_mm2: number;
  solidity: number; // boxes carry no mask solidity — 0 = unknown
  confidence: number;
}

export function centroid(b: FrameBox) {
  return { cx: (b.x1 + b.x2) / 2 / b.w, cy: (b.y1 + b.y2) / 2 / b.h };
}

export function boxAreaPx(b: FrameBox): number {
  return Math.max(0, (b.x2 - b.x1) * (b.y2 - b.y1));
}

export function iou(a: FrameBox, b: FrameBox): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = boxAreaPx(a) + boxAreaPx(b) - inter;
  return union <= 0 ? 0 : inter / union;
}

// Greedy global matching between consecutive frames: all candidate pairs
// scored by IoU + centroid distance, best pairs claimed first. A pair is
// only linked when close enough — otherwise the box starts a new track.
// (Hungarian would be optimal; greedy is deterministic, dependency-free,
// and equivalent when objects are well separated between samples.)
export function linkFrames(
  frames: FrameBox[][],
  opts: { tMinOf: (frame: number) => number; pxPerMm: number; maxDist?: number }
): LinkedPoint[] {
  const maxDist = opts.maxDist ?? 0.08; // normalised centroid distance cap
  const tracks: LinkedPoint[] = [];
  let nextId = 1;
  let prev: { trackId: number; box: FrameBox }[] = [];

  const toPoint = (trackId: number, b: FrameBox): LinkedPoint => {
    const { cx, cy } = centroid(b);
    const areaPx = boxAreaPx(b);
    return {
      track_id: trackId,
      frame: b.frame,
      t_min: opts.tMinOf(b.frame),
      x: cx,
      y: cy,
      area_px: areaPx,
      area_mm2: opts.pxPerMm > 0 ? areaPx / (opts.pxPerMm * opts.pxPerMm) : 0,
      solidity: 0,
      confidence: typeof b.c === "number" && Number.isFinite(b.c) ? b.c : 0.5,
    };
  };

  for (const boxes of frames) {
    const candidates: { pi: number; bi: number; score: number }[] = [];
    for (let pi = 0; pi < prev.length; pi++) {
      for (let bi = 0; bi < boxes.length; bi++) {
        const a = centroid(prev[pi].box);
        const b = centroid(boxes[bi]);
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        if (d > maxDist) continue;
        candidates.push({ pi, bi, score: iou(prev[pi].box, boxes[bi]) - d });
      }
    }
    candidates.sort((x, y) => y.score - x.score);
    const usedPrev = new Set<number>();
    const usedBox = new Set<number>();
    const current: { trackId: number; box: FrameBox }[] = [];
    for (const cand of candidates) {
      if (usedPrev.has(cand.pi) || usedBox.has(cand.bi)) continue;
      usedPrev.add(cand.pi);
      usedBox.add(cand.bi);
      const trackId = prev[cand.pi].trackId;
      tracks.push(toPoint(trackId, boxes[cand.bi]));
      current.push({ trackId, box: boxes[cand.bi] });
    }
    for (let bi = 0; bi < boxes.length; bi++) {
      if (usedBox.has(bi)) continue;
      const trackId = nextId++;
      tracks.push(toPoint(trackId, boxes[bi]));
      current.push({ trackId, box: boxes[bi] });
    }
    prev = current;
  }
  return tracks.sort((a, b) => a.frame - b.frame || a.track_id - b.track_id);
}

export function countsFromTracks(tracks: LinkedPoint[]): { frame: number; t_min: number; count: number }[] {
  const frames = [...new Set(tracks.map((t) => t.frame))].sort((a, b) => a - b);
  return frames.map((f) => ({
    frame: f,
    t_min: tracks.find((t) => t.frame === f)?.t_min ?? f,
    count: tracks.filter((t) => t.frame === f).length,
  }));
}
