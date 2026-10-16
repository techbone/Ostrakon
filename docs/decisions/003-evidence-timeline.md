# Decision 003 · timeline and rule coverage

Accepted 16 October 2026, before implementation.

Add a timeline to Transactions alongside the existing table. Order blocks by
height, not timestamp: block times are approximate and can move backwards.
Within each block, show records by transaction ID and explicitly state that this
is not execution or payment order. Keep exact amounts and source provenance.

The input contract will reject conflicting hashes/timestamps for one block height
and a block hash reused at different heights. Do not build a coherent-looking
timeline from contradictory snapshot metadata.

Add stable exclusion codes to analysis results while retaining the existing
human-readable reasons. These codes describe the amount/time rule's scope and
data requirements; exclusion does not imply safety, privacy, invalid consensus,
or an absence of other findings. Preserve all records and candidate sets.

Show eligible/excluded coverage for the entire loaded dataset. Let users filter
the timeline and table by eligibility, exclusion reason, ID and address, with a
clear filtered count and reset. A record opens the existing inspector, where the
exclusion explanation and next step are available. Pending analysis must never
reuse a previous dataset's classifications.

All changes stay inside the browser and the current memory-only data model. No
new providers, network calls, dependencies, persistence or scoring. Add focused
regression coverage for contradictory blocks, exclusion codes, grouping/order,
combined filters, and inspection of real recorded Ironwood activity.

This completes an engineering portion of M3. Three target-user walkthroughs are
still needed before marking the explanation milestone fully complete.
