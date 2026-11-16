// Live checks on the two outside sources. The main maintenance risk in this
// tool is a source changing its shape, so these tests call the real services
// and assert what the rest of the code depends on. Run with the other tests,
// skip offline with SKIP_LIVE=1.

import { test } from "node:test";
import assert from "node:assert/strict";
import { organization, search } from "../src/propublica.mjs";
import { zipLinksForYear } from "../src/efile.mjs";

const live = !process.env.SKIP_LIVE;

// A long-filing private foundation, chosen for a stable 990-PF series.
const LIVE_EIN = "131684331";

test("organization() returns the fields the metrics depend on", { skip: !live }, async () => {
  const org = await organization(LIVE_EIN);
  assert.ok(org, "EIN should resolve");
  assert.equal(typeof org.name, "string");
  assert.equal(typeof org.latestObjectId, "string");
  assert.ok(Array.isArray(org.filings) && org.filings.length > 0);
  const f = org.filings[org.filings.length - 1];
  for (const field of ["year", "taxPeriod", "formType", "revenue", "expenses", "assetsEnd", "liabilitiesEnd"]) {
    assert.ok(field in f, `filing carries ${field}`);
  }
  for (const field of ["grantsPaid", "charitableDisbursements", "fmvAssets", "distributableAmount"]) {
    assert.equal(typeof f[field], "number", `990-PF filing carries ${field} as a number`);
  }
});

test("search() returns ein and name pairs", { skip: !live }, async () => {
  const rows = await search("foundation");
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.ein && r.name));
});

test("the IRS downloads page still lists e-file zips", { skip: !live }, async () => {
  const year = new Date().getFullYear() - 1;
  const links = await zipLinksForYear(year);
  assert.ok(links.length > 0, `zip links listed for ${year}`);
  assert.ok(links.every((l) => l.startsWith("https://")));
});
