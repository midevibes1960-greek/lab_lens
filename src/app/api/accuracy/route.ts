import { NextResponse } from "next/server";
import { machineFramesFromTracks, scoreClip } from "@/lib/accuracy";
import { loadAnalysis, loadAnnotations } from "@/lib/store";

// GET /api/accuracy?id=... — human-vs-machine score for one clip.
// Nothing is estimated: missing annotators/analysis -> explicit status.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const [ann, analysis] = await Promise.all([loadAnnotations(id), loadAnalysis(id)]);
  const machine = analysis ? machineFramesFromTracks(analysis.tracks) : null;
  const score = scoreClip(id, ann, machine);
  return NextResponse.json({ ok: true, score, hasAnnotations: !!ann, hasMachineAnalysis: !!analysis });
}
