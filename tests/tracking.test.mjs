import { test } from "node:test";
import assert from "node:assert/strict";
import { linkFrames, iou, countsFromTracks } from "../src/lib/tracking.ts";

const box = (frame, x, y, s = 20) => ({ id: 99, frame, x1: x, y1: y, x2: x + s, y2: y + s, w: 200, h: 200, c: 0.9 });

test("iou: identical boxes = 1, disjoint = 0", () => {
  const a = box(0, 10, 10);
  assert.equal(iou(a, a), 1);
  assert.equal(iou(a, box(0, 150, 150)), 0);
});

test("linkFrames keeps identity for a moving object and births new tracks", () => {
  const frames = [
    [box(0, 10, 10), box(0, 120, 120)],
    [box(1, 14, 12), box(1, 122, 118)],
    [box(2, 18, 14), box(2, 124, 116), box(2, 60, 150)], // third object appears
  ];
  const tracks = linkFrames(frames, { tMinOf: (f) => f * 10, pxPerMm: 10 });
  const counts = countsFromTracks(tracks);
  assert.deepEqual(counts.map((c) => c.count), [2, 2, 3]);
  const t1 = tracks.filter((t) => t.track_id === 1);
  assert.equal(t1.length, 3);
  assert.ok(t1.every((t, i) => t.t_min === i * 10));
  assert.ok(t1[0].area_mm2 > 0); // (20*20)/(10*10) = 4
  assert.equal(t1[0].area_mm2, 4);
});

test("linkFrames does not link far jumps", () => {
  const frames = [[box(0, 10, 10)], [box(1, 160, 160)]];
  const tracks = linkFrames(frames, { tMinOf: (f) => f, pxPerMm: 0 });
  assert.equal(new Set(tracks.map((t) => t.track_id)).size, 2);
  assert.equal(tracks[0].area_mm2, 0); // uncalibrated
});

test("empty frames produce no tracks", () => {
  assert.deepEqual(linkFrames([[], []], { tMinOf: (f) => f, pxPerMm: 1 }), []);
});
