# Funder X-Ray

What has a foundation given, to whom, and is it paying out what the IRS requires?

## Who it is for

Funders, program leads, and board members who need a sourced read on a foundation or a nonprofit partner before a first call. Also development directors at smaller organizations that cannot pay for a grants database.

An EIN goes in. The EIN is the Employer Identification Number, the nine-digit ID the IRS gives every organization. A one-page report comes out, built from the organization's Form 990 filings. Form 990 is the yearly return a nonprofit files with the IRS. A private foundation files its own version, the 990-PF.

## Example

This excerpt comes from a made-up foundation, so every name and number in it is invented. Run the tool on any real EIN and the same report comes back for a real organization.

<!-- excerpt from examples/example-valley-foundation.md -->
> **PLACEHOLDER. This foundation is made up.** Every name and number below is invented, and a live run on any real EIN replaces them with that organization's own IRS filings.
<!-- end excerpt -->

<!-- excerpt from examples/example-valley-foundation.md -->
> A private foundation (990-PF), assets growing +3.8% a year from $238,500,000 in 2016, paying out an average of 5% of the fair market value of its assets in charitable disbursements, and meeting its required payout in 7 of 8 years.
>
> Its latest e-filed year, ending 2023-12-31, lists 16 grants totaling $14,900,000. The 10 largest recipients received 90.9% of the dollars.
>
> > Charitable disbursements fell short of the distributable amount, the IRS minimum payout, in 1 of 8 years (2019). Charitable disbursements are close to the qualifying distributions the IRS counts against that minimum but are not the same figure, so read the 990-PF before concluding.
<!-- end excerpt -->

<!-- excerpt from examples/example-valley-foundation.md -->
> The median grant was $800,000. The 10 largest recipients received 90.9% of the dollars.
>
> | Recipient | Grants | Amount |
> |---|---|---|
> | Example Literacy Fund | 2 | $3,500,000 |
> | Example Housing Partnership | 1 | $2,200,000 |
> | Example Health Access Network | 1 | $1,800,000 |
> | Example Youth Arts Collective | 1 | $1,200,000 |
> | Example River Conservancy | 1 | $1,100,000 |
> | Example Food Bank Alliance | 1 | $900,000 |
> | Example Workforce Partners | 1 | $850,000 |
> | Example Legal Aid Society | 1 | $750,000 |
> | Example Global Water Trust | 1 | $650,000 |
> | Example Public Library Friends | 1 | $600,000 |
<!-- end excerpt -->

Three full reports, all made up and all marked PLACEHOLDER.

- [Example Valley Foundation](examples/example-valley-foundation.md), a foundation meant to last, with one year below its required payout and one short year after a change in fiscal year.
- [Example Spend-Down Fund](examples/example-spend-down-fund.md), a foundation spending down its assets to close, with assets shrinking 26.1% a year and a few large closing grants.
- [Example Workforce Partners](examples/example-workforce-partners.md), an operating nonprofit read as a prospective partner, with months of reserve and a fast growth phase.

## How it works

1. The tool reads every machine-readable year of an organization's filings from the ProPublica Nonprofit Explorer API. It sorts them by the month each fiscal year ends.
2. For a foundation, it sets each year's charitable disbursements beside its required payout and the fair market value of its assets. The required payout is the distributable amount, the minimum the IRS says a private foundation must pay out. Charitable disbursements are grants plus the foundation's own charitable spending.
3. For a foundation, it then finds the latest e-filed 990-PF in the IRS bulk e-file data and reads the grants paid that year. It checks that the listed grants add up to the total the filing reports. Only then does it print the grant count, the median grant, the largest recipients, and where the money went. A grant to a person is counted but never named.
4. For an operating nonprofit, it reads months of operating reserve, the revenue trend, and swings that mark a large grant landing or ending.
5. Every number carries its limit beside it. A year that covers less than twelve months is named and left out of trends. Years that exist only as PDFs are listed, not dropped. Where the data cannot support a claim, the report says so instead of rounding to a claim.

