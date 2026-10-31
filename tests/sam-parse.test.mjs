import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSamBoxes } from "../src/lib/meta.ts";

// Real SAM 3.1 delta shape captured live (masks truncated).
const SAMPLE =
  "<0f>0<|box;x1=140;y1=140;x2=260;y2=260;w=768;h=768;c=0.9609|><|mask;x=0;y=0;c=0.9609;data=121,121,abc|>,1<|box;x1=455;y1=255;x2=545;y2=345;w=768;h=768;c=0.9569|><|mask;x=0;y=0;c=0.9;data=91,91,xyz|>\n<1f>0<|box;x1=10;y1=20;x2=60;y2=80;w=768;h=768|>";

test("parses boxes across frames incl. mask records between boxes", () => {
  const boxes = parseSamBoxes(SAMPLE);
  assert.equal(boxes.length, 3);
  assert.deepEqual(
    boxes.map((b) => [b.frame, b.id, b.x1, b.y1, b.x2, b.y2]),
    [
      [0, 0, 140, 140, 260, 260],
      [0, 1, 455, 255, 545, 345],
      [1, 0, 10, 20, 60, 80],
    ]
  );
  assert.ok(Math.abs(boxes[0].c - 0.9609) < 1e-9);
  assert.equal(boxes[2].c, undefined);
});

test("empty output = zero matches, not an error", () => {
  assert.deepEqual(parseSamBoxes(""), []);
  assert.deepEqual(parseSamBoxes("<0f>"), []);
});
