# Echo — Product Requirements Document

> A music intelligence layer on top of Spotify. Connect once, and the app passively captures everything you play, characterizes it with AI, and turns it into a beautiful, opinionated view of your listening life.

**Version:** 0.1 (MVP scope)
**Owner:** Single developer (you)
**Timeline:** 3 weeks to demo-ready

---

## 1. Vision

### One-line pitch
Spotify daylist tells you what to listen to now. Echo tells you who you've been all year — and lets you play that self on demand.

### Three-line pitch
Echo passively syncs your Spotify listening history, uses AI to characterize every track's mood and energy, and surfaces patterns you'd never find on your own: the personas hiding in your habits, the emotional weather of your year, the gaps in your library. Every insight is shareable. Every mood is one tap from playing in Spotify. Zero manual logging.

### Why this exists
- Spotify owns your *listening* but treats it as a stream-optimization signal, not as identity.
- Last.fm logs your music but offers no interpretation — just counts.
- Wrapped is once a year and gamified.
- There is no product that gives the music nerd a *daily relationship* with their own listening history.

### Non-goals
- Not a journaling app (writing is optional, never required).
- Not a music recommendation engine in the Spotify Discover sense (curatorial nudges only).
- Not a social network (sharing is one-way: export beautiful artifacts).
- Not a Spotify replacement (Spotify remains the player).

---

## 2. Target user

**Primary persona: The Music Nerd**
- 25–40, has Spotify Premium, listens to music daily as part of identity (not background).
- Posts daylist titles on social media; cares about Wrapped; has opinions on production.
- Often a DJ, producer, critic-adjacent, or just an obsessive listener.
- Has tried Last.fm, found it dated. Knows daylist, finds it shallow.

**They want:**
- A beautiful, opinionated view of their own taste
- Insights they'd never derive themselves
- Shareable artifacts that say "this is who I am right now"
- Zero homework — they listen, the app does the rest

---

## 3. Core principles

1. **Zero-friction capture.** User connects Spotify once. Never logs anything manually.
2. **AI is the interpreter, not the chatbot.** AI runs in the background tagging, characterizing, summarizing. Chat is hidden, optional.
3. **Every insight is playable.** Mood, archetype, era, region — one tap and it's playing in Spotify.
4. **Beautiful by default.** Dark mode native, album-art-driven, considered typography. Looks like a product, not a tool.
5. **Shareable artifacts as marketing.** Every screen yields a screenshot worth posting.
6. **Respect the user's taste.** Recommendations are curatorial nudges, not algorithmic feeds.

---

## 4. Feature set — MVP (3-week scope)

### 4.1 Onboarding
- Spotify OAuth (PKCE flow), scopes: `user-read-recently-played`, `user-top-read`, `user-read-currently-playing`, `playlist-modify-private`, `playlist-modify-public`, `ugc-image-upload`
- "Connect your Spotify" → "Importing your history…" → dashboard
- Optional: upload Spotify Extended Streaming History zip (years of past plays) for instant rich data on day one

### 4.2 Background sync
- Cron job every 30 min per user: hit `/me/player/recently-played`, dedupe against existing listens, store new ones
- Deduplication key: `(user_id, track_id, played_at_ms)`
- AI enrichment job: any track without mood tags gets enriched (one LLM call returns vibe tags, energy 0–10, mood category)

### 4.3 Dashboard (home)
- Hero: AI-generated one-line current state ("a slow-burn week, leaning melancholic")
- Stats row: listens today, new artists this week, % re-listens
- Active archetypes (3 cards, each tappable to play)
- Mood weather strip (last 30 days as colored bands)
- Two insight cards: anniversary + curatorial recommendation
- Now-playing bar with tap reactions (heart, 🔥)

### 4.4 Archetypes
- Auto-detection: cluster listens by hour-of-day + day-of-week + mood vector
- 3–5 archetypes per user, each with: AI-generated name + description, color, icon, defining tracks, peak time, plays count
- Detail page: hero, stats, when-this-self-appears heatmap, defining tracks
- Actions: play this self (in Spotify), save to Spotify (as playlist), share (image)

### 4.5 Mood map
- 2D galaxy view: each track a dot, clustered by AI vibe vector
- 4–6 labeled regions (melancholy, warm+patient, peak/propulsive, hypnotic, euphoric, contemplative)
- Filters: all time / this year / this month / this week
- Tap a region → plays those tracks via Spotify
- AI-read of the map (1 paragraph): "your library has a clear melancholy core…"
- "Missing region" callout for discovery

### 4.6 Patterns (lightweight in MVP)
- Listening rhythm heatmap (24h × 7d)
- Mood weather full view (last 90 days as area chart)
- Discovery vs. comfort line graph

### 4.7 Tap reactions
- On now-playing widget: heart (favorite), flame (obsessed-with-right-now)
- Stored as weighted signal for archetype detection and recommendations
- That's the only "input" the user can give. No writing in MVP.

### 4.8 Playlist export
- Every archetype page has "save to Spotify" → creates playlist via `POST /me/playlists`, adds tracks via `POST /playlists/{id}/tracks`
- Generated cover art: render SVG visualization → rasterize → upload via `PUT /playlists/{id}/images`
- Idempotency: maintain `(echo_archetype_id ↔ spotify_playlist_id)` mapping; re-export updates, not duplicates
- Living playlists: weekly cron updates archetype playlists as new listens flow in

### 4.9 Curatorial recommendations (1 per dashboard load)
- AI compares user's mood map to "music universe" — identifies gaps
- Outputs one suggestion: "you haven't listened to X this year, try Y"
- One tap → plays Y in Spotify

---

## 5. Feature set — post-MVP (parking lot)

These are great but **out of scope** for the 3-week build. Document them so they're not forgotten.

- Voice notes → AI-transcribed entries
- AI music critic conversation on album pages
- Monthly archetype letter (auto-generated reflection)
- Yearly portrait (Wrapped alternative)
- Time machine (slider through history)
- Daylist title archive
- Anniversaries push notifications
- Shareable monthly cards (auto-generated images for IG)
- Listening seasons (auto-detected eras)
- Gateway track insights
- Connections engine (cross-library links)
- Anti-recommendation playlists
- Bridge playlists from journal entries
- Sunday review

---

## 6. Success criteria for the interview demo

You can show:
1. A connected Spotify account with real listening data flowing in
2. A dashboard with 3 detected archetypes that are *true* about you
3. A mood map of your actual library
4. One "play this self" working end-to-end (clicks → Spotify plays)
5. One generated playlist exported to Spotify with custom cover art
6. A coherent story about technical decisions: why NestJS, why signals, why this AI pipeline

If all six work, the demo is a success regardless of what else is built.

---

## 7. Out of scope, explicit

- Multi-user features (one-user-at-a-time is fine; auth still required for security)
- Mobile native app (responsive web is enough)
- Free tier vs. premium tier logic (assume user has Spotify Premium)
- Public production deployment with extended quota approval (demo runs on your dev app, 25-user limit is fine)
- Audio file analysis (Spotify killed audio-features endpoint; we don't do our own DSP)
- Payments / monetization
- Email / push notifications (in-app surfaces only for MVP)
