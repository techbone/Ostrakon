# Public data feasibility · 16 October 2026

Outcome: **no live browser data adapter enabled**. The local workbench is a
deliberate narrower increment. These observations apply to this environment and
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
