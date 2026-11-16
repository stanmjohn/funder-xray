// Renders the committed examples from the invented fixtures in
// test/fixtures. No network. The same code path as a live run, fed saved
// data instead of the API and the IRS bulk files.
//
// Each fixture is { meta, response }. response has the shape of a ProPublica
// organization response. meta.placeholder says whether the subject is a
// made-up foundation or organization, meta.built is the date printed on the
// report, and meta.efile names an invented e-file for the grant list.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeOrganization } from "../src/propublica.mjs";
import { parseGrants } from "../src/efile.mjs";
import { report } from "../src/report.mjs";

export const FIXTURES = fileURLToPath(new URL("../test/fixtures/", import.meta.url));
export const EXAMPLES = fileURLToPath(new URL("../examples/", import.meta.url));

export const NAMES = ["example-valley-foundation", "example-spend-down-fund", "example-workforce-partners"];

/** Build the organization object for one fixture, grants included. */
export function loadFixture(name) {
  const { meta, response } = JSON.parse(readFileSync(`${FIXTURES}${name}.json`, "utf8"));
  const org = normalizeOrganization(response);
  org.placeholder = meta.placeholder;
  if (meta.efile) {
    org.grants = { status: "ok", data: parseGrants(readFileSync(`${FIXTURES}${meta.efile}`, "utf8")) };
  }
  return { org, built: meta.built };
}

/** The report text for one fixture, exactly as committed in examples/. */
export function renderExample(name) {
  const { org, built } = loadFixture(name);
  return report(org, { today: built });
}
