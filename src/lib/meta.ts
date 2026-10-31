// Server-only Meta Model API client. Key never leaves the server.

const BASE = process.env.META_MODEL_BASE ?? "https://api.meta.ai/v1";
const SPARK = process.env.META_SPARK_MODEL ?? "muse-spark-1.3";
const WONDER = process.env.META_WONDER_MODEL ?? "muse-wonder-1.0";
const SAM = process.env.META_SAM_MODEL ?? "sam-3.1";

export function metaStatus() {
  const key = process.env.MODEL_API_KEY ?? "";
  return {
    configured: key.length > 8,
    base: BASE,
    spark: SPARK,
    wonder: WONDER,
    sam: SAM,
  };
}

async function postJSON(path: string, body: unknown, timeoutMs = 30000) {
  const key = process.env.MODEL_API_KEY ?? "";
  if (!key) throw new Error("MODEL_API_KEY not configured");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 4000) };
    }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function extractText(j: unknown): string {
  if (!j || typeof j !== "object") return "";
  const o = j as Record<string, unknown>;
  const choices = o.choices as Array<Record<string, unknown>> | undefined;
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
  const c = msg?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((b) => {
        if (!b || typeof b !== "object") return "";
        const bb = b as Record<string, unknown>;
        if (typeof bb.text === "string") return bb.text;
        const t = bb.text as Record<string, unknown> | undefined;
        if (t && typeof t.value === "string") return t.value;
        return "";
      })
      .join("")
      .trim();
  }
  // Responses-API shape: { output: [{ content: [{ text / output_text }] }] }
  const out = o.output as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(out)) {
    return out
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .map((b) => {
        const bb = b as Record<string, unknown>;
        if (typeof bb.output_text === "string") return bb.output_text;
        if (typeof bb.text === "string") return bb.text;
        return "";
      })
      .join("")
      .trim();
  }
  if (typeof o.output_text === "string") return o.output_text;
  return "";
}

// Muse Spark: analysis + narrative. OpenAI-compatible chat completions.
export async function sparkAnalysis(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}) {
  const r = await postJSON("/chat/completions", {
    model: SPARK,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    max_completion_tokens: opts.maxTokens ?? 16384,
  });
  if (!r.ok) throw new Error(`spark ${r.status}`);
  const content = extractText(r.json);
  if (!content) throw new Error(`spark empty response (keys: ${Object.keys((r.json ?? {}) as object).join(",")})`);
  return { model: SPARK, content };
}

// Muse Wonder: visual adjudication (text + evidence summary; image via responses API when available)
export async function wonderAdjudicate(opts: { prompt: string; evidence: string }) {
  const r = await postJSON("/chat/completions", {
    model: WONDER,
    messages: [
      {
        role: "system",
        content:
          "You are a careful microscopy second opinion. Judge only what the evidence supports. If ambiguous, say so and ask for the specific frame that would resolve it. Never invent counts.",
      },
      { role: "user", content: `${opts.prompt}\n\nEvidence:\n${opts.evidence}` },
    ],
    max_completion_tokens: 8000,
  });
  if (!r.ok) throw new Error(`wonder ${r.status}`);
  const content = extractText(r.json);
  if (!content) throw new Error(`wonder empty response (keys: ${Object.keys((r.json ?? {}) as object).join(",")})`);
  return { model: WONDER, content };
}

// SAM 3.1: text-prompt segmentation over Responses API (streaming, per docs).
// Prompt MUST be a short noun phrase naming one concept ("bacterial colonies"),
// never a command sentence. Empty output_text = zero matches = normal, not error.
export interface SamBox {
  id: number;
  frame: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  c?: number;
}

export function sanitizeConcept(input: string): string {
  const s = (input ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  if (!s) return "colonies";
  // strip command wrappers ("count X", "track X", "segment X", "flag ...")
  const m = s
    .replace(/^(please\s+)?(count|track|segment|detect|find|flag|watch|measure|outline|number)\s+(the\s+|each\s+|every\s+|all\s+)*/g, "")
    .replace(/\s+(on the plate|on the dish|in the video|in the frame|and.*|with.*|flag.*|track.*)$/g, "")
    .trim();
  const short = (m || s).split(/[,.]/)[0].trim().slice(0, 48);
  return short || "colonies";
}

export function parseSamBoxes(text: string): SamBox[] {
  const boxes: SamBox[] = [];
  // Frame segments start with <Nf> and contain <|box;..|><|mask;..|> records,
  // so a segment ends at the NEXT <Mf> marker — never at the first "<".
  const markers: { frame: number; start: number; end: number }[] = [];
  const frameRe = /<(\d+)f>/g;
  let fm: RegExpExecArray | null;
  while ((fm = frameRe.exec(text)) !== null) {
    markers.push({ frame: Number(fm[1]), start: fm.index + fm[0].length, end: fm.index });
  }
  const boxRe = /(?:^|,)(\d+)<\|box;([^|]*)\|>/g;
  for (let mi = 0; mi < markers.length; mi++) {
    const frame = markers[mi].frame;
    const seg = text.slice(markers[mi].start, mi + 1 < markers.length ? markers[mi + 1].end : text.length);
    let bm: RegExpExecArray | null;
    boxRe.lastIndex = 0;
    while ((bm = boxRe.exec(seg)) !== null) {
      const fields = Object.fromEntries(
        bm[2].split(";").map((kv) => {
          const i = kv.indexOf("=");
          return i === -1 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)];
        })
      );
      const num = (k: string) => Number(fields[k] ?? NaN);
      if ([num("x1"), num("y1"), num("x2"), num("y2"), num("w"), num("h")].some((v) => !Number.isFinite(v))) continue;
      boxes.push({
        id: Number(bm[1]),
        frame,
        x1: num("x1"),
        y1: num("y1"),
        x2: num("x2"),
        y2: num("y2"),
        w: num("w"),
        h: num("h"),
        c: fields.c !== undefined && fields.c !== "" ? Number(fields.c) : undefined,
      });
    }
  }
  return boxes;
}

export async function samSegmentFrame(opts: { imageDataUrl: string; prompt: string }) {
  const key = process.env.MODEL_API_KEY ?? "";
  if (!key) throw new Error("MODEL_API_KEY not configured");
  const concept = sanitizeConcept(opts.prompt);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  let sse: string;
  try {
    // Timeout covers headers AND the streamed body — clear it only after
    // res.text() resolves, otherwise a stalled SSE read hangs forever.
    const res = await fetch(`${BASE}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        model: SAM,
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: concept },
              { type: "input_image", image_url: opts.imageDataUrl },
            ],
          },
        ],
        stream: true,
        metadata: { include_confidence: "true", mask_encoding: "one_bit" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`sam ${res.status}: ${body.slice(0, 200)}`);
    }
    sse = await res.text();
  } finally {
    clearTimeout(t);
  }
  let full = "";
  let completed = false;
  for (const line of sse.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") break;
    try {
      const ev = JSON.parse(payload) as { type?: string; delta?: string; response?: { status?: string } };
      if (typeof ev.delta === "string") full += ev.delta;
      if (ev.type === "response.completed") completed = true;
      if (ev.response?.status === "completed") completed = true;
    } catch {
      // ignore malformed SSE lines
    }
  }
  const boxes = parseSamBoxes(full);
  return { model: SAM, concept, matches: boxes.length, boxes: boxes.slice(0, 64), textLength: full.length, completed };
}
