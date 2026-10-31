import { NextResponse } from "next/server";
import { mkdir, writeFile, readFile } from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import path from "path";
import { metaStatus } from "@/lib/meta";

const UP = path.join(process.cwd(), "uploads");

async function ensure() {
  await mkdir(UP, { recursive: true });
}

// POST /api/upload — multipart form: file (video), prompt?, subject?
// Saves bytes to ./uploads (gitignored via .env* + add uploads/), returns id + player URL.
export async function POST(req: Request) {
  try {
    await ensure();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "no file field" }, { status: 400 });
    if (!file.type.startsWith("video")) return NextResponse.json({ ok: false, error: `not a video (${file.type})` }, { status: 400 });
    if (file.size > 200 * 1024 * 1024) return NextResponse.json({ ok: false, error: "over 200 MB" }, { status: 400 });

    const id = `upload-${Date.now().toString(36)}`;
    const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp4";
    // Stream to disk — never buffer a ≤200 MB upload in RAM.
    await pipeline(Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(path.join(UP, `${id}.${ext}`)));
    const prompt = String(form.get("prompt") ?? "count colonies on the plate and track each one's area");
    const subjectRaw = String(form.get("subject") ?? "colonies");
    const subject = ["colonies", "seeds", "mold"].includes(subjectRaw) ? subjectRaw : "colonies";
    const dishRaw = Number(form.get("plateDiameterMm"));
    const plateDiameterMm = Number.isFinite(dishRaw) && dishRaw >= 10 && dishRaw <= 1000 ? dishRaw : 90;
    await writeFile(
      path.join(UP, `${id}.json`),
      JSON.stringify({ id, filename: file.name, ext, size: file.size, type: file.type, prompt, subject, plateDiameterMm, createdAt: new Date().toISOString() })
    );
    return NextResponse.json({
      ok: true,
      id,
      url: `/api/video/${id}`,
      labUrl: `/lab/${id}`,
      size: file.size,
      prompt,
      sam: { ...metaStatus(), note: "Run SAM 3.1 from the viewer: first frame thumbnail -> POST /api/segment_track" },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "upload failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensure();
    const { readdir } = await import("fs/promises");
    const files = await readdir(UP).catch(() => [] as string[]);
    const metas = [];
    for (const f of files.filter((x) => x.endsWith(".json") && !x.endsWith(".tracks.json") && !x.endsWith(".corrections.json") && !x.endsWith(".annotations.json"))) {
      try {
        metas.push(JSON.parse(await readFile(path.join(UP, f), "utf8")));
      } catch { /* skip */ }
    }
    return NextResponse.json({ ok: true, uploads: metas });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "list failed" }, { status: 500 });
  }
}
