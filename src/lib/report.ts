import type { TrackPoint } from "./lablens";
import { countAtFrame, countsOverTime, fitRatePerUnit, median, toCSV } from "./lablens";
import type { StoredAnalysis } from "./store";

// Reports exist ONLY for real stored analyses (SAM boxes, time in seconds).
export function storedSummary(a: StoredAnalysis) {
  const tracks = a.tracks;
  const last = tracks.length ? Math.max(...tracks.map((t) => t.frame)) : 0;
  const ids = [...new Set(tracks.map((t) => t.track_id))];
  const areaCol = tracks.some((t) => t.area_mm2 > 0) ? "area_mm2" : "area_px";
  const rates = ids.map((id) => ({ id, r: fitRatePerUnit(tracks.filter((t) => t.track_id === id)) }));
  const counts = countsOverTime(tracks);
  return {
    last,
    finalCount: countAtFrame(tracks, last),
    rows: tracks.length,
    trackCount: ids.length,
    medianRate: median(rates.map((x) => x.r)),
    maxCount: counts.length ? Math.max(...counts.map((c) => c.count)) : 0,
    counts,
    rates,
    areaCol,
  };
}

export function buildStoredReportMarkdown(a: StoredAnalysis): string {
  const s = storedSummary(a);
  const areaLabel = s.areaCol === "area_mm2" ? "mm² (calibrated)" : "px (uncalibrated — set a reference width to get mm²)";
  const badQ = a.quality.filter((q) => q.bad);
  return `# LabLens report — ${a.title} (REAL analysis)

> Every number below is computed from the persisted track table (\`${s.rows}\` rows, ${s.trackCount} linked tracks). Source: SAM 3.1 boxes on ${a.framesSampled} sampled frames, linked in code. No training data used.

## Methods

Video frames were sampled in the browser, quality-checked per frame (sharpness, exposure, glare computed from pixels), then segmented zero-shot by SAM 3.1 (concept: "${a.concept}"; goal: "${a.prompt}"). Boxes were linked across sampled frames by IoU + centroid distance into persistent tracks. ${a.pxPerMm ? `Scale: ${a.plateDiameterMm} mm reference across the frame → ${a.pxPerMm.toFixed(2)} px/mm.` : "No scale calibration supplied — areas are in pixels."} Counts and per-track areas were computed from the track table in code; growth rates by log-linear fit of log(area) vs time (seconds). Solidity is 0 (unknown) — SAM boxes carry no mask solidity in this build. Accuracy against human counters is measured separately in the accuracy study (/study) and is not claimed here.

## Results

- Final count: **${s.finalCount}** (last sampled frame f${s.last}).
- Counts over time (frame:count): ${s.counts.map((c) => `f${c.frame}=${c.count}`).join(", ")}.
- Median growth rate: **${s.medianRate.toFixed(4)}/s** (log area vs seconds, area in ${areaLabel}).
- Quality: ${a.quality.length - badQ.length}/${a.quality.length} sampled frames usable${badQ.length ? `; flagged: ${badQ.map((q) => `f${q.frame} (${q.reason})`).join(", ")}` : ""}.
- Per-track rates (/s): ${s.rates.slice(0, 12).map((x) => `#${x.id} ${x.r.toFixed(4)}`).join(", ")}${s.rates.length > 12 ? ` (+${s.rates.length - 12} more)` : ""}.

## Files

- tracks CSV: \`${a.id}-tracks.csv\` (${s.rows} rows) via \`/api/report?id=${a.id}&format=csv\`
- notebook: \`${a.id}-report.ipynb\` via \`/api/report?id=${a.id}&format=ipynb\` (CSV embedded, runs standalone)
`;
}

export function buildStoredIpynb(a: StoredAnalysis) {
  const s = storedSummary(a);
  const csv = toCSV(a.tracks);
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: { kernelspec: { display_name: "Python 3", language: "python", name: "python3" } },
    cells: [
      { cell_type: "markdown", metadata: {}, source: `# LabLens notebook — ${a.title} (REAL)\n\nSAM 3.1 concept "${a.concept}" on ${a.framesSampled} sampled frames; boxes linked in code. Final count **${s.finalCount}**, ${s.rows} track rows.` },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: `import pandas as pd, numpy as np, io\ncsv_text = """${csv.replace(/"""/g, '\"\"\"')}"""\ndf = pd.read_csv(io.StringIO(csv_text))\nprint("rows:", len(df), "tracks:", df.track_id.nunique())\nfinal = df.frame.max()\nprint("final frame:", final, "count:", (df.frame==final).sum())\narea_col = "area_mm2" if (df.area_mm2 > 0).any() else "area_px"\nfor tid, g in list(df.groupby("track_id"))[:8]:\n    x = g.t_min.values; y = np.log(g[area_col].clip(lower=1e-9).values)\n    r = np.polyfit(x, y, 1)[0]\n    print(f"track #{tid}: {r:.4f}/s (n={len(g)})")`,
      },
      { cell_type: "markdown", metadata: {}, source: "## Tracks CSV (first 5 rows)\n\n```\n" + csv.split("\n").slice(0, 6).join("\n") + "\n```" },
    ],
  };
}

export type { TrackPoint };
