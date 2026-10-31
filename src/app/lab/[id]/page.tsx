import { notFound } from "next/navigation";
import { readFile } from "fs/promises";
import path from "path";
import { REAL_CLIPS, getRealClip, type Subject } from "@/lib/lablens";
import { LabClient } from "@/components/LabClient";

export function generateStaticParams() {
  return REAL_CLIPS.map((c) => ({ id: c.id }));
}

async function uploadMeta(id: string) {
  try {
    const raw = await readFile(path.join(process.cwd(), "uploads", `${id}.json`), "utf8");
    return JSON.parse(raw) as { prompt: string; filename: string; subject?: string; plateDiameterMm?: number };
  } catch {
    return null;
  }
}

const SUBJECTS: Subject[] = ["colonies", "seeds", "mold"];

export default async function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.startsWith("upload-")) {
    const u = await uploadMeta(id);
    if (!u) notFound();
    return (
      <LabClient
        key={id}
        meta={{
          id,
          title: `Upload — ${u.filename}`,
          prompt: u.prompt,
          subject: SUBJECTS.includes(u.subject as Subject) ? (u.subject as Subject) : "colonies",
          plateDiameterMm: u.plateDiameterMm ?? 90,
        }}
        videoUrl={`/api/video/${id}`}
      />
    );
  }
  const real = getRealClip(id);
  if (real) {
    return (
      <LabClient
        key={id}
        meta={{ id, title: `Real footage — ${real.title}`, prompt: real.prompt, subject: "seeds", plateDiameterMm: 120 }}
        videoUrl={real.src}
      />
    );
  }
  notFound();
}
