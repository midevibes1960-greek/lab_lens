import { NextResponse } from "next/server";
import { countAtFrame, countsOverTime, fitRatePerUnit, median } from "@/lib/lablens";
import { metaStatus, sparkAnalysis } from "@/lib/meta";
import { NOT_FOUND_BODY, resolveTracks } from "@/lib/resolve";
import { fallbackNarrative, ungroundedNumbers, type NumericSummary } from "@/lib/validate";

// POST /api/agent/run { id, prompt? } — Muse Spark narrative over the
// experiment's OWN real track table, checked by the numeric validator.
// No saved analysis -> 404.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const r = await resolveTracks(id);
  if (!r) return NextResponse.json(NOT_FOUND_BODY, { status: 404 });

  const tracks = r.tracks;
  const last = tracks.length ? Math.max(...tracks.map((t) => t.frame)) : 0;
  const summary: NumericSummary = {
    finalCount: countAtFrame(tracks, last),
    rows: tracks.length,
    medianRate: median([...new Set(tracks.map((t) => t.track_id))].map((tid) => fitRatePerUnit(tracks.filter((t) => t.track_id === tid)))),
    maxCount: countsOverTime(tracks).reduce((m, c) => Math.max(m, c.count), 0),
  };
  const goal = (body.prompt as string | undefined) ?? r.analysis.prompt;
  const methods = `SAM 3.1 concept "${r.analysis.concept}" on ${r.analysis.framesSampled} sampled frames; boxes linked in code; time in seconds; areas ${r.analysis.pxPerMm ? "in mm² (calibrated)" : "in px (uncalibrated)"}.`;
  const fallback = fallbackNarrative(summary, "sampled frame (time in seconds)");
  const status = metaStatus();

  if (!status.configured) {
    return NextResponse.json({ ok: true, source: "local-fallback (MODEL_API_KEY not set)", model: "local", numbers: summary, validated: true, narrative: fallback });
  }
  try {
    const out = await sparkAnalysis({
      system:
        "You are LabLens analysis. Numbers come ONLY from the supplied track-table summary. Never invent counts, rates, or percentages. Write 4 short bullets: count, growth, quality caveat, one next step with sample-size reasoning. Quote numbers exactly as given.",
      user: `Experiment: ${r.analysis.title}\nGoal: ${goal}\nTrack summary: final n=${summary.finalCount} at f${last}, rows=${summary.rows}, max count=${summary.maxCount}, median rate=${summary.medianRate.toFixed(4)}/s.\nSeries: ${countsOverTime(tracks).map((s) => `f${s.frame}=${s.count}`).join(", ")}.\nMethods: ${methods}`,
    });
    const bad = ungroundedNumbers(out.content, summary);
    if (bad.length) {
      return NextResponse.json({
        ok: true,
        source: "validator-fallback (Spark narrative contained ungrounded numbers)",
        model: out.model,
        numbers: summary,
        validated: false,
        ungrounded: bad,
        rejectedNarrative: out.content,
        narrative: fallback,
      });
    }
    return NextResponse.json({ ok: true, source: "muse-spark-1.3", model: out.model, numbers: summary, validated: true, narrative: out.content });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      source: "local-fallback (spark call failed)",
      model: "local",
      numbers: summary,
      validated: true,
      narrative: fallback,
      error: e instanceof Error ? e.message : "spark failed",
    });
  }
}
