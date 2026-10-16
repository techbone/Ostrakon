# Verification · local workbench v0.1

Checked 16 October 2026.

## Automated

- TypeScript strict compilation passed.
- Vite production build passed; output is static assets plus a module worker.
- 18 unit tests passed. Cases include competing candidates, no-match uncertainty,
  pool mismatch, mixed/migration flows, missing amounts, unsupported versions,
  low confirmations, timestamp windows, deterministic ordering, exact tolerance
  boundaries, duplicate IDs, oversized input, report re-import and integer money.
  Script outputs with no single decoded address retain their amount and do not
  create repeated-address findings from null values (rule version 0.1.1).
- npm install audit reports zero vulnerabilities after updating the test runner.
- Git whitespace checks passed.

## Node exporter increment

- 17 Python tests cover exact decimal/integer amounts, all three pool signs and
  fees, missing previous outputs, script addresses, parent caching, network/range
  limits, block linkage/reorgs, output preservation and permissions, HTTP Basic
  authentication, JSON-RPC errors over HTTP 500, blocked redirects, response IDs,
  and request/time/response/output bounds.
- Two additional integration tests execute Python normalization, validate its
  output with the actual browser schema, and run the analysis engine. The synthetic
  round trip produces one candidate; the archived mainnet coinbase produces none.
  The analysis and export integration tests total 20 passing tests.
- The archived [Zebra fixture](../tests/fixtures/ZEBRA_NOTICE.md) is pinned to a
  source revision with a checksum and retained license. Its block 1 data verifies
  historical response handling only. Modern-pool transcripts are synthetic.
- A temporary loopback HTTP server exercises real HTTP transport. No external node
  is needed for these tests. At this checkpoint the exporter had not been run
  against a live node; the verified follow-up is recorded below.

## Dataset-switch regression

The browser import of the archived fixture exposed a source-switch race: findings
from the preceding dataset rendered against new transaction IDs before the worker
effect cleared them. The evidence panel dereferenced a missing transaction.

Results are now bound to the dataset, parameters and run that produced them.
Retired or cancelled workers cannot publish results, and reports remain disabled
until the current analysis finishes. Four DOM regression tests cover importing
disjoint IDs and null addresses, late worker responses, changed rule settings and
cancellation. The complete Vitest suite totals 24 tests. JSDOM is development-only.

The import dialog and methodology now link to the node-export guide. Its updated
layout was inspected in the production preview with the restrictive CSP.

## Browser checks

- Default example produces one possible correlation and two repeated-address
  findings, with a permanent coverage limitation.
- Ambiguous example retains two candidate exits.
- Timing lab changes two matches to zero at +12 hours; reset returns two. The
  original dataset remains unchanged.
- Invalid JSON structure reports a validation error and leaves the previous data.
- A valid local JSON example loads through the native file chooser.
- Transaction filtering shows an empty state; clearing restores six rows.
- Transaction inspector displays exact 12.5001 ZEC input and 0.0001 ZEC fee.
- Report download was read back and checked for dataset, rule version, parameters,
  exclusions, and limitations.
- At 390 × 844, document width equals viewport width (390 px); no horizontal page
  overflow. Desktop and mobile layouts were visually inspected.
- Production preview with the Vercel CSP successfully loads the module worker and
  renders findings. Browser logs contain no errors or warnings in that check.

## Boundaries

No browser live-chain lookup, independent consensus validation,
external security audit, three-user walkthrough, deployed Vercel URL, or event
submission has been verified. Privacy is enforced by local design and production
`connect-src 'none'`; a complete browser network trace was not captured.

## Live mainnet increment

- A real nine-request export of mainnet block 3,520,054 completed on 16 October
  at 18:25:03 UTC (19:25:03 Lagos), with all seven records and no unresolved inputs.
  Range and original tip hashes were rechecked during collection.
- CipherScan's recorded response agrees on the canonical hash, ordered IDs/count,
  transaction versions, individual transparent addresses/values, totals, fees and
  supported net pool balances. This is not independent consensus verification.
- Three additional Python tests replay the real RPC results, compare public fields
  against the second source, and verify the evidence checksums. Three transport
  regressions cover request pacing and safe HTTP 429 hints. Python total: 23 tests.
- The real snapshot runs through the browser schema/analyzer. It has one eligible
  0.25015 ZEC Ironwood exit and zero candidate matches. Two shielded transactions
  whose public net outflow pays fees are explicitly excluded; internal payments
  remain hidden. Rule version 0.1.2 improves that explanation.
- A DOM test verifies recorded-data labels, provenance and source switching.
  Vitest total: 26 tests. Full local suite: **49 passing tests**, plus strict
  TypeScript and the static production build.
- In production preview under the CSP, the recorded dataset selector loads seven
  records and one eligible flow. The inspector displays the real 0.25 ZEC payout
  and 0.00015 ZEC fee. Provenance shows the recorded retrieval time, public source,
  block interval, collection checks and explicit lack of live verification.
  Browser console contains no warnings or errors in this check.
- At 390 × 844, the recorded-data layout has a 390 px page width with no horizontal
  overflow. The recorded-data selector, single-exit graph and coverage finding
  remain available in the mobile layout.

The source evidence and scope limits are in [LIVE_SNAPSHOT](LIVE_SNAPSHOT.md).
