// Shared frontend types + game constants.

export interface Filters {
  genres: string[]; // e.g. ["pop", "rock"]; empty = any
  years: string[]; // e.g. ["1990-1999", "2016"]; empty = any
  artist: string | null; // exact artist name fixed from autocomplete
}

export interface GenerateResponse {
  round_id: string;
  preview_url: string;
  hint: {
    release_year: string;
    genre_context: string | null;
  };
  fallback: boolean;
}

export interface Answer {
  track_id: string;
  name: string;
  artists: string[];
  album_image: string | null;
  release_year: string;
}

export interface GuessResult {
  correct: boolean;
  answer?: Answer;
}

export interface TrackCandidate {
  id: string;
  name: string;
  artists: string[];
  album_image: string | null;
}

export interface ArtistCandidate {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
}

// A guess row in the game: either skipped, wrong, or correct.
export type GuessOutcome = "skip" | "wrong" | "correct";

export interface GuessEntry {
  outcome: GuessOutcome;
  label: string; // what was guessed / "Skipped"
}

// Songless unlock schedule (seconds of audio available per attempt).
export const UNLOCK_SECONDS = [0.1, 1, 3, 5, 10, 30] as const;
export const MAX_ATTEMPTS = UNLOCK_SECONDS.length;

// Curated genre choices for the filter screen (valid Spotify genre seeds).
export const GENRES = [
  "pop",
  "hip-hop",
  "rock",
  "indie",
  "electronic",
  "r-n-b",
  "metal",
  "jazz",
  "classical",
  "country",
  "reggaeton",
  "k-pop",
  "punk",
  "soul",
  "house",
  "disco",
] as const;

// Decade presets for the year filter.
export const DECADES = [
  { label: "60s", value: "1960-1969" },
  { label: "70s", value: "1970-1979" },
  { label: "80s", value: "1980-1989" },
  { label: "90s", value: "1990-1999" },
  { label: "2000s", value: "2000-2009" },
  { label: "2010s", value: "2010-2019" },
  { label: "2020s", value: "2020-2029" },
] as const;
