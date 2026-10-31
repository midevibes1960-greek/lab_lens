"use client";
import { useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import type { LabConfig } from "@/lib/lablens";
import { getRealClip } from "@/lib/lablens";
import { RealFootage } from "./RealFootage";
import { StoredResults } from "./StoredResults";

// Real-only lab page: a video, SAM analysis on its frames, and results
// computed from the persisted track table. No simulated data anywhere.
export function LabClient({ meta, videoUrl }: { meta: LabConfig; videoUrl: string }) {
  const [prompt, setPrompt] = useState(meta.prompt);
  const [reloadKey, setReloadKey] = useState(0);
  const isUpload = meta.id.startsWith("upload-");

  return (
    <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <div className="rounded-2xl border border-cyan-900/15 bg-cyan-50/60 p-3.5">
        <div className="text-[15px] font-bold tracking-tight">{meta.title}</div>
        <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-stone-600">
          {isUpload ? "Your uploaded video. " : "Real footage (see credit on the home page). "}
          Run <b>full-video analysis</b>: frames are sampled across the clip, each is sent to SAM 3.1, boxes are linked into tracks,
          and every result below is computed from that saved track table. Accuracy vs human counters is measured in the{" "}
          <Link href="/study" className="font-bold text-cyan-800 hover:underline">accuracy study</Link>.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-[12px] font-bold text-stone-500">Your goal (for the report):</span>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            aria-label="analysis goal for the report"
            className="min-w-64 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] focus:border-cyan-700 focus:outline-none"
          />
          <Link href="/upload" className="flex items-center gap-1.5 rounded-full bg-cyan-700 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-cyan-600">
            <Upload className="size-3.5" /> Use my own video
          </Link>
        </div>
      </div>

      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <RealFootage
            videoUrl={videoUrl}
            prompt={prompt}
            experimentId={meta.id}
            defaultConcept={getRealClip(meta.id)?.concept}
            plateDiameterMm={meta.plateDiameterMm}
            onSaved={() => setReloadKey((k) => k + 1)}
          />
        </div>
        <div className="flex flex-col gap-2.5 lg:col-span-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="text-[14px] font-bold">What happens next?</div>
            <ol className="mt-1.5 flex flex-col gap-1.5 text-[13px] text-stone-600">
              <li><b>1.</b> (Optional) Pause on a clear frame and use <b>Check this frame</b> to test your noun phrase.</li>
              <li><b>2.</b> Run <b>full-video analysis</b>: sampled frames → SAM 3.1 → tracks saved. Results below update automatically.</li>
              <li><b>3.</b> Review flags, correct unsure tracks, download CSV / report / notebook, then have two people click-count the same frames in the <Link href="/study" className="font-bold text-cyan-800 hover:underline">accuracy study</Link>.</li>
            </ol>
            <p className="mt-2 rounded-xl bg-[#fafaf7] p-2.5 text-[12px] text-stone-500">
              SAM only receives the short noun phrase next to the video — not your goal sentence. If SAM finds nothing, that is reported honestly (try a closer frame or shorter phrase).
            </p>
          </div>
        </div>
      </div>

      <div className="mt-2.5">
        <StoredResults experimentId={meta.id} reloadKey={reloadKey} />
      </div>
    </main>
  );
}
