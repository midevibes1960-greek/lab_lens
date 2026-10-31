import { NextResponse } from "next/server";
import { loadCorrections, saveCorrections, safeId } from "@/lib/store";

// Review-queue corrections, persisted server-side per experiment.
// GET /api/corrections?id=... · POST { id, corrections: {trackId: verdict} }
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!safeId(id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  return NextResponse.json({ ok: true, corrections: await loadCorrections(id) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || !safeId(body.id) || typeof body.corrections !== "object" || body.corrections === null) {
    return NextResponse.json({ ok: false, error: "bad payload" }, { status: 400 });
  }
  const clean: Record<number, string> = {};
  for (const [k, v] of Object.entries(body.corrections as Record<string, unknown>)) {
    const n = Number(k);
    if (Number.isFinite(n) && typeof v === "string") clean[n] = v.slice(0, 80);
  }
  await saveCorrections(body.id, clean);
  return NextResponse.json({ ok: true, saved: Object.keys(clean).length });
}
