# Ostrakon

A local Zcash privacy workbench. Inspect visible transaction patterns, explore
possible amount/time correlations, and understand the limits of the evidence.

## Run

Use Node.js 22.22.2+ on the 22.x line (or a newer release supported by the package's
`engines` field) and npm. The optional node exporter and full check suite
also require Python 3.10+; no Python packages are needed.

```sh
npm ci
npm run dev
```

The default port is 5173. If occupied, use `npm run dev -- --port 5178`.

```sh
npm run check       # TypeScript + analysis/integration/exporter tests
npm run build       # Production output in dist/
npm run preview     # Production preview, including Vercel security headers
```

## What works

- Browser-worker analysis with exact integer zatoshi accounting.
- Repeated transparent address appearances and bounded amount/time candidates.
- All competing matches retained; no anonymity score or ownership assertion.
- Interactive pool-flow graph, block timeline/table, evidence and provenance views.
- Eligibility, exclusion-reason and ID/address filters with exact record counts.
- Inspectable net pool balances and explanations of why each record is excluded.
- Separate timing simulation that leaves the original dataset unchanged.
- Local JSON imports, report downloads, and report re-import with fresh analysis.
- Three explicitly synthetic examples, responsive layout, and keyboard controls.
- A separately labeled [recorded mainnet snapshot](docs/LIVE_SNAPSHOT.md), exported
  live and cross-checked against a second source. Choose **Mainnet · 7 records ·
  16 Oct 2026** in the dataset selector; no chain requests occur in the browser.
- Optional [read-only node exporter](docs/NODE_EXPORT.md) with bounded ranges,
  exact amount conversion, previous-output resolution and snapshot hash checks.

See [the dataset format](public/DATA_FORMAT.md). Inputs are limited to 2 MB and
200 transactions. Refreshing clears imported data; nothing is saved automatically.

## Current limits

**This is a snapshot analyzer, not a live address scanner.** The bounded public-node
export path is verified; direct browser lookup remains unimplemented. No backend
or hidden proxy has been added.
The application makes no chain-data requests, and production CSP uses
`connect-src 'none'`. Imported records and source claims are unverified; there is
no consensus, transaction-inclusion, current-confirmation, or live reorg validation
in the browser. The optional exporter checks node responses for consistency and
chain changes during collection. Its first live mainnet run is recorded with
cross-source comparisons; that does not establish consensus validity or ongoing availability.

The simple correlation rule excludes unresolved amounts, migrations, multiple
pools, transparent change, batched exits, low-confirmation snapshots and unsupported
versions. It compares net pool movements, not hidden note values. No-match results
cannot establish privacy. See [validation](VALIDATION.md) and the
[provider spike](docs/PROVIDER_SPIKE.md).

## Architecture and delivery

React + TypeScript + Vite, a dedicated Web Worker, Zod validation, and static assets.
No account system, wallet connection, spending/viewing keys, analytics, external
fonts, or application database. The static application is deployed on
[Vercel](https://ostrakon-kappa.vercel.app/) with no environment variables required.
Development commits are published to
[GitHub](https://github.com/techbone/Ostrakon) in small, verified increments.
Run the checks and production build locally before pushing.

- [Architecture](ARCHITECTURE.md)
- [Milestones](MILESTONES.md)
- [Verification record](docs/VERIFICATION.md)
- [Target-user walkthrough protocol](docs/USER_WALKTHROUGHS.md)
- [Contributing](CONTRIBUTING.md)
- [Node export decision](docs/decisions/001-node-export.md)

ZECATHON's registration form was accessible on 16 October 2026. Published
submissions close 28 October at 23:59 UTC (29 October at 00:59 Lagos). No event
account was created; track eligibility and registration remain separate tasks.

Git identity is repository-local: `techbone <musaawwaletudaye@gmail.com>`.
Commit messages stay short. Do not use `--author`.

## License

[MIT](LICENSE), copyright 2026 techbone. Third-party dependencies and archived
source fixtures retain their own licenses and notices.
