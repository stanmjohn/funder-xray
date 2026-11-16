# AGENTS.md

Instructions for an AI coding tool working in this repo. The README is for people and says what the tool is for. This file says how to change it without breaking its promises.

## What this is

A command line tool. A nine-digit EIN goes in. A one-page markdown report on that organization's IRS Form 990 filings comes out. For a private foundation it also reads the grants paid in its latest e-filed 990-PF. Node 20 or newer, ES modules, no dependencies, no build step.

## Commands

```
npm test                                     # all tests, three of them call live services
SKIP_LIVE=1 npm test                         # offline
npm run examples                             # rewrite examples/ from test/fixtures/
node bin/funder-xray.mjs <EIN> --stdout      # print a report on any real EIN
node bin/funder-xray.mjs search "<name>"     # find an EIN by name
```

Run the tests before and after any change.

## Layout

- `bin/funder-xray.mjs` reads the arguments and writes the file. No logic lives here.
- `src/propublica.mjs` talks to the ProPublica Nonprofit Explorer API. `normalizeOrganization` turns a response into plain data and is pure.
- `src/efile.mjs` reads one return from the IRS bulk e-file zips by range requests. `parseGrants` is pure. The zip links are read off the IRS downloads page each run.
- These two are the only files that touch the network. One request at a time, no retries, a clear User-Agent.
- `src/metrics.mjs` does all the math. It takes plain data and returns plain data.
- `src/report.mjs` formats the report. It computes nothing.
- `scripts/examples.mjs` renders the committed examples from the fixtures. `scripts/build-examples.mjs` writes them.
- `test/fixtures/` holds invented data in the shape of real API responses and e-files.
- `examples/` holds the reports built from those fixtures.
- `test/shape.test.mjs` is the live check on the API fields and the IRS downloads page.

Keep that split. Math added to `report.mjs` or formatting added to `metrics.mjs` is a wrong change.

## Rules that must survive any edit

1. Add no dependencies. The standard library and `node:test` cover everything here.
2. Every number in a report keeps its limit beside it. Charitable disbursements are close to qualifying distributions but are not the same figure, and that sentence stays beside the payout table. The reserve figure is a ceiling because book assets are not cash, and that sentence stays beside the reserve figure. The proxy sentence stays wherever the proxy prints. The 990-PF field meanings and form lines beside the payout table come from the IRS field guide for the annual extract. Cite the IRS annual extract page, never the spreadsheet link. The extract also carries qlfydistribtot and undistribincyr. Leave both unused.
3. The grant list prints only when the listed grants add up exactly to the total the filing reports. A grant to a person is counted and never named.
4. Every report ends with the section "What this report refuses to do." Make no claim about grant concentration across years or how long grantees stay funded. The tool reads one year of grants.
5. Compare adjacent full years only. Name a break in the series and a short year, never read either as a swing.
6. Disclose years that exist only as PDFs. Never drop them silently.
7. `test/report.test.mjs` pins the sentences above. When one of those tests fails, fix the report, not the test.
8. Never assemble a link a reader will click. Every link in a report or a doc is read off its source, a live page or an API response. The PDF links come from the API, and the e-file zip links come from the IRS downloads page.

## Examples and fixtures

- No real organization is named in any example, fixture, README text, or test comment. Every example's subject and every grantee is made up, and its name starts with Example. Real organizations appear only as data sources in the README's Data sources section.
- Every example opens with the banner "**PLACEHOLDER. This foundation is made up.**" or "**PLACEHOLDER. This organization is made up.**" and one sentence on what real data replaces it.
- The fixtures are invented and stay in the shape of real responses, so the examples run through the same code as a live run.
- `test/examples.test.mjs` rebuilds every example and compares it byte for byte. After any change to the report, run `npm run examples` and commit the rebuilt files with the code. Say so in the commit message.
- Set `FUNDER_XRAY_BLOCKLIST` to a word list kept outside the repo before `npm run examples`. The build stops if a printed grantee name matches.
- The README's Example section quotes an example word for word, and a test checks it. Update both together.
- Line endings are LF everywhere, set by `.gitattributes`. The byte-for-byte test depends on it.

## Style

Comments describe what the code does now, not how it got there. Report wording is plain, with no jargon the 990 itself does not use. Short sentences, no em-dashes, no semicolons. Error messages say what went wrong and what to type instead.
