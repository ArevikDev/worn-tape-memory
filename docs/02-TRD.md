# Echo — Technical Requirements Document

> Architecture, data model, integrations, and engineering decisions for the Echo MVP.

**Companion to:** `01-PRD.md`
**Audience:** Future you, Claude Code, interviewers.

---

## 1. Stack

### Frontend
- **Angular 20** — standalone components, signals for state, new `@if`/`@for` control flow, no NgRx
- **SSR enabled** for marketing/landing routes; CSR for app routes (auth-gated)
- **Tailwind CSS** for styling — utility-first, custom palette tokens for the dark theme
- **D3** for the mood map (force-directed clustering layout) and the heatmaps
- **Chart.js** for the line/area charts (lighter than D3 for simple ones)

### Backend
- **NestJS** — TypeScript, decorators, DI, module-based architecture
- **PostgreSQL** — via **Drizzle ORM** (lighter and more honest than Prisma)
- **Redis** — for OAuth state, sync job queue, AI response cache
- **BullMQ** — job queue running on Redis (background sync, AI enrichment, playlist syncs)
- **`@nestjs/schedule`** — cron triggers
- **`@resvg/resvg-js`** — SVG → PNG rasterization for playlist cover art

### Third-party APIs
- **Spotify Web API** — listening data, playback, playlist creation
- **Google Gemini 2.0 Flash** — AI for vibe tagging, archetype naming, insights (free tier, 1,500 req/day)
  - Backup: Groq for fast inference, Anthropic Claude for higher-quality narrative generation

