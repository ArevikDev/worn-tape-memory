# Worn Tape Memory — Claude Code Primer

> Drop this file in your repo root. Reference it in your first conversation with Claude Code (or Cursor / Copilot Agent) to get fast, aligned output.
> When you start a new session, say: *"Read CLAUDE.md and the docs in `/docs`. We're working on Worn Tape Memory."*

---

## What we're building

**Worn Tape Memory** — a music intelligence layer on top of Spotify. The name comes from the way a cassette sounds after it's been played a hundred times — slightly degraded, deeply personal. That's what this app is: the tape always comes back slightly different.

Read `/docs/01-PRD.md` for full product context. Read `/docs/02-TRD.md` for architecture. Read `/docs/03-BUILD-PLAN.md` for what we're shipping when.

In one line: Spotify tells you what to listen to. Worn Tape Memory tells you who you've been — and lets you play that self on demand.

---

## Stack snapshot

- **Frontend:** Angular 20 (standalone, signals, `@if`/`@for`), Tailwind, SSR for marketing routes
- **Backend:** NestJS, Drizzle ORM, Postgres, Redis, BullMQ
- **Integrations:** Spotify Web API, Google Gemini 2.0 Flash
- **Deploy:** Vercel (frontend), Railway (backend + DB + Redis)

Monorepo via pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`.

---

## How to work with me

### Always
- **Use modern Angular** — standalone components, `inject()` function over constructor injection, `signal()` / `computed()` / `effect()` for reactive state, new control flow (`@if` / `@for` / `@switch`), no `*ngIf` / `*ngFor`
- **Use Drizzle, not Prisma** for any DB code
- **Use NestJS modules** — never put logic in a controller; thin controller → service → repository
- **Keep types in `packages/shared`** so frontend and backend share interfaces
- **Show me a plan before big changes** — list files you'll create/modify, get my okay, then execute

### Never
- Don't suggest NgRx, ngxs, or any heavy state library. Signals are the answer.
- Don't suggest Prisma migrations syntax. Drizzle uses SQL files.
- Don't suggest Express middleware patterns in NestJS — use guards, interceptors, pipes.
- Don't write CSS-in-JS. Tailwind utility classes only, with one `@apply` exception for repeated patterns.
- Don't write tests "for completeness" — write tests only for the critical paths in TRD §9.
- Don't add new dependencies without telling me what they cost and why we need them.

### Style
- Function names: descriptive verbs. `syncRecentlyPlayedForUser`, not `doSync`.
- Don't over-comment. Comments explain *why*, never *what*. Code that needs *what* comments needs to be rewritten.
- Prefer composition over abstraction. Two slightly-different functions are usually better than one parameterized one.
- Error handling: throw typed errors at boundaries, catch at the controller level via a global filter.

---

## Domain glossary (use these terms consistently)

- **Listen** — one play event of a track at a specific time
- **Track** — canonical Spotify track record (one row per `spotify_track_id`, shared across all users)
- **Enrichment** — the AI step that adds mood tags + vibe vector to a track
- **Archetype** — a detected listener-persona (e.g. "The 11pm wound-licker")
- **Mood category** — one of: melancholy, warm, peak, hypnotic, euphoric, contemplative
- **Vibe vector** — 8-dim float array used for clustering tracks in mood space
- **Mood weather** — visualization of mood across time as colored bands
- **Mood map** — 2D projection of vibe vectors, showing the user's library as a constellation
- **Living playlist** — a Spotify playlist exported from Worn Tape Memory that re-syncs weekly as data evolves

---

## File organization

```
apps/
  web/                          # Angular 20 app
    src/app/
      core/                     # auth, http interceptors, guards
      features/
        dashboard/
        archetypes/
        mood-map/
        patterns/
        onboarding/
      shared/                   # components, pipes, directives
      app.config.ts             # standalone bootstrap
  api/                          # NestJS app
    src/
      modules/
        auth/                   # Spotify OAuth, JWT
        sync/                   # Spotify listens sync
        enrichment/             # AI track enrichment
        archetypes/             # detection + serving
        insights/               # generation + serving
        playlists/              # export to Spotify
        spotify/                # Spotify API client (rate-limited, retried)
        ai/                     # Gemini client + prompt builders
      common/                   # filters, guards, decorators
      db/                       # Drizzle schema + migrations
packages/
  shared/                       # types shared between web + api
```

---

## Patterns to follow

### Angular: data fetching with signals + resource
```typescript
// Don't do this:
// ngOnInit { this.http.get(...).subscribe(d => this.data = d); }

// Do this:
private http = inject(HttpClient);
archetypeId = input.required<string>();
archetype = resource({
  request: () => ({ id: this.archetypeId() }),
  loader: ({ request }) => firstValueFrom(this.http.get<Archetype>(`/api/archetypes/${request.id}`))
});
// Template: @if (archetype.value(); as a) { ... }
```

### NestJS: service-with-injected-deps
```typescript
@Injectable()
export class ArchetypeDetectionService {
  constructor(
    private readonly listens: ListensRepository,
    private readonly ai: AiService,
    private readonly archetypes: ArchetypesRepository,
  ) {}

