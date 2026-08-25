# Funder X-Ray

A foundation's nine-digit EIN in, a one-page financial read out.

Sizing up a foundation means opening IRS Form 990 PDFs and reading tax returns, roughly forty minutes if you know what to look for. The paid alternatives cost subscription money that small nonprofits do not have. This tool does the forty-minute read in seconds, from the same public filings, and writes it as a markdown memo you can paste into a client document.

The question it answers is the one that matters before any funder conversation. Is this foundation growing, holding, or quietly winding down. A spend-down foundation and a perpetual endowment are different partners with different five-year horizons, and that difference is invisible from a website.

## Use

Requires Node 20+. No API key, no account, no server.

```
node bin/funder-xray.mjs 56-2618866            # writes a report file
node bin/funder-xray.mjs 56-2618866 --stdout   # prints it instead
node bin/funder-xray.mjs search "ford foundation"
```

Data comes from the [ProPublica Nonprofit Explorer API](https://projects.propublica.org/nonprofits/api), which republishes IRS 990 data.

## What a report carries

- The one-paragraph read, growing or shrinking, spending like an operator or holding like an endowment
- The year-by-year financial trend with compound growth across the series
- Payout as a share of assets, labeled as the proxy it is
- Year-over-year revenue swings past 30 percent
- Leverage in the latest filed year
- A link to every source filing

Three real examples are in [`examples/`](examples/), the [Gates Foundation](examples/gates-foundation.md), the [Ford Foundation](examples/ford-foundation.md), and the [William Penn Foundation](examples/william-penn-foundation.md).

## The integrity rule

Every number carries its own limit beside it and a link to the filing behind it. The payout figure is a proxy built on total functional expenses, and the report says so where the number appears, not in a footnote. Years that exist only as PDFs are disclosed rather than silently dropped from the series. Where the data cannot support a claim, the report says that instead of rounding to a claim.

Every report ends with a section titled "What this report refuses to do." It makes no claim about who a funder actually funds, grant concentration, or multi-year grantee share. That data lives in the 990 grant schedules, which the summary API does not carry, and parsing the raw XML e-files honestly is its own project. That is the roadmap, not this version.

## Tests

```
npm test
```

Sixteen tests. The math runs against synthetic series with hand-checkable values, the report tests pin the sentences that must never disappear, the proxy caveat, the refusal section, the PDF-only disclosure, and one live test asserts the API fields this tool depends on, skippable offline with `SKIP_LIVE=1`.

## License

MIT. Built by [Stan John](https://www.linkedin.com/in/stanmjohn).