### Deployment
- **Frontend:** Vercel or Cloudflare Pages
- **Backend + DB + Redis:** Railway (single project, free tier covers this) or Fly.io
- **Domain:** `echo.app` (or whatever's available — `tryecho.com`, `echo.fm`, etc.)

---

## 2. High-level architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Angular 20    │  HTTPS  │     NestJS      │
│   (SSR + SPA)   │ ──────► │   REST + WS     │
└─────────────────┘         └────────┬────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
        ┌───────▼──────┐    ┌────────▼────────┐  ┌────────▼────────┐
        │  PostgreSQL  │    │  Redis + BullMQ │  │  Cron scheduler │
        │   (Drizzle)  │    │   (job queue)   │  │  (every 30 min) │
        └──────────────┘    └────────┬────────┘  └────────┬────────┘
                                     │                    │
                            ┌────────▼────────────────────▼────────┐
                            │           Background workers           │
                            │  • Spotify sync (per user)             │
                            │  • AI enrichment (per track)           │
                            │  • Archetype detection (per user/week) │
                            │  • Playlist sync (per archetype/week)  │
                            └────────┬───────────────────┬──────────┘
                                     │                   │
                            ┌────────▼─────┐    ┌────────▼──────────┐
                            │ Spotify API  │    │  Gemini API       │
                            │ (rate-limit  │    │  (response cache  │
                            │  + retry)    │    │   keyed by track) │
                            └──────────────┘    └───────────────────┘
```

---

## 3. Data model (Drizzle schema, simplified)

```typescript
// users
{
  id: uuid PRIMARY KEY,
  email: text UNIQUE,
  spotify_user_id: text UNIQUE,
  spotify_access_token: text,         // encrypted at rest
  spotify_refresh_token: text,        // encrypted at rest
  spotify_token_expires_at: timestamp,
  display_name: text,
  created_at: timestamp,
  last_synced_at: timestamp,
  last_active_at: timestamp,
}

// tracks  -- canonical track record, one per Spotify track_id
{
  spotify_track_id: text PRIMARY KEY,
  name: text,
  artist_name: text,                  // primary artist as a string for fast display
  artist_ids: text[],                 // all artist Spotify IDs
  album_name: text,
  album_id: text,
  album_art_url: text,
  duration_ms: integer,
  release_year: integer,
  // AI-enriched (nullable until enrichment runs)
  mood_tags: text[],                  // ["melancholy", "patient", "grieving"]
  mood_category: text,                // primary cluster: "melancholy" | "warm" | "peak" | "hypnotic" | "euphoric" | "contemplative"
  energy: real,                       // 0..10
  vibe_vector: real[],                // 8-dim embedding for clustering
  enriched_at: timestamp,
}

// listens  -- one row per play event
{
  id: bigserial PRIMARY KEY,
  user_id: uuid REFERENCES users(id),
  spotify_track_id: text REFERENCES tracks(spotify_track_id),
  played_at: timestamp,
  source: text,                       // "spotify-poll" | "extended-history-import" | "currently-playing"
  // dedup key: (user_id, spotify_track_id, played_at)
  UNIQUE (user_id, spotify_track_id, played_at)
}
INDEX (user_id, played_at DESC)
INDEX (spotify_track_id)

// reactions  -- user tap reactions
{
  id: bigserial PRIMARY KEY,
  user_id: uuid,
  spotify_track_id: text,
  type: text,                         // "heart" | "fire"
  created_at: timestamp,
}

// archetypes  -- detected personas per user
{
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES users(id),
  name: text,                         // "The 11pm wound-licker"
  description: text,                  // AI-generated 1-2 sentences
  color: text,                        // hex
  icon: text,                         // tabler icon name
  peak_hour: integer,
  peak_day_of_week: integer,
  primary_mood: text,
  track_ids: text[],                  // top tracks for this archetype
  play_count: integer,
  last_appeared_at: timestamp,
  detected_at: timestamp,
  // mapping to exported playlist
  spotify_playlist_id: text NULLABLE,
}

// insights  -- generated insights surfaced on dashboard
{
  id: uuid PRIMARY KEY,
  user_id: uuid,
  type: text,                         // "anniversary" | "gap_recommendation" | "current_state" | "missing_region"
  payload: jsonb,                     // type-specific data
  generated_at: timestamp,
  expires_at: timestamp,
  dismissed_at: timestamp NULLABLE,
}

// ai_cache  -- cache AI responses by track_id to avoid re-running
{
  spotify_track_id: text PRIMARY KEY,
  model: text,
  prompt_version: text,
  response: jsonb,
  created_at: timestamp,
}
```

---

## 4. Key flows

### 4.1 OAuth connect
1. User clicks "Connect Spotify" → frontend generates PKCE code verifier + challenge, stores verifier in sessionStorage
2. Redirect to Spotify authorize URL with challenge + scopes
3. Spotify redirects back to `/auth/callback?code=…&state=…`
4. Frontend posts `{ code, code_verifier }` to backend
5. Backend exchanges with Spotify, stores tokens (encrypted), creates user, returns app JWT
6. Frontend stores JWT in httpOnly cookie, redirects to dashboard
7. Backend queues initial sync job

### 4.2 Background sync (per user, every 30 min)
1. Cron picks up users where `last_active_at > 7 days ago AND last_synced_at < 30 min ago`
2. For each, enqueue `SyncSpotifyListensJob`
3. Job:
   - Refresh access token if expired
   - Call `/me/player/recently-played?limit=50` (use `after` cursor = last `played_at` we have)
   - For each new play: upsert into `tracks` (if track new), insert into `listens` (ON CONFLICT DO NOTHING)
   - For any new track_ids, enqueue `EnrichTrackJob`
   - Update `last_synced_at`

### 4.3 AI enrichment (per track, async)
1. Triggered when a new track enters the system
2. Check `ai_cache` — if cached for this prompt version, copy values and return
3. Otherwise call Gemini with structured prompt:
   ```
   Given track "{name}" by {artist} from album "{album}" ({year}):
   Return JSON: {
     mood_tags: string[] (3-5 evocative one-word tags),
     mood_category: one of [melancholy, warm, peak, hypnotic, euphoric, contemplative],
     energy: number 0-10,
     vibe_vector: number[8] (semantic embedding-like values for clustering)
   }
   No prose, just JSON.
   ```
4. Cache response in `ai_cache`, write enriched fields back to `tracks`

### 4.4 Archetype detection (per user, weekly)
1. Query last 30 days of listens for user
2. Build feature matrix: each row = (track, played_at_hour, played_at_dow, energy, mood_vector)
3. Cluster via k-means (k=3 to 5, pick best by silhouette score)
4. For each cluster, send aggregated summary to AI:
   ```
   This cluster represents listens with:
   - peak hour: 23
   - peak day: Sunday
   - dominant moods: melancholy, contemplative
   - top tracks: Phoebe Bridgers - Punisher, Mount Eerie - A Crow Looked At Me
   Generate a persona: name (3-6 words, evocative), description (1-2 sentences), color (hex), icon (tabler name).
   Return JSON.
   ```
5. Upsert into `archetypes` table

### 4.5 Playlist export
1. User clicks "Save to Spotify" on archetype
2. If `archetypes.spotify_playlist_id` exists → update (replace tracks via `PUT /playlists/{id}/tracks`)
3. Otherwise:
   - `POST /me/playlists` with name = archetype name, description = AI description
   - `POST /playlists/{id}/tracks` with track URIs (batch 100 at a time)
   - Generate cover art:
     - Render SVG of archetype's mood signature (color blocks based on mood weather of its listens)
     - Convert to JPEG via `@resvg/resvg-js`, ensure ≤256KB (Spotify limit)
     - Base64 encode
     - `PUT /playlists/{id}/images` with `Content-Type: image/jpeg`
   - Store `spotify_playlist_id` back to archetype

---

## 5. Engineering decisions to defend in interview

### Why NestJS over Express/Fastify?
Same mental model as Angular (DI, modules, decorators). Speeds up context-switching between front and back. Built-in scheduler, queue, validation — fewer ad-hoc choices to defend.

### Why Drizzle over Prisma?
Closer to SQL, less magic, faster cold-start (matters on Railway free tier). Type-safety is comparable. The migration story is more honest.

### Why signals over NgRx?
The app's state is mostly server state (sync, fetch, render). Local UI state is small. Signals + Angular's resource API handle this without ceremony. NgRx would be over-engineering for an MVP — and "I chose the simpler tool" is a stronger answer than "I used the popular one."

### Why Gemini over OpenAI/Claude for tagging?
Free tier handles MVP load. Structured JSON output is reliable. For the higher-stakes prose (archetype names, dashboard hero copy) you can upgrade specific calls to Claude later.

### Why background polling instead of real-time?
Spotify doesn't offer webhooks. 30-min poll is enough granularity for journaling/reflection. A real-time "now playing" widget uses the separate `currently-playing` endpoint, polled by the frontend itself when the app is open.

### Why cache AI responses by track?
Tracks are global. Once one user gets a track enriched, every other user benefits for free. Costs collapse as the user base grows.

### Why per-user dedup on listens?
Spotify's recently-played returns overlapping windows. The unique constraint on `(user_id, track_id, played_at)` makes ingestion idempotent — re-running sync jobs is safe.

---

## 6. Rate limits and failure modes

### Spotify
- App-level rate limit (not user-level). Use a shared token bucket in Redis for outgoing requests.
- 429 response → respect `Retry-After` header, exponential backoff with jitter.
- 50 items max on recently-played → poll frequently enough that overlap, not gaps, is the failure mode.
- Token refresh: do it proactively when `expires_at < now + 60s`, not reactively after a 401.
- Playlist track add: batch 100 at a time, ≥300ms between batches.
- Cover image upload sometimes 502s → retry with backoff, but treat as non-fatal (playlist still works without art).

### Gemini
- 1,500 req/day free tier. Enrichment is the heavy call.
- Mitigation: aggressive caching (most tracks enrich once across all users), batch enrichment requests where API supports it.
- On rate limit: defer to next cron cycle.

### Postgres
- Free tier on Railway has connection limits. Use a connection pool, keep it small (5–10).
- Listens table grows fast. Add indexes early, plan to partition by user_id later (not in MVP).

---

## 7. Security

- All Spotify tokens encrypted at rest (use Node's `crypto` with a key from env)
- JWTs in httpOnly cookies, SameSite=Lax, Secure in prod
- CSRF tokens on all state-changing endpoints
- Don't expose Spotify access tokens to the frontend, ever — frontend talks to Echo backend only
- Gemini API key only on backend, never in client bundle
- Rate-limit per-IP on auth endpoints
- HTTPS everywhere

---

## 8. Observability

For an MVP demo, you don't need full Datadog. Minimum viable:
- Structured logs via `pino`
- Health endpoint `/healthz` for Railway
- Sentry (free tier) for error tracking
- Manual `/admin/stats` page for you to peek at sync status, queue depth, user counts

---

## 9. Testing strategy

Don't test everything. Test what'd embarrass you if it broke in the demo:
- **Unit:** AI prompt builders (deterministic given input), dedup logic, archetype clustering correctness
- **Integration:** Spotify OAuth flow with mocked Spotify responses, full sync job end-to-end
- **E2E (1 happy path):** connect Spotify → see dashboard → tap archetype → export playlist → verify it exists in Spotify (against a test account)

Aim for ~50 tests total, not 500. The interview question to expect: *"how do you decide what to test?"* — and your answer is the above.

---

## 10. Open questions / decisions to make later

- Cover art generation: SVG-derived patterns vs. solid color blocks vs. low-res album-art collages. Pick one and ship it; iterate later.
- Archetype refresh cadence: weekly is the default. Make it user-configurable later.
- Mood vector dimensionality: 8 is a guess. Test with real data, may go to 16 or down to 4.
- How to handle the "the user hasn't listened in 2 weeks" cold-start. For MVP, just stop syncing them.
