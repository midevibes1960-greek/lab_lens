import type { TrackPoint } from "./lablens";
import { loadAnalysis, type StoredAnalysis } from "./store";

export type Resolved = { kind: "stored"; analysis: StoredAnalysis; tracks: TrackPoint[] } | null;

// Single resolution rule for every read API: only a persisted REAL analysis
// counts. Anything else -> null (caller returns 404). No demo data exists.
export async function resolveTracks(id: string): Promise<Resolved> {
  const stored = await loadAnalysis(id);
  if (stored) return { kind: "stored", analysis: stored, tracks: stored.tracks };
  return null;
}

export const NOT_FOUND_BODY = {
  ok: false,
  error: "no real analysis saved for this id. Run full-video analysis in the lab first (POST /api/tracks).",
};
