# Ostrakon validation

Checked 16 October 2026. Evidence supports a prototype investigation, not a claim
of proven demand, uniqueness, or cryptographic anonymity.

## Decision status

- Agreed workflow: architecture first, milestone delivery, short commits, local
  Git identity `techbone <musaawwaletudaye@gmail.com>`, no `--author`.
- Receipts: dropped following competitive overlap. We independently found
  [zpay](https://github.com/gustavovalverde/zpay) and
  [Zally's disclosure library](https://github.com/gustavovalverde/zally/tree/main/crates/zcash-payment-disclosure).
  The user's additional competitors have not been independently reviewed.
- Selected by the user on 16 October: Privacy X-ray as the core product.
- Cross-chain router: a separate feasibility experiment, outside the MVP.
- Claim links: outside scope; they introduce spending authority and fund handling.

## Build-time update

The local snapshot workbench and bounded public-node export path are implemented.
A live export of mainnet block 3,520,054 was cross-checked with CipherScan and
loaded through the production browser's analyzer, graph and inspector. The
[collection record](docs/LIVE_SNAPSHOT.md) contains provenance and replayable
evidence. This passes the bounded snapshot data gate. Browser live address lookup,
broader coverage, consensus verification and user demand remain unvalidated.

Current [ZecBlock documentation](https://zecblock.com/docs) also lists privacy,
linkability, graph, and pattern endpoints. This is direct competitive overlap with
the X-ray category, not just developer receipt tooling. The proposed distinction
is now a local, importable, reproducible evidence workbench with transparent rules
and scenario comparisons. Demand and comparative usability remain unvalidated.

## Event

The [Zcash ZECATHON site](https://thezecathon.com/) shows registration and
submissions opening 28 September, with submissions due 28 October 2026 at 23:59
UTC. The live registration form was accessible; successful registration was not
attempted. In Africa/Lagos the submission deadline is 29 October at 00:59.

Public rules inspected through the browser: one registering/submitting account;
code written during the build window; libraries permitted, existing products
excluded; source public at submission; exactly one track per entry. The submission
guide requests a name, track, description, repository, demo, and two-minute video.
Track definitions, judging criteria, and complete eligibility were not available
in the unauthenticated terminal. Core & Tooling is a candidate, not a verified fit.

## Why X-ray first

The proposed user is a Zcash user trying to understand what a transparent payment
or pool entry/exit exposes. The product translates evidence into an understandable
graph, timeline, and explanation. Its proposed distinction is the clarity of the
consumer experience and explicit uncertainty. Competitor review and user testing
must still establish that distinction.

[Quesnelle's 2017 paper](https://arxiv.org/abs/1712.01210) demonstrates historical
amount/time round-trip heuristics. Its 31.5% result belongs to that study's dataset;
it is not a current Ironwood exposure rate or a confidence score for this product.
Modern multi-pool transactions need new analysis and counterexamples.

## Why the router is not the initial product

Splitting transfers from one public source address leaves that common source
visible. Delays and varied amounts may change particular correlations, but cannot
by themselves establish unlinkability. A route operator may also know both ends.
An X-ray evaluating the same handpicked heuristic is not independent proof that
the router provides privacy.

[Solana's durable nonce documentation](https://solana.com/docs/core/transactions/durable-nonces)
supports delayed submission, not delayed execution guarantees or quote renewal.
Consuming a nonce invalidates other transactions signed against that nonce value;
independent pre-signed transactions need appropriate separate nonce handling.
A broadcaster holding signed transactions can submit them early unless execution
is constrained elsewhere. A cron schedule is not a cryptographic timelock.

[NEAR's 1Click documentation](https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api)
describes quote-specific deposit addresses. Its
[quote reference](https://github.com/near/agent-skills/blob/main/skills/near-intents/rules/api-quote.md)
describes expiry-sensitive quotes. Shielded destination support, route-specific
expiry, refunds, minimum amounts, and delayed funding behavior have not been tested.

## Remaining validation gates

1. For future live address lookup, establish a browser-accessible source with
   documented permission, historical coverage, pagination, CORS and usable limits.
   The operator snapshot route is proven for one block; it is not a chain-wide
   candidate search or an address-history service.
2. Evaluate modern pool accounting and false positives on known, consented or
   synthetic ground truth. Do not equate a pool's net balance change with one note.
3. Compare current consumer tools and test the explanation with three intended
   users. Record whether they understand observed facts versus inferred links.
4. Verify event track rules and complete registration before relying on eligibility.

## Receipt research retained for context

Upstream [Orchard note encryption](https://github.com/zcash/orchard/blob/main/src/note_encryption.rs)
includes separate Orchard and Ironwood domains. WebZjs's current community
repository contains NU6.3 dependency patches. This was source inspection only;
no Rust/WASM build or live receipt verification was completed.

[ZIP 311](https://github.com/zcash/zips/blob/main/zips/zip-0311.rst) remains draft.
An output disclosure alone is not proof of the presenter's spend authority.
Zally documents an experimental Ironwood profile with additional spend signatures.
These findings invalidate the original assumption that the receipt category is empty.
