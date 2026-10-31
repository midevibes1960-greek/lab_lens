// Accuracy scoring: human annotations vs machine track table.
// Pure + unit-tested (tests/accuracy.test.mjs). No invented numbers:
// every function returns null when its inputs don't exist.

export interface Pt {
  x: number;
  y: number;
}

export interface FrameAnnotation {
  frame: number;
  t_s: number;
  points: Pt[];
}

export interface AnnotatorData {
  frames: FrameAnnotation[];
  updatedAt?: string;
}

export interface AnnotationSet {
  id: string;
  updatedAt: string;
  annotators: Record<string, AnnotatorData>;
}

export interface MachineFrame {
  frame: number;
  t_min: number; // seconds for real analyses
  points: Pt[];
}

// Greedy global point matching: nearest pairs first, distance-capped.
export function matchPoints(human: Pt[], machine: Pt[], maxDist = 0.08) {
  const pairs: { h: number; m: number; d: number }[] = [];
  for (let h = 0; h < human.length; h++) {
    for (let m = 0; m < machine.length; m++) {
      const d = Math.hypot(human[h].x - machine[m].x, human[h].y - machine[m].y);
      if (d <= maxDist) pairs.push({ h, m, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedH = new Set<number>();
  const usedM = new Set<number>();
  let tp = 0;
  for (const p of pairs) {
    if (usedH.has(p.h) || usedM.has(p.m)) continue;
    usedH.add(p.h);
    usedM.add(p.m);
    tp++;
  }
  const fp = machine.length - tp;
  const fn = human.length - tp;
  return {
    tp,
    fp,
    fn,
    precision: tp + fp === 0 ? null : tp / (tp + fp),
    recall: tp + fn === 0 ? null : tp / (tp + fn),
    f1: tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn),
  };
}

export function finalFrame(a: AnnotatorData | undefined): FrameAnnotation | null {
  if (!a || !a.frames.length) return null;
  return a.frames.reduce((best, f) => (f.t_s > best.t_s ? f : best), a.frames[0]);
}

export interface ClipScore {
  id: string;
  // human side
  humanCounts: Record<string, number>; // annotator -> final-frame count
  humanMean: number | null;
  humanAgreement: number | null; // |H1-H2| / mean, null unless 2 annotators
  // machine side
  machineFinalCount: number | null;
  countMape: number | null; // |machine - humanMean| / humanMean (final frame)
  insideHumanSpread: boolean | null;
  // detection quality at final frame (points vs track centroids)
  detection: Record<string, ReturnType<typeof matchPoints>> | null;
  meanF1: number | null;
  // per-frame count error across all annotated frames (matched by time)
  perFrameMape: number | null;
  framesCompared: number;
  status: "scored" | "needs-2-annotators" | "needs-machine-analysis" | "needs-annotations";
}

export function scoreClip(id: string, ann: AnnotationSet | null, machine: MachineFrame[] | null): ClipScore {
  const annotators = ann ? Object.keys(ann.annotators).filter((k) => (ann.annotators[k]?.frames.length ?? 0) > 0) : [];
  const humanCounts: Record<string, number> = {};
  for (const k of annotators) {
    const ff = finalFrame(ann!.annotators[k]);
    if (ff) humanCounts[k] = ff.points.length;
  }
  const names = Object.keys(humanCounts);
  const humanMean = names.length ? names.reduce((s, k) => s + humanCounts[k], 0) / names.length : null;
  const humanAgreement =
    names.length >= 2 && humanMean && humanMean > 0 ? Math.abs(humanCounts[names[0]] - humanCounts[names[1]]) / humanMean : null;

  if (!machine || !machine.length) {
    return {
      id, humanCounts, humanMean, humanAgreement,
      machineFinalCount: null, countMape: null, insideHumanSpread: null,
      detection: null, meanF1: null, perFrameMape: null, framesCompared: 0,
      status: names.length ? "needs-machine-analysis" : "needs-annotations",
    };
  }
  const machineFinal = machine.reduce((best, f) => (f.t_min > best.t_min ? f : best), machine[0]);
  const machineFinalCount = machineFinal.points.length;

  if (names.length < 2 || humanMean === null) {
    return {
      id, humanCounts, humanMean, humanAgreement,
      machineFinalCount, countMape: null, insideHumanSpread: null,
      detection: null, meanF1: null, perFrameMape: null, framesCompared: 0,
      status: "needs-2-annotators",
    };
  }

  const countMape = humanMean > 0 ? Math.abs(machineFinalCount - humanMean) / humanMean : null;
  const lo = Math.min(...names.map((k) => humanCounts[k]));
  const hi = Math.max(...names.map((k) => humanCounts[k]));
  const insideHumanSpread = machineFinalCount >= lo && machineFinalCount <= hi;

  const detection: Record<string, ReturnType<typeof matchPoints>> = {};
  for (const k of names) {
    const ff = finalFrame(ann!.annotators[k])!;
    detection[k] = matchPoints(ff.points, machineFinal.points);
  }
  const meanF1 = names.reduce((s, k) => s + (detection[k].f1 ?? 0), 0) / names.length;

  // per-frame: nearest machine frame within 2 s of each annotated frame
  let errSum = 0;
  let compared = 0;
  for (const k of names) {
    for (const f of ann!.annotators[k].frames) {
      let best: MachineFrame | null = null;
      let bestD = Infinity;
      for (const mf of machine) {
        const d = Math.abs(mf.t_min - f.t_s);
        if (d < bestD) { bestD = d; best = mf; }
      }
      if (best && bestD <= 2 && f.points.length > 0) {
        errSum += Math.abs(best.points.length - f.points.length) / f.points.length;
        compared++;
      }
    }
  }

  return {
    id, humanCounts, humanMean, humanAgreement,
    machineFinalCount, countMape, insideHumanSpread,
    detection, meanF1,
    perFrameMape: compared ? errSum / compared : null,
    framesCompared: compared,
    status: "scored",
  };
}

export function machineFramesFromTracks(tracks: { frame: number; t_min: number; x: number; y: number }[]): MachineFrame[] {
  const byFrame = new Map<number, MachineFrame>();
  for (const t of tracks) {
    if (!byFrame.has(t.frame)) byFrame.set(t.frame, { frame: t.frame, t_min: t.t_min, points: [] });
    byFrame.get(t.frame)!.points.push({ x: t.x, y: t.y });
  }
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
}
