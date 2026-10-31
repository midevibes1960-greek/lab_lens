# LabLens — zero-shot lab video analyst

Theme 2 · Indie · Meta Global AI Developer Hackathon

Phone time-lapse in → counts, growth curves, contamination alerts out. No training.

## Run it

```bash
cd lablens && npm install && npm run dev   # http://localhost:3000
npm test                                   # unit tests (tracking + validator)
npm run build
```

## Everything is real (read this first)

There is **no simulated data in this app** — the old canvas-colony demo was deleted. Upload a video or open a bundled real clip (Wikimedia, licensed) → the browser samples frames across the clip, computes per-frame quality from pixels (sharpness/exposure/glare), sends each frame to **SAM 3.1**, links boxes into persistent tracks in code (`src/lib/tracking.ts`), and **persists the track table** (`POST /api/tracks`). Counts, growth rates, CSV, `.md` report and `.ipynb` notebook are computed from *your* table. Muse Spark narrative is checked by a numeric validator (`src/lib/validate.ts`); Muse Wonder adjudication runs live from the flag card. Pre-saved genuine analyses ship for the tomato clip (2 seedlings × 10 frames) and lettuce clip (1 seedling emerging) so results are visible immediately; re-running replaces them. SAM returns nothing for the dense lentil sprouts — reported honestly, that clip is for human annotation practice.
- **Not yet measured:** accuracy vs human counters (study at `/study`, 10 clips required), time-to-result, cost/run. Targets are stated on `/evaluation` as targets, not results.

## Live Meta wiring

- Base `https://api.meta.ai/v1`, bearer `MODEL_API_KEY` (server-only, in `.env.local` — never committed, never logged).
- `POST /api/segment_track` with `{ imageDataUrl, concept }` → live `sam-3.1` via Responses API (noun-phrase concept; zero matches is a normal result). Without a frame it returns simulator row counts for demo ids only.
- `POST /api/agent/run { id }` → `muse-spark-1.3` narrative over that experiment's own track table; validator rejects ungrounded numbers and falls back to a computed narrative.
- `POST /api/wonder { trackId, frame, evidence }` → `muse-wonder-1.0` second opinion (called from the flag card in the UI).

## Architecture (video in → results down)

```
upload (subject + dish mm + prompt, streamed to disk)
  → browser: sample N frames → per-frame quality (pixels) → SAM 3.1 per frame
  → link boxes (IoU + centroid, greedy) → POST /api/tracks (persisted track table, ONE source of truth)
  → counts / curves / rates computed in code → flag_event → Wonder (on demand)
  → review (corrections persisted per experiment) + report (md / ipynb / csv)
```

API seam: `GET /api/track_table?id=`, `POST /api/check_quality`, `POST /api/segment_track`, `POST /api/tracks` + `GET /api/tracks?id=`, `POST /api/corrections` + `GET /api/corrections?id=`, `POST /api/agent/run`, `POST /api/wonder`, `POST /api/upload`, `GET /api/video/[id]` (Range streaming), `GET /api/report?id=&format=md|ipynb|csv`.

## Accuracy study (`/study`)

Two independent annotators (H1/H2) click-count the same sampled frames a clip was analysed on (`POST /api/annotations`, persisted per clip). `GET /api/accuracy?id=` scores the machine against them: final-frame count MAPE vs the human mean, inside-human-spread, human disagreement, detection precision/recall/F1 (greedy point↔centroid matching, `src/lib/accuracy.ts`), and per-frame count MAPE. Missing annotators or machine analysis returns an explicit status — never an estimate. 10 fully scored clips are required before any accuracy claim; `/study` shows progress and pooled pilot numbers.

## Track-table schema

`track_id, frame, t_min, x, y, area_px, area_mm2, solidity, confidence`

For real analyses `t_min` holds **video seconds** (reports say so); `solidity` is 0 (unknown — SAM boxes carry no mask solidity); `area_mm2` is 0 when uncalibrated. `GET /api/report?format=ipynb` embeds the full CSV so the notebook runs standalone.

## Demo (3:00)

0:00 hook (“two people disagree”) → 0:20 plain-language goal → 0:50 open tomato footage, saved SAM counts + growth curves → 1:30 re-run live with a different phrase, counts change → 2:00 honest evaluation page (study 0/10) → 2:30 upload a phone clip and run it end-to-end.

Start: **Tomato seedlings** (`/lab/real-tomato`).

## Honest scope

Macro-scale first (colonies, seeds, mold). Microscopy cells = stretch. Known limits: greedy box linking (not optimal assignment, no mask propagation), SAM cannot individuate dense masses (lentil sprouts), scale assumes the stated reference spans the frame width, uploads live in local `./uploads` (wiped by some redeploys), no auth/rate-limiting yet.
