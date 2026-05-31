// Game logic helpers: filter normalization, track selection, answer matching.

import type { SpotifyTrack } from "../types";

/** Validate & normalize a year/decade filter into Spotify's `year:` value. */
export function normalizeYear(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  // Accept "1990", "1990-1999", "2010-2015".
  if (/^\d{4}$/.test(v)) return v;
  if (/^\d{4}-\d{4}$/.test(v)) {
    const [a, b] = v.split("-").map(Number);
    if (a <= b) return v;
    return `${b}-${a}`;
  }
  return undefined;
}

/** Pick a uniformly random element. */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Return a new array with the elements shuffled (Fisher–Yates). */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function releaseYearOf(track: SpotifyTrack): string {
  const date = track.album?.release_date ?? "";
  const year = date.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : "Unknown";
}

/** Normalize a string for fuzzy answer comparison. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/\(.*?\)|\[.*?\]/g, "") // drop bracketed extras (feat. etc.)
    // Drop a trailing " - …remaster/edit/live/version…" suffix, allowing
    // an intervening year (e.g. "- 2011 Remaster", "- Radio Edit").
    .replace(
      /\s*-\s*(\d{4}\s*)?(remaster|remastered|radio edit|single version|live|mono|stereo|version|edit).*/i,
      ""
    )
    .replace(/[^a-z0-9]+/g, "") // keep alphanumerics only
    .trim();
}

/**
 * A guess matches if the chosen track id equals the answer id,
 * OR the normalized titles match (covers re-releases / alt ids).
 */
export function isCorrectGuess(
  answerId: string,
  answerTitle: string,
  guessTrackId: string | undefined,
  guessTitle: string | undefined
): boolean {
  if (guessTrackId && guessTrackId === answerId) return true;
  if (guessTitle) {
    return normalizeForMatch(guessTitle) === normalizeForMatch(answerTitle);
  }
  return false;
}
