// Search routes: artist autocomplete (filter menu) + track autocomplete (answers).
// Uses Spotify when reachable, with an automatic iTunes fallback when Spotify
// is unavailable (e.g. region-blocked) or returns no results.

import { Hono } from "hono";
import { searchArtists, searchTracks } from "../spotify/api";
import {
  searchItunesArtists,
  searchItunesTracks,
} from "../spotify/itunes";

const search = new Hono();

/**
 * GET /api/search/artist?q=...
 * Returns artist candidates for the filter dropdown.
 */
search.get("/artist", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (q.length < 1) return c.json({ artists: [] });

  // Tier 1: Spotify (rich images + genres).
  try {
    const artists = await searchArtists(q, 8);
    if (artists.length > 0) {
      return c.json({
        artists: artists.map((a) => ({
          id: a.id,
          name: a.name,
          image:
            a.images?.[a.images.length - 1]?.url ?? a.images?.[0]?.url ?? null,
          genres: a.genres ?? [],
        })),
      });
    }
  } catch (err) {
    console.error("[search/artist] spotify unavailable:", String(err));
  }

  // Tier 2: iTunes fallback.
  const fallback = await searchItunesArtists(q, 8);
  return c.json({ artists: fallback });
});

/**
 * GET /api/search/track?q=...
 * Returns track candidates for the answer-input dropdown.
 */
search.get("/track", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (q.length < 1) return c.json({ tracks: [] });

  // Tier 1: Spotify.
  try {
    const tracks = await searchTracks({ freeText: q, limit: 10 });
    if (tracks.length > 0) {
      return c.json({
        tracks: tracks.map((t) => ({
          id: t.id,
          name: t.name,
          artists: t.artists.map((a) => a.name),
          album_image:
            t.album?.images?.[t.album.images.length - 1]?.url ??
            t.album?.images?.[0]?.url ??
            null,
        })),
      });
    }
  } catch (err) {
    console.error("[search/track] spotify unavailable:", String(err));
  }

  // Tier 2: iTunes fallback.
  const fallback = await searchItunesTracks(q, 10);
  return c.json({ tracks: fallback });
});

export default search;
