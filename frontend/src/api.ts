// Typed API client. All calls go to same-origin /api (Vite proxies in dev).

import type {
  GenerateResponse,
  GuessResult,
  Answer,
  TrackCandidate,
  ArtistCandidate,
  Filters,
} from "./types.ts";

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
  return http<GenerateResponse>(`/api/game/generate${qs ? `?${qs}` : ""}`);
}

export function guess(
  roundId: string,
  candidate: { track_id?: string; title?: string }
): Promise<GuessResult> {
  return http<GuessResult>("/api/game/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round_id: roundId, ...candidate }),
  });
}

export function reveal(roundId: string): Promise<Answer> {
  return http<Answer>("/api/game/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round_id: roundId }),
  });
}

export async function searchTracks(q: string): Promise<TrackCandidate[]> {
  if (!q.trim()) return [];
  const data = await http<{ tracks: TrackCandidate[] }>(
    `/api/search/track?q=${encodeURIComponent(q)}`
  );
  return data.tracks;
}

export async function searchArtists(q: string): Promise<ArtistCandidate[]> {
  if (!q.trim()) return [];
  const data = await http<{ artists: ArtistCandidate[] }>(
    `/api/search/artist?q=${encodeURIComponent(q)}`
  );
  return data.artists;
}