  async detectForUser(userId: string): Promise<Archetype[]> { /* ... */ }
}
```

### Drizzle: query, don't ORM
```typescript
// Use Drizzle's query builder, not raw SQL strings (you get types for free)
const recentListens = await db
  .select()
  .from(listens)
  .where(and(eq(listens.userId, userId), gte(listens.playedAt, thirtyDaysAgo)))
  .orderBy(desc(listens.playedAt));
```

### Background jobs: typed BullMQ
```typescript
// One queue per job type
export const ENRICH_TRACK_QUEUE = 'enrich-track';
export interface EnrichTrackJobData { spotifyTrackId: string; }

@Processor(ENRICH_TRACK_QUEUE)
export class EnrichTrackProcessor {
  @Process()
  async process(job: Job<EnrichTrackJobData>) { /* ... */ }
}
```

---

## Spotify API quick reference

- **Recently played:** `GET /me/player/recently-played?limit=50&after={unix_ms}` — max 50 items, use `after` cursor
- **Currently playing:** `GET /me/player/currently-playing` — may return 204 if nothing playing
- **Create playlist:** `POST /me/playlists` with `{ name, description, public: false }`
- **Add tracks:** `POST /playlists/{id}/tracks` with `{ uris: ["spotify:track:..."] }`, max 100 per call
- **Replace tracks:** `PUT /playlists/{id}/tracks` with `{ uris: [...] }` — replaces all
- **Upload cover:** `PUT /playlists/{id}/images` with raw base64 JPEG body, `Content-Type: image/jpeg`, max 256KB
- **Play tracks:** `PUT /me/player/play` with `{ uris: [...] }`
- **Token refresh:** `POST /api/token` with `grant_type=refresh_token`, do it proactively at expiry - 60s

**Scopes we use:**
`user-read-recently-played user-top-read user-read-currently-playing user-read-playback-state user-modify-playback-state playlist-modify-private playlist-modify-public playlist-read-private ugc-image-upload`

---

## AI prompt patterns

### Track enrichment (Gemini Flash, returns JSON)
```
You are a music taxonomist. Given this track, return ONLY a JSON object — no prose, no markdown.

Track: "{name}" by {artist}
Album: "{album}" ({year})

Return:
{
  "mood_tags": [3-5 evocative one-word tags like "melancholy", "patient", "euphoric"],
  "mood_category": one of ["melancholy", "warm", "peak", "hypnotic", "euphoric", "contemplative"],
  "energy": number 0-10 (10 = peak-time techno, 1 = ambient drone),
  "vibe_vector": array of 8 numbers from -1 to 1 representing the track's position in vibe space
}
```

### Archetype naming (Gemini Flash, returns JSON)
```
You are a perceptive music observer. Below is a cluster of one listener's plays. Generate a persona.

Cluster summary:
- Peak hour: {hour}
- Peak day: {day}
- Dominant moods: {moods}
- Top tracks: {tracks}
- Total plays: {count}

Return JSON only:
{
  "name": "The [3-6 words, evocative, specific — not generic vibes]",
  "description": "[1-2 sentences in second person, like 'sad indie played late after a heavy day']",
  "color": "#hex (a single color that captures the mood)",
  "icon": "tabler-icon-name (e.g. 'moon', 'coffee', 'bolt')"
}

Examples of good names: "The 11pm wound-licker", "The Sunday morning archivist", "The Thursday DJ".
Examples of bad names: "Late night vibes", "Sad music lover", "Energy boost playlist".
```

### Current state line (Gemini Flash, returns string)
```
You are reading a listener's last 7 days of music. In ONE sentence, capture what kind of week they've had.

Last 7 days summary:
- Top moods: {top_moods}
- Total listens: {count}
- New artists: {new_count}
- Re-listen ratio: {ratio}
- Peak listening times: {times}

Return only the sentence. No quotes, no preamble. Examples:
- "A slow-burn week, leaning melancholic. Mostly evenings, mostly alone."
- "Restless this week — bouncing between peak techno and ambient, never landing."
- "Patient and warm. You've been with the same five albums all week."
```

---

## Common things to ask me

When you're about to do something fuzzy, ask before diving in:
- "Should the X feature live in module Y or Z?"
- "I see two reasonable ways to structure this. Want me to lay them out?"
- "This will touch [files A, B, C]. Sound right before I start?"
- "I notice we don't have [pattern]. Want me to set it up first?"

I'd rather you ask twice than build the wrong thing once.

---

## Things that are NOT for you to decide

- Naming the product (it's Worn Tape Memory — never shorten to "WTM" or rename it)
- Stack choices (locked, see above)
- Whether to add a feature outside the MVP scope (no, defer to post-MVP backlog)
- Whether to write tests for everything (no, see TRD §9)
- Whether to refactor "while I'm in here" (no, ship the feature, refactor in a separate pass)

---

## When you finish a task

End every task with:
1. A one-line summary of what you did
2. A list of files changed
3. One next step you'd recommend (don't just stop dead — point to what's next per the build plan)

That's it. Let's build.
