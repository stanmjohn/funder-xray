// Metrics computed from a filing series. Every function takes plain data
// from propublica.mjs or efile.mjs and returns plain data. Rendering lives in
// report.mjs.
//
// Limits stated once here and repeated in the report. Charitable
// disbursements are close to the qualifying distributions the IRS counts
// against a foundation's minimum payout, but they are not the same figure.
// The grant list covers one e-filed year, so nothing here measures grant
// concentration across years or how long grantees stay funded.

function pct(n) {
  return n == null || !Number.isFinite(n) ? null : Math.round(n * 1000) / 10;
}

/** Filings that cover a full year. Short years stay out of trends. */
export function fullYears(filings) {
  return filings.filter((f) => !f.short);
}

/** Compound annual growth across the series for one field, as a percent. */
export function cagr(filings, field) {
  return growth(filings, field)?.pct ?? null;
}

/** Compound annual growth with the base year and base value it starts from. */
export function growth(filings, field) {
  const vals = filings.filter((f) => f[field] > 0);
  if (vals.length < 2) return null;
  const first = vals[0];
  const last = vals[vals.length - 1];
  const years = last.year - first.year;
  if (years < 1) return null;
  return {
    pct: pct(Math.pow(last[field] / first[field], 1 / years) - 1),
    fromYear: first.year,
    fromValue: first[field],
    toYear: last.year,
  };
}

/** Expenses as a share of end-of-year assets, per year and averaged. */
export function spendRate(filings) {
  const rows = filings
    .filter((f) => f.expenses != null && f.assetsEnd > 0)
    .map((f) => ({ year: f.year, rate: pct(f.expenses / f.assetsEnd) }));
  const avg = rows.length
    ? Math.round((rows.reduce((s, r) => s + r.rate, 0) / rows.length) * 10) / 10
    : null;
  return { perYear: rows, average: avg };
}

/**
 * Foundation payout per year from the 990-PF fields. The rate is charitable
 * disbursements over the fair market value of all assets. A year meets its
 * required payout when charitable disbursements reach the distributable
 * amount. Short years are reported but left out of the average and the count.
 */
export function payout(filings) {
  const rows = filings
    .filter((f) => f.formType === 2 && f.fmvAssets > 0 && f.charitableDisbursements != null)
    .map((f) => ({
      year: f.year,
      short: f.short,
      months: f.months,
      grantsPaid: f.grantsPaid,
      disbursements: f.charitableDisbursements,
      fmv: f.fmvAssets,
      required: f.distributableAmount,
      rate: pct(f.charitableDisbursements / f.fmvAssets),
      met: f.distributableAmount > 0 ? f.charitableDisbursements >= f.distributableAmount : null,
    }));
  const full = rows.filter((r) => !r.short);
  const average = full.length
    ? Math.round((full.reduce((s, r) => s + r.rate, 0) / full.length) * 10) / 10
    : null;
  const tested = full.filter((r) => r.met != null);
  return {
    perYear: rows,
    average,
    tested: tested.length,
    met: tested.filter((r) => r.met).length,
    shortYears: tested.filter((r) => !r.met).map((r) => r.year),
  };
}

/**
 * Year-over-year swings in one field, flagging any move past the threshold.
 * Only adjacent years are compared. A pair split by missing years is not a
 * year-over-year move, so it is skipped here and listed by seriesGaps.
 * Pass full years only.
 */
export function swings(filings, field, thresholdPct = 30) {
  const out = [];
  for (let i = 1; i < filings.length; i++) {
    const prev = filings[i - 1];
    const cur = filings[i];
    if (cur.year - prev.year !== 1) continue;
    if (!(prev[field] > 0) || cur[field] == null) continue;
    const change = pct(cur[field] / prev[field] - 1);
    if (Math.abs(change) >= thresholdPct) {
      out.push({ from: prev.year, to: cur.year, changePct: change });
    }
  }
  return out;
}

export function revenueSwings(filings, thresholdPct = 30) {
  return swings(filings, "revenue", thresholdPct);
}

export function assetSwings(filings, thresholdPct = 30) {
  return swings(filings, "assetsEnd", thresholdPct);
}

/** Breaks in the series, pairs of consecutive filings more than a year apart. */
export function seriesGaps(filings) {
  const out = [];
  for (let i = 1; i < filings.length; i++) {
    if (filings[i].year - filings[i - 1].year > 1) {
      out.push({ from: filings[i - 1].year, to: filings[i].year });
    }
  }
  return out;
}

/**
 * Months of operating reserve in the latest full year with both figures,
 * total end-of-year assets over one month of expenses. Book assets are not
 * cash, so this is a ceiling on the real cushion, not the cushion itself.
 */
