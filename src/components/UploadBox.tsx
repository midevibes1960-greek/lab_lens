"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export function UploadBox({ defaultPrompt }: { defaultPrompt: string }) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [subject, setSubject] = useState("colonies");
  const [dishMm, setDishMm] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const send = async (f: File | undefined) => {
    if (!f || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("prompt", prompt);
      fd.append("subject", subject);
      fd.append("plateDiameterMm", String(dishMm));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "upload failed");
      setDone(`Saved ${f.name} — opening lab…`);
      router.push(j.labUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          send(e.dataTransfer.files?.[0]);
        }}
        className="grid cursor-pointer place-items-center gap-1.5 rounded-2xl border-2 border-dashed border-stone-300 bg-[#fafaf7] px-4 py-8 text-center hover:border-stone-900"
      >
        {busy ? <Loader2 className="size-5 animate-spin text-stone-500" /> : <Upload className="size-5 text-stone-500" />}
        <span className="text-[13px] font-bold">{busy ? "Uploading…" : "Drop .mp4 / .mov (phone on stand works) or click"}</span>
        <span className="text-[11px] text-stone-500">≤200 MB · stored on server · playable in the viewer + first frame to SAM 3.1</span>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => send(e.target.files?.[0])} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-stone-500">subject
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-[13px] normal-case focus:border-stone-900 focus:outline-none">
            <option value="colonies">colonies</option>
            <option value="seeds">seeds / seedlings</option>
            <option value="mold">mold</option>
          </select>
        </label>
        <label className="block text-[11px] font-bold uppercase tracking-wide text-stone-500">dish / tray width (mm)
          <input type="number" min={10} max={1000} value={dishMm} onChange={(e) => setDishMm(Number(e.target.value) || 90)} className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-[13px] focus:border-stone-900 focus:outline-none" />
        </label>
      </div>
      <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-stone-500">plain-language goal (sent with the video)</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 font-mono text-[12px] focus:border-stone-900 focus:outline-none"
      />
      {error && (
        <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-rose-900/15 bg-rose-50 p-2.5 text-[12px] font-semibold text-rose-800">
          <AlertTriangle className="size-4" /> {error}
        </div>
      )}
      {done && (
        <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-emerald-900/15 bg-emerald-50 p-2.5 text-[12px] font-semibold text-emerald-800">
          <CheckCircle2 className="size-4" /> {done}
        </div>
      )}
    </div>
  );
}
