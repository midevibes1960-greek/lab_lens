import Link from "next/link";
import { ArrowRight, ShieldCheck, ScanEye, FileText, FlaskConical, Play, Check, Upload, MousePointerClick } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { REAL_CLIPS } from "@/lib/lablens";
import { Badge, Card } from "@/components/chrome";
import { UploadBox } from "@/components/UploadBox";
import { RealClips } from "@/components/RealClips";

export default function Home() {
  return (
    <main>
      {/* hero — plain words first */}
      <section className="lab-grid border-b border-stone-200">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="green"><Check className="size-3" /> No training needed</Badge>
              <Badge tone="cyan">Works with a phone video</Badge>
            </div>
            <h1 className="mt-3 text-balance text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl">
              Counting colonies by hand is slow and two people disagree.
            </h1>
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-stone-700">
              <b>Upload a video of your plate or tray.</b> LabLens outlines and numbers everything,
              draws how each one grows, warns you about blurry footage or contamination,
              and writes up the results you can paste into your notebook.
            </p>
            <div className="mt-4 grid max-w-xl gap-2">
              {[
                ["1", "Upload your video + say what to count", "e.g. “count colonies, flag anything weird”"],
                ["2", "Watch it get outlined + counted", "every outline has a number; curves draw as it plays"],
                ["3", "Download results + report", "spreadsheet, charts, methods text — each number links to its frame"],
              ].map(([n, t, d]) => (
                <div key={n} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-900 text-[14px] font-black text-white">{n}</span>
                  <span><span className="block text-[14px] font-bold">{t}</span><span className="block text-[12px] text-stone-500">{d}</span></span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/upload" className="flex items-center gap-1.5 rounded-full bg-cyan-700 px-5 py-3 text-[14px] font-bold text-white shadow hover:bg-cyan-600">
                <Upload className="size-4" /> Upload your video
              </Link>
              <Link href="/lab/real-tomato" className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-5 py-3 text-[14px] font-bold hover:border-stone-900">
                <Play className="size-4" /> See it on real footage
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold text-stone-500">
              <span className="rounded-full bg-white border border-stone-200 px-3 py-1.5">✓ real SAM analysis on your video</span>
              <span className="rounded-full bg-white border border-stone-200 px-3 py-1.5">✓ accuracy study still to run — we say so</span>
              <span className="rounded-full bg-white border border-stone-200 px-3 py-1.5">✓ shows its mistakes</span>
            </div>
          </div>

          {/* upload card */}
          <div id="upload">
          <Card className="h-fit overflow-hidden ring-2 ring-cyan-700/20">
            <div className="border-b border-stone-100 bg-cyan-50/60 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight"><MousePointerClick className="size-4 text-cyan-800" /> Start here — 30 seconds</div>
              <div className="text-[12px] text-stone-600">Drop a video, or open real footage below — analysed live by SAM 3.1</div>
            </div>
            <div className="p-4">
              <UploadBox defaultPrompt="count colonies on the plate and track each one's area, flag anything fast-spreading" />
              <div className="mt-3 grid gap-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">No video handy? Real footage (Wikimedia, licensed)</div>
                {REAL_CLIPS.map((c) => (
                  <Link key={c.id} href={`/lab/${c.id}`} className="group flex items-center gap-3 rounded-xl border border-stone-200 p-2.5 hover:border-cyan-700 hover:bg-cyan-50/40">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-stone-900 text-white"><FlaskConical className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold">{c.title}</span>
                      <span className="block truncate text-[11px] text-stone-500">Try “{c.concept}” · {c.license}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-stone-400 group-hover:text-cyan-800" />
                  </Link>
                ))}
              </div>
            </div>
          </Card>
          </div>
        </div>
      </section>

      {/* how it works — no jargon */}
      <section id="how" className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <RealClips />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h2 className="text-xl font-black tracking-tight">What happens after you upload?</h2>
        <p className="mt-1 max-w-2xl text-[14px] text-stone-600">Four checks, in order. You can click every number to see the exact video frame it came from.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {(
            [
              ["1 · Is the video OK?", "We flag blurry, shaky or glare moments first — so you don't waste time on bad footage.", ShieldCheck],
              ["2 · Everything gets outlined", "Each colony/seed gets an outline + number that follows it through the video.", ScanEye],
              ["3 · Counts + growth charts", "Totals over time, how fast each one grows, plus warnings for odd ones.", FileText],
              ["4 · You check + download", "The unsure ones are shown first. One click to fix. Then spreadsheet + report.", Check],
            ] as [string, string, LucideIcon][]
          ).map(([t, d, Icon]) => (
            <Card key={t} className="p-4">
              <Icon className="size-5 text-cyan-800" />
              <div className="mt-1.5 text-[14px] font-bold">{t}</div>
              <div className="mt-0.5 text-[13px] leading-relaxed text-stone-600">{d}</div>
            </Card>
          ))}
        </div>
        <details className="mt-2 rounded-2xl border border-stone-200 bg-white p-3 text-[12px] text-stone-600">
          <summary className="cursor-pointer font-bold text-stone-800">For experts + judges: models, tools, numbers</summary>
          <p className="mt-1 font-mono leading-relaxed">
            Every video: browser samples frames + computes quality from pixels → SAM 3.1 segments each frame from a noun-phrase prompt →
            boxes linked into tracks in code → track table persisted per experiment is the only source of truth →
            Muse Spark 1.3 writes the narrative (server-side numeric validator rejects ungrounded figures) → Muse Wonder adjudicates flagged tracks on demand.
            There is no simulated data in this app. Targets (not yet measured): count error ≤10% vs 2 humans, tracking &lt;5 ID
            switches/100, growth error &lt;15%, &lt;5 min, &lt;$1.50/run. Honest status in <Link href="/evaluation" className="underline">How accurate?</Link>
          </p>
        </details>
      </section>

      {/* trust */}
      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-black tracking-tight">Why you can trust it</h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
              {[
                "Accuracy study vs two human counters is still to run — we publish targets and say what is unmeasured, rather than inventing numbers.",
                "Every number clicks through to the video frames behind it.",
                "It shows its mistakes by cause (merged blobs, glare, blur) — with the worst examples.",
                "Blurry/shaky parts are flagged before you spend anything.",
              ].map((x) => (
                <li key={x} className="flex gap-2 rounded-xl border border-emerald-900/10 bg-emerald-50/60 p-2.5 text-emerald-950"><Check className="mt-0.5 size-4 shrink-0" />{x}</li>
              ))}
            </ul>
            <Link href="/evaluation" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-[13px] font-bold hover:border-stone-900">
              See the accuracy numbers <ArrowRight className="size-4" />
            </Link>
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">The 30-second tour</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              {[
                ["1", "Open the tomato footage — two real seedlings, already analysed by SAM."],
                ["2", "See the saved track table: counts per sampled frame, growth curves from SAM boxes."],
                ["3", "Re-run it yourself with a different phrase and watch the counts change — nothing is canned."],
                ["4", "Download the spreadsheet + report, then click-count it yourself in the accuracy study."],
              ].map(([n, d]) => (
                <div key={n} className="flex gap-3 rounded-xl border border-stone-200 bg-[#fafaf7] p-2.5 text-[13px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-900 text-[12px] font-black text-white">{n}</span><span className="text-stone-700">{d}</span>
                </div>
              ))}
            </div>
            <Link href="/lab/real-tomato" className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-stone-900 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-stone-700">
              <Play className="size-4" /> Start the tour — tomato seedlings
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
