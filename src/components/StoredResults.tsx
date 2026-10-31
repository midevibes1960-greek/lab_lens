"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, ShieldCheck, Sparkles } from "lucide-react";
import type { LabAlert, TrackPoint } from "@/lib/lablens";
import { countAtFrame, fitRatePerUnit, median, toCSV } from "@/lib/lablens";
import type { StoredAnalysis } from "@/lib/store";
import { GrowthChart, QualityStrip } from "./charts";
import { AlertFeed, ReviewQueue } from "./panels";
import { Card, CardHead, Badge } from "./chrome";

// Everything here renders from the persisted REAL track table only.
export function StoredResults({ experimentId, reloadKey }: { experimentId: string; reloadKey: number }) {
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [frame, setFrame] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [corrections, setCorrections] = useState<Record<number, string>>({});
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrSource, setNarrSource] = useState<string | null>(null);
  const [narrBusy, setNarrBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/tracks?id=${encodeURIComponent(experimentId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const a = (j?.analysis ?? null) as StoredAnalysis | null;
        setAnalysis(a);
        if (a?.tracks.length) setFrame(Math.max(...a.tracks.map((t) => t.frame)));
      })
      .catch(() => setAnalysis(null))
      .finally(() => setLoaded(true));
  }, [experimentId, reloadKey]);

  const tracks: TrackPoint[] = useMemo(() => analysis?.tracks ?? [], [analysis]);

  const alerts: LabAlert[] = useMemo(() => {
    if (!tracks.length) return [];
    const byTrack = new Map<number, TrackPoint[]>();
    for (const p of tracks) {
      if (!byTrack.has(p.track_id)) byTrack.set(p.track_id, []);
      byTrack.get(p.track_id)!.push(p);
    }
    const rates = [...byTrack.entries()].map(([id, pts]) => ({ id, pts, r: fitRatePerUnit(pts) }));
    const med = median(rates.map((x) => x.r));
    const out: LabAlert[] = [];
    const fastest = [...rates].sort((a, b) => b.r - a.r)[0];
    if (fastest && med > 0 && fastest.r > 2.5 * med && fastest.pts.length >= 3) {
      const mid = fastest.pts[Math.floor(fastest.pts.length / 2)];
      out.push({
        id: "real-fast",
        type: "growth",
        track_id: fastest.id,
        frame: mid.frame,
        t_min: mid.t_min,
        title: `Fast-growing track #${fastest.id} — check it`,
        detail: `Growth ${fastest.r.toFixed(3)}/s vs median ${med.toFixed(3)}/s (${(fastest.r / med).toFixed(1)}×). Computed from the real track table; could be contamination, a merge, or the healthiest object — adjudicate before concluding.`,
        confidence: 0.7,
        needsWonder: true,
      });
    }
    const last = Math.max(...tracks.map((t) => t.frame));
    const late = tracks.filter((t) => t.frame === last);
    outer: for (let i = 0; i < late.length; i++) {
      for (let j = i + 1; j < late.length; j++) {
        const d = Math.hypot(late[i].x - late[j].x, late[i].y - late[j].y);
        if (d < 0.06) {
          out.push({
            id: "real-close",
            type: "merge",
            track_id: late[i].track_id,
            frame: last,
            t_min: late[i].t_min,
            title: `Close pair — tracks #${late[i].track_id} + #${late[j].track_id}`,
            detail: `Centroids ${(d * 100).toFixed(1)}% of frame width apart at the final frame. Box linking kept both IDs; verify on the video whether this is one object or two.`,
            confidence: 0.65,
            needsWonder: false,
          });
          break outer;
        }
      }
    }
    return out;
  }, [tracks]);

  const askSpark = async () => {
    if (narrBusy) return;
    setNarrBusy(true);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experimentId }),
      });
      const j = await res.json();
      setNarrative(j.narrative ?? j.error ?? "no narrative");
      setNarrSource(`${j.source ?? "unknown"}${j.validated === false ? " · validator rejected Spark draft" : ""}`);
    } catch (e) {
      setNarrative(e instanceof Error ? e.message : "spark failed");
      setNarrSource("error");
    } finally {
      setNarrBusy(false);
    }
  };

  if (!loaded) return <Card className="p-4 text-[13px] text-stone-500">Loading saved analysis…</Card>;
  if (!analysis || !tracks.length) {
    return (
      <Card className="p-4">
        <div className="text-[14px] font-bold">No real analysis saved for this video yet</div>
        <p className="mt-1 text-[13px] text-stone-600">Run <b>full-video analysis</b> above. Results, charts, flags and downloads will appear here — computed from SAM boxes on your actual frames. There is no demo data on this page.</p>
      </Card>
    );
  }

  const last = Math.max(...tracks.map((t) => t.frame));
  const n = countAtFrame(tracks, last);
  const rates = [...new Set(tracks.map((t) => t.track_id))].map((id) => fitRatePerUnit(tracks.filter((t) => t.track_id === id)));
  const calibrated = tracks.some((t) => t.area_mm2 > 0);
  const csv = toCSV(tracks);
  const qualityFrames = analysis.quality.map((q) => ({ frame: q.frame, t_min: q.t_s, sharpness: q.sharpness, exposure: q.exposure, shake: 0, glare: q.glare, bad: q.bad, reason: q.reason }));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {[
          ["found (final frame)", `${n}`, `${new Set(tracks.map((t) => t.track_id)).size} tracks · ${tracks.length} rows`],
          ["median growth", `${median(rates).toFixed(4)}/s`, `log-area slope, ${calibrated ? "mm²" : "px (uncalibrated)"}`],
          ["frames sampled", `${analysis.framesSampled}`, `SAM concept “${analysis.concept}”`],
          ["source", "SAM 3.1 live", `saved ${new Date(analysis.createdAt).toLocaleString()}`],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-xl border border-stone-200 bg-[#fafaf7] px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div>
            <div className="font-mono text-[20px] font-bold leading-tight tracking-tight">{value}</div>
            <div className="text-[11px] leading-snug text-stone-500">{sub}</div>
          </div>
        ))}
      </div>

      <GrowthChart tracks={tracks} frame={frame} selected={selected} onSelect={setSelected} />

      {qualityFrames.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-3">
          <div className="mb-1 text-[12px] font-bold text-stone-500">Measured frame quality (from pixels). Amber = flagged.</div>
          <QualityStrip quality={qualityFrames} frame={frame} onJump={(f) => setFrame(f)} />
        </div>
      )}

      <AlertFeed alerts={alerts} onJump={(f) => setFrame(f)} />

      <ReviewQueue tracks={tracks} onJump={(f, id) => { setFrame(f); if (id !== undefined) setSelected(id); }} corrections={corrections} setCorrections={setCorrections} experimentId={experimentId} />

      <Card>
        <CardHead kicker="paste into notebook · spreadsheet + charts" title="Your results — from your video" right={<Badge tone="green">real track table</Badge>} />
        <div className="grid gap-3 p-3.5 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">downloads</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`${experimentId}-tracks.csv`} className="flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-stone-700"><Download className="size-3" /> CSV ({tracks.length})</a>
              <a href={`/api/report?id=${encodeURIComponent(experimentId)}&format=md`} className="flex items-center gap-1 rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-bold hover:border-stone-900"><Download className="size-3" /> .md</a>
              <a href={`/api/report?id=${encodeURIComponent(experimentId)}&format=ipynb`} className="flex items-center gap-1 rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-bold hover:border-stone-900"><Download className="size-3" /> .ipynb</a>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
              <ShieldCheck className="size-4" /> every figure computed from the {tracks.length}-row track table
            </div>
            <p className="mt-1 text-[12px] text-stone-500">Time is video-seconds. {calibrated ? `Scale ${analysis.pxPerMm?.toFixed(2)} px/mm from the ${analysis.plateDiameterMm} mm reference.` : "Uncalibrated — areas in px. Set a reference width (mm) and re-run for mm²."}</p>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">narrative (validator-checked)</div>
            <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-violet-50 p-2 text-[11px] leading-relaxed text-violet-950">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" />
              <span>{narrative ? <><b>Spark ({narrSource}):</b> {narrative}</> : "Drafted by Muse Spark from the computed summary; the server validator rejects any number that isn't in your track table."}</span>
            </div>
            <button onClick={askSpark} disabled={narrBusy} className="mt-1.5 w-full rounded-full border border-violet-900/20 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-950 hover:border-violet-900 disabled:opacity-60">
              {narrBusy ? "Asking Muse Spark…" : narrative ? "↻ re-run Spark analysis" : "Run live Spark analysis"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
