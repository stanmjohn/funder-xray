// Deterministic tests over synthetic filing series with hand-checkable math.
// The live API is not called here, shape drift in the API is test/shape.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cagr, spendRate, revenueSwings, leverage, classify } from "../src/metrics.mjs";

function filing(year, revenue, expenses, assetsEnd, liabilitiesEnd = 0, formType = 2) {
  return { year, revenue, expenses, assetsEnd, liabilitiesEnd, formType, pdfUrl: null };
}

test("cagr computes compound growth across the series", () => {
  // 100 -> 121 over 2 years is 10% a year exactly.
  const f = [filing(2020, 0, 0, 100), filing(2021, 0, 0, 900), filing(2022, 0, 0, 121)];
  assert.equal(cagr(f, "assetsEnd"), 10);
});

test("cagr returns null when fewer than two positive values exist", () => {
  assert.equal(cagr([filing(2022, 0, 0, 100)], "assetsEnd"), null);
  assert.equal(cagr([], "assetsEnd"), null);
});

test("spendRate averages expenses over end-of-year assets", () => {
  const f = [filing(2021, 0, 5, 100), filing(2022, 0, 7, 100)];
  const s = spendRate(f);
  assert.equal(s.perYear.length, 2);
  assert.equal(s.perYear[0].rate, 5);
  assert.equal(s.average, 6);
});

test("revenueSwings flags only moves past the threshold", () => {
  const f = [filing(2020, 100, 0, 1), filing(2021, 129, 0, 1), filing(2022, 300, 0, 1)];
  const swings = revenueSwings(f, 30);
  assert.equal(swings.length, 1);
  assert.equal(swings[0].from, 2021);
  assert.equal(swings[0].changePct, 132.6);
});

test("leverage uses the latest year carrying both figures", () => {
  const f = [filing(2021, 0, 0, 100, 40), filing(2022, 0, 0, 200, 30), { year: 2023, revenue: 1, expenses: 1, assetsEnd: 0, liabilitiesEnd: 5, formType: 2 }];
  const l = leverage(f);
  assert.equal(l.year, 2022);
  assert.equal(l.pct, 15);
});

test("classify flags a private foundation spending under the 5% floor", () => {
  const org = { filings: [filing(2021, 10, 2, 100), filing(2022, 10, 3, 100)] };
  const c = classify(org);
  assert.equal(c.kind, "private-foundation");
  assert.ok(c.notes.some((n) => n.includes("5%")));
});

test("classify stays quiet about the floor for public charities", () => {
  const org = { filings: [filing(2021, 10, 2, 100, 0, 0), filing(2022, 10, 3, 100, 0, 0)] };
  const c = classify(org);
  assert.equal(c.kind, "public-charity");
  assert.equal(c.notes.length, 0);
});

test("classify names a shrinking-assets pattern", () => {
  const org = { filings: [filing(2020, 10, 8, 100), filing(2022, 10, 8, 64)] };
  const c = classify(org);
  assert.ok(c.notes.some((n) => n.includes("spend-down")));
});

test("reserveMonths uses the latest year with expenses and assets", async () => {
  const { reserveMonths } = await import("../src/metrics.mjs");
  const f = [filing(2021, 0, 120, 60), filing(2022, 0, 120, 30)];
  const r = reserveMonths(f);
  assert.equal(r.year, 2022);
  assert.equal(r.months, 3);
});

test("classify flags a public charity under three months of reserve", async () => {
  const { classify: c2 } = await import("../src/metrics.mjs");
  const org = { filings: [filing(2022, 100, 120, 20, 0, 0)] };
  const c = c2(org);
  assert.equal(c.kind, "public-charity");
  assert.equal(c.reserveMonths, 2);
  assert.ok(c.notes.some((n) => n.includes("months of spending")));
});
