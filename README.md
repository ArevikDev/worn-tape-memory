# Worn Tape Memory

> Spotify tells you what to listen to. Worn Tape Memory tells you who you've been — and lets you play that self on demand.

A music intelligence layer on top of Spotify. Connect once, and the app passively captures everything you play, characterizes every track's mood and energy, and surfaces patterns you'd never find on your own: the listening personas hiding in your habits, the emotional weather of your year, the moods that define you.

---

## Features

- **Archetypes** — AI-detected listener personas clustered from your history (e.g. "The 11pm wound-licker", "The Sunday morning archivist"). Each one is playable as a Spotify playlist with auto-generated cover art.
- **Mood weather** — Your last 30 days visualized as colored bands: melancholy, warm, peak, hypnotic, euphoric, contemplative.
- **Now playing** — Live track display with album art.
- **Dashboard insights** — A one-line current state of your listening week, top tracks, top artists, and recent listens.
- **Living playlists** — Export any archetype as a Spotify playlist that re-syncs as your data evolves.
- **Passive sync** — Background job syncs your Spotify history every 30 minutes. Zero manual logging.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Angular 20, Tailwind CSS, SSR |
| Backend | NestJS, Drizzle ORM, PostgreSQL, Redis, BullMQ |
| AI enrichment | Google Gemini 2.0 Flash |
| Auth | Spotify OAuth (PKCE) |
| Deploy | Vercel (frontend), Railway (backend + DB + Redis) |

Monorepo via pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`.

---

## Getting started

### Prerequisites

- Node 22+, pnpm 9+, Docker
- Spotify Developer account — register an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) to get a client ID and secret
- Google AI Studio account for a Gemini API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Install

```bash
git clone https://github.com/your-username/worn-tape-memory
cd worn-tape-memory
pnpm install
```

### Environment variables

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/worn_tape
REDIS_URL=redis://localhost:6379
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/callback
GEMINI_API_KEY=your_gemini_key
ENCRYPTION_KEY=32-char-random-string
JWT_SECRET=your-jwt-secret
```

### Run locally

```bash
# Start Postgres + Redis
docker compose up -d

# Run DB migrations
pnpm --filter api db:migrate

# Start API (port 3000) and web (port 4200)
pnpm --filter api dev
pnpm --filter web dev
```

Open [http://localhost:4200](http://localhost:4200) and connect your Spotify account.

---

## Project structure

```
apps/
  web/        # Angular 20 frontend
  api/        # NestJS backend
packages/
  shared/     # Types shared between frontend and backend
docs/         # Product and technical docs
```

---

## Spotify scopes required

```
user-read-recently-played
user-top-read
user-read-currently-playing
user-read-playback-state
user-modify-playback-state
playlist-modify-private
playlist-modify-public
playlist-read-private
ugc-image-upload
```
