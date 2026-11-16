// The report is a document, so these tests check that its load-bearing
// sentences survive edits: the payout caveats, the grant list rules, the
// refusal section, the PDF-only years disclosure, the placeholder banner,
// and the source lines.

import { test } from "node:test";
import assert from "node:assert/strict";
import { report } from "../src/report.mjs";

function f(year, extra = {}) {
  return { year, taxPeriod: year * 100 + 12, formType: 2, revenue: 1000, expenses: 30, assetsEnd: 1000, liabilitiesEnd: 10, pdfUrl: null, short: false, months: 12, ...extra };
}

// A foundation whose filings carry no payout fields, so the proxy path runs.
const proxyOrg = {
  ein: 123456789,
  name: "Test Foundation",
  city: "Test City",
  state: "PA",
  filings: [f(2021, { pdfUrl: "fixture-2021.pdf" }), f(2022, { revenue: 1400, assetsEnd: 1100 })],
  filingsPdfOnly: [2016, 2017, 2017],
};
const proxyMd = report(proxyOrg, { today: "2026-11-15" });

// A foundation with payout fields and a grant list that ties.
const grants = {
  returnType: "990PF",
  taxPeriodEnd: "2023-12-31",
  reportedTotal: 300,
  grants: [
    { name: "Alpha Fund", amount: 200, individual: false, foreign: false, state: "PA" },
    { name: null, amount: 100, individual: true, foreign: false, state: "PA" },
  ],
  source: { zip: "fixture.zip", member: "1_public.xml" },
};
const payOrg = {
  ein: 987654321,
  name: "Test Payout Foundation",
  city: "Test City",
  state: "PA",
  filings: [
    f(2022, { charitableDisbursements: 60, fmvAssets: 1000, distributableAmount: 50, grantsPaid: 55 }),
    f(2023, { charitableDisbursements: 40, fmvAssets: 1000, distributableAmount: 50, grantsPaid: 35, revenue: 900 }),
  ],
  filingsPdfOnly: [],
  grants: { status: "ok", data: grants },
};
const payMd = report(payOrg, { today: "2026-11-15" });

test("the proxy figure never appears without its caveat", () => {
  assert.ok(proxyMd.includes("This is a proxy, not the 990-PF qualifying-distribution figure"));
});

test("the under-5% flag prints when only the proxy is available", () => {
  assert.ok(proxyMd.includes("5% private-foundation floor"));
});

test("the payout table carries its limit and the IRS source", () => {
  assert.ok(payMd.includes("## Giving and payout"));
  assert.ok(payMd.includes("they are not the same figure"));
  assert.ok(payMd.includes("[private foundations terms page](https://www.irs.gov/statistics/soi-tax-stats-private-foundations-study-terms-and-concepts)"));
  assert.ok(payMd.includes("| 2023 | $35 | $40 | $50 | $1,000 | 4% | No |"));
  assert.ok(payMd.includes("meeting its required payout in 1 of 2 years"));
});

test("a grant list that ties is summarized, and no person is named", () => {
  assert.ok(payMd.includes("## Who it funded, latest e-filed year"));
  assert.ok(payMd.includes("The listed grants add up exactly to the total the filing reports."));
  assert.ok(payMd.includes("| Alpha Fund | 1 | $200 |"));
  assert.ok(payMd.includes("No person is named in this report."));
  assert.ok(payMd.includes("Source. Return 1_public.xml in the IRS bulk e-file file fixture.zip."));
});

test("a grant list that does not tie prints no breakdown", () => {
  const md = report({ ...payOrg, grants: { status: "ok", data: { ...grants, reportedTotal: 999 } } }, { today: "2026-11-15" });
  assert.ok(md.includes("The list does not add up to the filed total, so no breakdown is shown."));
  assert.ok(!md.includes("| Alpha Fund |"));
});

test("a latest e-file that is not a 990-PF prints no grant list", () => {
  const md = report({ ...payOrg, grants: { status: "ok", data: { ...grants, returnType: "990T" } } }, { today: "2026-11-15" });
  assert.ok(md.includes("is a Form 990T, not a 990-PF, so no grant list is shown."));
});

test("an unreadable e-file says so and the rest of the report still prints", () => {
  const md = report({ ...payOrg, grants: { status: "error", reason: "HTTP 503" } }, { today: "2026-11-15" });
  assert.ok(md.includes("could not be read from the IRS bulk e-file data"));
  assert.ok(md.includes("## Leverage"));
});

test("PDF-only years are disclosed once each, with a count", () => {
  assert.ok(proxyMd.includes("2016, 2017 (2 filings)"));
  assert.ok(proxyMd.includes("not machine readable"));
  assert.ok(proxyMd.includes("the organization's real history"));
});

test("every machine-readable year appears in Sources, with or without a PDF", () => {
  assert.ok(proxyMd.includes("[Form 990-PF filing](fixture-2021.pdf)"));
  assert.ok(proxyMd.includes("no PDF link published"));
  assert.ok(proxyMd.includes("Every figure comes from a filing listed in the Sources section."));
});

test("the refusal section ships in every report, worded for the form type", () => {
  assert.ok(payMd.includes("## What this report refuses to do"));
  assert.ok(payMd.includes("It shows grants from one year only"));
  const charity = report({ ...proxyOrg, filings: proxyOrg.filings.map((x) => ({ ...x, formType: 0 })) }, { today: "2026-11-15" });
  assert.ok(charity.includes("It makes no claim about who funds this organization"));
  assert.ok(!charity.includes("funder actually funds"));
});

test("a 30%+ revenue swing is reported with its usual cause named", () => {
  assert.ok(proxyMd.includes("+40%"));
  assert.ok(proxyMd.includes("## Asset swings"));
});

test("the growth sentence names its base year and value", () => {
  assert.ok(proxyMd.includes("from $1,000 in 2021"));
});

test("a short year is named and left out of the trend", () => {
  const org = { ...proxyOrg, filings: [...proxyOrg.filings, f(2022, { taxPeriod: 202212, short: true, months: 6 })] };
  const md = report(org, { today: "2026-11-15" });
  assert.ok(md.includes("| 2022, short year of 6 months |"));
  assert.ok(md.includes("covers a short year of 6 months"));
});

test("a made-up subject carries the PLACEHOLDER banner and no source links", () => {
  const md = report({ ...payOrg, placeholder: "foundation" }, { today: "2026-11-15" });
  assert.ok(md.includes("**PLACEHOLDER. This foundation is made up.**"));
  assert.ok(md.includes("Every filing in this report is invented."));
  assert.ok(!md.includes("Organization page"));
});

test("a missing value prints as words, and no em-dash appears", () => {
  const md = report({ ...proxyOrg, filings: [f(2022, { liabilitiesEnd: null })] }, { today: "2026-11-15" });
  assert.ok(md.includes("not reported"));
  assert.ok(!md.includes("—"));
});
