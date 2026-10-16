# Ostrakon

A local Zcash privacy workbench. Inspect visible transaction patterns, explore
possible amount/time correlations, and understand the limits of the evidence.

## Run

Requires Node.js 22.12+ and npm. The optional node exporter and full check suite
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
- Interactive pool-flow graph, transaction notebook, evidence and provenance views.
- Separate timing simulation that leaves the original dataset unchanged.
- Local JSON imports, report downloads, and report re-import with fresh analysis.
- Three explicitly synthetic examples, responsive layout, and keyboard controls.
- Optional [read-only node exporter](docs/NODE_EXPORT.md) with bounded ranges,
  exact amount conversion, previous-output resolution and snapshot hash checks.

See [the dataset format](public/DATA_FORMAT.md). Inputs are limited to 2 MB and
200 transactions. Refreshing clears imported data; nothing is saved automatically.

## Current limits

**This is a snapshot analyzer, not a live address scanner.** Public-provider tests
did not establish usable browser access. No backend or hidden proxy has been added.
The application makes no chain-data requests, and production CSP uses
`connect-src 'none'`. Imported records and source claims are unverified; there is
no consensus, transaction-inclusion, current-confirmation, or live reorg validation
in the browser. The optional exporter checks node responses for consistency and
chain changes during collection; a live-node run remains unverified.

The simple correlation rule excludes unresolved amounts, migrations, multiple
pools, transparent change, batched exits, low-confirmation snapshots and unsupported
versions. It compares net pool movements, not hidden note values. No-match results
cannot establish privacy. See [validation](VALIDATION.md) and the
[provider spike](docs/PROVIDER_SPIKE.md).

## Architecture and delivery

React + TypeScript + Vite, a dedicated Web Worker, Zod validation, and static assets.
No account system, wallet connection, spending/viewing keys, analytics, external
fonts, or application database. Vercel build/security configuration is included;
deployment remains pending. Development commits are published to
[GitHub](https://github.com/techbone/Ostrakon) in small, verified increments.
Run the checks and production build locally before pushing.

- [Architecture](ARCHITECTURE.md)
- [Milestones](MILESTONES.md)
- [Verification record](docs/VERIFICATION.md)
- [Contributing](CONTRIBUTING.md)
- [Node export decision](docs/decisions/001-node-export.md)

ZECATHON's registration form was accessible on 16 October 2026. Published
submissions close 28 October at 23:59 UTC (29 October at 00:59 Lagos). No event
account was created; track eligibility and registration remain separate tasks.

Git identity is repository-local: `techbone <musaawwaletudaye@gmail.com>`.
Commit messages stay short. Do not use `--author`.
