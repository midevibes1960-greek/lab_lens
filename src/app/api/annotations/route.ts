import { NextResponse } from "next/server";
import { loadAnnotations, saveAnnotations, safeId } from "@/lib/store";
import type { AnnotationSet, FrameAnnotation } from "@/lib/accuracy";

// Human ground-truth annotations for the accuracy study.
// GET /api/annotations?id=... · POST { id, annotator, frames: [{frame,t_s,points:[{x,y}]}] }
// Annotators are independent: each saves only their own set.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!safeId(id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  const ann = await loadAnnotations(id);
  return NextResponse.json({ ok: true, annotations: ann ?? { id, updatedAt: null, annotators: {} } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, annotator, frames } = body as { id?: string; annotator?: string; frames?: FrameAnnotation[] };
  if (typeof id !== "string" || !safeId(id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  if (typeof annotator !== "string" || !/^[A-Za-z0-9_-]{1,24}$/.test(annotator)) {
    return NextResponse.json({ ok: false, error: "annotator must be a short id (e.g. H1, H2)" }, { status: 400 });
  }
  if (!Array.isArray(frames) || frames.length === 0 || frames.length > 64) {
    return NextResponse.json({ ok: false, error: "frames must be 1..64 annotated frames" }, { status: 400 });
  }
  const clean: FrameAnnotation[] = [];
  for (const f of frames) {
    if (typeof f?.t_s !== "number" || !Array.isArray(f.points) || f.points.length > 2000) {
      return NextResponse.json({ ok: false, error: "bad frame annotation" }, { status: 400 });
    }
    clean.push({
      frame: Number(f.frame) || 0,
      t_s: f.t_s,
      points: f.points
        .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
        .map((p) => ({ x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) })),
    });
  }
  const existing = await loadAnnotations(id);
  const set: AnnotationSet = existing ?? { id, updatedAt: "", annotators: {} };
  set.annotators[annotator] = { frames: clean, updatedAt: new Date().toISOString() };
  set.updatedAt = new Date().toISOString();
  await saveAnnotations(set);
  return NextResponse.json({ ok: true, id, annotator, frames: clean.length, counts: clean.map((f) => f.points.length) });
}
