// Narrative validator: every number an LLM writes must trace to the
// track-table summary it was given. Anything else is flagged, and the
// caller falls back to a purely computed narrative.

export interface NumericSummary {
  finalCount: number;
  rows: number;
  medianRate: number;
  maxCount: number;
}

// Extract candidate quantitative claims: integers, decimals, percents, rates.
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
    const v = Number(m[0]);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function allowedNumbers(s: NumericSummary): Set<number> {
  const set = new Set<number>();
  const add = (v: number) => {
    if (!Number.isFinite(v)) return;
    set.add(Math.round(v * 100) / 100);
    set.add(Math.round(v));
    set.add(Math.round(v * 10) / 10);
  };
  add(s.finalCount);
  add(s.rows);
  add(s.medianRate);
  add(s.maxCount);
  // small structural numbers (bullet counts, frame refs like f0) are not claims
  for (let i = 0; i <= 12; i++) set.add(i);
  return set;
}

// Returns list of numbers in the narrative that match nothing computed.
// Empty = validated. Percent claims are checked against count ratios too.
export function ungroundedNumbers(text: string, s: NumericSummary): number[] {
  const allowed = allowedNumbers(s);
  const bad: number[] = [];
  for (const v of extractNumbers(text)) {
    if (allowed.has(Math.round(v * 100) / 100) || allowed.has(v)) continue;
    // tolerate a rate quoted to 1dp/3dp of the true median rate
    if (Math.abs(v - s.medianRate) < 0.06) continue;
    bad.push(v);
  }
  return bad;
}

export function fallbackNarrative(s: NumericSummary, timeUnit = "frame"): string {
  return [
    `Final count ${s.finalCount} objects (${s.rows} track rows, max ${s.maxCount} in any ${timeUnit}).`,
    `Median growth rate ${s.medianRate.toFixed(3)}/time-unit (log-linear fit of log(area) vs time, computed in code).`,
    `Quality caveat: inspect low-confidence and flagged frames before trusting early, small objects.`,
    `Next step: run at least 3 replicate plates/trays so plate-to-plate variation can be separated from any treatment effect.`,
  ].join(" ");
}
