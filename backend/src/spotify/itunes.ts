// iTunes Search API client — used as the AUDIO source.
//
// As of late 2024 Spotify's Web API no longer returns `preview_url` for
// app-only (Client Credentials) tokens. We therefore keep Spotify for rich
// catalog/search/filtering and resolve a playable 30s preview from Apple's
// public iTunes Search API (no key, no auth, CORS-friendly, ~universal
// coverage of mainstream music).

const ITUNES_BASE = "https://itunes.apple.com/search";

interface ItunesResult {
  trackName: string;
  artistName: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesResult[];
}

export interface ItunesMatch {
  previewUrl: string;
  artworkUrl: string | null;
  trackName: string;
  artistName: string;
}

// Small in-memory cache so repeated lookups for the same song are instant
// and we stay friendly to Apple's (unauthenticated) rate limits.
const cache = new Map<string, ItunesMatch | null>();
const CACHE_MAX = 2000;

function cacheSet(key: string, value: ItunesMatch | null): void {
  if (cache.size >= CACHE_MAX) {
    // Drop the oldest entry (Map preserves insertion order).
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, value);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/\s*-\s*(\d{4}\s*)?(remaster|remastered|radio edit|single version|live|mono|stereo|version|edit).*/i, "")
    .replace(/feat\.?.*$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Resolve a playable 30s preview for a given track + (primary) artist.
 * Returns null if Apple has no preview for it.
 */
export async function resolvePreview(
  trackName: string,
  artistName: string
): Promise<ItunesMatch | null> {
  const key = `${normalize(trackName)}|${normalize(artistName)}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const term = `${artistName} ${trackName}`.trim();
  const url = `${ITUNES_BASE}?${new URLSearchParams({
    term,
    media: "music",
    entity: "song",
    limit: "10",
  })}`;

  let data: ItunesResponse;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      cacheSet(key, null);
      return null;
    }
    data = (await res.json()) as ItunesResponse;
  } catch {
    // Don't poison the cache on transient network errors.
    return null;
  }

  const wantTrack = normalize(trackName);
  const wantArtist = normalize(artistName);

  // Prefer a result whose normalized title matches and whose artist
  // contains the wanted artist (Apple often lists "A, B & C").
  const candidates = data.results.filter((r) => r.previewUrl);

  const exact = candidates.find((r) => {
    const t = normalize(r.trackName);
    const a = normalize(r.artistName);
    return t === wantTrack && (a.includes(wantArtist) || wantArtist.includes(a));
  });

  const titleOnly = candidates.find((r) => normalize(r.trackName) === wantTrack);

  const chosen = exact ?? titleOnly ?? candidates[0] ?? null;

  if (!chosen || !chosen.previewUrl) {
    cacheSet(key, null);
    return null;
  }

  const match: ItunesMatch = {
    previewUrl: chosen.previewUrl,
    artworkUrl: chosen.artworkUrl100
      ? chosen.artworkUrl100.replace("100x100bb", "600x600bb")
      : null,
    trackName: chosen.trackName,
    artistName: chosen.artistName,
  };
  cacheSet(key, match);
  return match;
}

// ---- iTunes as a full catalog provider (fallback when Spotify is blocked) ----

export interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  primaryGenreName: string | null;
  releaseYear: string;
  previewUrl: string;
  artworkUrl: string | null;
}

interface ItunesCatalogResult extends ItunesResult {
  trackId?: number;
  primaryGenreName?: string;
  releaseDate?: string;
}

function mapCatalog(r: ItunesCatalogResult): ItunesTrack | null {
  if (!r.previewUrl || !r.trackId) return null;
  return {
    trackId: r.trackId,
    trackName: r.trackName,
    artistName: r.artistName,
    primaryGenreName: r.primaryGenreName ?? null,
    releaseYear: (r.releaseDate ?? "").slice(0, 4) || "Unknown",
    previewUrl: r.previewUrl,
    artworkUrl: r.artworkUrl100
      ? r.artworkUrl100.replace("100x100bb", "600x600bb")
      : null,
  };
}

/**
 * Search the iTunes catalog directly. Builds a search term from the chosen
 * filters and post-filters results by genre/year client-side, since the
 * iTunes Search API has no structured field filters.
 */
export async function searchItunesCatalog(opts: {
  genre?: string;
  artist?: string;
  yearFrom?: number;
  yearTo?: number;
}): Promise<ItunesTrack[]> {
  const termParts: string[] = [];
  if (opts.artist) termParts.push(opts.artist);
  if (opts.genre) termParts.push(opts.genre);
  // A non-empty term is required; default to a broad popular query.
  const term = termParts.join(" ").trim() || "top hits";

  const url = `${ITUNES_BASE}?${new URLSearchParams({
    term,
    media: "music",
    entity: "song",
    limit: "200",
  })}`;

  let data: ItunesResponse & { results: ItunesCatalogResult[] };
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    data = (await res.json()) as ItunesResponse & {
      results: ItunesCatalogResult[];
    };
  } catch {
    return [];
  }

  const wantGenre = opts.genre ? normalize(opts.genre) : null;
  const wantArtist = opts.artist ? normalize(opts.artist) : null;

  const out: ItunesTrack[] = [];
  for (const r of data.results) {
    const t = mapCatalog(r);
    if (!t) continue;

    if (wantGenre) {
      const g = normalize(t.primaryGenreName ?? "");
      // "hip-hop" → iTunes "Hip-Hop/Rap"; match loosely on substring.
      const a = wantGenre.replace(/hiphop/g, "hiphop");
      if (!(g.includes(a) || a.includes(g))) continue;
    }
    if (wantArtist) {
      const a = normalize(t.artistName);
      if (!(a.includes(wantArtist) || wantArtist.includes(a))) continue;
    }
    if (opts.yearFrom || opts.yearTo) {
      const y = Number(t.releaseYear);
      if (!Number.isFinite(y)) continue;
      if (opts.yearFrom && y < opts.yearFrom) continue;
      if (opts.yearTo && y > opts.yearTo) continue;
    }
    out.push(t);
  }

  // De-dupe by normalized title+artist to avoid many versions of one song.
  const seen = new Set<string>();
  return out.filter((t) => {
    const k = `${normalize(t.trackName)}|${normalize(t.artistName)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---- iTunes autocomplete helpers (fallback for /api/search/*) ----

export interface ItunesArtist {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
}

export async function searchItunesArtists(
  q: string,
  limit = 8
): Promise<ItunesArtist[]> {
  if (!q.trim()) return [];
  const url = `${ITUNES_BASE}?${new URLSearchParams({
    term: q,
    media: "music",
    entity: "musicArtist",
    limit: String(limit),
  })}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results: {
        artistId?: number;
        artistName?: string;
        primaryGenreName?: string;
      }[];
    };
    const seen = new Set<string>();
    const out: ItunesArtist[] = [];
    for (const r of data.results) {
      if (!r.artistId || !r.artistName) continue;
      const key = normalize(r.artistName);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `itunes:${r.artistId}`,
        name: r.artistName,
        image: null, // iTunes Search API does not return artist images
        genres: r.primaryGenreName ? [r.primaryGenreName] : [],
      });
    }
    return out;
  } catch {
    return [];
  }
}

export interface ItunesTrackLite {
  id: string;
  name: string;
  artists: string[];
  album_image: string | null;
}

export async function searchItunesTracks(
  q: string,
  limit = 10
): Promise<ItunesTrackLite[]> {
  if (!q.trim()) return [];
  const url = `${ITUNES_BASE}?${new URLSearchParams({
    term: q,
    media: "music",
    entity: "song",
    limit: String(Math.min(limit * 3, 50)),
  })}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { results: ItunesCatalogResult[] };
    const seen = new Set<string>();
    const out: ItunesTrackLite[] = [];
    for (const r of data.results) {
      if (!r.trackId || !r.trackName) continue;
      const key = `${normalize(r.trackName)}|${normalize(r.artistName)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `itunes:${r.trackId}`,
        name: r.trackName,
        artists: [r.artistName],
        album_image: r.artworkUrl100 ?? null,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Try to resolve previews for several tracks concurrently, returning the
 * first N successful matches paired with the original index.
 */
export async function resolveFirstPlayable<T>(
  items: T[],
  toQuery: (item: T) => { track: string; artist: string }
): Promise<{ item: T; match: ItunesMatch } | null> {
  // Resolve in small concurrent batches; stop as soon as we have matches.
  const BATCH = 8;
  const matches: { item: T; match: ItunesMatch }[] = [];

  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (item) => {
        const { track, artist } = toQuery(item);
        const match = await resolvePreview(track, artist);
        return match ? { item, match } : null;
      })
    );
    for (const r of results) if (r) matches.push(r);
    if (matches.length > 0) break; // enough to pick from
  }

  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}
