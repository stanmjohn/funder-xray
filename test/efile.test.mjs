// The e-file reader on saved text, no network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGrants, zipLinksForYear } from "../src/efile.mjs";

const fixture = readFileSync(new URL("./fixtures/example-valley-foundation.efile.xml", import.meta.url), "utf8");

test("parseGrants reads the return type, period, total, and every grant", () => {
  const p = parseGrants(fixture);
  assert.equal(p.returnType, "990PF");
  assert.equal(p.taxPeriodEnd, "2023-12-31");
  assert.equal(p.reportedTotal, 14900000);
  assert.equal(p.grants.length, 16);
  assert.equal(p.grants.reduce((s, g) => s + g.amount, 0), p.reportedTotal);
});

test("parseGrants never keeps a person's name", () => {
  const people = parseGrants(fixture).grants.filter((g) => g.individual);
  assert.equal(people.length, 2);
  assert.ok(people.every((g) => g.name === null));
});

test("parseGrants marks foreign addresses and decodes entities", () => {
  const xml = `<ReturnTypeCd>990PF</ReturnTypeCd><GrantOrContributionPdDurYrGrp><RecipientBusinessName><BusinessNameLine1Txt>A &amp; B Fund</BusinessNameLine1Txt><BusinessNameLine2Txt>West</BusinessNameLine2Txt></RecipientBusinessName><RecipientForeignAddress><CountryCd>CA</CountryCd></RecipientForeignAddress><Amt>5</Amt></GrantOrContributionPdDurYrGrp>`;
  const [g] = parseGrants(xml).grants;
  assert.equal(g.name, "A & B Fund West");
  assert.equal(g.foreign, true);
  assert.equal(g.state, null);
});

test("zipLinksForYear keeps only the zips for the asked year, once each", async () => {
  const html = `<a href="/pub/xml/2025/a.zip">a</a><a href="/pub/xml/2025/a.zip">a</a><a href="/pub/xml/2024/b.zip">b</a><a href="/pub/xml/2025/index_2025.csv">i</a>`;
  assert.deepEqual(await zipLinksForYear(2025, html), ["/pub/xml/2025/a.zip"]);
});
