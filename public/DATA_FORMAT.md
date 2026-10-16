# Ostrakon dataset format · version 1

Ostrakon accepts UTF-8 JSON, at most 2 MB, with 1–200 transactions. Unknown fields
are rejected. Never provide seed phrases, viewing keys, wallet databases or secrets.
This release does not fetch or independently authenticate blockchain records.

Download the synthetic example from Import dataset to see a complete file.

## Dataset

- `schemaVersion`: `1`
- `name`: 1–100 characters
- `network`: `mainnet` or `testnet`
- `source`: `{ kind: "import" | "sample", label: string, retrievedAt: ISO8601 }`
- `coverage`: `{ fromHeight: integer, toHeight: integer, complete: boolean, note: string }`
- `transactions`: array of records below

`sample` means synthetic, even if a file was imported. Use `import` for real exported
records. `complete` is the file author's assertion about the declared block interval;
Ostrakon cannot verify it. Source timestamps must include a timezone.

## Transaction

- `txid`, `blockHash`: 64 lowercase hexadecimal characters each
- `blockHeight`: nonnegative integer inside the declared interval
- `timestamp`: ISO8601 block timestamp with timezone; not an exact payment time
- `version`: integer; only 4, 5 and 6 are eligible for current rules
- `confirmations`: nonnegative integer at snapshot time, not live confirmations
- `coinbase`: boolean
- `feeZat`: unsigned integer string, or `null` if unknown
- `inputs`, `outputs`: arrays, at most 16 each, containing `{ address: string | null, valueZat: string | null }`
- `poolDeltas`: at most one item per pool, `{ pool: "sapling" | "orchard" | "ironwood", valueZat: signedIntegerString }`

All amounts are integer zatoshis. 100,000,000 zatoshis = 1 ZEC. No decimal points,
exponents, or floating point numbers. Each amount's magnitude is capped at the
maximum Zcash supply. Zero pool deltas should be omitted. **Positive pool delta
means value entering the pool; negative means leaving.** Some node APIs use the
opposite sign: an adapter must explicitly convert it. Do not copy raw fields by name.

Transparent input amounts must come from resolved previous outputs. Never infer
individual shielded note values or addresses. A net pool delta is not a note value.
Use a null address when a transparent script has no single decoded address (for
example, a bare public-key or multisig script). Preserve its known amount. Null
addresses never contribute to repeated-address findings; they are not one shared
address. Use a null amount only when the value itself is unresolved.

## Accounting and scope

The simple correlation rule requires:

`sum(inputs) - sum(outputs) = sum(poolDeltas) + fee`

An eligible entry has one pool, resolved transparent inputs, no transparent outputs,
and a known fee. An eligible exit has one pool, no transparent inputs, one resolved
transparent output, and a known fee. Both require at least two snapshot confirmations.
Multiple pools, change, batched payouts, unknown amounts and unsupported versions
are excluded from the simple rule. Pool/version compatibility is checked, but
full consensus validity and activation heights are not verified.

The rules compare net pool amounts directly using the selected absolute tolerance.
They do not subtract a guessed fee or claim a specific note was transferred.
All candidates within the loaded dataset and selected window remain possible.

Reports are a separate envelope containing `dataset` and `analysis`. You can
re-import a version 1 report: Ostrakon extracts its dataset, discards the saved
findings and re-runs the current rules. A single-record export is for inspection
and is not a complete dataset. Files are held only in memory and cleared on refresh.
