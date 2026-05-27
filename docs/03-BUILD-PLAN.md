# Worn Tape Memory — 3-Week Build Plan

> Day-by-day plan to get from empty repo to demo-ready in 21 days.
> Assumes ~3 hrs/day average with Claude Code assistance. Adjust pace as needed.

**Companion to:** `01-PRD.md`, `02-TRD.md`

---

## Build philosophy

- **End every day with something runnable.** Even on day 1.
- **Vertical slices, not horizontal.** Don't build all the schemas, then all the services, then all the UI. Build one feature end-to-end first.
- **Defer auth/deploy stress.** Run locally until week 3, then deploy.
- **Use real data ASAP.** Connect *your* Spotify on day 3. Pretend-data debugging is a waste.
- **Ship the demo path first.** The path through the app you'll show in the interview. Polish that, then add the rest.

---

## Week 1 — Foundation + Spotify ingestion

**Goal:** by Sunday, you can run the app locally, connect your Spotify, and see your real listening history flowing in.

### Day 1 — Scaffolding
- [ ] Init monorepo (e.g. `pnpm` workspace with `apps/web`, `apps/api`, `packages/shared`)
- [ ] Angular 20 app with standalone components, signals, Tailwind, dark mode by default
- [ ] NestJS app with `@nestjs/config`, pino logging, healthz endpoint
- [ ] Postgres + Redis via Docker Compose locally
- [ ] Drizzle schema for `users`, `tracks`, `listens` tables, migrations running
- [ ] Basic landing page on the web app: just a logo and "Connect Spotify" button (non-functional)

**End of day:** `pnpm dev` brings up both apps, you see the landing page at `localhost:4200`.

### Day 2 — Spotify OAuth
- [ ] Register Spotify dev app, get client ID, set redirect URI to `http://localhost:4200/auth/callback`
- [ ] Backend: `POST /auth/spotify/exchange` endpoint (PKCE flow)
- [ ] Backend: encrypted token storage (use `@nestjs/config` for encryption key)
- [ ] Backend: token refresh service
- [ ] Frontend: PKCE code generation, redirect flow, callback handling
- [ ] JWT issuance, httpOnly cookie set
- [ ] After connect → redirect to `/dashboard` (placeholder page showing "you're connected!")

**End of day:** you can click Connect, authorize with Spotify, and land on a "hello, [your name]" page.

### Day 3 — First sync
- [ ] BullMQ + Redis wired up in NestJS
- [ ] `SyncSpotifyListensJob` — fetches `/me/player/recently-played`, upserts tracks, inserts listens
- [ ] Manual trigger endpoint: `POST /admin/sync/me` (for testing)
- [ ] Run it. Check your DB has real listen data.
- [ ] Cron schedule: every 30 min

**End of day:** your real Spotify data is in your local Postgres. This is the magic moment.

### Day 4 — Extended history import
- [ ] Add file upload endpoint for Spotify's Extended Streaming History zip
- [ ] Parser: unzip → for each JSON file → bulk insert listens (skip duplicates)
- [ ] UI: drag-and-drop upload page at `/onboarding/import`
- [ ] Run on your own history (request it from Spotify privacy settings ahead of time)

**End of day:** you have years of real listens in your DB. The pattern features will actually have something to chew on.

### Day 5 — Dashboard skeleton
- [ ] Route guards: `/dashboard` requires JWT
- [ ] Dashboard layout: top nav, hero area, stats row, three placeholder archetype cards, mood weather strip placeholder
- [ ] Real stats: today's listens count, this-week new artists, % re-listens (compute from DB)
- [ ] "Now playing" component: polls `/me/player/currently-playing` every 10s when app is focused
- [ ] Tap reactions UI (heart, fire) — store in `reactions` table

**End of day:** dashboard shows your real stats and what you're listening to right now. No archetypes yet — placeholders.

### Day 6 — Visual polish pass
- [ ] Tailwind theme: dark palette tokens, custom font stack, consistent spacing scale
- [ ] Build a small component library: Card, Pill, StatTile, ArchetypeCard, MoodBar
- [ ] Loading states everywhere (skeletons, not spinners)
- [ ] Empty states (when no data yet)
- [ ] Mobile-responsive at minimum (you don't need to design mobile-first, just don't break it)

