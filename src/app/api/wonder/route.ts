import { NextResponse } from "next/server";
import { metaStatus, wonderAdjudicate } from "@/lib/meta";

// POST /api/wonder { trackId, frame, evidence } — second opinion on hard frames.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const status = metaStatus();
  const evidence = `track #${body.trackId ?? "?"} at f${body.frame ?? "?"}: ${body.evidence ?? "fast growth + low solidity vs plate median"}`;
  if (!status.configured) {
    return NextResponse.json({
      ok: true,
      source: "local-fallback",
      model: "local",
      verdict: "Likely contaminant — irregular margin + 3.1× growth vs median. Keep ID, quarantine from CFU count. (Set MODEL_API_KEY for a live muse-wonder-1.0 second opinion.)",
      bothRecorded: true,
    });
  }
  try {
    const r = await wonderAdjudicate({
      prompt: `Adjudicate this flagged lab track. Contamination or merge? ${body.prompt ?? ""}`,
      evidence,
    });
    return NextResponse.json({ ok: true, source: "muse-wonder-1.0", model: r.model, verdict: r.content, bothRecorded: true });
  } catch (e) {
    return NextResponse.json({ ok: true, source: "local-fallback", model: "local", verdict: "Unresolved — needs the next frame. Kept as low-confidence.", error: e instanceof Error ? e.message : "wonder failed" });
  }
}