export function reserveMonths(filings) {
  const f = [...fullYears(filings)].reverse().find((x) => x.expenses > 0 && x.assetsEnd != null);
  if (!f) return null;
  return { year: f.year, months: Math.round((f.assetsEnd / (f.expenses / 12)) * 10) / 10 };
}

/** Liabilities as a share of assets in the latest year with both figures. */
export function leverage(filings) {
  const f = [...filings].reverse().find((x) => x.liabilitiesEnd != null && x.assetsEnd > 0);
  if (!f) return null;
  return { year: f.year, pct: pct(f.liabilitiesEnd / f.assetsEnd) };
}

/** PDF-only years, each listed once with the number of filings it holds. */
export function pdfOnlyYears(years) {
  const counts = new Map();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  return [...counts].map(([year, count]) => ({ year, count }));
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Summary of one year's grant list. It ties when the listed grants add up
 * exactly to the total the filing reports. Grants to individuals are counted
 * together and never named. Recipients are grouped by name.
 */
export function grantSummary(parsed, topN = 10) {
  const grants = parsed.grants;
  const total = grants.reduce((s, g) => s + g.amount, 0);
  const ties = parsed.reportedTotal != null && total === parsed.reportedTotal && grants.length > 0;
  const byName = new Map();
  let individualTotal = 0;
  let individualCount = 0;
  for (const g of grants) {
    if (g.individual) {
      individualTotal += g.amount;
      individualCount++;
      continue;
    }
    const key = g.name.toUpperCase();
    const cur = byName.get(key) ?? { name: g.name, amount: 0, grants: 0 };
    cur.amount += g.amount;
    cur.grants++;
    byName.set(key, cur);
  }
  const top = [...byName.values()]
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    .slice(0, topN);
  const topTotal = top.reduce((s, r) => s + r.amount, 0);
  const foreignTotal = grants.filter((g) => g.foreign).reduce((s, g) => s + g.amount, 0);
  const states = new Map();
  for (const g of grants) {
    if (g.state) states.set(g.state, (states.get(g.state) ?? 0) + g.amount);
  }
  const topStates = [...states]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([state, amount]) => ({ state, sharePct: pct(amount / total) }));
  return {
    count: grants.length,
    recipients: byName.size,
    total,
    reportedTotal: parsed.reportedTotal,
    ties,
    median: median(grants.map((g) => g.amount).sort((a, b) => a - b)),
    top,
    topSharePct: total ? pct(topTotal / total) : null,
    individualCount,
    individualTotal,
    foreignSharePct: total ? pct(foreignTotal / total) : null,
    topStates,
  };
}

/**
 * The one-paragraph read: is this organization growing, shrinking, or
 * steady, and for a foundation, does it pay out what the IRS requires?
 */
export function classify(org) {
  const all = org.filings;
  if (all.length === 0) return { kind: "no-data", notes: ["No machine-readable filings."] };
  const f = fullYears(all);
  const isPF = all.some((x) => x.formType === 2);
  const spend = spendRate(f);
  const pay = payout(all);
  const assetGrowth = growth(f, "assetsEnd");
  const reserve = reserveMonths(all);
  const notes = [];
  if (isPF && pay.average == null && spend.average != null && spend.average < 5) {
    notes.push(
      `Average spend rate ${spend.average}% of assets sits under the 5% private-foundation floor. The proxy misses qualifying distributions counted elsewhere, so read the 990-PF before concluding.`
    );
  }
  if (isPF && pay.tested > 0 && pay.met < pay.tested) {
    notes.push(
      `Charitable disbursements fell short of the distributable amount, the IRS minimum payout, in ${pay.tested - pay.met} of ${pay.tested} years (${pay.shortYears.join(", ")}). Charitable disbursements are close to the qualifying distributions the IRS counts against that minimum but are not the same figure, so read the 990-PF before concluding.`
    );
  }
  if (assetGrowth != null && assetGrowth.pct <= -3) {
    notes.push(`Assets are shrinking ${Math.abs(assetGrowth.pct)}% a year, consistent with a spend-down or a market drawdown. The filings say which.`);
  }
  if (!isPF && reserve != null && reserve.months < 3) {
    notes.push(
      `Assets cover ${reserve.months} months of spending at the ${reserve.year} rate. A partnership that adds delivery load without adding funding stresses an organization this thin. Structure the funding to arrive before the work does.`
    );
  }
  return {
    kind: isPF ? "private-foundation" : "public-charity",
    spendAverage: spend.average,
    payoutAverage: pay.average,
    payoutMet: pay.met,
    payoutTested: pay.tested,
    assetGrowth,
    assetGrowthPct: assetGrowth?.pct ?? null,
    revenueGrowthPct: cagr(f, "revenue"),
    reserveMonths: reserve?.months ?? null,
    notes,
  };
}
