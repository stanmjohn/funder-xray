// Client for the ProPublica Nonprofit Explorer API, which republishes IRS 990
// data. Open API, no key, so be a polite consumer: one request per call, no
// retry storms, and a clear User-Agent.
//
// Docs: https://projects.propublica.org/nonprofits/api

const BASE = "https://projects.propublica.org/nonprofits/api/v2";
const UA = "funder-xray/0.1 (open source; github)";

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

/** Search organizations by name. Returns [{ein, name, city, state, ntee_code}]. */
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

/**
 * Fetch one organization with its filings. Returns null when the EIN is not
 * in the Explorer. Filings without extracted data (PDF-only years) are kept
 * separately so the report can say "these years exist but are not machine
 * readable" instead of silently shortening the series.
 */
export async function organization(ein) {
  const data = await get(`/organizations/${cleanEin(ein)}.json`);
  if (!data) return null;
  const org = data.organization;
  return {
    ein: org.ein,
    name: org.name,
    city: org.city,
    state: org.state,
    ntee: org.ntee_code ?? "",
    rulingDate: org.ruling_date ?? null,
    filings: (data.filings_with_data ?? [])
      .map((f) => ({
        year: f.tax_prd_yr,
        formType: f.formtype, // 0 = 990, 1 = 990-EZ, 2 = 990-PF
        revenue: f.totrevenue ?? null,
        expenses: f.totfuncexpns ?? null,
        assetsEnd: f.totassetsend ?? null,
        liabilitiesEnd: f.totliabend ?? null,
        pdfUrl: f.pdf_url ?? null,
      }))
      .sort((a, b) => a.year - b.year),
    filingsPdfOnly: (data.filings_without_data ?? [])
      .map((f) => f.tax_prd_yr)
      .sort(),
  };
}
