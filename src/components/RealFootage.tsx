"use client";
import { useEffect, useRef, useState } from "react";
import { ScanEye, Loader2, Play, Download } from "lucide-react";
import { Card, CardHead, Badge } from "./chrome";
import { linkFrames, countsFromTracks, type FrameBox } from "@/lib/tracking";
import { seekToVideo, SeekTimeout } from "@/lib/seekVideo";
import { fitRatePerUnit, median, toCSV, type TrackPoint } from "@/lib/lablens";

interface SamBox extends FrameBox { c?: number }

type SingleState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "found"; matches: number; boxes: SamBox[]; thumb: string; concept: string }
  | { kind: "empty"; concept: string; thumb: string }
  | { kind: "error"; message: string };

interface QualityRow { frame: number; t_s: number; sharpness: number; exposure: number; glare: number; bad: boolean; reason: string | null }

interface AnalysisSummary {
  rows: number;
  tracks: number;
  finalCount: number;
  medianRate: number;
  counts: { frame: number; t_min: number; count: number }[];
  calibrated: boolean;
}

function frameQuality(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  let sum = 0;
  let glarePx = 0;
  for (let i = 0, p = 0; i < img.length; i += 4, p++) {
    const g = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
    gray[p] = g;
    sum += g;
    if (g > 245) glarePx++;
  }
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const lapVar = n ? lapSq / n - (lapSum / n) ** 2 : 0;
  const sharpness = Math.round((lapVar / (lapVar + 200)) * 100) / 100;
  const exposure = Math.round((sum / (w * h) / 255) * 100) / 100;
  const glare = Math.round((glarePx / (w * h)) * 100) / 100;
  const bad = sharpness < 0.3 || glare > 0.25;
  return { sharpness, exposure, glare, bad, reason: !bad ? null : sharpness < 0.3 ? "blurry (low sharpness)" : "glare" };
}

function drawFrame(v: HTMLVideoElement) {
  const vw = v.videoWidth || 640;
  const vh = v.videoHeight || 360;
  const scale = Math.min(1, 768 / vw);
  const cv = document.createElement("canvas");
  cv.width = Math.round(vw * scale);
  cv.height = Math.round(vh * scale);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(v, 0, 0, cv.width, cv.height);
  return { cv, ctx };
}

// Capture a frame as a data URL. If the canvas is tainted (video was loaded
// cross-origin — e.g. tab moved between localhost/127.0.0.1/ports), reload
// the video in CORS mode once and retry before giving up.
async function capture(v: HTMLVideoElement) {
  const first = drawFrame(v);
  try {
    return { ...first, imageDataUrl: first.cv.toDataURL("image/jpeg", 0.85) };
  } catch (e) {
    if (!(e instanceof DOMException) || e.name !== "SecurityError") throw e;
    const t = v.currentTime;
    v.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("video reload timed out")), 10000);
      const done = () => { clearTimeout(to); v.removeEventListener("loadeddata", done); resolve(); };
      v.addEventListener("loadeddata", done);
      v.load();
    });
    if (Number.isFinite(t) && t > 0) await seekToVideo(v, t).catch(() => {});
    const retry = drawFrame(v);
    try {
      return { ...retry, imageDataUrl: retry.cv.toDataURL("image/jpeg", 0.85) };
    } catch {
      throw new Error(`frame capture blocked: this video was loaded from a different origin (${v.currentSrc || "unknown src"}) than the page (${window.location.origin}). Hard-reload the page (Ctrl+Shift+R) so the video loads with the page, then try again.`);
    }
  }
}

