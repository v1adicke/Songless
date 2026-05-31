# Songless Clone 🎵

A minimalist, premium dark-themed music guessing game (inspired by Heardle / Songless). Guess the track from progressively longer audio snippets — **no Spotify login required for players**.

## Stack

- **Monorepo** — `/backend` + `/frontend`, Bun workspaces
- **Backend** — [Bun](https://bun.sh) + [Hono](https://hono.dev) (TypeScript)
- **Frontend** — Vite + React + TypeScript + Tailwind CSS v4
- **Catalog** — Spotify (Client Credentials Flow) when configured & reachable, with an automatic **iTunes** catalog fallback
- **Audio** — Apple **iTunes Search API** 30-second previews (no key, no login, no Premium)

## Why iTunes for audio?

As of late 2024, Spotify's Web API **no longer returns `preview_url`** for app-only (Client Credentials) tokens — the field is `null` for essentially every track. Full-track playback is only possible via the Spotify Web Playback SDK, which requires each player to log in with a **Spotify Premium** account.

To keep the game **public and login-free**, audio is sourced from Apple's public **iTunes Search API**, which returns a 30-second AAC preview (`previewUrl`) for almost all mainstream music, with no authentication. Spotify is still used for its richer catalog/genre filtering when available; the backend transparently falls back to the iTunes catalog when Spotify is unconfigured or region-blocked.

## How it works

1. The player picks filters (genre / decade / artist) and starts a round.
2. The backend builds a candidate list:
   - **Tier 1** — Spotify advanced search (if configured) → resolve each candidate's 30s preview from iTunes.
   - **Tier 2** — iTunes catalog search directly (genre/year/artist post-filtered).
   - **Tier 3/4** — curated popular pool (Spotify-resolved, else iTunes) as a last resort.
3. A random track **with a playable preview** is chosen.
4. The answer (title / artist / artwork) is **never** sent to the client up front — only the preview URL + light hints. It is validated via `POST /api/game/guess` or revealed via `POST /api/game/reveal`. This prevents cheating via the Network tab.
5. The player unlocks more audio per attempt: **0.1s → 1s → 3s → 5s → 10s → 30s**.

## Setup

### 1. Spotify credentials (optional)

The game works **out of the box without any credentials** (iTunes-only mode). To enable the richer Spotify catalog, create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add the **Client ID** / **Client Secret**:

```bash
cd backend
cp .env.example .env
# optional: fill in SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
```

### 2. Install

From the repo root:

```bash
bun install            # installs root + workspaces
cd backend && bun install
cd ../frontend && bun install
```

### 3. Run (development)

Two terminals:

```bash
# terminal 1 — backend on :3000
cd backend && bun run dev

# terminal 2 — frontend on :5173 (proxies /api to :3000)
cd frontend && bun run dev
```

Or, from the root (requires the root `concurrently` dev dep):

```bash
bun run dev
```

Open <http://localhost:5173>.

### 4. Production build & serve

```bash
cd frontend && bun run build      # outputs frontend/dist
cd ../backend && bun run start    # Hono serves the API *and* the built frontend
```

The backend serves `frontend/dist` as static files, so the whole app runs from a single Bun process on `PORT` (default 3000).

## API reference

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `GET`  | `/api/health` | Liveness check |
| `GET`  | `/api/game/generate?genre=&year=&artist=` | Start a round (returns `round_id`, `preview_url`, `hint`, `fallback`) |
| `POST` | `/api/game/guess` | `{ round_id, track_id?, title? }` → `{ correct, answer? }` |
| `POST` | `/api/game/reveal` | `{ round_id }` → answer (on give-up / loss) |
| `GET`  | `/api/search/artist?q=` | Artist autocomplete (filter menu) |
| `GET`  | `/api/search/track?q=`  | Track autocomplete (answer input) |

### Filter → Spotify query mapping

- `genre=pop` → `genre:"pop"`
- `year=1990-1999` → `year:1990-1999`
- `artist=Daft Punk` → `artist:"Daft Punk"`
- combined filters are space-joined into one `q`.

## Edge cases handled

- **Spotify unavailable / region-blocked / no credentials** → automatic iTunes catalog fallback; the game keeps working.
- **No previewable tracks for the chosen filters** → falls through the tiers to a curated popular pool (the UI shows a subtle notice).
- **Audio load failures** → surfaced with a hint to skip / restart.
- **Rapid play clicks** → re-entrancy guard + hard stop via `requestAnimationFrame` *and* a `setTimeout` ceiling.
- **Cross-source guessing** → guesses are matched by normalized title (case/diacritics/"- Remaster"/"(feat. …)" insensitive), so a Spotify answer still matches an iTunes-sourced guess and vice versa.
- **Token expiry / 401** → Spotify token auto-refreshes; API wrapper retries once.
- **Round memory** → in-memory rounds auto-expire after 1 hour.

## Notes

> Audio previews are 30-second clips from Apple's public iTunes Search API — no key, no login, no Premium required. Spotify (when configured) only enriches catalog search; it is never required for the game to function.
