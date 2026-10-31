"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { REAL_CLIPS } from "@/lib/lablens";
import type { StoredAnalysis } from "@/lib/store";
import { Card } from "@/components/chrome";

interface Score {
  status: string;
  humanCounts: Record<string, number>;
  countMape: number | null;
  meanF1: number | null;
}

// Real status only: what SAM actually did on the bundled real clips, and
// where the human accuracy study stands. Nothing here is simulated.
export default function EvaluationPage() {
  const [data, setData] = useState<Record<string, { analysis: StoredAnalysis | null; score: Score | null }>>({});

  useEffect(() => {
    let live = true;
    Promise.all(
      REAL_CLIPS.map(async (clip) => {
        const [a, s] = await Promise.all([
          fetch(`/api/tracks?id=${encodeURIComponent(clip.id)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/accuracy?id=${encodeURIComponent(clip.id)}`).then((r) => r.json()).catch(() => null),
        ]);
        return [clip.id, { analysis: (a?.analysis ?? null) as StoredAnalysis | null, score: (s?.score ?? null) as Score | null }] as const;
      })
    ).then((rows) => {
      if (!live) return;
      setData(Object.fromEntries(rows));
    });
    return () => { live = false; };
  }, []);

  const scored = REAL_CLIPS.filter((c) => data[c.id]?.score?.status === "scored").length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400">real footage · real SAM runs · human study in progress</div>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Evaluation — what is actually measured</h1>
      <p className="mt-1 max-w-3xl text-[14px] text-stone-600">
        Every machine number below comes from a persisted SAM 3.1 track table on the bundled Wikimedia clips.
        Accuracy against humans comes only from the <Link href="/study" className="font-bold text-cyan-800 hover:underline">accuracy study</Link>:
        <b> {scored}/10 clips fully scored</b> — below 10, no accuracy claim is made.
      </p>

      <div className="mt-4 grid gap-2.5">
        {REAL_CLIPS.map((clip) => {
          const d = data[clip.id];
          const analysis = d?.analysis;
          const score = d?.score;
          const tracks = analysis?.tracks ?? [];
          const last = tracks.length ? Math.max(...tracks.map((t) => t.frame)) : 0;
          const finalCount = tracks.filter((t) => t.frame === last).length;
          const counts = [...new Set(tracks.map((t) => t.frame))].sort((a, b) => a - b).map((f) => `f${f}=${tracks.filter((t) => t.frame === f).length}`).join(" · ");
          return (
            <Card key={clip.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-3">
                <span className="text-[14px] font-bold">{clip.title}</span>
                <span className="font-mono text-[11px] text-stone-500">
                  {analysis
                    ? `SAM “${analysis.concept}” · ${analysis.framesSampled} frames · ${new Set(tracks.map((t) => t.track_id)).size} tracks · final count ${finalCount} · quality ${analysis.quality.filter((q) => !q.bad).length}/${analysis.quality.length}`
                    : "no machine analysis saved yet"}
                </span>
                <Link href={`/lab/${clip.id}`} className="ml-auto flex items-center gap-1 rounded-full bg-stone-900 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-stone-700">
                  open lab <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className="grid gap-2 p-4 text-[12px] sm:grid-cols-2">
                <div className="rounded-xl bg-[#fafaf7] p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500">machine (computed)</div>
                  {analysis ? (
                    <div className="mt-1 font-mono leading-relaxed">
                      counts: {counts}
                      <br />rows: {tracks.length} · saved {new Date(analysis.createdAt).toLocaleString()}
                    </div>
                  ) : (
                    <div className="mt-1 text-stone-600">Run full-video analysis in the lab. SAM finding nothing (dense lentil sprouts) is a real result and will say so.</div>
                  )}
                </div>
                <div className="rounded-xl bg-[#fafaf7] p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500">humans vs machine</div>
                  <div className="mt-1 font-mono leading-relaxed">
                    status: {score ? score.status.replaceAll("-", " ") : "loading…"}
                    <br />
                    humans: {score ? (Object.entries(score.humanCounts).map(([k, v]) => `${k}=${v}`).join(" · ") || "—") : "—"}
                    {" · "}MAPE: {score?.countMape === null || score?.countMape === undefined ? "—" : `${(score.countMape * 100).toFixed(1)}%`}
                    {" · "}F1: {score?.meanF1 === null || score?.meanF1 === undefined ? "—" : score.meanF1.toFixed(2)}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-2.5 p-4 text-[13px] leading-relaxed">
        <b>Targets (not results):</b> count MAPE ≤10% vs the mean of 2 independent human counters, detection F1 ≥0.9, tracking &lt;5 ID switches/100,
        growth-rate error &lt;15%, &lt;5 min and &lt;$1.50 per run. ID switches, timing and cost are <b>not yet measured</b> and are not claimed anywhere in this app.
        Add your own clips in the <Link href="/study" className="font-bold text-cyan-800 hover:underline">accuracy study →</Link>
      </Card>
    </main>
  );
}
