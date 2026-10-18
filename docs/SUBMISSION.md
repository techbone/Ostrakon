# Ostrakon submission

Project name: **Ostrakon**

Recommended track: **Core & Tooling**, based on the analysis workbench and node
exporter. Confirm the exact track definition in the signed-in event form; the
public event page does not expose the track rules. Final track selection and
submission have not been confirmed.

- Code: https://github.com/techbone/Ostrakon
- Working demo: https://ostrakon-kappa.vercel.app/
- Demo video: https://youtu.be/gIAtyuNJ6Ns (1:47.5 source cut)
- Reproducible mainnet evidence: [collection record](LIVE_SNAPSHOT.md)
- Judge walkthrough: [verification path](demo/README.md)

On 18 October, the unauthenticated GitHub API reported the repository as public,
the deployed app returned HTTP 200, and YouTube's public oEmbed endpoint returned
the expected video title and channel. This is a link-availability check, not a
full video playback or hackathon submission confirmation.

## Description

Ostrakon makes public Zcash transaction patterns understandable without wallet keys or dataset uploads.

The browser-local workbench separates observed facts, possible correlations and coverage limits. Users inspect a block timeline, explore amount/time candidates and transparent address reuse, see why records are excluded, and export analysis reports. A separate timing lab changes a copy of the data to explain the heuristic's limits.

The working demo includes all seven transactions in recorded mainnet block 3,520,054, collected on 16 October 2026 through Tatum's Zebra RPC. Public fields were cross-checked with CipherScan. Judges can inspect real Ironwood payout and fee accounting, backed by committed node responses, the normalized export and SHA-256 checksums.

Analysis runs in a browser worker using integer zatoshi accounting. There are no accounts, wallet connections, viewing keys or automatic persistence. A read-only Python exporter collects fresh bounded snapshots. The React/TypeScript frontend is deployed on Vercel; the project is MIT licensed.

The mainnet example is a dated recording, not a live address scan. The browser does not verify consensus or chain inclusion. Correlations do not prove ownership, and zero matches do not prove privacy. Synthetic learning examples are explicitly labeled.

## Final submission

Registration is shown as complete in the user's event form. Confirm the winner
contact handle in the account settings, choose the final track, fill the fields
above, and acknowledge the public-repository requirement. The repository is
already public. Use **Submit** and verify the submitted status. The form states
that saving another draft after submission requires submitting again.

The form shows the deadline as **28 October 2026, 23:59 UTC**
(29 October, 00:59 Lagos). Do not treat this preparation document, an uploaded
video, or a saved draft as confirmation that the event received a submission.
