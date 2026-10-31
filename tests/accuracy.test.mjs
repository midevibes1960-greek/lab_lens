import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPoints, scoreClip, machineFramesFromTracks } from "../src/lib/accuracy.ts";

test("matchPoints: near points match, far points do not", () => {
  const human = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.6 }];
  const machine = [{ x: 0.31, y: 0.41 }, { x: 0.1, y: 0.1 }];
  const r = matchPoints(human, machine, 0.08);
  assert.equal(r.tp, 1);
  assert.equal(r.fp, 1);
  assert.equal(r.fn, 1);
  assert.equal(r.precision, 0.5);
  assert.equal(r.recall, 0.5);
});

test("scoreClip refuses to score with one annotator", () => {
  const ann = { id: "c", updatedAt: "", annotators: { H1: { frames: [{ frame: 0, t_s: 10, points: [{ x: 0.3, y: 0.4 }] }] } } };
  const machine = machineFramesFromTracks([{ frame: 5, t_min: 10, x: 0.3, y: 0.4 }]);
  const s = scoreClip("c", ann, machine);
  assert.equal(s.status, "needs-2-annotators");
  assert.equal(s.countMape, null);
});

test("scoreClip computes MAPE, spread and F1 with two annotators", () => {
  const pts = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.6 }];
  const ann = {
    id: "c", updatedAt: "",
    annotators: {
      H1: { frames: [{ frame: 0, t_s: 10, points: pts }] },
      H2: { frames: [{ frame: 0, t_s: 10, points: pts }] },
    },
  };
  const machine = machineFramesFromTracks([
    { frame: 5, t_min: 10, x: 0.3, y: 0.4 },
    { frame: 5, t_min: 10, x: 0.7, y: 0.6 },
  ]);
  const s = scoreClip("c", ann, machine);
  assert.equal(s.status, "scored");
  assert.equal(s.countMape, 0);
  assert.equal(s.insideHumanSpread, true);
  assert.equal(s.meanF1, 1);
  assert.equal(s.humanAgreement, 0);
});

test("scoreClip reports missing machine honestly", () => {
  const s = scoreClip("c", null, null);
  assert.equal(s.status, "needs-annotations");
  assert.equal(s.countMape, null);
});
