# Instructions for coding agents

These instructions apply to the Baseline tennis equipment tracker repository.

## Project basics

- This is the Canadian-first Baseline racquet and tennis gear tracker.
- The web app uses Next-compatible React components with vinext/Vite. Main UI is in `app/ui/`; API routes are in `app/api/`; retailer catalogues and price checks are in `scripts/check-prices.mjs`, which the relay (`scripts/baseline-relay.mjs`) runs. The API route stores settings and serves the dashboard; it does not read retailer pages, so do not add retailer fetching there.
- Product specifications should prefer manufacturer-published values, with retailer corroboration when available. Keep units and string package formats explicit.
- Keep Canada as the default market. Do not enable new markets or retailers without checking their access method and existing market-isolation rules.
- Preserve the existing public-beta read-only behavior and protected admin write behavior.

## Working on a module

- First inspect the existing implementation and tests; extend the established patterns instead of adding a parallel subsystem.
- Keep changes focused on the requested module. Avoid unrelated styling, catalogue, retailer, schema, or deployment changes.
- Preserve user settings and persistent data. Do not change migrations or persistent storage formats without documenting compatibility and migration behavior.
- Do not fabricate product data, prices, retailer coverage, player usage, or specification sources. Mark unknown values as unknown.
- Do not bypass retailer access controls, bot protections, login requirements, or rate limits. Prefer documented APIs and publicly accessible catalogues.
- Never put API keys, passwords, tunnel tokens, signing keys, cookies, or production data in source files, prompts, logs, or commits. Use environment variables or the existing local secret stores.
- Do not publish images, deploy to TrueNAS/Cloudflare, alter production settings, or trigger a release. Return a proposed patch for the owner to review and release.

## Validation and handoff

- Run `npm.cmd test` from Windows PowerShell (or `npm test` on other platforms) after implementation.
- Summarize the user-visible change, files touched, checks run, and any remaining limitations.
- Work on a separate feature branch when possible. Do not commit or push unless the repository owner explicitly asks.
