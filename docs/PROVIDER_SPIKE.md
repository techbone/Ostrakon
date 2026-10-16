# Public data feasibility · 16 October 2026

Outcome: **no live browser data adapter enabled; a separate live node export
now verified**. The local workbench is a deliberate narrower product. These observations apply to this environment and
time; they do not establish permanent provider unavailability.

| Probe                                                                        | Observed result                    | Implication                                    |
| ---------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| CipherScan `GET /api/shielded/list?limit=5`                                  | HTTP 500                           | No validated flow schema or dataset obtained   |
| CipherScan `GET /api/blocks?limit=2`                                         | HTTP 500                           | No validated block dataset obtained            |
| Trezor `zec1.trezor.io/api/` and `/api/v2`                                   | HTTP 403 / edge block              | No usable indexer access from this environment |
| ZecBlock `GET /v1/transactions?limit=2` with `Origin: http://localhost:5173` | HTTP 403, “Origin is not allowed.” | Direct browser access not established          |

The current [ZecBlock documentation](https://zecblock.com/docs) describes a v1
contract with envelope metadata and exact zatoshi fields. It also describes
preview access and broad domain payload schemas. The earlier CipherScan search
result described legacy routes; implementation must follow actual available
responses rather than infer a schema from endpoint names.

No access restrictions were bypassed and no origin-spoofing proxy was added.
No wallets or real user addresses were queried. No paid service was provisioned.

## Next integration gate

Obtain documented browser access for the intended deployment origin, or design
a user-operated export adapter. If a server is needed, explicitly document the
queries and metadata it can observe, retention, limits, and funding assumptions.

Verify network, units, pool-delta sign, transparent previous outputs, v6 support,
snapshot tip/hash, pagination completeness, missing records, CORS, rate-limit
handling, and reorg behavior. Retain a bounded real public fixture with provenance
for adapter regression tests. Do not label a local JSON example as a live test.

## Node exporter increment

[Decision 001](decisions/001-node-export.md) selects a separate user-operated
exporter as the next route. [The implementation](NODE_EXPORT.md) normalizes
read-only node responses into a bounded import, resolves previous outputs and
checks snapshot consistency. Tests cover synthetic modern-pool transcripts and
an archived upstream mainnet coinbase block. This establishes an offline data
path at that stage, not supported browser access or a verified live-node run.
The subsequent live collection is recorded below.

## Live-node gate · passed for one bounded range

Tatum's [documented keyless Zebra gateway](https://freerpc.com/zcash) returned chain
information and complete verbosity 2 block responses. A paced nine-request export
of block 3,520,054 resolved every previous output and rechecked range/tip hashes.
The deployed endpoint rejected verbosity 3 with RPC code -8. An earlier inspected
block exceeded the workbench's 16-input limit and was not silently truncated.

CipherScan's single-block endpoint also succeeded during this follow-up; the
earlier list-route failures do not establish permanent service unavailability.
Its hash, transaction list, individual transparent addresses/values, totals, fees
and pool balances agree with the export. The recorded dataset loads in the
production browser with no chain requests. See [the evidence](LIVE_SNAPSHOT.md).

This passes the snapshot data path, not direct browser CORS, address lookup,
large ranges, arbitrary node versions, uptime or consensus validation. Those
capabilities require their own tests. No origin restriction was bypassed and no
relay, signup, paid service, or wallet query was introduced.
