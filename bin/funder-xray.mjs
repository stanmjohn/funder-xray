#!/usr/bin/env node
// funder-xray <ein> [--out file.md | --stdout] [--no-grants]
// funder-xray search "<name>"
//
// One command in, one markdown report out. No server, no key, no account.

import { writeFileSync } from "node:fs";
import { search, organization, cleanEin } from "../src/propublica.mjs";
import { fetchGrants } from "../src/efile.mjs";
import { report } from "../src/report.mjs";

const args = process.argv.slice(2);

function usage(code) {
  console.log(`Usage:
  funder-xray <ein>              Write a report on any nine-digit EIN to <ein>-<name>.md
  funder-xray <ein> --stdout     Print the report instead of writing a file
  funder-xray <ein> --out x.md   Write to a chosen path
  funder-xray <ein> --no-grants  Skip the grant list, which reads IRS bulk e-file data
  funder-xray search "<name>"    Find an EIN by organization name`);
  process.exitCode = code;
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function runSearch(q) {
  const rows = await search(q);
  if (rows.length === 0) {
    console.log(`No organizations matched "${q}".`);
    return;
  }
  for (const r of rows.slice(0, 15)) {
    console.log(`${String(r.ein).padStart(9, "0").padEnd(11)} ${r.name}  (${[r.city, r.state].filter(Boolean).join(", ")})`);
  }
}

async function grantsFor(org) {
  if (!org.filings.some((x) => x.formType === 2)) return undefined;
  if (args.includes("--no-grants")) return { status: "skipped" };
  if (!org.latestObjectId) return { status: "none" };
  try {
    console.error("Reading the latest e-filed return from IRS bulk e-file data. The first run for an EIN can take a minute.");
    const data = await fetchGrants(org.latestObjectId);
    return data ? { status: "ok", data } : { status: "not-found" };
  } catch (e) {
    return { status: "error", reason: e.message };
  }
}

async function runReport(einArg) {
  let ein;
  try {
    ein = cleanEin(einArg);
  } catch (e) {
    console.error(e.message);
    return usage(1);
  }

  const org = await organization(ein);
  if (!org) {
    console.error(`EIN ${ein} is not in the Nonprofit Explorer. Check the number, or the organization has never filed electronically.`);
    process.exitCode = 1;
    return;
  }
  org.grants = await grantsFor(org);

  const md = report(org);

  if (args.includes("--stdout")) {
    console.log(md);
    return;
  }
  const outFlag = args.indexOf("--out");
  const path = outFlag !== -1 && args[outFlag + 1] ? args[outFlag + 1] : `${ein}-${slug(org.name)}.md`;
  writeFileSync(path, md, "utf8");
  console.log(`Wrote ${path}`);
}

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  usage(args.length ? 1 : 0);
} else if (args[0] === "search") {
  const q = args.slice(1).join(" ").trim();
  if (q) await runSearch(q);
  else usage(1);
} else {
  await runReport(args[0]);
}
