// Deterministic tests over synthetic filing series with hand-checkable math.
// The live API is not called here. Shape drift in the API is test/shape.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cagr, growth, spendRate, payout, revenueSwings, assetSwings, seriesGaps, leverage,
  classify, reserveMonths, fullYears, pdfOnlyYears, grantSummary,
} from "../src/metrics.mjs";
import { normalizeOrganization } from "../src/propublica.mjs";

function filing(year, revenue, expenses, assetsEnd, liabilitiesEnd = 0, formType = 2) {
  return { year, revenue, expenses, assetsEnd, liabilitiesEnd, formType, pdfUrl: null, short: false, months: 12 };
}

function pfFiling(year, disbursements, fmv, required, grants = disbursements) {
  return { ...filing(year, 0, 0, fmv), charitableDisbursements: disbursements, fmvAssets: fmv, distributableAmount: required, grantsPaid: grants };
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

test("growth names the base year and base value it starts from", () => {
  const g = growth([filing(2017, 0, 0, 100), filing(2019, 0, 0, 121)], "assetsEnd");
  assert.deepEqual(g, { pct: 10, fromYear: 2017, fromValue: 100, toYear: 2019 });
});

test("spendRate averages expenses over end-of-year assets", () => {
  const s = spendRate([filing(2021, 0, 5, 100), filing(2022, 0, 7, 100)]);
  assert.equal(s.perYear.length, 2);
  assert.equal(s.perYear[0].rate, 5);
  assert.equal(s.average, 6);
});

test("payout divides charitable disbursements by fair market value and checks the required payout", () => {
  const p = payout([pfFiling(2021, 6, 100, 5), pfFiling(2022, 4, 100, 5)]);
  assert.equal(p.perYear[0].rate, 6);
  assert.equal(p.perYear[0].met, true);
  assert.equal(p.perYear[1].met, false);
  assert.equal(p.average, 5);
  assert.equal(p.tested, 2);
  assert.equal(p.met, 1);
  assert.deepEqual(p.shortYears, [2022]);
});

test("payout leaves a short year out of the average and the count", () => {
  const short = { ...pfFiling(2022, 1, 100, 2), short: true, months: 3 };
  const p = payout([pfFiling(2021, 6, 100, 5), short]);
  assert.equal(p.perYear.length, 2);
  assert.equal(p.average, 6);
  assert.equal(p.tested, 1);
});

test("revenueSwings flags only moves past the threshold", () => {
  const f = [filing(2020, 100, 0, 1), filing(2021, 129, 0, 1), filing(2022, 300, 0, 1)];
  const swings = revenueSwings(f, 30);
  assert.equal(swings.length, 1);
  assert.equal(swings[0].from, 2021);
  assert.equal(swings[0].changePct, 132.6);
});

test("revenueSwings skips a pair of filings split by missing years", () => {
  // 100 -> 300 across 2015 to 2019 is not a year-over-year move.
  const f = [filing(2015, 100, 0, 1), filing(2019, 300, 0, 1), filing(2020, 310, 0, 1)];
  assert.equal(revenueSwings(f, 30).length, 0);
  assert.deepEqual(seriesGaps(f), [{ from: 2015, to: 2019 }]);
});

test("assetSwings flags an adjacent-year asset move past the threshold", () => {
  // 400 -> 200 is -50%, 200 -> 220 is +10%.
  const s = assetSwings([filing(2011, 0, 0, 400), filing(2012, 0, 0, 200), filing(2013, 0, 0, 220)], 30);
  assert.equal(s.length, 1);
  assert.equal(s[0].to, 2012);
  assert.equal(s[0].changePct, -50);
});

test("leverage uses the latest year carrying both figures", () => {
  const f = [filing(2021, 0, 0, 100, 40), filing(2022, 0, 0, 200, 30), { ...filing(2023, 1, 1, 0, 5) }];
  const l = leverage(f);
  assert.equal(l.year, 2022);
  assert.equal(l.pct, 15);
});

test("classify flags a private foundation spending under the 5% floor when no payout fields exist", () => {
  const c = classify({ filings: [filing(2021, 10, 2, 100), filing(2022, 10, 3, 100)] });
  assert.equal(c.kind, "private-foundation");
  assert.ok(c.notes.some((n) => n.includes("5%")));
});

test("classify flags a year that fell short of the required payout", () => {
  const c = classify({ filings: [pfFiling(2021, 6, 100, 5), pfFiling(2022, 4, 100, 5)] });
  assert.equal(c.payoutTested, 2);
  assert.equal(c.payoutMet, 1);
  assert.ok(c.notes.some((n) => n.includes("fell short of the distributable amount") && n.includes("(2022)")));
});

test("classify stays quiet about the floor for public charities", () => {
  const c = classify({ filings: [filing(2021, 10, 2, 100, 0, 0), filing(2022, 10, 3, 100, 0, 0)] });
  assert.equal(c.kind, "public-charity");
  assert.equal(c.notes.length, 0);
});

test("classify names a shrinking-assets pattern", () => {
  const c = classify({ filings: [filing(2020, 10, 8, 100), filing(2022, 10, 8, 64)] });
  assert.ok(c.notes.some((n) => n.includes("spend-down")));
});

test("reserveMonths uses the latest full year with expenses and assets", () => {
  const short = { ...filing(2023, 0, 10, 30), short: true, months: 3 };
  const r = reserveMonths([filing(2021, 0, 120, 60), filing(2022, 0, 120, 30), short]);
  assert.equal(r.year, 2022);
  assert.equal(r.months, 3);
});

test("classify flags a public charity under three months of reserve", () => {
  const c = classify({ filings: [filing(2022, 100, 120, 20, 0, 0)] });
  assert.equal(c.kind, "public-charity");
  assert.equal(c.reserveMonths, 2);
  assert.ok(c.notes.some((n) => n.includes("months of spending")));
});

test("normalizeOrganization sorts by tax period and marks a short year", () => {
  const org = normalizeOrganization({
    organization: { ein: 1, name: "Test", latest_object_id: "9" },
    filings_with_data: [
      { tax_prd: 201212, tax_prd_yr: 2012, formtype: 2, totrevenue: 10 },
      { tax_prd: 201209, tax_prd_yr: 2012, formtype: 2, totrevenue: 40 },
      { tax_prd: 201109, tax_prd_yr: 2011, formtype: 2, totrevenue: 30 },
    ],
    filings_without_data: [],
  });
  assert.deepEqual(org.filings.map((f) => f.taxPeriod), [201109, 201209, 201212]);
  assert.equal(org.filings[2].short, true);
  assert.equal(org.filings[2].months, 3);
  assert.equal(org.latestObjectId, "9");
  // The short year stays out of swings, so 30 -> 40 is the only pair compared.
  assert.equal(revenueSwings(fullYears(org.filings), 30).length, 1);
});

test("pdfOnlyYears lists a year once with its count", () => {
  assert.deepEqual(pdfOnlyYears([2014, 2015, 2015]), [{ year: 2014, count: 1 }, { year: 2015, count: 2 }]);
});

test("grantSummary ties to the filed total, groups recipients, and never names a person", () => {
  const s = grantSummary({
    reportedTotal: 1000,
    grants: [
      { name: "Alpha Fund", amount: 500, individual: false, foreign: false, state: "PA" },
      { name: "ALPHA FUND", amount: 100, individual: false, foreign: false, state: "PA" },
      { name: "Beta Trust", amount: 300, individual: false, foreign: true, state: null },
      { name: null, amount: 100, individual: true, foreign: false, state: "NJ" },
    ],
  });
  assert.equal(s.ties, true);
  assert.equal(s.recipients, 2);
  assert.deepEqual(s.top.map((r) => [r.name, r.amount, r.grants]), [["Alpha Fund", 600, 2], ["Beta Trust", 300, 1]]);
  assert.equal(s.individualCount, 1);
  assert.equal(s.individualTotal, 100);
  assert.equal(s.foreignSharePct, 30);
  assert.equal(s.median, 200);
  assert.ok(s.top.every((r) => r.name));
});

test("grantSummary does not tie when the list misses the filed total", () => {
  const s = grantSummary({ reportedTotal: 999, grants: [{ name: "Alpha Fund", amount: 500, individual: false, foreign: false, state: "PA" }] });
  assert.equal(s.ties, false);
});
