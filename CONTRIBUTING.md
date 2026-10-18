# Contributing

Use a Node.js version supported by `package.json`, npm and Python 3.10+.
No Python packages are required for the exporter or tests.

```sh
npm ci
npm run check
npm run build
```

Exporter tests briefly open a loopback HTTP server; no external node is required.
The integration suite exercises Python normalization with the browser schema and
analysis engine. Add focused regression coverage for changed behavior.

Keep amounts as integer zatoshis, preserve competing matches and coverage limits,
and distinguish public facts from inference. Follow the privacy boundaries in
[ARCHITECTURE.md](ARCHITECTURE.md). Keep synthetic examples clearly labeled and
retain provenance and license notices for archived fixtures.

Never commit credentials, wallet exports, private reports, generated builds or
local production assets. `exports/` is ignored for local datasets and working
material. Keep changes focused and document changes to the data format or rules.
