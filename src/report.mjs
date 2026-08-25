// Renders the analysis as a markdown memo, pasteable into a client document.
// All computation lives in metrics.mjs; this file only formats and, where a
// number has a known limit, prints the limit next to the number.

import { cagr, spendRate, revenueSwings, leverage, classify } from "./metrics.mjs";

function usd(n) {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function signed(n) {
  if (n == null) return "—";
  return (n > 0 ? "+" : "") + n + "%";
}

const FORM_NAMES = { 0: "990", 1: "990-EZ", 2: "990-PF" };

/** Build the full markdown report for one organization. */
export function report(org, { today = new Date() } = {}) {
  const f = org.filings;
  const c = classify(org);
  const spend = spendRate(f);
  const swings = revenueSwings(f);
  const lev = leverage(f);
  const years = f.length ? `${f[0].year}–${f[f.length - 1].year}` : "none";
  const forms = [...new Set(f.map((x) => FORM_NAMES[x.formType] ?? "990"))].join(", ");
  const lines = [];

  lines.push(`# Funder X-Ray: ${org.name}`);
  lines.push("");
  lines.push(`EIN ${org.ein} · ${org.city ?? ""}${org.state ? ", " + org.state : ""} · Forms on file: ${forms || "none"} · Machine-readable years: ${years}`);
  lines.push("");
  lines.push(`Generated ${today.toISOString().slice(0, 10)} from the ProPublica Nonprofit Explorer API, which republishes IRS Form 990 data. Every figure below traces to a filing linked in the Sources section.`);
  lines.push("");

  lines.push(`## The read`);
  lines.push("");
  if (c.kind === "no-data") {
    lines.push(`No machine-readable filings exist for this organization. The years listed under Sources may still have PDF filings worth opening by hand.`);
  } else {
    const kind = c.kind === "private-foundation" ? "private foundation (990-PF)" : "public charity";
    const growth =
      c.assetGrowthPct == null ? "asset trend not computable from the series" :
      c.assetGrowthPct >= 3 ? `assets growing ${signed(c.assetGrowthPct)} a year` :
      c.assetGrowthPct <= -3 ? `assets shrinking ${signed(c.assetGrowthPct)} a year` :
      `assets roughly flat (${signed(c.assetGrowthPct)} a year)`;
    const spendTxt = c.spendAverage == null ? "spend rate not computable" : `spending an average of ${c.spendAverage}% of assets a year`;
    lines.push(`A ${kind}, ${growth}, ${spendTxt}.`);
    for (const note of c.notes) {
      lines.push("");
      lines.push(`> ${note}`);
    }
  }
  lines.push("");

  if (f.length) {
    lines.push(`## Financial trend`);
    lines.push("");
    lines.push(`| Year | Form | Total revenue | Total expenses | Assets, end of year | Liabilities |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const x of f) {
      lines.push(`| ${x.year} | ${FORM_NAMES[x.formType] ?? "990"} | ${usd(x.revenue)} | ${usd(x.expenses)} | ${usd(x.assetsEnd)} | ${usd(x.liabilitiesEnd)} |`);
    }
    lines.push("");
    lines.push(`Compound annual growth across the series: assets ${signed(cagr(f, "assetsEnd"))}, revenue ${signed(cagr(f, "revenue"))}. Revenue at a foundation includes investment returns, so single years mislead and the multi-year line is the one to trust.`);
    lines.push("");

    lines.push(`## Payout, as a proxy`);
    lines.push("");
    if (spend.average == null) {
      lines.push(`Not computable, the series lacks paired expense and asset figures.`);
    } else {
      lines.push(`Total functional expenses ran ${spend.average}% of end-of-year assets on average. This is a proxy, not the 990-PF qualifying-distribution figure, it counts overhead alongside grants and misses distributions counted elsewhere. It answers "is this funder spending like an operator or holding like an endowment," and nothing finer than that.`);
    }
    lines.push("");

    lines.push(`## Revenue swings`);
    lines.push("");
    if (swings.length === 0) {
      lines.push(`No year-over-year revenue move past ±30% in the machine-readable series.`);
    } else {
      for (const s of swings) {
        lines.push(`- ${s.from} to ${s.to}: ${signed(s.changePct)}. At a foundation this usually means investment returns or a large gift, the filing says which.`);
      }
    }
    lines.push("");

    lines.push(`## Leverage`);
    lines.push("");
    lines.push(lev == null ? `Not computable from the series.` : `Liabilities were ${lev.pct}% of assets in ${lev.year}.`);
    lines.push("");
  }

  if (org.filingsPdfOnly.length) {
    lines.push(`## Years on file but not machine readable`);
    lines.push("");
    lines.push(`${org.filingsPdfOnly.join(", ")}. These filings exist as PDFs only, so nothing above includes them. The series is shorter than the foundation's real history, not the other way around.`);
    lines.push("");
  }

  lines.push(`## Sources`);
  lines.push("");
  for (const x of f) {
    lines.push(`- ${x.year}: ${x.pdfUrl ? `[Form ${FORM_NAMES[x.formType] ?? "990"} filing](${x.pdfUrl})` : `filing extracted by ProPublica, no PDF link published`}`);
  }
  lines.push(`- Organization page: https://projects.propublica.org/nonprofits/organizations/${org.ein}`);
  lines.push("");

  lines.push(`## What this report refuses to do`);
  lines.push("");
  lines.push(`It makes no claim about who this funder actually funds, grant concentration, or multi-year grantee share. That lives in the 990 grant schedules, which the summary API does not carry, and analyzing it honestly is a separate build. It also draws no conclusion a linked filing cannot support, where the data runs out, the report says so instead of rounding to a verdict.`);
  lines.push("");

  return lines.join("\n");
}
