# Funder X-Ray

A nine-digit EIN in, a one-page read on a prospective partner out.

Partnerships in the social sector fail at scoping more often than at delivery. Before anyone structures a multi-year program with a workforce organization, a talent developer, or a foundation, someone has to know what kind of partner the filings say they can be. A funder quietly winding down and a perpetual endowment have different five-year horizons. A nonprofit holding two months of reserve and one holding two years absorb new delivery load differently, and the partnership structure has to know which one it is signing.

That read lives in IRS Form 990 filings, roughly forty minutes per organization if you know what to look for, behind subscription paywalls if you do not. This tool does it in seconds from the same public data and writes it as a markdown memo you can paste into a scoping document.

## Use

Requires Node 20+. No API key, no account, no server.

```
node bin/funder-xray.mjs 04-3534407           # writes a report file
node bin/funder-xray.mjs 04-3534407 --stdout  # prints it instead
node bin/funder-xray.mjs search "year up"
```

Data comes from the [ProPublica Nonprofit Explorer API](https://projects.propublica.org/nonprofits/api), which republishes IRS 990 data.

## What a report carries

The tool reads the organization's form type and answers the scoping question that fits it.

**For a foundation (990-PF).** Growing, holding, or winding down. Payout as a share of assets, labeled as the proxy it is, with a flag when it sits under the 5 percent statutory floor.

**For an operating nonprofit (990).** The partner capacity read. Months of operating reserve, revenue trend across the series, swings that mark a large grant landing or ending, and leverage. The question it answers is whether this organization absorbs new delivery load from margin or needs the funding to land before the work does.

Both reads carry the year-by-year trend, compound growth across the series, and a link to every source filing.

## Examples, run on real organizations

Two workforce and talent organizations and two foundations, committed as they came out of the tool.

- [Year Up](examples/year-up.md), a national talent developer, thirteen machine-readable years
- [CodePath](examples/codepath.md), a technical-education nonprofit in a fast growth phase
- [Gates Foundation](examples/gates-foundation.md)
- [Ford Foundation](examples/ford-foundation.md)
- [William Penn Foundation](examples/william-penn-foundation.md), where the payout proxy flags under the 5 percent floor and the report says to open the real 990-PF before concluding

## The integrity rule

Every number carries its own limit beside it and a link to the filing behind it. The payout figure is a proxy built on total functional expenses, and the report says so where the number appears. The reserve figure is a ceiling because book assets are not cash, and the report says that beside the number too. Years that exist only as PDFs are disclosed rather than silently dropped from the series. Where the data cannot support a claim, the report says so instead of rounding to a claim.

Every report ends with a section titled "What this report refuses to do." It makes no claim about who a funder actually funds, grant concentration, or multi-year grantee share. That data lives in the 990 grant schedules, which the summary API does not carry, and parsing the raw XML e-files honestly is its own project. That is the roadmap, not this version.

## Tests

```
npm test
```

Eighteen tests. The math runs against synthetic series with hand-checkable values, the report tests pin the sentences that must never disappear, and one live test asserts the API fields this tool depends on, skippable offline with `SKIP_LIVE=1`.

## License

MIT. Built by [Stan John](https://www.linkedin.com/in/stanmjohn).
