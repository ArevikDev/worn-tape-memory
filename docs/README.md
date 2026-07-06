# Worn Tape Memory — Docs

This folder contains the product and technical documentation for Worn Tape Memory.

## What's here

| File | Purpose |
|---|---|
| `01-PRD.md` | Product Requirements Document — what we're building and why |
| `02-TRD.md` | Technical Requirements Document — stack, architecture, data model |
| `03-BUILD-PLAN.md` | Day-by-day 3-week build schedule |

## Recommended setup

- [ ] Spotify developer account: register an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), get client ID and secret
- [ ] Request your Spotify Extended Streaming History (privacy settings → request data, takes ~5 days — do this early)
- [ ] Google AI Studio account for a free Gemini API key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- [ ] Railway account (or Fly.io) — free tier is enough for development
- [ ] Vercel account — free tier is enough
- [ ] Node 22+, pnpm 9+, Docker installed locally

## Troubleshooting

- **Spotify changed their API** — check the [changelog](https://developer.spotify.com/documentation/web-api/references/changes) for migration notes
- **Sync job stuck** — check Redis is up; check the worker logs in BullMQ dashboard
- **Postgres connection limit** — Railway free tier is tight; reduce pool size to 5
