"use client";
import { useEffect, useMemo, useState } from "react";
import { TriangleAlert, Brain, CircleAlert } from "lucide-react";
import type { LabAlert, TrackPoint } from "@/lib/lablens";
import { Badge, Card, CardHead, Provenance } from "./chrome";

export function AlertFeed({ alerts, onJump }: { alerts: LabAlert[]; onJump: (f: number) => void }) {
  return (
    <Card>
      <CardHead kicker="computed from the real track table" title="Flags — fast growth + close pairs" right={<Badge tone={alerts.length ? "amber" : "green"}>{alerts.length} open</Badge>} />
      <div className="flex flex-col gap-2 p-3">
        {alerts.map((a) => (
          <div key={a.id} className={`rounded-xl border p-3 ${a.type === "growth" ? "border-rose-900/15 bg-rose-50/60" : "border-stone-200 bg-[#fafaf7]"}`}>
            <div className="flex items-center gap-2">
              {a.type === "growth" ? <CircleAlert className="size-4 text-rose-600" /> : <TriangleAlert className="size-4 text-amber-600" />}
              <span className="text-[13px] font-bold tracking-tight">{a.title}</span>
              {a.needsWonder && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-violet-900 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Brain className="size-3" /> Wonder: 2nd opinion
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-stone-600">{a.detail}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Provenance frames={[a.frame]} onJump={onJump} />
              <span className="font-mono text-[11px] text-stone-400">conf {Math.round(a.confidence * 100)}%</span>
              <button onClick={() => onJump(a.frame)} className="ml-auto rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-bold hover:border-stone-900">
                view f{a.frame}
              </button>
            </div>
            {a.needsWonder && <WonderBox alert={a} />}
          </div>
        ))}
        {alerts.length === 0 && <div className="p-3 text-[13px] text-stone-500">No flags from this track table. Fast-growth and close-pair events will appear here, never hidden.</div>}
      </div>
    </Card>
  );
}

// Live Muse Wonder adjudication — calls /api/wonder, shows source honestly.
function WonderBox({ alert }: { alert: LabAlert }) {
  const [verdict, setVerdict] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/wonder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: alert.track_id, frame: alert.frame, evidence: alert.detail }),
      });
      const j = await res.json();
      setVerdict(j.verdict ?? "no verdict returned");
      setSource(j.source ?? "unknown");
    } catch (e) {
      setVerdict(e instanceof Error ? e.message : "Wonder request failed");
      setSource("error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 rounded-lg border border-violet-900/15 bg-violet-50 p-2 text-[11px] leading-relaxed text-violet-950">
      {verdict ? (
        <span><b>Muse Wonder ({source}):</b> {verdict}</span>
      ) : (
        <span><b>Second opinion available.</b> The flag above is computed from the track table. Ask Wonder to adjudicate the evidence.</span>
      )}
      <button onClick={ask} disabled={busy} className="ml-2 rounded-full bg-violet-900 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-60">
        {busy ? "Asking…" : verdict ? "↻ ask again" : "Ask Wonder"}
      </button>
    </div>
  );
}

export function ReviewQueue({
  tracks,
  onJump,
  corrections,
  setCorrections,
  experimentId,
}: {
  tracks: TrackPoint[];
  onJump: (f: number, id?: number) => void;
  corrections: Record<number, string>;
  setCorrections: (c: Record<number, string>) => void;
  experimentId?: string;
}) {
  // Load persisted corrections; every fix is POSTed back to the server.
  useEffect(() => {
    if (!experimentId) return;
    fetch(`/api/corrections?id=${encodeURIComponent(experimentId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.corrections && Object.keys(j.corrections).length) setCorrections(j.corrections);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId]);

  const save = (next: Record<number, string>) => {
    setCorrections(next);
    if (experimentId) {
      fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experimentId, corrections: next }),
      }).catch(() => {});
    }
  };

  const rows = useMemo(() => {
    const byId = new Map<number, TrackPoint[]>();
    for (const p of tracks) {
      if (!byId.has(p.track_id)) byId.set(p.track_id, []);
      byId.get(p.track_id)!.push(p);
    }
    return [...byId.entries()]
      .map(([id, pts]) => ({
        id,
        n: pts.length,
        conf: pts.reduce((s, x) => s + x.confidence, 0) / pts.length,
        last: pts[pts.length - 1],
      }))
      .sort((a, b) => a.conf - b.conf)
      .slice(0, 8);
  }, [tracks]);

  return (
    <Card>
      <CardHead kicker="unsure tracks first — 1 click fixes" title="Teach it — confirm or say “not it”" right={<Badge tone="amber">{Object.keys(corrections).length} fixes saved</Badge>} />
      <div className="divide-y divide-stone-100">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
            <button
              onClick={() => onJump(r.last.frame, r.id)}
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-900 font-mono text-[13px] font-bold text-white hover:bg-cyan-700"
            >
              {r.id}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">track #{r.id} <span className="font-normal text-stone-500">· {r.n} obs</span></div>
              <div className="font-mono text-[11px] text-stone-500">mean conf {r.conf.toFixed(2)} · last f{r.last.frame} · {corrections[r.id] ? `✓ ${corrections[r.id]}` : "uncorrected"}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => save({ ...corrections, [r.id]: "confirmed" })} className="rounded-full border border-stone-200 px-2 py-1 text-[11px] font-bold hover:border-emerald-600 hover:text-emerald-700">confirm</button>
              <button onClick={() => save({ ...corrections, [r.id]: "false positive" })} className="rounded-full border border-stone-200 px-2 py-1 text-[11px] font-bold hover:border-rose-600 hover:text-rose-700">FP</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="p-3.5 text-[13px] text-stone-500">No tracks to review yet.</div>}
      </div>
      <div className="border-t border-stone-100 bg-[#fafaf7] px-3.5 py-2 text-[11px] text-stone-500">
        Fixes are saved on the server for this experiment and reloaded with it. (Reusing them as few-shot examples is not implemented yet.)
      </div>
    </Card>
  );
}