## Data sources

- [ProPublica Nonprofit Explorer API](https://projects.propublica.org/nonprofits/api). It republishes the IRS Annual Extract of Tax-Exempt Organization Financial Data. Every financial figure in a report comes from here.
- [IRS Form 990 Series Downloads](https://www.irs.gov/charities-non-profits/form-990-series-downloads). The IRS publishes every e-filed return here as XML in large zip files. The tool reads only the slices it needs, the zip's table of contents and the one return. The grant list comes from here.
- [IRS, Private foundations study terms and concepts](https://www.irs.gov/statistics/soi-tax-stats-private-foundations-study-terms-and-concepts). The source for what the distributable amount and qualifying distributions mean.

The tool reads four 990-PF fields from the API. The IRS field guide for the annual extract, linked from the [IRS annual extract page](https://www.irs.gov/statistics/soi-tax-stats-annual-extract-of-tax-exempt-organization-financial-data), describes each one and names its line on the form.

- Grants paid is contributions, gifts, grants paid, Part I line 25, column (a).
- Charitable disbursements is total expenses for exempt purposes, Part I line 26, column (d).
- Fair market value of assets is total assets at end-of-year fair market value, from item I in the form's header.
- The required payout is the distributable amount, Part X line 7.

## Limits

The report shows grants from one year only, the latest e-filed 990-PF. It makes no claim about grant concentration across years or about how many grantees a foundation funds year after year. For an operating nonprofit it makes no claim about who funds the organization. It draws no conclusion a linked filing cannot support.

- Charitable disbursements come close to the qualifying distributions the IRS counts against the required payout, but they are not the same figure. A year marked No is a reason to open the 990-PF, not a finding.
- The months-of-reserve figure uses total assets. Book assets are not cash, so it is a ceiling on the real cushion.
- The grant list can be a later year than the financial trend, because the IRS e-file data can run a year ahead of the API's summary data. The report says so when it happens.
- The first grant lookup for an EIN reads tens of megabytes from the IRS in small slices and can take a minute. Later runs reuse the location saved under `out/`. It searches the IRS zip files for the year the return's ID starts with and the year after. A return outside those years is reported as not found.
- A swing is any year-over-year move past 30 percent. That line is a chosen threshold, not a standard.
- Some years exist only as PDFs, so the trend can start later than the organization's history and can have gaps.

Not built yet. Grants across several years, which would show concentration and how long grantees stay funded.

## Run it yourself

Requires Node 20 or newer. No install, no key, no account.

```
node bin/funder-xray.mjs <EIN>                # any nine-digit EIN, writes a report file
node bin/funder-xray.mjs <EIN> --stdout       # prints the report instead
node bin/funder-xray.mjs <EIN> --no-grants    # skips the IRS grant list lookup
node bin/funder-xray.mjs search "<name>"      # finds an EIN by organization name
```

To check it yourself, run `npm run examples` and then `git diff examples/`. Nothing changes, because every committed example is rebuilt from its fixture in `test/fixtures/`.

## How this was built

Built with AI coding assistants. Stan John set the design and the rules in AGENTS.md, which any AI coding tool must follow when it changes this repo. A test rebuilds every committed example from its fixture and compares it to the file byte for byte.

## Related tools

[Cost-per-Outcome Workbench](https://github.com/stanmjohn/cost-per-outcome) measures what one program result costs against a comparison group, and ranks the assumptions that drive that cost.

[Impact Chain](https://github.com/stanmjohn/impact-chain) tracks a program from community reach to household gain, and shows where people leave and which step falls furthest short of its benchmark.

## Tests

```
npm test
```

The math runs on synthetic series with hand-checkable values. The report tests pin the sentences that must never disappear. One test rebuilds every committed example and compares it to the file byte for byte. Another checks each excerpt in this README against the example it quotes. The live tests call the ProPublica API and the IRS downloads page. Skip them offline with `SKIP_LIVE=1`.

## License

MIT. Built by [Stan John](https://www.linkedin.com/in/stanmjohn).
