# Decision 001 · user-operated node export

Accepted 16 October 2026, before implementation.

Explorer probes did not establish supported browser access. Add an optional,
user-operated command-line exporter for a bounded range from a Zcash node. Keep
the static browser application and its `connect-src 'none'` policy.

The exporter will use read-only JSON-RPC methods: `getblockchaininfo`, `getblock`,
`getblockhash`, and `getrawtransaction` to resolve spent transparent outputs.
It will never call wallet, signing, submission, or key-export methods.

The operator supplies their node endpoint and, when required, authentication via
environment variables. Endpoint URLs and credentials must not appear in datasets,
logs, or committed fixtures. Remote node operators can observe the requested
heights and previous transaction IDs; use a local node to avoid that disclosure.
There is no Ostrakon-operated relay, server, credential store, or telemetry.

Export rules:

- Decode decimal JSON amounts exactly, using integer zatoshis for all accounting.
- Convert node balance signs explicitly: positive node value balance means value
  leaves the shielded pool, the opposite of Ostrakon's pool delta.
- Include every transaction in the requested interval or fail; never truncate a
  range and declare it complete. Bound response sizes, requests and transactions.
- Check the network, block linkage, snapshot tip and range hashes. Abort on a
  detected reorg. These checks compare node responses; they do not verify consensus
  or prove that an untrusted node told the truth.
- Fail visibly on unsupported transaction or script formats. Missing previous
  outputs may be represented as unresolved, with a null fee and partial coverage.
- Write the final file only after the entire export succeeds. Preserve an existing
  file unless the operator chooses another output path.

Python 3's standard library supplies exact decimal JSON parsing, HTTP, and file
handling without adding browser dependencies. Regression tests will use synthetic
RPC transcripts and, if available, a pinned upstream public-chain fixture. An
upstream fixture is not a successful live-node integration test.

The live-data gate remains open until a real node export is loaded end-to-end and
its coverage is independently checked. This adapter is an incremental route toward
that gate; it does not add an address scanner or viewing-key import.

Outcome, 16 October: the [bounded mainnet collection](../LIVE_SNAPSHOT.md) passed
the snapshot path through the actual exporter and production browser. Live
browser address lookup remains a separate, unimplemented capability.
