// Metrics computed from a filing series. Every function takes the filings
// array from propublica.mjs and returns plain data; rendering lives in
// report.mjs.
//
// The honest limits, stated once here and repeated in the report: the
// Explorer's extracted fields are summary lines, not the grant schedule. So
// spend-to-asset here is a payout proxy built on total functional expenses,
// not the 990-PF qualifying-distribution figure, and grant-level analysis
// (concentration, multi-year share) needs the XML e-file, which is the
// roadmap, not this version.

function pct(n) {
  return n == null ? null : Math.round(n * 1000) / 10;
}

/** Compound annual growth across the series for one field, as a percent. */
export function cagr(filings, field) {
  const vals = filings.filter((f) => f[field] > 0);
  if (vals.length < 2) return null;
  const first = vals[0];
  const last = vals[vals.length - 1];
  const years = last.year - first.year;
  if (years < 1) return null;
  return pct(Math.pow(last[field] / first[field], 1 / years) - 1);
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

/** Year-over-year revenue swings, flagging any move past the threshold. */
export function revenueSwings(filings, thresholdPct = 30) {
  const out = [];
  for (let i = 1; i < filings.length; i++) {
    const prev = filings[i - 1];
    const cur = filings[i];
    if (!(prev.revenue > 0) || cur.revenue == null) continue;
    const change = pct(cur.revenue / prev.revenue - 1);
    if (Math.abs(change) >= thresholdPct) {
      out.push({ from: prev.year, to: cur.year, changePct: change });
    }
  }
  return out;
}

/**
 * Months of operating reserve in the latest year with both figures, total
 * end-of-year assets over one month of expenses. An honest limit rides with
 * it everywhere it prints: book assets are not cash, so this is a ceiling on
 * the real cushion, not the cushion itself. It still separates an
 * organization holding years of margin from one running month to month.
 */
export function reserveMonths(filings) {
  const f = [...filings].reverse().find((x) => x.expenses > 0 && x.assetsEnd != null);
  if (!f) return null;
  return { year: f.year, months: Math.round((f.assetsEnd / (f.expenses / 12)) * 10) / 10 };
}

/** Liabilities as a share of assets in the latest year with both figures. */
export function leverage(filings) {
  const f = [...filings]
    .reverse()
    .find((x) => x.liabilitiesEnd != null && x.assetsEnd > 0);
  if (!f) return null;
  return { year: f.year, pct: pct(f.liabilitiesEnd / f.assetsEnd) };
}

/**
 * The one-paragraph read: is this funder growing, shrinking, or steady, and
 * is it spending like an operating charity or holding like an endowment?
 * A private foundation (990-PF) spending far under 5% of assets is worth a
 * flag because 5% is the statutory distribution floor the proxy approximates.
 */
export function classify(org) {
  const f = org.filings;
  if (f.length === 0) return { kind: "no-data", notes: ["No machine-readable filings."] };
  const isPF = f.some((x) => x.formType === 2);
  const spend = spendRate(f);
  const assetGrowth = cagr(f, "assetsEnd");
  const reserve = reserveMonths(f);
  const notes = [];
  if (isPF && spend.average != null && spend.average < 5) {
    notes.push(
      `Average spend rate ${spend.average}% of assets sits under the 5% private-foundation floor. The proxy misses qualifying distributions counted elsewhere, so read the 990-PF before concluding.`
    );
  }
  if (assetGrowth != null && assetGrowth <= -3) {
    notes.push(`Assets are shrinking ${Math.abs(assetGrowth)}% a year, consistent with a spend-down or a market drawdown, the filings say which.`);
  }
  if (!isPF && reserve != null && reserve.months < 3) {
    notes.push(
      `Assets cover ${reserve.months} months of spending at the ${reserve.year} rate. A partnership that adds delivery load without adding funding stresses an organization this thin, structure the funding to arrive before the work does.`
    );
  }
  return {
    kind: isPF ? "private-foundation" : "public-charity",
    spendAverage: spend.average,
    assetGrowthPct: assetGrowth,
    revenueGrowthPct: cagr(f, "revenue"),
    reserveMonths: reserve?.months ?? null,
    notes,
  };
}
