import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";

// GET /api/video/<id> — streams uploaded bytes with real Range support
// (seeking in <video> + frame sampling depend on 206 responses).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^upload-[a-z0-9]+$/.test(id)) return NextResponse.json({ ok: false, error: "unknown video" }, { status: 404 });
  try {
    const metaRaw = await readFile(path.join(process.cwd(), "uploads", `${id}.json`), "utf8");
    const meta = JSON.parse(metaRaw) as { ext: string; type: string };
    const filePath = path.join(process.cwd(), "uploads", `${id}.${meta.ext}`);
    const { size } = await stat(filePath);
    const type = meta.type || "video/mp4";
    const range = req.headers.get("range");

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        const start = m[1] === "" ? 0 : Number(m[1]);
        const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
        if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < size) {
          const stream = createReadStream(filePath, { start, end });
          return new NextResponse(stream as unknown as BodyInit, {
            status: 206,
            headers: {
              "Content-Type": type,
              "Content-Length": String(end - start + 1),
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "private, max-age=3600",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = createReadStream(filePath);
    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "video not found (server restarts wipe /uploads on some hosts — re-upload)" }, { status: 404 });
  }
}
