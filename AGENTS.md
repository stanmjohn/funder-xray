# AGENTS.md

Instructions for an AI coding tool working in this repo. The README is for people and says what the tool is for. This file says how to change it without breaking its promises.

## What this is

A command line tool. A nine-digit EIN goes in, a one-page markdown memo on that organization's IRS 990 filings comes out. Node 20 or newer, ES modules, no dependencies, no build step.

## Commands

```
npm test                                      # all tests, one of them calls the live API
SKIP_LIVE=1 npm test                          # offline
node bin/funder-xray.mjs 04-3534407 --stdout  # print a report
node bin/funder-xray.mjs search "year up"     # find an EIN by name
```

Run the tests before and after any change.

## Layout

- `bin/funder-xray.mjs` reads the arguments and writes the file. No logic lives here.
- `src/propublica.mjs` is the only file that touches the network. One request per call, no retries, a clear User-Agent.
- `src/metrics.mjs` does all the math. It takes the filings array and returns plain data.
- `src/report.mjs` formats the memo. It computes nothing.
- `examples/` holds reports committed as they came out of the tool.
- `test/shape.test.mjs` is the live check on the API fields the code depends on.

Keep that split. Math added to `report.mjs` or formatting added to `metrics.mjs` is a wrong change.

## Rules that must survive any edit

1. Add no dependencies. The standard library and `node:test` cover everything here.
2. Every number in a report keeps its limit beside it and a link to the filing behind it. The payout figure is a proxy built on total functional expenses. The reserve figure is a ceiling because book assets are not cash. Both sentences stay where the numbers appear.
3. Every report ends with the section "What this report refuses to do." Do not add a claim about who a funder funds, grant concentration, or multi-year grantee share. The summary API does not carry that data.
4. Compare adjacent years only. Name a break in the series, never read it as a swing.
5. Disclose years that exist only as PDFs. Never drop them silently.
6. `test/report.test.mjs` pins the sentences above. When one of those tests fails, fix the report, not the test.

## Style

Comments describe what the code does now, not how it got there. Report wording is plain, with no jargon the 990 itself does not use. Error messages say what went wrong and what to type instead.

## Examples

The files in `examples/` are real output on real organizations, so they change when new filings post. Regenerate one only on purpose, and say so in the commit message.
