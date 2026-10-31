"use client";
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-stone-200 bg-white shadow-[0_1px_0_rgb(0_0_0/0.04),0_8px_24px_-16px_rgb(0_0_0/0.25)]", className)}>
      {children}
    </div>
  );
}

export function CardHead({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400">{kicker}</div>
        <div className="truncate text-[14px] font-bold tracking-tight">{title}</div>
      </div>
      <div className="ml-auto shrink-0">{right}</div>
    </div>
  );
}

export function Badge({ tone = "stone", children }: { tone?: "stone" | "green" | "amber" | "rose" | "cyan" | "ink"; children: ReactNode }) {
  const map: Record<string, string> = {
    stone: "border-stone-200 bg-stone-100 text-stone-700",
    green: "border-emerald-900/15 bg-emerald-50 text-emerald-800",
    amber: "border-amber-900/15 bg-amber-50 text-amber-800",
    rose: "border-rose-900/15 bg-rose-50 text-rose-800",
    cyan: "border-cyan-900/15 bg-cyan-50 text-cyan-900",
    ink: "border-stone-900 bg-stone-900 text-white",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold", map[tone])}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-[#fafaf7] px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="font-mono text-[20px] font-bold leading-tight tracking-tight">{value}</div>
      {sub && <div className="text-[11px] leading-snug text-stone-500">{sub}</div>}
    </div>
  );
}

export function Provenance({ frames, onJump }: { frames: number[]; onJump: (f: number) => void }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px]">
      <span className="font-semibold text-stone-500">evidence:</span>
      {frames.slice(0, 3).map((f) => (
        <button
          key={f}
          onClick={() => onJump(f)}
          className="rounded-md border border-stone-200 bg-white px-1.5 py-0.5 font-mono font-bold text-cyan-800 hover:border-cyan-600 hover:bg-cyan-50"
        >
          f{f}
        </button>
      ))}
    </span>
  );
}
