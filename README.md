# Baseline — tennis gear finder

Baseline is a Canadian-first tennis gear discovery app for comparing racquets, strings, balls, and accessories across retailers, with used-market listings, specs, and buying guides.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```powershell
npm install
npm run dev
```

Use `npm.cmd` instead of `npm` in PowerShell environments where script execution policy blocks npm's PowerShell shim.

Useful checks:

```powershell
npm run build
npm test
```

Check `package.json` for the complete scripts list. Some catalog refreshes and retailer checks require environment variables; use `.env.example` as the template and keep real credentials in an untracked local `.env` or a secret manager.

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
