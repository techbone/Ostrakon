# Export from your Zcash node

The optional exporter turns a small block range into an Ostrakon dataset using
read-only JSON-RPC. It requires Python 3.10+ and a synchronized Zebra or zcashd node
with compatible RPC responses. No Python packages are required.

The tool has offline regression coverage, an archived upstream mainnet fixture,
and a [verified live collection of one modern mainnet block](LIVE_SNAPSHOT.md).
That recorded operation includes resolved previous outputs and Ironwood accounting;
it does not establish compatibility with every node release or production reliability.

## Run

Start with one older block on your node, at least two confirmations deep. Replace
the example height with a height available on the selected network:

```sh
mkdir -p exports
python3 scripts/export_node.py \
  --network mainnet \
  --from-height 3000000 \
  --to-height 3000000 \
  --output exports/snapshot.json
```

The default endpoint is `http://127.0.0.1:8232`. To use another node, set
`OSTRAKON_RPC_URL` in your shell environment. Remote endpoints must use HTTPS.
For nodes requiring HTTP Basic authentication, supply both `OSTRAKON_RPC_USER`
and `OSTRAKON_RPC_PASSWORD` through your environment or a secret manager. Do not
put credentials in a URL, command argument, committed file, or dataset.

Use `--request-interval 13` for a provider limited to five calls per minute.
Pacing counts toward the 180-second export budget, so start with one block.
HTTP 429 stops the export and displays a numeric Retry-After hint when supplied;
wait before retrying. No rate-limit retries or provider switching happen silently.

Open Ostrakon, select **Import dataset**, and choose the generated JSON. The
browser does not contact your node; the file remains in memory in that tab.
The exporter records the block interval and original tip height/hash in the
dataset coverage note. The browser still labels the file as an unverified import.

Each export needs a new output path. Existing files are never overwritten. The
`exports/` directory is ignored by Git to keep local datasets out of commits.

## What is checked

- Network and a synchronized-node flag, when the node supplies it.
- Consecutive block linkage, one coinbase per block, transaction counts/IDs,
  block metadata, range hashes and the original tip hash at the end of the export.
- Previous transparent outputs, fetched with `getrawtransaction`, cached within
  the operation. This may require `txindex` or equivalent historical access.
- Integer amount fields (`valueZat`, `valueSat`, `valueBalanceZat`) where available;
  exact decimal parsing for legacy ZEC fields. No binary floating point conversion.
- Node pool balances are negated into Ostrakon's convention. Positive Ostrakon
  deltas enter a pool; positive node balances leave it. Fees come from resolved
  transparent amounts and all supported pool balances.
- Bare public-key, multisig and non-address scripts keep their value with a null
  address. They do not become fabricated repeated-address findings.

Hash and linkage checks detect inconsistent node responses and reorgs during an
export. They do not verify proof of work, consensus, transaction inclusion or an
untrusted node's honesty. The snapshot can become stale after collection.

## Bounds and failures

One export supports 1–20 blocks, 1–200 transactions, and at most 16 transparent
inputs/outputs per transaction. The JSON result must fit within 2 MB. RPC responses
are limited to 16 MB each, 64 MB total, 1,000 calls, a 20-second socket timeout,
and a 180-second budget checked before each request. Large or unsupported ranges
fail without exporting a truncated dataset. Choose a smaller range and retry.

Versions 1–6 can be normalized; the current correlation rules only accept supported
v4/v5/v6 pool movements. Sapling, Orchard and the documented Zebra Ironwood bundle
shape are handled. Sprout JoinSplits, unknown versions, inconsistent accounting,
and unsupported response shapes fail explicitly. This is not full consensus
validation or a guarantee of compatibility with every node release.

Missing previous outputs fail by default. Add `--allow-unresolved` to retain node
RPC “not found” responses as null addresses/amounts, null fees and partial coverage.
These records are excluded from simple amount/time correlations. Connection
failures, authentication failures and other RPC errors still stop the export.

The node can observe requested block heights, previous transaction IDs and your
IP. A local node avoids disclosing those queries to a remote provider. Endpoints,
credentials and node error messages are omitted from exported data and errors.
HTTP redirects and inherited HTTP proxies are disabled. Files are created with
owner-only permissions on platforms that support them. No wallet methods, keys,
signing, transaction submission or automatic sharing are involved.

## Verify locally

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm run check
npm run build
```

The transport test briefly opens a loopback HTTP server. Integration tests connect
Python normalization to the browser schema and analysis engine. See the
[archived fixture notice](../tests/fixtures/ZEBRA_NOTICE.md) for provenance and
license. Synthetic RPC transcripts test modern pool accounting; the archived
mainnet fixture contains only a historical coinbase transaction.

Primary contracts:
[getblock](https://zcash.github.io/rpc/getblock.html),
[getrawtransaction](https://zcash.github.io/rpc/getrawtransaction.html),
[Zebra transaction RPC types, pinned revision](https://github.com/ZcashFoundation/zebra/blob/6ef54e34361156d6344157ba3d8935dcf8ffdbff/zebra-rpc/src/methods/types/transaction.rs),
[Zebra pool-balance sign convention](https://github.com/ZcashFoundation/zebra/blob/6ef54e34361156d6344157ba3d8935dcf8ffdbff/book/src/dev/rfcs/0012-value-pools.md).
