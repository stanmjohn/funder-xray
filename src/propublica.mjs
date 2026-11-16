// Client for the ProPublica Nonprofit Explorer API, which republishes IRS
// Form 990 data. Open API, no key, so be a polite consumer: one request per
// call, no retry storms, and a clear User-Agent.
//
// Docs: https://projects.propublica.org/nonprofits/api

const BASE = "https://projects.propublica.org/nonprofits/api/v2";
export const UA = "funder-xray/0.2 (open source; github)";

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ProPublica API ${res.status} on ${path}`);
  return res.json();
}

/** Normalize an EIN: strip the dash, keep digits only. */
export function cleanEin(ein) {
  const digits = String(ein).replace(/\D/g, "");
  if (digits.length !== 9) throw new Error(`"${ein}" is not a 9-digit EIN`);
  return digits;
}

/** Search organizations by name. Returns [{ein, name, city, state, ntee}]. */
export async function search(query) {
  const data = await get(`/search.json?q=${encodeURIComponent(query)}`);
  return (data?.organizations ?? []).map((o) => ({
    ein: o.ein,
    name: o.name,
    city: o.city,
    state: o.state,
    ntee: o.ntee_code ?? "",
  }));
}

/** Months between two YYYYMM tax periods. */
function monthsBetween(a, b) {
  return (Math.floor(b / 100) - Math.floor(a / 100)) * 12 + ((b % 100) - (a % 100));
}

/**
 * Turn one organization response into the shape the rest of the tool uses.
 * Pure, so tests and the committed examples run it on saved responses.
 *
 * Filings are sorted by tax period, the month a fiscal year ends. A filing
 * that ends less than twelve months after the one before it covers a short
 * year, which happens when an organization changes its fiscal year. It is
 * marked short so the metrics can leave it out of swings, averages, and
 * growth. Filings without extracted data (PDF-only years) are kept
 * separately so the report can say those years exist but are not machine
 * readable instead of silently shortening the series.
 *
 * The four 990-PF payout fields, as the IRS field guide for the annual
 * extract describes them. The guide is linked from
 * https://www.irs.gov/statistics/soi-tax-stats-annual-extract-of-tax-exempt-organization-financial-data
 *   contrpdpbks     Contributions, gifts, grants paid, 990-PF Part I line 25, column (a)
 *   totexpnsexempt  Total expenses, exempt purpose, 990-PF Part I line 26, column (d)
 *   fairmrktvalamt  Total assets, end-of-year fair market value, 990-PF header, item I
 *   distribamt      Distributable amount, 990-PF Part X line 7
 * They are null on 990 and 990-EZ filings.
 */
export function normalizeOrganization(data) {
  const org = data.organization;
  const filings = (data.filings_with_data ?? [])
    .map((f) => ({
      year: f.tax_prd_yr,
      taxPeriod: f.tax_prd ?? f.tax_prd_yr * 100 + 12,
      formType: f.formtype, // 0 = 990, 1 = 990-EZ, 2 = 990-PF
      revenue: f.totrevenue ?? null,
      expenses: f.totfuncexpns ?? null,
      assetsEnd: f.totassetsend ?? null,
      liabilitiesEnd: f.totliabend ?? null,
      grantsPaid: f.contrpdpbks ?? null,
      charitableDisbursements: f.totexpnsexempt ?? null,
      fmvAssets: f.fairmrktvalamt ?? null,
      distributableAmount: f.distribamt ?? null,
      pdfUrl: f.pdf_url ?? null,
      short: false,
      months: 12,
    }))
    .sort((a, b) => a.taxPeriod - b.taxPeriod);
  for (let i = 1; i < filings.length; i++) {
    const months = monthsBetween(filings[i - 1].taxPeriod, filings[i].taxPeriod);
    if (months > 0 && months < 12) {
      filings[i].short = true;
      filings[i].months = months;
    }
  }
  return {
    ein: org.ein,
    name: org.name,
    city: org.city,
    state: org.state,
    ntee: org.ntee_code ?? "",
    rulingDate: org.ruling_date ?? null,
    latestObjectId: org.latest_object_id ?? null,
    filings,
    filingsPdfOnly: (data.filings_without_data ?? []).map((f) => f.tax_prd_yr).sort(),
  };
}

/**
 * Fetch one organization with its filings. Returns null when the EIN is not
 * in the Explorer.
 */
export async function organization(ein) {
  const data = await get(`/organizations/${cleanEin(ein)}.json`);
  if (!data) return null;
  return normalizeOrganization(data);
}
