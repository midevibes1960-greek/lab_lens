"use client";
import { useRouter } from "next/navigation";
import { Play, ArrowRight } from "lucide-react";
import { REAL_CLIPS } from "@/lib/lablens";
import { Card } from "./chrome";

export function RealClips({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-stone-100 bg-emerald-50/60 px-4 py-3">
        <div className="text-[14px] font-bold">No camera? Use real footage — free, licensed, downloadable</div>
        <div className="text-[12px] text-stone-600">Real germination time-lapses from Wikimedia Commons. Click through to analyse with SAM 3.1.</div>
      </div>
      <div className={`grid gap-2 p-3 ${compact ? "" : "sm:grid-cols-3"}`}>
        {REAL_CLIPS.map((c) => (
          <div
            key={c.id}
            onClick={() => router.push(`/lab/${c.id}`)}
            className="cursor-pointer overflow-hidden rounded-xl border border-stone-200 hover:border-emerald-700"
          >
            <div className="relative bg-black">
              <video src={c.src} preload="metadata" muted playsInline className="block aspect-video w-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/25">
                <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold"><Play className="size-3.5" /> Analyse</span>
              </span>
            </div>
            <div className="p-2.5">
              <div className="text-[13px] font-bold leading-tight">{c.title}</div>
              <div className="mt-0.5 font-mono text-[11px] text-stone-500">{c.duration} · try “{c.concept}”</div>
              <div className="mt-1 text-[11px] text-stone-500">
                <a href={c.creditUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="hover:underline">{c.credit}</a>
                {" · "}
                <a href={c.licenseUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="hover:underline">{c.license}</a>
              </div>
              <span className="mt-1.5 flex items-center gap-1 text-[12px] font-bold text-emerald-800">Open in LabLens <ArrowRight className="size-3.5" /></span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
