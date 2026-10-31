// Server-side persistence for REAL analyses (uploads + real clips).
// One JSON per experiment in ./uploads (already gitignored, survives route
// calls; note in /api/video route applies: redeploys may wipe it).
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { TrackPoint } from "./lablens";

export const UP_DIR = path.join(process.cwd(), "uploads");

export function safeId(id: string): string | null {
  return /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,80}$/.test(id) ? id : null;
}

export interface StoredQuality {
  frame: number;
  t_s: number;
  sharpness: number;
  exposure: number;
  glare: number;
  bad: boolean;
  reason: string | null;
}

export interface StoredAnalysis {
  id: string;
  title: string;
  prompt: string;
  concept: string;
  source: "live-sam-3.1";
  plateDiameterMm: number;
  pxPerMm: number | null; // null = uncalibrated (areas reported in px)
  videoDurationS: number | null;
  framesSampled: number;
  createdAt: string;
  tracks: TrackPoint[];
  quality: StoredQuality[];
}

async function ensure() {
  await mkdir(UP_DIR, { recursive: true });
}

export async function saveAnalysis(a: StoredAnalysis): Promise<void> {
  const id = safeId(a.id);
  if (!id) throw new Error("bad id");
  await ensure();
  await writeFile(path.join(UP_DIR, `${id}.tracks.json`), JSON.stringify(a));
}

export async function loadAnalysis(id: string): Promise<StoredAnalysis | null> {
  const sid = safeId(id);
  if (!sid) return null;
  try {
    return JSON.parse(await readFile(path.join(UP_DIR, `${sid}.tracks.json`), "utf8")) as StoredAnalysis;
  } catch {
    return null;
  }
}

export async function saveCorrections(id: string, corrections: Record<number, string>): Promise<void> {
  const sid = safeId(id);
  if (!sid) throw new Error("bad id");
  await ensure();
  await writeFile(path.join(UP_DIR, `${sid}.corrections.json`), JSON.stringify(corrections));
}

export async function loadCorrections(id: string): Promise<Record<number, string>> {
  const sid = safeId(id);
  if (!sid) return {};
  try {
    return JSON.parse(await readFile(path.join(UP_DIR, `${sid}.corrections.json`), "utf8")) as Record<number, string>;
  } catch {
    return {};
  }
}

import type { AnnotationSet } from "./accuracy";

export async function saveAnnotations(a: AnnotationSet): Promise<void> {
  const id = safeId(a.id);
  if (!id) throw new Error("bad id");
  await ensure();
  await writeFile(path.join(UP_DIR, `${id}.annotations.json`), JSON.stringify(a));
}

export async function loadAnnotations(id: string): Promise<AnnotationSet | null> {
  const sid = safeId(id);
  if (!sid) return null;
  try {
    return JSON.parse(await readFile(path.join(UP_DIR, `${sid}.annotations.json`), "utf8")) as AnnotationSet;
  } catch {
    return null;
  }
}

export interface UploadMetaFile {
  id: string;
  filename: string;
  ext: string;
  size: number;
  type: string;
  prompt: string;
  subject: string;
  plateDiameterMm?: number;
  createdAt: string;
}

export async function loadUploadMeta(id: string): Promise<UploadMetaFile | null> {
  const sid = safeId(id);
  if (!sid) return null;
  try {
    return JSON.parse(await readFile(path.join(UP_DIR, `${sid}.json`), "utf8")) as UploadMetaFile;
  } catch {
    return null;
  }
}