**End of day:** dashboard *looks* like a product, even with placeholder data.

### Day 7 — Buffer / catch-up
- [ ] Whatever ran long, finish it
- [ ] Write a README for the repo
- [ ] Commit, push to GitHub (private repo)

---

## Week 2 — AI enrichment + Archetypes + Mood map

**Goal:** by Sunday, the AI is fully online, you have real archetypes detected from your listening, and the mood map renders.

### Day 8 — AI enrichment pipeline
- [ ] Gemini API integration in NestJS
- [ ] `EnrichTrackJob`: takes track, calls Gemini with prompt from TRD §4.3, parses JSON, writes to `tracks` table
- [ ] `ai_cache` table — check before calling
- [ ] Enqueue enrichment job for every new track from the sync flow
- [ ] Trigger backfill: enqueue enrichment for all existing un-enriched tracks (rate-limited)
- [ ] Watch the queue process. Verify mood_tags / mood_category appear in DB.

**End of day:** every track in your library has an AI-assigned mood. Backend foundations done.

### Day 9 — Archetype detection algorithm
- [ ] `ArchetypeDetectionJob`: pull last 30 days of listens for user
- [ ] Feature engineering: per-listen feature vector (hour, dow, energy, mood_category one-hot, vibe_vector)
- [ ] K-means clustering (try `ml-kmeans` npm package), k=3..5, pick by silhouette
- [ ] For each cluster, compute stats (peak hour, peak dow, dominant mood, top tracks)
- [ ] Send to Gemini for naming via prompt in TRD §4.4
- [ ] Upsert into `archetypes` table
- [ ] Manual trigger: `POST /admin/archetypes/detect/me`

**End of day:** you have 3-5 real archetypes for yourself, with AI-generated names. Marvel at how accurate they are.

### Day 10 — Archetype UI
- [ ] Archetype cards on dashboard (real data)
- [ ] Archetype detail page route: `/archetypes/:id`
- [ ] Detail UI per the mockup: hero, action pills, stats row, heatmap, defining tracks
- [ ] Heatmap component (D3 or just SVG grid) for "when this self appears"
- [ ] "Play this self" button → calls Spotify `PUT /me/player/play` with track URIs

**End of day:** the headline feature works. You can tap an archetype and Spotify plays it.

### Day 11 — Mood map
- [ ] Compute 2D projection of vibe_vectors via `umap-js` or PCA via `ml-pca`
- [ ] Detect cluster regions: which mood_category dominates each spatial region
- [ ] Render: SVG with dots positioned, cluster region ellipses, color by mood
- [ ] Interactivity: hover for track preview, click region → play those tracks
- [ ] Filter pills (all time / year / month / week) — re-projects on selection

**End of day:** the mood map screen works against your real library. Screenshot it. It's beautiful.

### Day 12 — Insights generation
- [ ] `InsightsGenerationJob` — runs daily per user
- [ ] Anniversaries: query for first-played dates exactly 1 year ago, store as insight
- [ ] Gap recommendations: identify which mood region has fewest tracks, ask Gemini for one suggestion
- [ ] Current state line: aggregate last 7 days, ask Gemini for a one-liner ("a slow-burn week, leaning melancholic")
- [ ] Dashboard surfaces top 2 insights, with dismiss action

**End of day:** dashboard feels alive — anniversary cards, recommendations, the AI hero copy.

### Day 13 — Listening rhythm + Patterns lite
- [ ] Patterns route `/patterns`
- [ ] Listening rhythm heatmap (24h × 7d, all-time)
- [ ] Mood weather full view (last 90 days as Chart.js area chart)
- [ ] Discovery vs comfort line graph

**End of day:** secondary screens exist, demoable.

### Day 14 — Buffer / polish week 2
- [ ] Performance audit: dashboard load time, signal usage check
- [ ] Fix any broken sync edge cases
- [ ] Visual polish round 2: animations, micro-interactions, loading states refined
- [ ] Snapshot test the key screens (Playwright is overkill; just a visual smoke test)

---

## Week 3 — Playlist export + Polish + Deploy

