"use client";
import { useMemo } from "react";
import type { TrackPoint } from "@/lib/lablens";

export interface QualityFrame {
  frame: number;
  t_min: number;
  sharpness: number;
  exposure: number;
  shake: number;
  glare: number;
  bad: boolean;
  reason: string | null;
}

// mm² when calibrated, else px — growth slope is identical either way.
const areaOf = (p: TrackPoint) => (p.area_mm2 > 0 ? p.area_mm2 : p.area_px);
import { Card, CardHead, Badge } from "./chrome";

function path(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  return points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
}

export function GrowthChart({
  tracks,
  frame,
  selected,
  onSelect,
}: {
  tracks: TrackPoint[];
  frame: number;
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  const W = 560;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const { series, counts, tMax, aMax, cMax } = useMemo(() => {
    const byId = new Map<number, TrackPoint[]>();
    for (const p of tracks) {
      if (!byId.has(p.track_id)) byId.set(p.track_id, []);
      byId.get(p.track_id)!.push(p);
    }
    const ids = [...byId.keys()].sort((a, b) => a - b).slice(0, 14);
    const tMax = Math.max(...tracks.map((t) => t.t_min), 1);
    const aMax = Math.max(...tracks.map((t) => areaOf(t)), 1);
    const frames = [...new Set(tracks.map((t) => t.frame))].sort((a, b) => a - b);
    const counts = frames.map((f) => ({ f, c: tracks.filter((t) => t.frame === f).length }));
    const cMax = Math.max(...counts.map((c) => c.c), 1);
    const series = ids.map((id) => ({ id, pts: byId.get(id)! }));
    return { series, counts, tMax, aMax, cMax };
  }, [tracks]);

  const X = (t: number) => pad.l + (t / tMax) * (W - pad.l - pad.r);
  const Y = (a: number) => H - pad.b - (a / aMax) * (H - pad.t - pad.b);

  return (
    <Card>
      <CardHead
        kicker="one line per outline — drawn from measurements"
        title="Growth lines — tap one to follow it"
        right={<Badge tone="green">✓ measured, not guessed</Badge>}
      />
      <div className="px-3 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={Y(aMax * f)} y2={Y(aMax * f)} stroke="#e7e5e4" strokeDasharray="4 4" />
              <text x={4} y={Y(aMax * f) + 4} fontSize={10} fill="#78716c" fontFamily="monospace">
                {(aMax * f).toFixed(0)}
              </text>
            </g>
          ))}
          {series.map((s) => {
            const isSel = selected === s.id;
            const isCont = s.pts[0] && s.pts[0].solidity > 0 && s.pts[0].solidity < 0.72 && s.pts.length > 8;
            const pts = s.pts.filter((pt) => pt.frame <= frame).map((pt) => ({ x: X(pt.t_min), y: Y(areaOf(pt)) }));
            return (
              <g key={s.id} onClick={() => onSelect(isSel ? null : s.id)} className="cursor-pointer">
                <path
                  d={path(pts)}
                  fill="none"
                  stroke={isCont ? "#e11d48" : isSel ? "#f59e0b" : "#0891b2"}
                  strokeWidth={isSel || isCont ? 3 : 1.6}
                  opacity={selected === null || isSel ? 0.95 : 0.3}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {/* playhead */}
          {(() => {
            const t = tracks.find((x) => x.frame === frame)?.t_min ?? 0;
            return <line x1={X(t)} x2={X(t)} y1={pad.t} y2={H - pad.b} stroke="#1c1917" strokeWidth={1.5} />;
          })()}
          <text x={W / 2} y={H - 6} fontSize={10} fill="#78716c" textAnchor="middle" fontFamily="monospace">
            time (s) → · click a curve to isolate track
          </text>
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <div className="rounded-xl bg-[#fafaf7] p-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500">total found over time</div>
          <svg viewBox="0 0 280 90" className="mt-1 w-full">
            <path
              d={counts
                .filter((c) => c.f <= frame)
                .map((c, i) => `${i === 0 ? "M" : "L"}${12 + (c.f / Math.max(1, counts[counts.length - 1].f)) * 256},${80 - (c.c / cMax) * 66}`)
                .join(" ")}
              fill="none"
              stroke="#1c1917"
              strokeWidth={2.5}
            />
          </svg>
          <div className="font-mono text-[12px] font-bold">
            n={counts.find((c) => c.f === frame)?.c ?? 0} <span className="font-normal text-stone-500">at f{frame}</span>
          </div>
        </div>
        <div className="rounded-xl bg-[#fafaf7] p-2.5 font-mono text-[11px] leading-relaxed text-stone-600">
          <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500">where numbers come from</div>
          <div className="mt-1">counted outlines per video moment — click any total to jump there</div>
          <div className="mt-1 text-emerald-700">every figure links to its video frame</div>
        </div>
      </div>
    </Card>
  );
}

export function QualityStrip({ quality, frame, onJump }: { quality: QualityFrame[]; frame: number; onJump: (f: number) => void }) {
  const bad = quality.filter((q) => q.bad);
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-stone-500">
        quality {quality.length - bad.length}/{quality.length} ok ·
      </span>
      {bad.slice(0, 6).map((q) => (
        <button
          key={q.frame}
          onClick={() => onJump(q.frame)}
          className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold ${q.frame === frame ? "border-amber-700 bg-amber-500 text-white" : "border-amber-900/20 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
        >
          f{q.frame} {q.reason}
        </button>
      ))}
      {bad.length === 0 && <span className="text-[12px] font-semibold text-emerald-700">all frames pass — safe to spend SAM budget</span>}
      {bad.length > 6 && <span className="font-mono text-[11px] text-stone-500">+{bad.length - 6} more</span>}
    </div>
  );
}
