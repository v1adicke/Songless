// Typed API client.
//
// In local dev VITE_API_URL is unset, so requests go to same-origin `/api/*`
// and Vite proxies them to the Hono backend. In production (split Vercel
// deploys) set VITE_API_URL to the backend's origin, e.g.
// "https://songless-api.vercel.app" — calls then hit that origin's `/api/*`.

import type {
  GenerateResponse,
  GuessResult,
  Answer,
  TrackCandidate,
  ArtistCandidate,
  Filters,
} from "./types.ts";

// Strip any trailing slash so we can safely append `/api/...`.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/** Build an absolute (or same-origin) API URL from a `/api/...` path. */
function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function http<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function generateRound(filters: Filters): Promise<GenerateResponse> {
  const params = new URLSearchParams();
  if (filters.genres.length) params.set("genre", filters.genres.join(","));
  if (filters.years.length) params.set("year", filters.years.join(","));
  if (filters.artist) params.set("artist", filters.artist);
  const qs = params.toString();
  return http<GenerateResponse>(apiUrl(`/api/game/generate${qs ? `?${qs}` : ""}`));
}

export function guess(
  roundId: string,
  candidate: { track_id?: string; title?: string }
): Promise<GuessResult> {
  return http<GuessResult>(apiUrl("/api/game/guess"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round_id: roundId, ...candidate }),
  });
}

export function reveal(roundId: string): Promise<Answer> {
  return http<Answer>(apiUrl("/api/game/reveal"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round_id: roundId }),
  });
}

export async function searchTracks(q: string): Promise<TrackCandidate[]> {
  if (!q.trim()) return [];
  const data = await http<{ tracks: TrackCandidate[] }>(
    apiUrl(`/api/search/track?q=${encodeURIComponent(q)}`)
  );
  return data.tracks;
}

export async function searchArtists(q: string): Promise<ArtistCandidate[]> {
  if (!q.trim()) return [];
  const data = await http<{ artists: ArtistCandidate[] }>(
    apiUrl(`/api/search/artist?q=${encodeURIComponent(q)}`)
  );
  return data.artists;
}
