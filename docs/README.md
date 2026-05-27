# Worn Tape Memory — Docs

This folder contains everything needed to build Worn Tape Memory from scratch.

## What's here

| File | Purpose | Read when |
|---|---|---|
| `01-PRD.md` | Product Requirements Document — what we're building and why | First, to understand the product |
| `02-TRD.md` | Technical Requirements Document — stack, architecture, data model | After PRD, before coding |
| `03-BUILD-PLAN.md` | Day-by-day 3-week build schedule | To know what to ship when |
| `CLAUDE.md` | Primer for Claude Code / Cursor — drop in repo root | Every time you start a new AI session |

## How to use this with Claude Code in VS Code

1. Clone/init your repo
2. Copy all four files into the repo:
   - `CLAUDE.md` goes in the **repo root**
   - The three numbered docs go in a `/docs` folder
3. Open the project in VS Code with Claude Code extension
4. Start a new chat with Claude Code, paste:
   > Read `CLAUDE.md` and the docs in `/docs`. We're working on Worn Tape Memory. Confirm you understand the product, stack, and build plan, then we'll begin Day 1 of the build plan.
5. Claude Code reads the docs, gives you a confirmation, then start building day by day

## Recommended setup before Day 1

- [ ] Spotify developer account: register an app at https://developer.spotify.com/dashboard, get client ID
- [ ] Request your Spotify Extended Streaming History (privacy settings → request data, takes ~5 days, so do this NOW)
- [ ] Google AI Studio account for free Gemini API key: https://aistudio.google.com/apikey
- [ ] Railway account (or Fly.io) — free tier is enough
- [ ] Vercel account — free tier is enough
- [ ] Domain (optional for demo, but `tryecho.app` or similar is a nice touch)
- [ ] Node 22+, pnpm 9+, Docker installed locally

## The interview pitch (memorize)

> Spotify daylist tells you what to listen to right now. Worn Tape Memory tells you who you've been all year, based on every right-now you've had. It's the difference between a weather forecast and a climate.

## The technical pitch (memorize)

> I built a reflection layer on top of Spotify. The hard part wasn't the UI — it was designing a sync pipeline that respects Spotify's rate limits, an AI enrichment cache that scales sub-linearly with users, and an archetype detection algorithm that produces personas specific enough to feel *true* about the listener. Want to walk through the sync pipeline?

(Spoiler: yes they will want to walk through it. Practice that walkthrough.)

## When things go wrong

- **Spotify changed their API again** — they do this. Check the [changelog](https://developer.spotify.com/documentation/web-api/references/changes) for migration notes.
- **Gemini rate limit** — fall back to Groq (free, fast) or pay for OpenAI/Anthropic
- **Sync job stuck** — check Redis is up; check the worker logs in BullMQ dashboard
- **Postgres connection limit** — Railway free tier is tight; reduce pool size to 5

## License

Your project, your call. MIT is the no-brainer default if you want it public, none if you want it private. For an interview repo, private is fine — share a link with the interviewer manually.
