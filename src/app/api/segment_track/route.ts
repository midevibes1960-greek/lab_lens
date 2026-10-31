import { NextResponse } from "next/server";
import { metaStatus, samSegmentFrame, sanitizeConcept } from "@/lib/meta";

// POST /api/segment_track { id, prompt?, concept?, imageDataUrl }
// Live SAM 3.1 on one frame (streaming, noun-phrase concept).
// Zero matches is a NORMAL result (concept absent), not an error.
// Without imageDataUrl there is nothing real to return -> 400.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt: string = body.prompt ?? body.concept ?? "colonies";
  const concept = sanitizeConcept(body.concept ?? prompt);
  const status = metaStatus();

  if (typeof body.imageDataUrl === "string" && body.imageDataUrl.startsWith("data:image")) {
    if (!status.configured) {
      return NextResponse.json({
        tool: "segment_track",
        source: "fallback",
        live: false,
        matches: 0,
        boxes: [],
        concept,
        error: "MODEL_API_KEY not set on server",
      });
    }
    try {
      const r = await samSegmentFrame({ imageDataUrl: body.imageDataUrl, prompt: concept });
      return NextResponse.json({
        tool: "segment_track",
        model: r.model,
        source: "live-sam-3.1",
        live: true,
        concept: r.concept,
        matches: r.matches,
        boxes: r.boxes,
        note:
          r.matches === 0
            ? "Zero matches — normal when the concept isn't visible in this frame. Try a clearer frame or a shorter noun phrase (e.g. “colonies”)."
            : `${r.matches} outline(s) on this frame. Counts for a full video need the whole clip, not one frame.`,
      });
    } catch (e) {
      return NextResponse.json({
        tool: "segment_track",
        source: "fallback",
        live: false,
        matches: 0,
        boxes: [],
        concept,
        error: e instanceof Error ? e.message : "sam failed",
      });
    }
  }

  return NextResponse.json(
    {
      tool: "segment_track",
      live: false,
      concept,
      error: "imageDataUrl is required: send one real frame (data:image/jpeg;base64,…) plus a noun-phrase concept. There is no simulated segmentation.",
    },
    { status: 400 }
  );
}