**Goal:** by Sunday, the app is deployed, exports playlists with custom cover art, and is interview-ready.

### Day 15 — Playlist export (no cover art)
- [ ] `ExportArchetypeAsPlaylistService`: creates Spotify playlist, adds tracks
- [ ] Idempotency: check `archetypes.spotify_playlist_id`, update if exists
- [ ] Batched track adds (100 per call, 300ms delay)
- [ ] Error handling: 502s on bulk add, token expiry, rate limits
- [ ] UI: "Save to Spotify" button on archetype detail → toast on success with link to playlist

**End of day:** you can save any archetype to your Spotify. Open the Spotify app and see it appear.

### Day 16 — Cover art pipeline
- [ ] SVG cover art generator: takes archetype's mood signature, renders color-block art (Rothko-style)
- [ ] `@resvg/resvg-js` to rasterize to JPEG, max 256KB
- [ ] Base64 encode, `PUT /playlists/{id}/images`
- [ ] Wire into export flow
- [ ] Verify in Spotify: cover art appears on saved playlist

**End of day:** your exported playlists have custom, data-derived cover art. This is genuinely cool — practice talking about the pipeline.

### Day 17 — Living playlists
- [ ] Weekly cron: `SyncArchetypePlaylistsJob`
- [ ] For each archetype with `spotify_playlist_id`: re-detect top tracks, diff vs current playlist contents, push update via `PUT /playlists/{id}/tracks`
- [ ] Handle case where user has manually edited the playlist (detect drift, optionally surface "your version diverged" UI)

**End of day:** archetypes are "living" — they update as your listening evolves.

### Day 18 — Deploy
- [ ] Set up Railway project: Postgres, Redis, NestJS service
- [ ] Set up Vercel for Angular SSR (or Cloudflare Pages)
- [ ] Environment variables, encryption keys, Spotify redirect URI updated
- [ ] HTTPS, CORS configured
- [ ] Run migrations against prod DB
- [ ] Smoke test the full flow against prod

**End of day:** app is live at a public URL. Connect your Spotify on prod, verify it all works.

### Day 19 — Demo polish
- [ ] Onboarding screen flow: connect → import history → "we're analyzing your listening…" loading state → dashboard
- [ ] Error states (Spotify not connected, sync failed, AI quota hit)
- [ ] Add 3-5 sample insights to dashboard for "you just connected, here's a preview" experience
- [ ] Make sure your own account looks *amazing* — your archetypes, your map, your insights should be the best showcase
- [ ] Record a 90-second screen capture of the happy path (for the interview if live demo fails)

**End of day:** the demo path is bulletproof.

### Day 20 — README + Architecture docs
- [ ] Repo README with:
  - One-paragraph pitch
  - Screenshots of dashboard, archetype detail, mood map
  - Setup instructions
  - Stack rationale
  - Architecture diagram (export from your TRD)
- [ ] `ARCHITECTURE.md` with the decisions from TRD §5
- [ ] A short `DEMO.md` listing the 6 things you'll show in the interview

**End of day:** the repo itself is interview-ready. Most candidates skip this; you won't.

### Day 21 — Interview prep
- [ ] Walk through the demo end-to-end three times. Time yourself.
- [ ] Prep answers to: "what was hardest?", "what would you do differently?", "how would this scale?", "why these choices?"
- [ ] Pick the one technical deep-dive you want to volunteer: probably the Spotify sync pipeline (token refresh, dedup, rate limits, AI enrichment cache)
- [ ] Sleep well

---

## What you cut

If you fall behind, cut in this order:

1. Living playlist sync (day 17) — nice but not essential
2. Listening rhythm + discovery graphs (day 13) — patterns route can be hidden
3. Insights generation (day 12) — dashboard still works with just archetypes + mood weather
4. Extended history import (day 4) — start with empty data, use month of live listens instead

**Do not cut:** dashboard, archetypes, mood map, playlist export with cover art. These are the demo.

---

## What you defer (post-interview)

Everything in PRD §5 (parking lot). After the interview, if you want to keep iterating: voice notes and the AI critic conversation are the next two features I'd add — both lean into the "wow" factor without being weeks of work.
