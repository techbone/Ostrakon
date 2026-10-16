# Contributing

Work architecture first and deliver one coherent increment at a time. Keep
verified behavior separate from plans, example data, and untested assumptions.

Use Node.js 22.12+, Python 3.10+ and `npm ci`. No Python packages are required.
Run `npm run check` and `npm run build` before
committing application changes. Add focused regression tests for analysis or
validation behavior; do not add tests that only mirror markup.

Keep money as integer zatoshis. Never infer hidden note values from net pool
balances. Preserve ambiguous matches and coverage limits. Do not add analytics,
remote fonts, keys, persistence, or network calls without updating the architecture
and privacy model. Keep sample data unmistakably synthetic.

Exporter tests include a temporary loopback HTTP server and offline integration
between Python normalization and the browser analyzer. Keep RPC calls read-only,
bound all requests, and never log node URLs or credentials. Archived upstream
fixtures must retain provenance and license notices. Do not commit node exports
or user reports; `exports/` is ignored.

Repository-local Git identity:

```sh
git config --local user.name techbone
git config --local user.email musaawwaletudaye@gmail.com
```

Keep commit messages short and specific, such as `Build analyzer` or `Fix import`.
Do not pass an author flag or change global Git configuration. Review staged files;
never commit imported user data, private reports, credentials or generated builds.
