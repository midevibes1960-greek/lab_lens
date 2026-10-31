"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { REAL_CLIPS } from "@/lib/lablens";
import { Card } from "@/components/chrome";
import { Annotator } from "@/components/Annotator";

interface ClipRow { id: string; title: string; videoUrl: string; labUrl: string }
interface Score { status: string; humanCounts: Record<string, number>; countMape: number | null; meanF1: number | null; humanAgreement: number | null }

const pct = (v: number | null) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);

export default function StudyPage() {
  const [clips, setClips] = useState<ClipRow[]>(REAL_CLIPS.map((c) => ({ id: c.id, title: c.title, videoUrl: c.src, labUrl: `/lab/${c.id}` })));
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [selected, setSelected] = useState<string>(REAL_CLIPS[0].id);

  useEffect(() => {
    fetch("/api/upload")
      .then((r) => r.json())
      .then((j) => {
        const ups = ((j.uploads ?? []) as { id: string; filename: string }[]).map((u) => ({ id: u.id, title: `Upload — ${u.filename}`, videoUrl: `/api/video/${u.id}`, labUrl: `/lab/${u.id}` }));
        if (ups.length) setClips((prev) => [...prev, ...ups]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all(
      clips.map(async (c) => {
        try {
          const r = await fetch(`/api/accuracy?id=${encodeURIComponent(c.id)}`);
          const j = await r.json();
          return [c.id, j.score as Score] as const;
        } catch { return null; }
      })
    ).then((rows) => {
      if (!live) return;
      const out: Record<string, Score> = {};
      for (const row of rows) if (row) out[row[0]] = row[1];
      setScores(out);
    });
    return () => { live = false; };
  }, [clips]);

  const scored = clips.filter((c) => scores[c.id]?.status === "scored");
  const pooledMape = scored.length ? scored.reduce((s, c) => s + (scores[c.id].countMape ?? 0), 0) / scored.length : null;
  const pooledF1 = scored.length ? scored.reduce((s, c) => s + (scores[c.id].meanF1 ?? 0), 0) / scored.length : null;
  const sel = clips.find((c) => c.id === selected) ?? clips[0];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400">accuracy study · human ground truth</div>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Measure it for real — 2 humans vs the machine</h1>
      <p className="mt-1 max-w-3xl text-[14px] text-stone-600">
        Pick a clip, run the machine analysis in its lab page, then have <b>two people independently</b> click-count the same sampled frames here.
        Scores (count MAPE, detection F1, human agreement) are computed from those clicks — nothing is estimated. Target: <b>10 clips</b> before any accuracy claim.
      </p>

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Target className="size-5 text-cyan-800" />
          <span className="text-[14px] font-bold">Progress: {scored.length}/10 clips fully scored</span>
          <div className="h-2.5 min-w-40 flex-1 rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-cyan-700" style={{ width: `${Math.min(100, scored.length * 10)}%` }} />
          </div>
          <span className="font-mono text-[12px] font-bold">pooled count MAPE: {pct(pooledMape)} · pooled F1: {pooledF1 === null ? "—" : pooledF1.toFixed(2)}</span>
        </div>
        {scored.length < 10 && <p className="mt-1 text-[12px] text-amber-800">Below 10 clips this is a pilot, not an accuracy claim — pooled numbers are shown for tracking only.</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[12px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-stone-400">
                <th className="py-2 pr-3">clip</th><th className="px-3 py-2">status</th><th className="px-3 py-2">humans</th><th className="px-3 py-2">human disagreement</th><th className="px-3 py-2">count MAPE</th><th className="px-3 py-2">F1</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {clips.map((c) => {
                const s = scores[c.id];
                return (
                  <tr key={c.id} className={c.id === selected ? "bg-cyan-50/50" : ""}>
                    <td className="py-2 pr-3 font-bold">{c.title}</td>
                    <td className="px-3 py-2 font-mono">{s ? s.status.replaceAll("-", " ") : "loading…"}</td>
                    <td className="px-3 py-2 font-mono">{s ? (Object.entries(s.humanCounts).map(([k, v]) => `${k}=${v}`).join(" · ") || "—") : "—"}</td>
                    <td className="px-3 py-2 font-mono">{pct(s?.humanAgreement ?? null)}</td>
                    <td className="px-3 py-2 font-mono font-bold">{pct(s?.countMape ?? null)}</td>
                    <td className="px-3 py-2 font-mono">{s?.meanF1 === null || s?.meanF1 === undefined ? "—" : s.meanF1.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className="flex gap-1.5">
                        <button onClick={() => setSelected(c.id)} className="rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-bold text-white">Annotate</button>
                        <Link href={c.labUrl} className="flex items-center gap-1 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-bold hover:border-stone-900">Lab <ArrowRight className="size-3" /></Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {sel && (
        <div className="mt-4">
          <Annotator key={sel.id} videoUrl={sel.videoUrl} experimentId={sel.id} title={sel.title} />
        </div>
      )}
    </main>
  );
}
