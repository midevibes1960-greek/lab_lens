import { NextResponse } from "next/server";
import { loadAnalysis } from "@/lib/store";

// POST /api/check_quality { id } — measured per-frame quality of a REAL
// stored analysis. No stored analysis -> 404 (nothing is simulated).
export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({ id: "" }));
  const stored = typeof id === "string" ? await loadAnalysis(id) : null;
  if (!stored) {
    return NextResponse.json(
      { ok: false, error: "no real analysis saved for this id — run full-video analysis first" },
      { status: 404 }
    );
  }
  const bad = stored.quality.filter((x) => x.bad);
  return NextResponse.json({
    tool: "check_quality",
    kind: "stored",
    video: stored.id,
    frames: stored.quality.length,
    usablePct: stored.quality.length ? Math.round(((stored.quality.length - bad.length) / stored.quality.length) * 100) : 0,
    badFrames: bad.map((b) => ({ frame: b.frame, t_s: b.t_s, reason: b.reason })),
    verdict: bad.length === 0 ? "PASS — all sampled frames usable" : `WARN — ${bad.length} bad sampled frames`,
  });
}
