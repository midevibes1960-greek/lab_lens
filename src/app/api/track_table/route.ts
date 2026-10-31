import { NextResponse } from "next/server";
import { countsOverTime } from "@/lib/lablens";
import { NOT_FOUND_BODY, resolveTracks } from "@/lib/resolve";

// GET /api/track_table?id=...&frame=2 — the persisted REAL track table.
// No saved analysis -> 404.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const r = await resolveTracks(id);
  if (!r) return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
  const frameParam = searchParams.get("frame");
  const data = frameParam ? r.tracks.filter((t) => t.frame === Number(frameParam)) : r.tracks;
  return NextResponse.json({
    source: "track_table",
    kind: "stored",
    model: "SAM 3.1 live boxes, linked in code (persisted)",
    meta: { id: r.analysis.id, concept: r.analysis.concept, plateDiameterMm: r.analysis.plateDiameterMm, pxPerMm: r.analysis.pxPerMm },
    counts: countsOverTime(r.tracks).slice(-5),
    rows: data.length,
    sample: data.slice(0, 5),
    note: "Every report number must match a row here. Validator rejects anything else.",
  });
}
