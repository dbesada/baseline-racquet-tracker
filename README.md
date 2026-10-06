# Baseline — tennis gear finder

Baseline is a Canadian-first tennis gear discovery app for comparing racquets, strings, balls, and accessories across retailers, with used-market listings, specs, and buying guides.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```powershell
npm install
npm run dev
```

Use `npm.cmd` instead of `npm` in PowerShell environments where script execution policy blocks npm's PowerShell shim.

`npm run dev` serves the app and its API but does not check prices. Price checks run in the price monitor (`scripts/check-prices.mjs`), which the relay (`scripts/baseline-relay.mjs`) starts when it boots, every 3 hours, and when an admin presses Check prices now; the relay then merges the results into the dashboard. The relay only runs in the deployed container, so under `npm run dev` Check prices now fails: the API answers with a 501 error that says so.

Useful checks:

```powershell
npm run build
npm test
```

Check `package.json` for the complete scripts list. Some catalog refreshes and retailer checks require environment variables; copy `.env.example` to `.env` as the template and keep real credentials in that untracked file or a secret manager.

## Access control

The relay (`scripts/baseline-relay.mjs`) decides who may change settings or start price checks. A request is an admin request only if it comes directly from the local network, or if it arrives through Cloudflare with a valid Cloudflare Access token for this application. Everyone else gets the read-only public preview. To enable admin access through Cloudflare, set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` on the relay service (see `.env.example` and `deploy/truenas-compose.yml`).

## Tailscale routes

The Android app reaches Baseline through the NAS's Tailscale address, and eBay's account-deletion callback arrives through Tailscale Funnel. These routes are settings inside the TrueNAS Tailscale app, not part of `deploy/truenas-compose.yml`, and they persist across restarts. If the Tailscale app is reinstalled or its state is reset, apply them again from a TrueNAS shell:

```sh
docker exec ix-tailscale-tailscale-1 tailscale serve --bg --https=443 http://127.0.0.1:4600
docker exec ix-tailscale-tailscale-1 tailscale funnel --bg --https=8443 http://127.0.0.1:4602
docker exec ix-tailscale-tailscale-1 tailscale serve status
```

Port 443 is the relay, private to the tailnet. Port 8443 is the eBay callback, public through Funnel.

## Releasing to TrueNAS

The containers run as the unprivileged `node` user (uid 1000), so uid 1000 must own the data folders on the NAS: `/mnt/pool0/apps/baseline/direct-data` and `/mnt/pool0/apps/baseline/direct-wrangler`.

The API's database is kept in `direct-wrangler/state`, so it survives releases. The relay also keeps a copy of the settings in `direct-data/baseline-settings.json` and writes it into the database each time it starts, so a new or reset database gets the saved settings back.

Retailer links go through the relay's `/go/<offer id>` redirect, which sends the visitor to the URL stored for that offer and adds one line to `direct-data/baseline-clicks.jsonl`: time, offer ID, retailer and market (no IP address or user agent). Rows older than 90 days are removed, and the file stops growing at 5 MB. The market defaults to `CA`; a deployment for another market sets `BASELINE_MARKET` on the relay. The file is new and additive; deleting it only loses click counts.

Affiliate links are set per retailer in `config/affiliates/ca.json` (and `us.json` for a U.S. deployment); the relay reads only the file for its own market, at startup, so a change needs a release. Both files ship with no retailers, so every click goes to the plain retailer link. An entry looks like this:

```json
{ "retailer": "Amazon.ca", "market": "CA", "network": "amazon-associates", "enabled": false,
  "hosts": ["www.amazon.ca"], "addParams": { "tag": "your-tag-20" } }
```

`retailer` must match the store name shown on offers, and `hosts` lists the retailer link hostnames the entry applies to. Use `addParams` to add query parameters to the retailer's own link, or `linkTemplate` (an https link containing `{url}`, which becomes the encoded retailer link) for networks that send clicks through their own address. A disabled, invalid or non-matching entry falls back to the plain link; the relay logs a warning for an invalid one, and the tests reject it. Each click row records the entry's `network`, or `null` for a plain link. Keep entries disabled until the affiliate disclosure is on the site; a test enforces this until then.

The release scripts verify the TrueNAS certificate. They connect to `truenas.besada.net`, which resolves to the NAS and is covered by its Let's Encrypt certificate for `*.besada.net`; connecting by IP address fails verification. Set `TRUENAS_HOST` to use another name. Only if the certificate cannot be verified, set `BASELINE_ALLOW_INSECURE_TLS=1` for a single run on a trusted network.

## Project map

- `app/` — application routes, shared UI, data, and server logic.
- `public/` — static assets and product imagery.
- `scripts/` — retailer/catalog maintenance and price-check utilities.
- `tests/` — automated checks.
- `deploy/` — container and TrueNAS deployment configuration.
- `docs/` — project and operations notes.

## Working with AI coding tools

This repository is the shared source of truth. Ask an AI coding tool to connect to GitHub and open `dbesada/baseline-racquet-tracker`, or clone the repository with an authenticated GitHub account. Keep changes on a feature branch and open a pull request for review before merging.

Never commit API keys, browser profiles, personal data, local databases, or deployment secrets. Review `git status` and the diff before pushing.

## Deployment boundary

This repo contains deployment configuration for the owner's TrueNAS environment. Repository access does not authorize deploying, changing live services, or publishing a release; make those changes only when the owner explicitly requests them.
