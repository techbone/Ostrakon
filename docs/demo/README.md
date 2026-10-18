# Ostrakon judge demo

![Ostrakon title card](poster.png)

The video leads with the recorded mainnet integration, then uses an explicitly
synthetic example to explain the correlation heuristic. These are actual captures
of the deployed application, edited with explanatory titles, captions and motion;
they are not a continuous screen recording. Narration uses a local synthetic voice.
No app UI or analysis result is fabricated for the video.

The checked cut is **1:57.83**, **1920 × 1080**, **24 fps**, with H.264 video,
AAC narration and burned captions. Ten representative frames were decoded for
review; the encoded narration track decoded successfully and every source audio
clip contained non-silent samples. [Production metadata](production.json) records
the final MP4 checksum. The MP4 is ready for review and upload; it has not been
published to a video platform or submitted to the event.

## Judge verification path

1. Open [Ostrakon](https://ostrakon-kappa.vercel.app/) and select **Mainnet · 7
   records · 16 Oct 2026**.
2. Open **Dataset coverage**. Check mainnet, block **3,520,054**, collection time,
   source label and the link to the collection record.
3. Open **Transactions**. Expect **1 eligible · 6 excluded · 7 loaded**.
4. Inspect transaction
   `206dd86e7df343e15ccd460a1f8577e6393c359499b4d388b90848ba5155bbd6`.
   Its **0.25015 ZEC** net Ironwood outflow equals a **0.25 ZEC** public payout
   plus a **0.00015 ZEC** fee.
5. Filter **No public payout**. Two records expose a public fee contribution;
   hidden recipients and payment amounts are not inferred.
6. Return to **Overview**. Zero candidates in this one-block snapshot are not a
   privacy guarantee. Switch to **The familiar round trip** only to demonstrate
   the explicitly synthetic amount/time example and hypothetical scenario lab.

The [collection record](../LIVE_SNAPSHOT.md) links the decoded node responses,
original normalized export, CipherScan comparison and SHA-256 checksums. The
integration demonstrates handling of real recorded mainnet data. It does not
cryptographically prove chain inclusion, consensus validity, current confirmations,
reorg status, ownership or anonymity. Tatum and CipherScan may share infrastructure.

## Editable production files

- [Scene script](scenes.json): narration, on-screen claims and capture references.
- [Renderer](render.py) and [native encoder](render.swift): 1920 × 1080 H.264/AAC
  MP4, burned captions and SRT sidecar.
- `captures/`: original 1280 × 720 captures from the deployed application.
- [Title card](poster.png): a small preview retained for GitHub readers.
- Generated video, audio and review contact sheets: `exports/demo/` at the
  repository root. This directory is ignored; do not commit the rendered MP4.

Rendering requires macOS, Python 3.10+ with Pillow and the Swift command-line
tools. Video and audio encoding use the built-in AVFoundation framework. These are
optional video-production tools, not application dependencies. The default
narration uses macOS `say` with Daniel;
`--voice` and `--rate` allow a different installed voice and speaking rate. To use
your own voice, provide one uncompressed PCM WAV file per scene ID under `exports/demo/audio/`
and run with `--reuse-audio`.

```sh
python3 docs/demo/render.py
```

To check the encoded file and extract representative frames:

```sh
swift -module-cache-path exports/demo/swift-cache docs/demo/verify.swift \
  exports/demo/ostrakon-demo.mp4 exports/demo/encoded-review
```

The renderer measures the narration, adds reading pauses, derives subtitle timing,
and refuses to render a cut longer than 120 seconds. It validates audio is nonempty.
Review the final MP4 before uploading; publishing and hackathon submission are
separate actions. Use the title **Ostrakon — Zcash Privacy, in Plain Sight**.

Suggested video description:

> Ostrakon is a browser-local Zcash privacy workbench. This demo inspects a real
> recorded mainnet block, including Ironwood payout and fee accounting, then uses
> a clearly labeled synthetic example to explain amount/time correlations. Mainnet
> block 3,520,054 was collected on 16 October 2026 and public fields were compared
> with CipherScan. It is a dated snapshot, not a live address scan or privacy proof.
> Try it: https://ostrakon-kappa.vercel.app/ · Source and reproducible evidence:
> https://github.com/techbone/Ostrakon
