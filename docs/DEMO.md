# Demo walkthrough

[Open Ostrakon](https://ostrakon-kappa.vercel.app/) ·
[Watch the 1:47 video](https://youtu.be/gIAtyuNJ6Ns)

## Real mainnet data

1. Choose **Mainnet · 7 records · 16 Oct 2026**. This is a dated public-chain
   recording, not a live scan.
2. Open **Dataset coverage**. Inspect the source, collection time, block interval
   and collection-record link.
3. Open **Transactions**. Block **3,520,054** contains all seven records, with
   **1 eligible · 6 excluded · 7 loaded** for the amount/time rule.
4. Inspect transaction
   `206dd86e7df343e15ccd460a1f8577e6393c359499b4d388b90848ba5155bbd6`.
   Its **0.25015 ZEC** net Ironwood outflow equals a **0.25 ZEC** transparent
   payout plus a **0.00015 ZEC** fee.
5. Filter **No public payout**. Two records expose only a public fee contribution;
   hidden payment amounts and recipients are not inferred.

The [collection record](LIVE_SNAPSHOT.md) contains the decoded node responses,
normalized export, CipherScan comparison and SHA-256 checksums. Public-source
agreement is not cryptographic proof of inclusion or consensus. Zero candidates
in this single-block recording do not establish privacy.

## Understand the heuristic

Switch to **The familiar round trip**, an explicitly synthetic learning example.
The dashed connection marks an amount/time candidate; supporting records and
limitations explain why it appeared. It is not a traced shielded payment or a
mainnet finding.

Open **Scenario lab**. Moving eligible exits outside the rule window changes its
candidate count while preserving the original dataset. Fewer matches describe
the heuristic's sensitivity, not proof of anonymity.

Local imports and report downloads use the same validated data model. To bring
fresh node data, use the [read-only exporter](NODE_EXPORT.md).
