#!/usr/bin/env node
// Rewrites every file in examples/ from its fixture. Run with npm run examples.
//
// If the environment variable FUNDER_XRAY_BLOCKLIST names a text file, one
// word or phrase per line, the build stops before writing anything when a
// grant recipient printed in an example contains one of them. The maintainer
// keeps that list outside the repo.

import { readFileSync, writeFileSync } from "node:fs";
import { NAMES, EXAMPLES, loadFixture, renderExample } from "./examples.mjs";

const listPath = process.env.FUNDER_XRAY_BLOCKLIST;
const blocked = listPath
  ? readFileSync(listPath, "utf8").split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(Boolean)
  : [];

const out = [];
for (const name of NAMES) {
  const { org } = loadFixture(name);
  const recipients = (org.grants?.data?.grants ?? []).filter((g) => g.name).map((g) => g.name);
  for (const r of recipients) {
    const hit = blocked.find((w) => r.toLowerCase().includes(w));
    if (hit) {
      console.error(`Stopped. The recipient "${r}" in ${name} matches a blocked word. Rename it in the fixture and run again.`);
      process.exit(1);
    }
  }
  out.push([name, renderExample(name)]);
}
for (const [name, md] of out) {
  writeFileSync(`${EXAMPLES}${name}.md`, md, "utf8");
  console.log(`Wrote examples/${name}.md`);
}
if (!listPath) console.log("No blocklist set, so recipient names were not checked against one.");
