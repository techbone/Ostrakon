# Verification · local workbench v0.1

Checked 16 October 2026.

## Automated

- TypeScript strict compilation passed.
- Vite production build passed; output is static assets plus a module worker.
- 17 unit tests passed. Cases include competing candidates, no-match uncertainty,
  pool mismatch, mixed/migration flows, missing amounts, unsupported versions,
  low confirmations, timestamp windows, deterministic ordering, exact tolerance
  boundaries, duplicate IDs, oversized input, report re-import and integer money.
- npm install audit reports zero vulnerabilities after updating the test runner.
- Git whitespace checks passed.

## Browser checks

- Default example produces one possible correlation and two repeated-address
  findings, with a permanent coverage limitation.
- Ambiguous example retains two candidate exits.
- Timing lab changes two matches to zero at +12 hours; reset returns two. The
  original dataset remains unchanged.
- Invalid JSON structure reports a validation error and leaves the previous data.
- A valid local JSON example loads through the native file chooser.
- Transaction filtering shows an empty state; clearing restores six rows.
- Transaction inspector displays exact 12.5001 ZEC input and 0.0001 ZEC fee.
- Report download was read back and checked for dataset, rule version, parameters,
  exclusions, and limitations.
- At 390 × 844, document width equals viewport width (390 px); no horizontal page
  overflow. Desktop and mobile layouts were visually inspected.
- Production preview with the Vercel CSP successfully loads the module worker and
  renders findings. Browser logs contain no errors or warnings in that check.

## Boundaries

No live-chain lookup, real-chain fixture, independent consensus validation,
external security audit, three-user walkthrough, deployed Vercel URL, or event
submission has been verified. Privacy is enforced by local design and production
`connect-src 'none'`; a complete browser network trace was not captured.