export function RealFootage({ videoUrl, prompt, experimentId, defaultConcept, plateDiameterMm = 90, onSaved, videoLabel = "Your uploaded time-lapse" }: { videoUrl: string; prompt: string; experimentId: string; defaultConcept?: string; plateDiameterMm?: number; onSaved?: () => void; videoLabel?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [concept, setConcept] = useState(defaultConcept ?? "bacterial colonies");
  const [state, setState] = useState<SingleState>({ kind: "idle" });
  const [sampleCount, setSampleCount] = useState(10);
  const [dishMm, setDishMm] = useState(plateDiameterMm);
  const [running, setRunning] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [savedTracks, setSavedTracks] = useState<TrackPoint[] | null>(null);

  // Load a previously saved real analysis for this experiment.
  useEffect(() => {
    fetch(`/api/tracks?id=${encodeURIComponent(experimentId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.analysis) return;
        const tracks = j.analysis.tracks as TrackPoint[];
        const counts = countsFromTracks(tracks);
        setSavedTracks(tracks);
        setSummary({
          rows: tracks.length,
          tracks: new Set(tracks.map((t) => t.track_id)).size,
          finalCount: counts.length ? counts[counts.length - 1].count : 0,
          medianRate: median([...new Set(tracks.map((t) => t.track_id))].map((id) => fitRatePerUnit(tracks.filter((t) => t.track_id === id)))),
          counts,
          calibrated: tracks.some((t) => t.area_mm2 > 0),
        });
      })
      .catch(() => {});
  }, [experimentId]);

  const sendFrame = async () => {
    const v = videoRef.current;
    if (!v || state.kind === "busy") return;
    setRunError(null);
    setState({ kind: "busy" });
    try {
      const { imageDataUrl } = await capture(v);
      const res = await fetch("/api/segment_track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experimentId, concept, prompt: `${concept} — goal: ${prompt}`, imageDataUrl }),
      });
      const j = await res.json();
      if (j.live && typeof j.matches === "number") {
        if (j.matches > 0) setState({ kind: "found", matches: j.matches, boxes: (j.boxes ?? []) as SamBox[], thumb: imageDataUrl, concept: j.concept ?? concept });
        else setState({ kind: "empty", concept: j.concept ?? concept, thumb: imageDataUrl });
      } else {
        setState({ kind: "error", message: j.error ?? "SAM request failed." });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "frame send failed" });
    }
  };

  const runFullAnalysis = async () => {
    const v = videoRef.current;
    if (!v || running) return;
    setRunError(null);
    setState({ kind: "idle" });
    try {
      v.pause();
      if (!Number.isFinite(v.duration) || v.duration <= 0) throw new Error("video metadata not loaded yet — press play once, then run");
      const duration = v.duration;
      const times = Array.from({ length: sampleCount }, (_, i) => (sampleCount === 1 ? 0 : (i / (sampleCount - 1)) * Math.max(0, duration - 0.1)));
      const framesBoxes: FrameBox[][] = [];
      const quality: QualityRow[] = [];
      let capW = 768;
      let seekNotes = 0;
      for (let i = 0; i < times.length; i++) {
        setRunning(`Frame ${i + 1}/${times.length} — asking SAM…`);
        try {
          await seekToVideo(v, times[i]);
        } catch (e) {
          // One stalled seek must not kill the run: capture the frame
          // currently displayed and note it. Only abort if nothing is shown.
          if (e instanceof SeekTimeout && v.readyState >= 2) seekNotes++;
          else throw e;
        }
        const { cv, ctx, imageDataUrl } = await capture(v);
        capW = cv.width;
        const q = frameQuality(ctx, cv.width, cv.height);
        quality.push({ frame: i, t_s: Math.round(times[i] * 10) / 10, ...q });
        const res = await fetch("/api/segment_track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: experimentId, concept, prompt: `${concept} — goal: ${prompt}`, imageDataUrl }),
        });
        const j = await res.json();
        if (!j.live) throw new Error(j.error ?? "SAM unavailable — full analysis needs the live model");
        framesBoxes.push(((j.boxes ?? []) as SamBox[]).map((b) => ({ ...b, frame: i })));
      }
      setRunning("Linking boxes into tracks…");
      const pxPerMm = dishMm > 0 ? capW / dishMm : 0;
      const tracks = linkFrames(framesBoxes, { tMinOf: (f) => Math.round(times[f] * 10) / 10, pxPerMm });
      if (!tracks.length) {
        setRunError(`SAM found “${concept}” on none of the ${times.length} sampled frames. Try a shorter noun phrase or clearer footage — nothing was saved.`);
        setRunning(null);
        return;
      }
      const counts = countsFromTracks(tracks);
      const res = await fetch("/api/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: experimentId,
          title: experimentId,
          prompt,
          concept,
          plateDiameterMm: dishMm,
          pxPerMm: pxPerMm > 0 ? pxPerMm : null,
          videoDurationS: Math.round(duration * 10) / 10,
          framesSampled: times.length,
          tracks,
          quality,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "could not save analysis");
      onSaved?.();
      if (seekNotes > 0) setRunError(`Note: ${seekNotes} frame(s) captured at the nearest displayed position after a seek timeout — results are still from your video.`);
      setSavedTracks(tracks);
      setSummary({
        rows: tracks.length,
        tracks: new Set(tracks.map((t) => t.track_id)).size,
        finalCount: counts.length ? counts[counts.length - 1].count : 0,
        medianRate: median([...new Set(tracks.map((t) => t.track_id))].map((id) => fitRatePerUnit(tracks.filter((t) => t.track_id === id)))),
        counts,
        calibrated: pxPerMm > 0,
      });
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "analysis failed");
    } finally {
      setRunning(null);
    }
  };

  const badge =
    state.kind === "found" ? <Badge tone="green">SAM found {state.matches}</Badge>
    : state.kind === "empty" ? <Badge tone="amber">SAM found nothing</Badge>
    : state.kind === "busy" ? <Badge tone="cyan">asking SAM…</Badge>
    : <Badge tone="cyan">SAM ready</Badge>;

  const maxC = summary ? Math.max(1, ...summary.counts.map((c) => c.count)) : 1;

  return (
    <Card className="overflow-hidden border-cyan-900/20">
      <CardHead kicker="real analysis happens here" title={videoLabel} right={badge} />
      <video ref={videoRef} src={videoUrl} controls playsInline preload="auto" crossOrigin="anonymous" className="block aspect-video w-full bg-black" />
      <div className="flex flex-col gap-2 p-3">
        <label className="text-[12px] font-bold text-stone-500">
          What should SAM look for? <span className="font-normal">One noun phrase, not a sentence.</span>
        </label>
        <div className="flex flex-wrap gap-1">
          {["seedling", "sprouts", "seedlings", "colonies", "bacterial colonies", "mold"].map((c) => (
            <button key={c} onClick={() => setConcept(c)} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${concept === c ? "bg-cyan-700 text-white" : "border border-stone-200 bg-white text-stone-600 hover:border-cyan-700"}`}>{c}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="bacterial colonies" aria-label="SAM concept, one noun phrase" className="w-full flex-1 rounded-xl border border-stone-200 bg-[#fafaf7] px-3 py-2 text-[13px] focus:border-cyan-700 focus:outline-none" />
          <button onClick={sendFrame} disabled={state.kind === "busy"} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white border border-stone-300 px-4 py-2 text-[13px] font-bold hover:border-stone-900 disabled:opacity-60">
            {state.kind === "busy" ? <Loader2 className="size-4 animate-spin" /> : <ScanEye className="size-4" />}
            {state.kind === "busy" ? "Asking…" : "Check this frame"}
          </button>
        </div>

        <div className="rounded-xl border border-cyan-900/15 bg-cyan-50/50 p-3">
          <div className="text-[13px] font-bold">Full-video analysis (real)</div>
          <p className="mt-0.5 text-[12px] text-stone-600">Samples frames across the whole clip, sends each to SAM 3.1, links boxes into tracks, and saves the track table. Reports below then use <b>your</b> data — not demo data.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-bold text-stone-500">frames to sample
              <input type="number" min={3} max={24} value={sampleCount} onChange={(e) => setSampleCount(Math.max(3, Math.min(24, Number(e.target.value) || 10)))} className="mt-0.5 block w-24 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[13px]" />
            </label>
            <label className="text-[11px] font-bold text-stone-500">reference width = full frame (mm, 0 = px only)
              <input type="number" min={0} max={1000} value={dishMm} onChange={(e) => setDishMm(Number(e.target.value) || 0)} className="mt-0.5 block w-28 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[13px]" />
            </label>
            <button onClick={runFullAnalysis} disabled={!!running} className="flex items-center gap-1.5 rounded-full bg-cyan-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-cyan-600 disabled:opacity-60">
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ?? "▶ Run full-video analysis"}
            </button>
          </div>
          {runError && (
            runError.startsWith("Note:") ? (
              <p className="mt-2 rounded-lg border border-amber-900/15 bg-amber-50 p-2 text-[12px] text-amber-950">{runError}</p>
            ) : (
              <p className="mt-2 rounded-lg border border-rose-900/15 bg-rose-50 p-2 text-[12px] text-rose-900"><b>Analysis stopped:</b> {runError}</p>
            )
          )}
          {summary && (
            <div className="mt-2 rounded-lg border border-emerald-900/15 bg-emerald-50 p-2.5 text-[12px] text-emerald-950">
              <b>Real results saved:</b> final count <b>{summary.finalCount}</b> · {summary.tracks} tracks · {summary.rows} rows · median growth {summary.medianRate.toFixed(4)}/s ({summary.calibrated ? "mm² calibrated" : "px, uncalibrated"}). Time is video-seconds.
              <svg viewBox="0 0 280 70" className="mt-1.5 w-full">
                <path d={summary.counts.map((c, i) => `${i === 0 ? "M" : "L"}${8 + (summary.counts.length <= 1 ? 0 : (i / (summary.counts.length - 1)) * 264)},${62 - (c.count / maxC) * 52}`).join(" ")} fill="none" stroke="#065f46" strokeWidth={2.5} />
              </svg>
              <div className="font-mono text-[11px]">{summary.counts.map((c) => `f${c.frame}=${c.count}`).join(" · ")}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {savedTracks && (
                  <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCSV(savedTracks))}`} download={`${experimentId}-tracks.csv`} className="flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-bold text-white"><Download className="size-3" /> CSV ({summary.rows})</a>
                )}
                <a href={`/api/report?id=${encodeURIComponent(experimentId)}&format=md`} className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-bold">Report .md</a>
                <a href={`/api/report?id=${encodeURIComponent(experimentId)}&format=ipynb`} className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-bold">Notebook .ipynb</a>
                <a href={`/api/report?id=${encodeURIComponent(experimentId)}&format=csv`} className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-bold">CSV via API</a>
              </div>
            </div>
          )}
        </div>

        {state.kind === "idle" && !summary && (
          <p className="rounded-xl bg-[#fafaf7] p-2.5 text-[12px] text-stone-600">No analysis yet on your video. Use <b>Check this frame</b> for a quick test, or run the full-video analysis above.</p>
        )}
        {state.kind === "found" && (
          <div>
            <p className="rounded-xl border border-emerald-900/15 bg-emerald-50 p-2.5 text-[12px] font-semibold text-emerald-900">SAM 3.1 found <b>{state.matches} outline{state.matches === 1 ? "" : "s"}</b> for “{state.concept}” on this frame.</p>
            <div className="relative mt-2 overflow-hidden rounded-xl border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.thumb} alt="analysed frame" className="block w-full" />
              {state.boxes.map((b) => (
                <span key={`${b.id}-${b.x1}`} className="absolute rounded-sm border-2 border-cyan-400 bg-cyan-400/10" style={{ left: `${(b.x1 / b.w) * 100}%`, top: `${(b.y1 / b.h) * 100}%`, width: `${((b.x2 - b.x1) / b.w) * 100}%`, height: `${((b.y2 - b.y1) / b.h) * 100}%` }} title={`object ${b.id}`}>
                  <span className="absolute -top-5 left-0 rounded bg-cyan-700 px-1 font-mono text-[10px] font-bold text-white">#{b.id}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {state.kind === "empty" && (
          <p className="rounded-xl border border-amber-900/15 bg-amber-50 p-2.5 text-[12px] text-amber-950"><b>SAM found nothing for “{state.concept}” on this frame.</b> Normal result — try a clearer frame or a shorter phrase.</p>
        )}
        {state.kind === "error" && (
          <p className="rounded-xl border border-rose-900/15 bg-rose-50 p-2.5 text-[12px] text-rose-900"><b>Frame check failed:</b> {state.message}</p>
        )}
      </div>
    </Card>
  );
}
