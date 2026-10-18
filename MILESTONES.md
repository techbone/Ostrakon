# Milestones

The X-ray direction is selected. Submission is due 28 October
2026 at 23:59 UTC, which is 29 October at 00:59 in Lagos. Aim to finish on
27 October; retain 28 October for submission issues.

| Milestone     | Target, Lagos dates | Deliverable                                                             | Exit condition                                                                                                      |
| ------------- | ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| M0 — Validate | 16–17 Oct           | Product selection, event checks, competitor review, data-provider spike | A bounded real dataset loads in a browser with documented coverage and limits; rule scope is technically defensible |
| M1 — Specify  | 17 Oct              | Architecture, normalized schema, example findings, threat model         | Every UI claim maps to available evidence; unsupported and missing data have defined behavior                       |
| M2 — Analyze  | 18–20 Oct           | Data adapter, local imports, versioned rules, worker                    | Known positive and negative fixtures behave correctly; ambiguous cases remain candidates or unknown                 |
| M3 — Explain  | 21–23 Oct           | Graph, timeline, evidence panel, separate scenario comparison           | Real-data end-to-end flow works; three user walkthroughs distinguish facts from inference                           |
| M4 — Ship     | 24–26 Oct           | Static deployment, local export, accessibility and privacy checks       | Live core flow works on mobile and desktop; offline/import mode is clear; no unintended data transmission           |
| M5 — Submit   | 27 Oct              | Open-source repo, demo, two-minute video, submission                    | Registered account submits required material and receives confirmation                                              |

## Data gate · passed for the bounded snapshot route

On 16 October, a complete confirmed mainnet block was exported live through
Tatum's public Zebra RPC, cross-checked with CipherScan, and loaded through the
production browser's schema, worker, graph and inspector. The collection record
and reproducible evidence are in [LIVE_SNAPSHOT](docs/LIVE_SNAPSHOT.md).

This passes M0's bounded-real-data condition for the selected snapshot product.
Browser address lookup remains deferred. User validation, broader real-data
coverage and submission preparation remain open; this is not completion of the
entire hackathon MVP. Synthetic examples remain explicitly separate from the
dated mainnet recording.

## Initial 16 October checkpoint

- **Implemented and verified:** local dataset schema, pure rule engine, worker,
  synthetic examples, graph, evidence/provenance panels, transaction inspector,
  timing lab, JSON import/export and responsive UI. Production build and local tests
  pass. Browser checks are recorded in [VERIFICATION](docs/VERIFICATION.md).
- **Scope adjustment after the spike:** deliver the local snapshot workbench as
  the first development increment. Keep live lookup visibly unavailable. This
  advanced the independent portions of M1–M3 before the real-data gate passed.
- **At that checkpoint, still open:** real provider/integration, independent data
  validation, target user walkthroughs, competitive differentiation, event registration/track,
  Vercel deployment, public licensing and submission.

## GitHub delivery checkpoint

The initial architecture and workbench commits are pushed to
[`techbone/Ostrakon`](https://github.com/techbone/Ostrakon). Each coherent increment
will be checked locally, committed and pushed with a short message.

The following increment implemented [Decision 001](docs/decisions/001-node-export.md):
a user-operated, read-only [node exporter](docs/NODE_EXPORT.md). Offline tests cover
pool signs, exact amounts, previous outputs, range bounds, reorg detection and the
Python-to-browser analysis path. An archived upstream mainnet coinbase fixture
checks historical response compatibility. That increment preceded the live
mainnet run recorded below.

## Real-data checkpoint · 16 October

- Live export: all seven transactions in block 3,520,054; five previous
  transactions resolved, zero missing inputs, original tip and range hashes rechecked.
- CipherScan agrees on canonical hash, transaction list, amounts, fees, addresses
  and pool balances. Agreement is a cross-source check, not consensus verification.
- Recorded RPC results replay through the exporter without network access. Checksums
  protect the committed evidence; application data retains the exact records.
- The browser selector distinguishes the recorded mainnet dataset from learning
  examples. Provenance states when it was collected and that it is not a live scan.
- Rule version 0.1.2 explains shielded fee outflows without inventing public
  payouts or hidden payment amounts. This block yields one eligible exit and no
  amount/time candidate, while preserving the coverage limitation.

## Explanation checkpoint · 16 October

- Transactions now has a block-height timeline and table. Same-block records share
  a header timestamp and use ID order without implying execution or payment order.
- Whole-dataset rule coverage shows eligible/excluded counts. First-reason chips,
  eligibility and ID/address search can be combined, inspected and reset.
- The inspector shows exact net pool balances, the first rule exclusion and reading
  guidance. Pending analysis never claims eligibility. Excluded records remain
  available to other rules.
- Conflicting block metadata is rejected; backwards clocks across blocks remain
  valid. Stable exclusion codes are included in report analysis (rule 0.1.3).
- 58 local tests pass, and the production timeline/filter/inspector path has been
  checked on desktop and mobile. No providers, dependencies or network calls added.

M3's engineering increment is complete; its three target-user walkthroughs are
still pending. Use [the walkthrough protocol](docs/USER_WALKTHROUGHS.md) rather
than treating automated or agent browser checks as human validation.

Next engineering milestone: release readiness, including remaining accessibility/privacy
verification. Browser live lookup, broader provider
coverage, event registration/track and submission remain open.
Any server proxy requires an explicit architecture/privacy change.

## Deployment and licensing checkpoint · 18 October

The static application is live at [ostrakon-kappa.vercel.app](https://ostrakon-kappa.vercel.app/).
The deployed mainnet timeline, analysis worker, filters and security headers were
checked in the browser. No Vercel environment variables are required. The repository
now includes an MIT license and matching package metadata; third-party notices
remain in place. Human walkthroughs, broader release checks and submission remain open.

## Demo checkpoint · 18 October

A **1:58.75** narrated, captioned **1080p** judge walkthrough has been rendered
with Samantha narration and checked locally. It leads with recorded mainnet provenance, the seven-record
timeline and exact Ironwood payout/fee accounting. Synthetic heuristic and timing
examples have separate persistent labels. The [demo guide](docs/demo/README.md)
provides the reproduction path, script, real app captures and media-production
sources. Video upload, human walkthroughs, registration/track and submission are
still pending; rendering the demo does not complete those tasks.

## Verification priorities

- Positive matches, near misses, multiple equal candidates, fees/change, pool
  migration, unsupported transactions, and incomplete histories.
- Exact zatoshi arithmetic and deterministic results for the same dataset/rules.
- Provider outages, pagination limits, stale tips, and reorg handling.
- Network inspection for local imports; no imported contents leave the browser.
- Keyboard navigation, reduced motion, readable mobile evidence panels, and large
  graph limits. A text explanation must communicate the graph's conclusions.

Cross-chain execution and viewing-key support are not scheduled in this MVP.
Commit messages remain short; commit only coherent, verified milestone changes.
