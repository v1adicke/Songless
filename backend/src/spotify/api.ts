// Thin wrapper around the Spotify Web API.
// Handles auth headers, retries once on 401, and exposes typed search helpers.

import { getAccessToken, invalidateToken, isSpotifyConfigured } from "./token.ts";
import type {
  SpotifyArtist,
  SpotifySearchResponse,
  SpotifyTrack,
} from "../types.ts";

const API_BASE = "https://api.spotify.com/v1";

/**
 * Authenticated GET against the Spotify API.
 * Retries exactly once if a 401 indicates a stale token.
 */
async function spotifyGet<T>(path: string, retry = true): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && retry) {
    invalidateToken();
    return spotifyGet<T>(path, false);
  }

  if (res.status === 429) {
    // Rate limited — surface a clear error; caller may retry later.
    const retryAfter = res.headers.get("Retry-After") ?? "1";
    throw new Error(`Spotify rate limit hit. Retry after ${retryAfter}s.`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error (${res.status}) on ${path}: ${text}`);
  }

  return (await res.json()) as T;
}

export interface TrackSearchParams {
  genre?: string;
  year?: string; // already validated/normalized, e.g. "1990-1999" or "2016"
  artist?: string;
  freeText?: string; // raw query for the answer-search autocomplete
  limit?: number;
}

/**
 * Build the advanced-search `q` string from structured filters.
 * Spotify field filters: genre:"x" year:a-b artist:"x"
 */
export function buildTrackQuery(params: TrackSearchParams): string {
  const parts: string[] = [];

  if (params.freeText && params.freeText.trim()) {
    parts.push(params.freeText.trim());
  }
  if (params.genre && params.genre.trim()) {
    parts.push(`genre:"${params.genre.trim()}"`);
  }
  if (params.year && params.year.trim()) {
    parts.push(`year:${params.year.trim()}`);
  }
  if (params.artist && params.artist.trim()) {
    parts.push(`artist:"${params.artist.trim()}"`);
  }

  return parts.join(" ").trim();
}

export async function searchTracks(
  params: TrackSearchParams
): Promise<SpotifyTrack[]> {
  if (!isSpotifyConfigured()) return [];
  const q = buildTrackQuery(params);
  if (!q) return [];

  const limit = params.limit ?? 50;
  const query = new URLSearchParams({
    q,
    type: "track",
    limit: String(limit),
  });

  const data = await spotifyGet<SpotifySearchResponse>(
    `/search?${query.toString()}`
  );
  return data.tracks?.items ?? [];
}

export async function searchArtists(
  q: string,
  limit = 8
): Promise<SpotifyArtist[]> {
  if (!isSpotifyConfigured()) return [];
  if (!q.trim()) return [];
  const query = new URLSearchParams({
    q: q.trim(),
    type: "artist",
    limit: String(limit),
  });
  const data = await spotifyGet<SpotifySearchResponse>(
    `/search?${query.toString()}`
  );
  return data.artists?.items ?? [];
}

/** Fetch full track objects by IDs (used by the fallback pool). */
export async function getTracksByIds(ids: string[]): Promise<SpotifyTrack[]> {
  if (!isSpotifyConfigured()) return [];
  if (ids.length === 0) return [];
  const query = new URLSearchParams({ ids: ids.slice(0, 50).join(",") });
  const data = await spotifyGet<{ tracks: (SpotifyTrack | null)[] }>(
    `/tracks?${query.toString()}`
  );
  return (data.tracks ?? []).filter((t): t is SpotifyTrack => t !== null);
}
