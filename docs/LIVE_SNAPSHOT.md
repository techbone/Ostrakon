# Mainnet snapshot · block 3,520,054

Collected live from Tatum's public Zebra RPC on 16 October 2026. Export completed
at **18:25:03 UTC / 19:25:03 Lagos**. This is a dated recording; choosing it in
the app does not query a provider or refresh confirmations.

## Collection

| Field             | Recorded value                                                      |
| ----------------- | ------------------------------------------------------------------- |
| Network           | Mainnet, node-reported `chain: main`                                |
| Block range       | 3,520,054–3,520,054                                                 |
| Block hash        | `00000000000a364135cf959973e85eaa17206d9e273a884a53f276df2a9dc50d`  |
| Block timestamp   | 16 October 2026, 17:54:10 UTC (header time, not exact payment time) |
| Snapshot tip      | 3,520,076                                                           |
| Original tip hash | `00000000003f5aca5123ef836c9569268750a562adeb1230b91f59d08775ac2b`  |
| Transactions      | All 7 in the selected block; 0 unresolved previous outputs          |
| RPC requests      | 9, paced at least 13 seconds apart                                  |
| Response bytes    | 180,587 before JSON normalization                                   |
| Endpoint          | `https://zcash-mainnet-zebrad.gateway.tatum.io`                     |

The requests were one `getblockchaininfo`, one `getblock` at verbosity 2, five
`getrawtransaction` calls for previous outputs, and two `getblockhash` calls to
recheck the range block and original tip. Advancing tips are allowed; a changed
hash at either recorded height would abort the export. This node rejected
verbosity 3 with RPC code -8, so no inline-prevout assumptions were used.

The range contains a v6 Ironwood coinbase, two fully shielded transactions whose
public net outflow covers their fees, one Ironwood exit, and three transparent
transactions. Internal shielded payments remain hidden. The current rule engine
retains one eligible pool exit: **0.25015 ZEC** of net Ironwood outflow, including
a **0.00015 ZEC** fee and **0.25 ZEC** transparent payout. It finds no amount/time
round trip in this one-block dataset. The coverage limitation remains visible.

## Cross-source comparison

[CipherScan's block response](https://api.mainnet.cipherscan.app/api/block/3520054)
agreed on the block hash, ordered transaction IDs/count, versions, transparent
input/output counts, individual resolved addresses/values, aggregate values,
non-coinbase fees and all three supported net pool balances. Node balances are
negated to match Ostrakon's pool-entry-positive convention.

This is agreement between public services, not proof of independent underlying
nodes or consensus verification. Neither provider's truthfulness, transaction
inclusion, proof of work nor current reorg status is cryptographically verified
by Ostrakon. The dataset covers only one block, not a wallet's history.

## Reproducible evidence

- [Original exporter output](../tests/fixtures/mainnet-3520054/export.json)
- [Decoded RPC results](../tests/fixtures/mainnet-3520054/rpc.json)
- [Recorded CipherScan response](../tests/fixtures/mainnet-3520054/cipherscan.json)
- [Provenance and SHA-256 checksums](../tests/fixtures/mainnet-3520054/provenance.json)
- [Bundled application dataset](../src/data/mainnet-3520054.json)

Only the dataset name and source label were curated for the application. The
transaction records, coverage and retrieval time remain unchanged. RPC evidence
retains exact decimal JSON values but is a decoded transcript, not a verbatim
HTTP capture. No credentials, headers, wallet exports or private user data are
included. These are public blockchain observations collected through documented
public read endpoints; no upstream program code is copied in these files.

Local regression tests replay the nine recorded RPC results through the actual
exporter, compare the resulting dataset exactly with its original output, check
all recorded file hashes, and compare public fields with the second source.
The browser schema and analyzer also run against the bundled snapshot. Tests
perform no live external requests.

To collect a fresh recording into an ignored local directory:

```sh
mkdir -p exports
OSTRAKON_RPC_URL=https://zcash-mainnet-zebrad.gateway.tatum.io \
  python3 scripts/export_node.py \
  --network mainnet --from-height 3520054 --to-height 3520054 \
  --request-interval 13 --output exports/mainnet-fresh.json
```

Historical availability and service limits can change. The public gateway's
[documentation](https://freerpc.com/zcash) advertises five requests per minute;
the pacing flag stays within that rate for this small operation. This is an
integration check, not a production uptime or free-access guarantee.
