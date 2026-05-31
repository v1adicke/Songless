// Game routes: generate / guess / reveal.

import { Hono } from "hono";
import {
  searchTracks,
  getTracksByIds,
  type TrackSearchParams,
} from "../spotify/api";
import {
  resolveFirstPlayable,
  searchItunesCatalog,
  type ItunesMatch,
  type ItunesTrack,
} from "../spotify/itunes";
import {
  shuffle,
  pickRandom,
  releaseYearOf,
  normalizeYear,
  isCorrectGuess,
} from "../game/logic";
import { createRound, getRound, deleteRound } from "../game/store";
import { FALLBACK_TRACK_IDS } from "../game/fallback";
import type { GameRound, GenerateResponse, SpotifyTrack } from "../types";

const game = new Hono();

function spotifyRoundData(
  track: SpotifyTrack,
  match: ItunesMatch,
  genreContext: string | null
): Omit<GameRound, "createdAt"> {
  return {
    trackId: track.id,
    // Audio comes from Apple's iTunes preview, not Spotify.
    previewUrl: match.previewUrl,
    name: track.name,
    artists: track.artists.map((a) => a.name),
    // Prefer Spotify artwork; fall back to iTunes artwork.
    albumImage: track.album?.images?.[0]?.url ?? match.artworkUrl ?? null,
    releaseYear: releaseYearOf(track),
    genreContext,
  };
}

function itunesRoundData(
  t: ItunesTrack,
  genreContext: string | null
): Omit<GameRound, "createdAt"> {
  return {
    trackId: `itunes:${t.trackId}`,
    previewUrl: t.previewUrl,
    name: t.trackName,
    artists: [t.artistName],
    albumImage: t.artworkUrl,
    releaseYear: t.releaseYear,
    genreContext: genreContext ?? t.primaryGenreName,
  };
}

/** Parse "1990-1999" | "2016" into numeric year bounds. */
function yearBounds(year: string | undefined): {
  from?: number;
  to?: number;
} {
  if (!year) return {};
  if (/^\d{4}$/.test(year)) return { from: Number(year), to: Number(year) };
  const m = year.match(/^(\d{4})-(\d{4})$/);
  if (m) return { from: Number(m[1]), to: Number(m[2]) };
  return {};
}

/**
 * Split a comma-separated query value (e.g. "pop,rock") into a trimmed,
 * de-duped list, then pick ONE at random for this round. Multi-select
 * filters thus vary the pool across rounds while keeping each Spotify/iTunes
 * query single-valued (their field filters don't support OR cleanly).
 */
function pickFromCsv(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const list = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  if (list.length === 0) return undefined;
  return pickRandom(list);
}

/**
 * GET /api/game/generate?genre=&year=&artist=
 *
 * Audio source is Apple's iTunes 30s preview (Spotify no longer returns
 * preview_url for app tokens). Catalog source is Spotify when reachable,
 * with an automatic iTunes catalog fallback when Spotify is unavailable
 * (e.g. region-blocked), and a curated popular pool as a last resort.
 */
game.get("/generate", async (c) => {
  // Genre/year may arrive as comma-separated multi-selects (e.g. "pop,rock").
  // Pick one of each at random per round for pool variety.
  const genre = pickFromCsv(c.req.query("genre"));
  const artist = c.req.query("artist")?.trim() || undefined;
  const year = normalizeYear(pickFromCsv(c.req.query("year")));
  const genreContext = genre ?? null;

  const resolveSpotify = (tracks: SpotifyTrack[]) =>
    resolveFirstPlayable(shuffle(tracks), (t) => ({
      track: t.name,
      artist: t.artists[0]?.name ?? "",
    }));

  let usedFallback = false;

  const finish = (data: Omit<GameRound, "createdAt">) => {
    const roundId = createRound(data);
    const response: GenerateResponse & { fallback: boolean } = {
      round_id: roundId,
      preview_url: data.previewUrl,
      hint: {
        release_year: data.releaseYear,
        genre_context: data.genreContext,
      },
      fallback: usedFallback,
    };
    return c.json(response);
  };

  // ---- Tier 1: Spotify catalog → iTunes preview ----
  try {
    const params: TrackSearchParams = { genre, artist, year, limit: 50 };
    const tracks = await searchTracks(params);
    if (tracks.length > 0) {
      const result = await resolveSpotify(tracks);
      if (result) {
        return finish(spotifyRoundData(result.item, result.match, genreContext));
      }
    }
  } catch (err) {
    console.error("[generate] spotify search unavailable:", String(err));
  }

  // ---- Tier 2: iTunes catalog directly (Spotify blocked / no matches) ----
  try {
    const { from, to } = yearBounds(year);
    const itTracks = await searchItunesCatalog({
      genre,
      artist,
      yearFrom: from,
      yearTo: to,
    });
    if (itTracks.length > 0) {
      return finish(itunesRoundData(pickRandom(itTracks), genreContext));
    }
  } catch (err) {
    console.error("[generate] itunes catalog failed:", String(err));
  }

  // ---- Tier 3: curated popular pool (Spotify-resolved if possible) ----
  usedFallback = true;
  try {
    const fallbackTracks = await getTracksByIds(FALLBACK_TRACK_IDS);
    if (fallbackTracks.length > 0) {
      const result = await resolveSpotify(fallbackTracks);
      if (result) {
        return finish(spotifyRoundData(result.item, result.match, genreContext));
      }
    }
  } catch (err) {
    console.error("[generate] curated pool failed:", String(err));
  }

  // ---- Tier 4: iTunes popular pool by name ----
  try {
    const itTracks = await searchItunesCatalog({ genre: undefined });
    if (itTracks.length > 0) {
      return finish(itunesRoundData(pickRandom(itTracks), null));
    }
  } catch (err) {
    console.error("[generate] itunes pool failed:", String(err));
  }

  return c.json(
    {
      error:
        "Couldn't find a playable preview right now. Please try again or use different filters.",
    },
    404
  );
});

/**
 * POST /api/game/guess
 * Body: { round_id, track_id?, title? }
 * Checks a guess WITHOUT leaking the answer (unless correct).
 */
game.post("/guess", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.round_id !== "string") {
    return c.json({ error: "round_id is required" }, 400);
  }

  const round = getRound(body.round_id);
  if (!round) {
    return c.json({ error: "Round not found or expired" }, 404);
  }

  const correct = isCorrectGuess(
    round.trackId,
    round.name,
    typeof body.track_id === "string" ? body.track_id : undefined,
    typeof body.title === "string" ? body.title : undefined
  );

  if (correct) {
    // Reveal the answer on a correct guess and close the round.
    deleteRound(body.round_id);
    return c.json({
      correct: true,
      answer: {
        track_id: round.trackId,
        name: round.name,
        artists: round.artists,
        album_image: round.albumImage,
        release_year: round.releaseYear,
      },
    });
  }

  return c.json({ correct: false });
});

/**
 * POST /api/game/reveal
 * Body: { round_id }
 * Reveals the answer when the player gives up / runs out of attempts.
 */
game.post("/reveal", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.round_id !== "string") {
    return c.json({ error: "round_id is required" }, 400);
  }

  const round = getRound(body.round_id);
  if (!round) {
    return c.json({ error: "Round not found or expired" }, 404);
  }

  deleteRound(body.round_id);
  return c.json({
    track_id: round.trackId,
    name: round.name,
    artists: round.artists,
    album_image: round.albumImage,
    release_year: round.releaseYear,
  });
});

export default game;
