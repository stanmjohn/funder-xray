// Renders the analysis as a one-page markdown report. All computation lives
// in metrics.mjs. This file only formats and, where a number has a known
// limit, prints the limit next to the number.

import {
  fullYears, growth, cagr, spendRate, payout, revenueSwings, assetSwings,
  seriesGaps, leverage, classify, reserveMonths, pdfOnlyYears, grantSummary,
} from "./metrics.mjs";

const IRS_TERMS = "https://www.irs.gov/statistics/soi-tax-stats-private-foundations-study-terms-and-concepts";

function usd(n) {
  if (n == null) return "not reported";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function signed(n) {
  if (n == null) return "not reported";
  return (n > 0 ? "+" : "") + n + "%";
}

function count(n) {
  return n.toLocaleString("en-US");
}

const FORM_NAMES = { 0: "990", 1: "990-EZ", 2: "990-PF" };

function yearLabel(x) {
  return x.short ? `${x.year}, short year of ${x.months} months` : String(x.year);
}

function growthPhrase(g) {
  if (g == null) return "asset trend not computable from the series";
  const base = `from ${usd(g.fromValue)} in ${g.fromYear}`;
  if (g.pct >= 3) return `assets growing ${signed(g.pct)} a year ${base}`;
  if (g.pct <= -3) return `assets shrinking ${signed(g.pct)} a year ${base}`;
  return `assets roughly flat, ${signed(g.pct)} a year ${base}`;
}

function grantsSection(org, lines) {
  const g = org.grants;
  lines.push(`## Who it funded, latest e-filed year`);
  lines.push("");
  if (!g || g.status === "skipped") {
    lines.push(`The grant list was skipped for this run.`);
  } else if (g.status === "none") {
    lines.push(`No e-filed return is listed for this foundation, so no grant list is shown.`);
  } else if (g.status === "not-found") {
    lines.push(`The latest e-filed return could not be found in the IRS bulk e-file data, so no grant list is shown.`);
  } else if (g.status === "error") {
    lines.push(`The latest e-filed return could not be read from the IRS bulk e-file data, so no grant list is shown. The error was "${g.reason}".`);
  } else if (g.data.returnType !== "990PF") {
    lines.push(`The latest e-filed return is a Form ${g.data.returnType ?? "of unknown type"}, not a 990-PF, so no grant list is shown.`);
  } else {
    const s = grantSummary(g.data);
    const period = g.data.taxPeriodEnd;
    const lastYear = org.filings.length ? org.filings[org.filings.length - 1].year : null;
    const later = lastYear != null && Number(period.slice(0, 4)) > lastYear
      ? ` That is a later year than the financial trend above, which stops at ${lastYear}.`
      : "";
    if (!s.ties) {
      lines.push(`The e-filed 990-PF for the tax year ending ${period} lists ${count(s.count)} grants totaling ${usd(s.total)}, but the filing reports ${usd(s.reportedTotal)}. The list does not add up to the filed total, so no breakdown is shown. Open the filing to read the grants.${later}`);
    } else {
      lines.push(`The e-filed 990-PF for the tax year ending ${period} lists ${count(s.count)} grants paid during the year, totaling ${usd(s.total)}.${later} The listed grants add up exactly to the total the filing reports.`);
      lines.push("");
      lines.push(s.recipients > s.top.length
        ? `The median grant was ${usd(s.median)}. The ${s.top.length} largest recipients received ${s.topSharePct}% of the dollars.`
        : `The median grant was ${usd(s.median)}. All ${s.recipients} recipients are listed below.`);
      lines.push("");
      lines.push(`| Recipient | Grants | Amount |`);
      lines.push(`|---|---|---|`);
      for (const r of s.top) lines.push(`| ${r.name} | ${r.grants} | ${usd(r.amount)} |`);
      lines.push("");
      const where = [];
      if (s.topStates.length) where.push(`By recipient address, the states that received the most were ${s.topStates.map((t) => `${t.state} at ${t.sharePct}%`).join(", ")}.`);
      where.push(`Recipients with a foreign address received ${s.foreignSharePct}% of the dollars.`);
      if (s.individualCount) where.push(`${count(s.individualCount)} grants to individuals totaled ${usd(s.individualTotal)}. No person is named in this report.`);
      lines.push(where.join(" "));
    }
    lines.push("");
    lines.push(org.placeholder
      ? `Source. The grant list is invented for this example. A live run reads it from the foundation's e-filed return in the IRS bulk e-file data.`
      : `Source. Return ${g.data.source.member} in the IRS bulk e-file file ${g.data.source.zip}.`);
  }
  lines.push("");
}

/** Build the full markdown report for one organization. */
export function report(org, { today = new Date() } = {}) {
  const all = org.filings;
  const f = fullYears(all);
  const short = all.filter((x) => x.short);
  const c = classify(org);
  const pay = payout(all);
  const spend = spendRate(f);
  const swings = revenueSwings(f);
  const aSwings = assetSwings(f);
  const gaps = seriesGaps(f);
  const lev = leverage(all);
  const years = all.length ? `${all[0].year}–${all[all.length - 1].year}` : "none";
  const forms = [...new Set(all.map((x) => FORM_NAMES[x.formType] ?? "990"))].join(", ");
  const date = typeof today === "string" ? today : today.toISOString().slice(0, 10);
  const lines = [];

  lines.push(`# Funder X-Ray: ${org.name}`);
  lines.push("");
  if (org.placeholder) {
    lines.push(`**PLACEHOLDER. This ${org.placeholder} is made up.** Every name and number below is invented, and a live run on any real EIN replaces them with that organization's own IRS filings.`);
    lines.push("");
  }
  lines.push(`EIN ${String(org.ein).padStart(9, "0")} · ${org.city ?? ""}${org.state ? ", " + org.state : ""} · Forms on file: ${forms || "none"} · Machine-readable years: ${years}`);
  lines.push("");
  lines.push(org.placeholder
    ? `Built ${date} from an invented response shaped like one from the ProPublica Nonprofit Explorer API, which republishes IRS Form 990 data.`
    : `Data retrieved ${date} from the ProPublica Nonprofit Explorer API, which republishes IRS Form 990 data. Every figure comes from a filing listed in the Sources section.`);
  lines.push("");

  lines.push(`## The read`);
  lines.push("");
  if (c.kind === "no-data") {
    lines.push(`No machine-readable filings exist for this organization. The years listed under Sources may still have PDF filings worth opening by hand.`);
  } else {
    const kind = c.kind === "private-foundation" ? "private foundation (990-PF)" : "public charity";
    let tail;
    if (c.kind === "private-foundation") {
      tail = c.payoutAverage != null
        ? `paying out an average of ${c.payoutAverage}% of the fair market value of its assets in charitable disbursements, and meeting its required payout in ${c.payoutMet} of ${c.payoutTested} years`
        : spend.average == null ? "spend rate not computable" : `spending an average of ${spend.average}% of assets a year`;
    } else {
      tail = c.reserveMonths == null ? "operating reserve not computable" : `holding assets that cover ${c.reserveMonths} months of spending at the latest filed rate`;
    }
    lines.push(`A ${kind}, ${growthPhrase(c.assetGrowth)}, ${tail}.`);
    if (c.kind === "private-foundation" && org.grants?.status === "ok" && org.grants.data.returnType === "990PF") {
      const s = grantSummary(org.grants.data);
      if (s.ties) {
        lines.push("");
        const share = s.recipients > s.top.length ? ` The ${s.top.length} largest recipients received ${s.topSharePct}% of the dollars.` : "";
        lines.push(`Its latest e-filed year, ending ${org.grants.data.taxPeriodEnd}, lists ${count(s.count)} grants totaling ${usd(s.total)}.${share}`);
      }
    }
    for (const note of c.notes) {
      lines.push("");
      lines.push(`> ${note}`);
    }
  }
  lines.push("");

  if (all.length) {
    lines.push(`## Financial trend`);
    lines.push("");
    lines.push(`| Year | Form | Total revenue | Total expenses | Assets, end of year | Liabilities |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const x of all) {
      lines.push(`| ${yearLabel(x)} | ${FORM_NAMES[x.formType] ?? "990"} | ${usd(x.revenue)} | ${usd(x.expenses)} | ${usd(x.assetsEnd)} | ${usd(x.liabilitiesEnd)} |`);
    }
    lines.push("");
    const revCaveat =
      c.kind === "private-foundation"
        ? "Revenue at a foundation includes investment returns, so single years mislead and the multi-year line is the one to trust."
        : "Revenue at an operating nonprofit moves with grant cycles and campaign timing, so single years mislead and the multi-year line is the one to trust.";
    lines.push(`Compound annual growth across the series is ${signed(cagr(f, "assetsEnd"))} for assets and ${signed(cagr(f, "revenue"))} for revenue. ${revCaveat}`);
    lines.push("");
    for (const s of short) {
      lines.push(`The ${s.year} filing ending ${String(s.taxPeriod).slice(0, 4)}-${String(s.taxPeriod).slice(4)} covers a short year of ${s.months} months, after a change in fiscal year. It is shown in the tables and left out of growth, averages, and swings.`);
      lines.push("");
    }

    if (c.kind === "private-foundation") {
      if (pay.average != null) {
        lines.push(`## Giving and payout`);
        lines.push("");
        lines.push(`| Year | Grants paid | Charitable disbursements | Required payout | Fair market value of assets | Disbursements as share of value | Met required payout |`);
        lines.push(`|---|---|---|---|---|---|---|`);
        for (const r of pay.perYear) {
          const met = r.met == null ? "not reported" : r.met ? "Yes" : "No";
          lines.push(`| ${r.short ? `${r.year}, short year` : r.year} | ${usd(r.grantsPaid)} | ${usd(r.disbursements)} | ${usd(r.required)} | ${usd(r.fmv)} | ${r.rate}% | ${met} |`);
        }
        lines.push("");
        lines.push(`Grants paid is contributions, gifts, grants paid, from 990-PF Part I line 25, column (a). Charitable disbursements are total expenses for exempt purposes, from Part I line 26, column (d), which adds the foundation's own charitable spending to its grants. The fair market value of assets is the end-of-year figure from item I in the form's header. The field meanings come from the IRS field guide linked on the [IRS annual extract page](https://www.irs.gov/statistics/soi-tax-stats-annual-extract-of-tax-exempt-organization-financial-data). The required payout is the distributable amount, from Part X line 7, which the IRS defines as the minimum payout a private foundation must distribute. It starts from 5 percent of the value of assets not used for charitable purposes. The IRS defines these terms on its [private foundations terms page](${IRS_TERMS}). Charitable disbursements are close to the qualifying distributions the IRS counts against the required payout, but they are not the same figure. Treat a No as a reason to open the 990-PF, not as a finding.`);
      } else {
        lines.push(`## Payout, as a proxy`);
        lines.push("");
        if (spend.average == null) {
          lines.push(`Not computable. The series lacks paired expense and asset figures.`);
        } else {
          lines.push(`The filings carry no payout fields, so this falls back to a proxy. Total functional expenses ran ${spend.average}% of end-of-year assets on average. This is a proxy, not the 990-PF qualifying-distribution figure. It counts overhead alongside grants and misses distributions counted elsewhere.`);
        }
      }
      lines.push("");
      grantsSection(org, lines);
    } else {
      lines.push(`## Partner capacity`);
      lines.push("");
      const r = reserveMonths(all);
      if (r == null) {
        lines.push(`Operating reserve is not computable. The series lacks paired expense and asset figures.`);
      } else {
        lines.push(`End-of-${r.year} assets cover ${r.months} months of spending at that year's rate. Book assets are not cash, so this is a ceiling on the real cushion, not the cushion itself. It answers the scoping question a partnership depends on, whether this organization absorbs new delivery load from margin or needs the funding to land before the work does.`);
      }
      lines.push("");
    }

    lines.push(`## Revenue swings`);
    lines.push("");
    if (swings.length === 0) {
      lines.push(`No year-over-year revenue move past ±30% in the machine-readable series.`);
    } else {
      const swingCause =
        c.kind === "private-foundation"
          ? "At a foundation this usually means investment returns or a large gift. The filing says which."
          : "At an operating nonprofit this usually means a large grant landing or ending. The filing says which.";
      for (const s of swings) lines.push(`- ${s.from} to ${s.to}: ${signed(s.changePct)}. ${swingCause}`);
    }
    lines.push("");

    lines.push(`## Asset swings`);
    lines.push("");
    if (aSwings.length === 0) {
      lines.push(`No year-over-year move in end-of-year assets past ±30% in the machine-readable series.`);
    } else {
      const assetCause =
        c.kind === "private-foundation"
          ? "At a foundation a move this size usually means a large gift, a transfer out, or a market move. It can also be an error in the extracted data, so open the filing before using either year."
          : "At an operating nonprofit a move this size usually means a multi-year grant booked up front, a capital gift, or a merger. It can also be an error in the extracted data, so open the filing before using either year.";
      for (const s of aSwings) lines.push(`- ${s.from} to ${s.to}: ${signed(s.changePct)}. ${assetCause}`);
    }
    lines.push("");

    if (gaps.length) {
      const gapList = gaps.map((g) => `${g.from} to ${g.to}`).join(", ");
      lines.push(`The series breaks at ${gapList}. A pair of filings split by missing years is not compared, so no swing is reported across a break.`);
      lines.push("");
    }

    lines.push(`## Leverage`);
    lines.push("");
    lines.push(lev == null ? `Not computable from the series.` : `Liabilities were ${lev.pct}% of assets in ${lev.year}.`);
    lines.push("");
  }

  if (org.filingsPdfOnly.length) {
    const list = pdfOnlyYears(org.filingsPdfOnly).map((y) => (y.count > 1 ? `${y.year} (${y.count} filings)` : String(y.year))).join(", ");
    lines.push(`## Years on file but not machine readable`);
    lines.push("");
    lines.push(`${list}. These filings exist as PDFs only, so nothing above includes them. The series is shorter than the organization's real history, not the other way around.`);
    lines.push("");
  }

  lines.push(`## Sources`);
  lines.push("");
  if (org.placeholder) {
    lines.push(`- Every filing in this report is invented. A live run lists each real filing here, with a link to its PDF where ProPublica publishes one.`);
  } else {
    for (const x of all) {
      lines.push(`- ${yearLabel(x)}: ${x.pdfUrl ? `[Form ${FORM_NAMES[x.formType] ?? "990"} filing](${x.pdfUrl})` : `filing extracted by ProPublica, no PDF link published`}`);
    }
  }
  lines.push("");

  lines.push(`## What this report refuses to do`);
  lines.push("");
  if (c.kind === "private-foundation") {
    lines.push(`It shows grants from one year only, the latest e-filed 990-PF. It makes no claim about grant concentration across years or about how many grantees the foundation funds year after year. That needs every year's e-file read the same way, which is a separate build. It also draws no conclusion a linked filing cannot support. Where the data runs out, the report says so instead of rounding to a verdict.`);
  } else {
    lines.push(`It makes no claim about who funds this organization or how concentrated its funding is. The summary data does not carry that. It also draws no conclusion a linked filing cannot support. Where the data runs out, the report says so instead of rounding to a verdict.`);
  }
  lines.push("");

  return lines.join("\n");
}
