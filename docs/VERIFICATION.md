# Verification

## Reproduce the checks

```sh
npm ci
npm run check
npm run build
```

The local suite uses public archived fixtures and synthetic transcripts. Exporter
transport tests briefly open a loopback HTTP server; no external chain-data service
is needed. Node.js and Python requirements are in the [README](../README.md).

## Automated coverage

The 18 October 2026 check passes strict TypeScript compilation, **35 Vitest tests**,
**23 Python tests** and the static Vite production build.

| Area | Covered behavior |
| --- | --- |
| Schema and accounting | Exact zatoshis, pool signs, fees, bounds, duplicate IDs, contradictory block metadata and valid backwards clocks. |
| Rules | Competing candidates, no-match uncertainty, amount/time boundaries, mixed flows, missing amounts, unsupported versions and exclusion reasons. |
| Workspace | Dataset switching, stale/cancelled workers, pending classifications, report re-import and null-address handling. |
| Timeline | Block grouping, deterministic ID order, combined filters, counts, resets and record inspection. |
| Exporter | RPC authentication/errors, response IDs, bounds, pacing, safe rate-limit hints, blocked redirects, reorg checks, output preservation and permissions. |
| Mainnet recording | Actual RPC replay, exact normalized export, second-source field comparison and evidence checksums. |

The [archived Zebra notice](../tests/fixtures/ZEBRA_NOTICE.md) retains the upstream
fixture's provenance and license. Modern pool tests include synthetic transcripts
and the separately identified [real mainnet recording](LIVE_SNAPSHOT.md).

## Browser checks

Desktop and 390 × 844 mobile production-preview checks on 16 October covered
recorded-data loading, provenance, exact payout/fee inspection, timeline filters,
table scrolling, keyboard opening/closing, local import and report export.
The module worker ran under the production CSP without console warnings or errors
in those checks. The mobile page had no horizontal overflow.

The deployed Vercel mainnet timeline, analysis worker, filters and security headers
were checked on 18 October. The [demo guide](DEMO.md) provides the reproduction path.

## What these checks establish

Tests verify the application's rules and its handling of the recorded inputs.
Mainnet collection rechecked node hashes and compared public fields with a second
service. It does not independently verify consensus, transaction inclusion,
current confirmations, reorg status, hidden ownership or anonymity.

Automated and browser checks are engineering evidence. They are not an external
security audit, full accessibility audit or completed participant usability study.
