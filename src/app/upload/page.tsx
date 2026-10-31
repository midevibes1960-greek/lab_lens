"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, ArrowRight, ShieldCheck, ScanEye, FileText, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/chrome";
import { UploadBox } from "@/components/UploadBox";
import { RealClips } from "@/components/RealClips";

interface UploadRec {
  id: string;
  filename: string;
  prompt: string;
  size: number;
  createdAt: string;
}

export default function UploadPage() {
  const [recs, setRecs] = useState<UploadRec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/upload")
      .then((r) => r.json())
      .then((j) => setRecs(j.uploads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="text-center">
        <h1 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">
          Upload your lab video.<br />Get counts, curves + a report.
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-[14px] leading-relaxed text-stone-600">
          Phone on a stand works fine. We check quality first (free), then count everything frame by frame.
          Nothing to install, nothing to train.
        </p>
      </div>

      <Card className="mt-5 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-cyan-700 text-white"><Upload className="size-4" /></span>
          <div>
            <div className="text-[15px] font-bold">Step 1 — drop your time-lapse</div>
            <div className="text-[12px] text-stone-500">.mp4 / .mov, up to 200 MB · then tell us what to count</div>
          </div>
        </div>
        <div className="mt-3">
          <UploadBox defaultPrompt="count colonies on the plate and track each one's area, flag anything fast-spreading" />
        </div>
      </Card>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(
          [
            ["2 · We check it", "Blurry, shaky or glare frames are flagged before anything costs you.", ShieldCheck],
            ["3 · We count it", "Every colony outlined + numbered. Curves grow as the video plays.", ScanEye],
            ["4 · You get results", "Report, spreadsheet + charts. Every number links to its video frame.", FileText],
          ] as [string, string, LucideIcon][]
        ).map(([t, d, Icon]) => {
          return (
            <Card key={t} className="p-3.5">
              <Icon className="size-4 text-cyan-800" />
              <div className="mt-1 text-[13px] font-bold">{t}</div>
              <div className="text-[12px] text-stone-600">{d}</div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <div className="border-b border-stone-100 px-4 py-3 text-[14px] font-bold">What films well? (2-minute checklist)</div>
        <ul className="flex flex-col gap-1 p-4 text-[13px] text-stone-600">
          <li>✓ <b>Top-down, still camera</b> — phone on a stand, plate filling the frame.</li>
          <li>✓ <b>One dish/tray per video</b>, even light, no moving shadows or hands in frame.</li>
          <li>✓ <b>Know your dish size</b> (e.g. 90 mm) — it sets the millimetre scale.</li>
          <li>✗ A laptop screen, a crowded bench, or a moving camera won’t analyse — SAM will honestly return nothing.</li>
        </ul>
      </Card>

      <div className="mt-4"><RealClips /></div>

      <Card className="mt-4">
        <div className="border-b border-stone-100 px-4 py-3 text-[14px] font-bold">Your uploads on this device</div>
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-[13px] text-stone-500"><Loader2 className="size-4 animate-spin" /> Loading…</div>
        ) : recs.length === 0 ? (
          <div className="p-4 text-[13px] text-stone-500">
            Nothing yet. Upload above — or <Link href="/lab/real-tomato" className="font-bold text-cyan-800 hover:underline">open real footage instead <ArrowRight className="inline size-3.5" /></Link>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recs.map((r) => (
              <Link key={r.id} href={`/lab/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafaf7]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{r.filename}</span>
                  <span className="block truncate font-mono text-[11px] text-stone-500">{r.prompt} · {(r.size / 1048576).toFixed(1)} MB</span>
                </span>
                <span className="flex items-center gap-1 rounded-full bg-stone-900 px-3 py-1.5 text-[12px] font-bold text-white">Open results <ArrowRight className="size-3.5" /></span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
