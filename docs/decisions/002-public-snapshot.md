# Decision 002 · verify a bounded public snapshot

Accepted 16 October 2026, before extending the exporter.

Tatum's [public endpoint documentation](https://freerpc.com/zcash) advertises a
keyless Zebra JSON-RPC gateway with a five-request-per-minute free limit. A
read-only chain-info probe and confirmed mainnet block requests succeeded.
The deployed endpoint rejects `getblock` verbosity 3, so retain the existing
verbosity 2 path and resolve previous transparent outputs separately.

Add an explicit request interval to the operator tool, bounded to 0–60 seconds,
within the existing 180-second operation budget. Do not silently retry rate
limits or introduce a relay. Surface HTTP 429 with a safe numeric Retry-After hint.
Use a small complete block range that fits the existing transaction/input bounds.
Oversized blocks remain explicit failures; do not silently drop transactions.

Record one real export, its RPC evidence and checksums. Cross-check its canonical
block hash, transaction count and IDs with a second public source where available.
These checks improve reproducibility and catch adapter errors; agreement between
providers does not constitute independent consensus or cryptographic verification.

Expose a recorded snapshot only if the export and checks succeed. Bundle it as a
static, dated dataset with a separate label from synthetic examples. Loading it
must not trigger chain-data requests or imply that it is a live scan. Imported
private/user datasets must never be bundled or committed.

Passing this bounded snapshot gate does not deliver address lookup, prove hidden
wallet links, or validate all versions and transaction forms. Track the narrower
success and remaining live-lookup work explicitly in the milestones.
