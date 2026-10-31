import { NextResponse } from "next/server";
import { loadAnalysis, saveAnalysis, safeId, type StoredAnalysis } from "@/lib/store";

// POST /api/tracks — persist a REAL analysis produced in the browser
// (per-frame SAM boxes already linked into tracks client-side).
// Body: StoredAnalysis JSON. Tracks capped to keep files sane.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as StoredAnalysis | null;
  if (!body || typeof body.id !== "string" || !safeId(body.id)) {
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  }
  if (!Array.isArray(body.tracks) || body.tracks.length === 0) {
    return NextResponse.json({ ok: false, error: "no tracks — SAM found nothing on the sampled frames; nothing to save" }, { status: 400 });
  }
  if (body.tracks.length > 20000) {
    return NextResponse.json({ ok: false, error: "track table too large (cap 20000 rows)" }, { status: 413 });
  }
  const analysis: StoredAnalysis = {
    id: body.id,
    title: String(body.title ?? body.id).slice(0, 200),
    prompt: String(body.prompt ?? "").slice(0, 500),
    concept: String(body.concept ?? "").slice(0, 80),
    source: "live-sam-3.1",
    plateDiameterMm: Number(body.plateDiameterMm) || 0,
    pxPerMm: body.pxPerMm ?? null,
    videoDurationS: body.videoDurationS ?? null,
    framesSampled: Number(body.framesSampled) || 0,
    createdAt: new Date().toISOString(),
    tracks: body.tracks,
    quality: Array.isArray(body.quality) ? body.quality : [],
  };
  await saveAnalysis(analysis);
  return NextResponse.json({ ok: true, id: analysis.id, rows: analysis.tracks.length, tracks: new Set(analysis.tracks.map((t) => t.track_id)).size });
}

// GET /api/tracks?id=... — return the stored real analysis, if any.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const a = await loadAnalysis(id);
  if (!a) return NextResponse.json({ ok: false, error: "no stored analysis for this id" }, { status: 404 });
  return NextResponse.json({ ok: true, analysis: a });
}
