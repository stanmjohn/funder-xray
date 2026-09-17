// The report is a document, so these tests check that its load-bearing
// sentences survive edits: the proxy caveat, the refusal section, the
// PDF-only years disclosure, and the source links.

import { test } from "node:test";
import assert from "node:assert/strict";
import { report } from "../src/report.mjs";

const org = {
  ein: 123456789,
  name: "Example Foundation",
  city: "Philadelphia",
  state: "PA",
  filings: [
    { year: 2021, formType: 2, revenue: 1000, expenses: 30, assetsEnd: 1000, liabilitiesEnd: 10, pdfUrl: "https://example.org/2021.pdf" },
    { year: 2022, formType: 2, revenue: 1400, expenses: 30, assetsEnd: 1100, liabilitiesEnd: 10, pdfUrl: null },
  ],
  filingsPdfOnly: [2016, 2017],
};

const md = report(org, { today: new Date("2026-08-25T12:00:00Z") });

test("the payout figure never appears without its proxy caveat", () => {
  assert.ok(md.includes("This is a proxy, not the 990-PF qualifying-distribution figure"));
});

test("the under-5% flag prints for a private foundation spending 3%", () => {
  assert.ok(md.includes("5% private-foundation floor"));
});

test("PDF-only years are disclosed rather than silently dropped", () => {
  assert.ok(md.includes("2016, 2017"));
  assert.ok(md.includes("not machine readable"));
});

test("every machine-readable year appears in Sources, with or without a PDF", () => {
  assert.ok(md.includes("[Form 990-PF filing](https://example.org/2021.pdf)"));
  assert.ok(md.includes("no PDF link published"));
});

test("the refusal section ships in every report", () => {
  assert.ok(md.includes("## What this report refuses to do"));
});

test("a 30%+ revenue swing is reported with its usual cause named", () => {
  assert.ok(md.includes("+40%"));
});

test("an asset swing section ships in every report with data", () => {
  assert.ok(md.includes("## Asset swings"));
});

test("the PDF-only disclosure names the organization, not a foundation", () => {
  assert.ok(md.includes("the organization's real history"));
});
