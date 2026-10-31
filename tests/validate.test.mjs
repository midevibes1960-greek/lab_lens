import { test } from "node:test";
import assert from "node:assert/strict";
import { ungroundedNumbers, fallbackNarrative } from "../src/lib/validate.ts";

const summary = { finalCount: 15, rows: 1186, medianRate: 0.123, maxCount: 15 };

test("grounded narrative passes", () => {
  assert.deepEqual(ungroundedNumbers("Final count 15 objects across 1186 rows. Median rate 0.12.", summary), []);
});

test("invented count is flagged", () => {
  const bad = ungroundedNumbers("We found 42 colonies, a superb result.", summary);
  assert.ok(bad.includes(42));
});

test("fallback narrative is grounded by construction", () => {
  assert.deepEqual(ungroundedNumbers(fallbackNarrative(summary), summary), []);
});
