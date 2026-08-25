// Live API shape check. The one maintenance risk in this tool is ProPublica
// changing its response shape, so this test calls the real API once and
// asserts the fields the rest of the code depends on. Run with the other
// tests; skip offline with SKIP_LIVE=1.

import { test } from "node:test";
import assert from "node:assert/strict";
import { organization, search } from "../src/propublica.mjs";

const live = !process.env.SKIP_LIVE;

test("organization() returns the fields the metrics depend on", { skip: !live }, async () => {
  // Gates Foundation, chosen as a stable, long-filing organization.
  const org = await organization("562618866");
  assert.ok(org, "EIN should resolve");
  assert.equal(typeof org.name, "string");
  assert.ok(Array.isArray(org.filings) && org.filings.length > 0);
  const f = org.filings[org.filings.length - 1];
  for (const field of ["year", "formType", "revenue", "expenses", "assetsEnd", "liabilitiesEnd"]) {
    assert.ok(field in f, `filing carries ${field}`);
  }
});

test("search() returns ein and name pairs", { skip: !live }, async () => {
  const rows = await search("Ford Foundation");
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.ein && r.name));
});
