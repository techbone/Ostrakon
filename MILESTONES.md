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

## First implementation gate

M0 is incomplete. Before building a polished interface, establish browser data
access and a narrow, honest rule set. If a live provider cannot meet the required
coverage, choose explicitly between a narrower import-based educational product
and a backend/indexer; do not present sample data as a successful live analysis.

## 16 October checkpoint

- **Implemented and verified:** local dataset schema, pure rule engine, worker,
  synthetic examples, graph, evidence/provenance panels, transaction inspector,
  timing lab, JSON import/export and responsive UI. Production build and 17 tests
  pass. Browser checks are recorded in [VERIFICATION](docs/VERIFICATION.md).
- **Scope adjustment after the spike:** deliver the local snapshot workbench as
  the first development increment. Keep live lookup visibly unavailable. This
  advances the independent portions of M1–M3; it does not pass M0's live-data gate.
- **Still open:** real provider/integration, independent data validation, target
  user walkthroughs, competitive differentiation, event registration/track,
  Vercel deployment, public licensing and submission.

## GitHub delivery checkpoint

The initial architecture and workbench commits are pushed to
[`techbone/Ostrakon`](https://github.com/techbone/Ostrakon). Each coherent increment
will be committed and pushed with a short message. GitHub Actions checks types,
analysis tests and the static production build on pushes and pull requests.

The next increment follows [Decision 001](docs/decisions/001-node-export.md): a
user-operated, read-only node exporter. This keeps network access outside the
browser and preserves the local analysis privacy model.

Next engineering milestone: obtain a supported provider or a user-operated data
export adapter, verify a real bounded dataset end-to-end, and document coverage.
Any server proxy must be an explicit architecture change with a privacy model.

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
