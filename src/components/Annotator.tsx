"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, MousePointerClick, Save, Trash2, Undo2 } from "lucide-react";
import { Card, CardHead, Badge } from "./chrome";
import type { FrameAnnotation, Pt } from "@/lib/accuracy";

interface Still { t_s: number; thumb: string }
interface Score {
  status: string;
  humanCounts: Record<string, number>;
  humanMean: number | null;
  humanAgreement: number | null;
  machineFinalCount: number | null;
  countMape: number | null;
  insideHumanSpread: boolean | null;
  meanF1: number | null;
  perFrameMape: number | null;
  framesCompared: number;
}

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("seek timed out")), 8000);
    const done = () => { clearTimeout(to); v.removeEventListener("seeked", done); resolve(); };
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}

const pct = (v: number | null) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);

export function Annotator({ videoUrl, experimentId, title }: { videoUrl: string; experimentId: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stills, setStills] = useState<Still[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [annotator, setAnnotator] = useState("H1");
  // points[annotator][frameIndex] = points
  const [allPoints, setAllPoints] = useState<Record<string, Record<number, Pt[]>>>({ H1: {}, H2: {} });
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [score, setScore] = useState<Score | null>(null);

  const refreshScore = () =>
    fetch(`/api/accuracy?id=${encodeURIComponent(experimentId)}`)
      .then((r) => r.json())
      .then((j) => setScore(j.score as Score))
      .catch(() => {});

  useEffect(() => { refreshScore(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId]);

  const prepare = async () => {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy("Preparing frames…");
    setError(null);
    try {
      v.pause();
      // Align annotation times with the machine analysis when one exists.
      let times: number[] | null = null;
      try {
        const r = await fetch(`/api/tracks?id=${encodeURIComponent(experimentId)}`);
        if (r.ok) {
          const j = await r.json();
          const ts = [...new Set((j.analysis.tracks as { t_min: number }[]).map((t) => t.t_min))].sort((a, b) => a - b);
          if (ts.length >= 2) times = ts;
        }
      } catch { /* fall through to even sampling */ }
      if (!Number.isFinite(v.duration) || v.duration <= 0) throw new Error("video metadata not loaded — press play once, then prepare");
      if (!times) {
        const n = 6;
        times = Array.from({ length: n }, (_, i) => (i / (n - 1)) * Math.max(0, v.duration - 0.1));
      }
      const out: Still[] = [];
      for (let i = 0; i < times.length; i++) {
        setBusy(`Capturing frame ${i + 1}/${times.length}…`);
        await seekTo(v, times[i]);
        const vw = v.videoWidth || 640;
        const vh = v.videoHeight || 360;
        const scale = Math.min(1, 768 / vw);
        const cv = document.createElement("canvas");
        cv.width = Math.round(vw * scale);
        cv.height = Math.round(vh * scale);
        cv.getContext("2d")?.drawImage(v, 0, 0, cv.width, cv.height);
        out.push({ t_s: Math.round(times[i] * 10) / 10, thumb: cv.toDataURL("image/jpeg", 0.85) });
      }
      setStills(out);
      // Load existing annotations (points stay per-annotator; switching hides the other's marks).
      const r = await fetch(`/api/annotations?id=${encodeURIComponent(experimentId)}`);
      const j = await r.json();
      const anns = (j.annotations?.annotators ?? {}) as Record<string, { frames: FrameAnnotation[] }>;
      const loaded: Record<string, Record<number, Pt[]>> = { H1: {}, H2: {} };
      for (const [name, data] of Object.entries(anns)) {
        loaded[name] = {};
        (data.frames ?? []).forEach((f, idx) => { loaded[name][idx] = f.points ?? []; });
        // frames were saved in sampled order; index by order is correct here
      }
      if (Object.keys(anns).length) setAllPoints((prev) => ({ ...prev, ...loaded }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "prepare failed");
    } finally {
      setBusy(null);
    }
  };

  const points = allPoints[annotator]?.[sel] ?? [];
  const setPoints = (next: Pt[]) => setAllPoints((prev) => ({ ...prev, [annotator]: { ...(prev[annotator] ?? {}), [sel]: next } }));

  const save = async () => {
    if (!stills || busy) return;
    setBusy("Saving…");
    try {
      const frames: FrameAnnotation[] = stills.map((s, i) => ({ frame: i, t_s: s.t_s, points: allPoints[annotator]?.[i] ?? [] }));
      const r = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experimentId, annotator, frames }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "save failed");
      setSavedAt((prev) => ({ ...prev, [annotator]: new Date().toLocaleTimeString() }));
      await refreshScore();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHead kicker="human ground truth — click each object once" title={`Annotate: ${title}`} right={score ? <Badge tone={score.status === "scored" ? "green" : "amber"}>{score.status.replaceAll("-", " ")}</Badge> : <Badge tone="cyan">accuracy study</Badge>} />
      <video ref={videoRef} src={videoUrl} controls playsInline preload="auto" crossOrigin="anonymous" className="block aspect-video w-full bg-black" />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-stone-500">I am annotator:</span>
          {["H1", "H2"].map((a) => (
            <button key={a} onClick={() => setAnnotator(a)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${annotator === a ? "bg-stone-900 text-white" : "border border-stone-300 bg-white hover:border-stone-900"}`}>
              {a}{savedAt[a] ? ` ✓ ${savedAt[a]}` : ""}
            </button>
          ))}
          <span className="text-[11px] text-stone-500">Annotators work independently — switching hides the other person’s marks.</span>
          {!stills && (
            <button onClick={prepare} disabled={!!busy} className="ml-auto flex items-center gap-1.5 rounded-full bg-cyan-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-cyan-600 disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MousePointerClick className="size-4" />} {busy ?? "Prepare sampled frames"}
            </button>
          )}
        </div>
        {error && <p className="rounded-xl border border-rose-900/15 bg-rose-50 p-2.5 text-[12px] text-rose-900"><b>Error:</b> {error}</p>}

        {stills && (
          <>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {stills.map((s, i) => (
                <button key={i} onClick={() => setSel(i)} className={`relative shrink-0 overflow-hidden rounded-lg border-2 ${i === sel ? "border-cyan-700" : "border-stone-200"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumb} alt={`frame at ${s.t_s}s`} className="block h-14 w-24 object-cover" />
                  <span className="absolute bottom-0 left-0 bg-stone-900/85 px-1 font-mono text-[10px] font-bold text-white">{s.t_s}s · {(allPoints[annotator]?.[i] ?? []).length}</span>
                </button>
              ))}
            </div>
            <div className="relative overflow-hidden rounded-xl border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={stills[sel].thumb}
                alt={`annotation frame at ${stills[sel].t_s}s`}
                className="block w-full cursor-crosshair"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPoints([...points, { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }]);
                }}
              />
              {points.map((p, i) => (
                <span key={i} className="pointer-events-none absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-rose-600 font-mono text-[9px] font-bold text-white" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>{i + 1}</span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold">{annotator}: {points.length} marked on this frame ({stills[sel].t_s}s)</span>
              <button onClick={() => setPoints(points.slice(0, -1))} className="flex items-center gap-1 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-bold hover:border-stone-900"><Undo2 className="size-3" /> undo</button>
              <button onClick={() => setPoints([])} className="flex items-center gap-1 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-bold hover:border-rose-600 hover:text-rose-700"><Trash2 className="size-3" /> clear frame</button>
              <button onClick={save} disabled={!!busy} className="ml-auto flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-stone-700 disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save {annotator} annotations
              </button>
            </div>
            <p className="text-[11px] text-stone-500">Click once per object on <b>every</b> sampled frame (counts on all frames feed per-frame error; the last frame feeds the headline count). Mark what <i>you</i> see — don’t copy the machine or the other annotator.</p>
          </>
        )}

        <div className="rounded-xl bg-[#fafaf7] p-3 text-[12px] leading-relaxed">
          <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500">score vs machine (computed, nothing estimated)</div>
          {score ? (
            <div className="mt-1 grid gap-1 font-mono text-[12px] sm:grid-cols-2">
              <span>humans: {Object.entries(score.humanCounts).map(([k, v]) => `${k}=${v}`).join(" · ") || "none yet"}</span>
              <span>human agreement (disagreement/mean): {pct(score.humanAgreement)}</span>
              <span>machine final count: {score.machineFinalCount ?? "— (run full-video analysis first)"}</span>
              <span>count MAPE vs human mean: <b>{pct(score.countMape)}</b>{score.insideHumanSpread !== null ? ` · inside human spread: ${score.insideHumanSpread ? "yes" : "no"}` : ""}</span>
              <span>detection F1 (final frame, point↔centroid): {score.meanF1 === null ? "—" : score.meanF1.toFixed(2)}</span>
              <span>per-frame count MAPE: {pct(score.perFrameMape)} ({score.framesCompared} frames)</span>
            </div>
          ) : (
            <span className="text-stone-500">Loading score…</span>
          )}
          {score && score.status !== "scored" && <p className="mt-1 font-sans text-[11px] text-amber-800">Status “{score.status.replaceAll("-", " ")}” — the missing side must be supplied before any accuracy number exists.</p>}
        </div>
      </div>
    </Card>
  );
}
