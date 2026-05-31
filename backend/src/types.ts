// Shared types for the backend.

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  release_date_precision: "year" | "month" | "day";
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string | null;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  popularity?: number;
  external_urls?: { spotify?: string };
}

export interface SpotifySearchResponse {
  tracks?: {
    items: SpotifyTrack[];
  };
  artists?: {
    items: SpotifyArtist[];
  };
}

// The internal record we keep server-side about the current target track.
// This NEVER fully leaves the server except via /reveal.
export interface GameRound {
  trackId: string;
  previewUrl: string;
  name: string;
  artists: string[];
  albumImage: string | null;
  releaseYear: string;
  genreContext: string | null;
  createdAt: number;
}

// What the client receives on generate (no title / artist leaked).
export interface GenerateResponse {
  round_id: string;
  preview_url: string;
  hint: {
    release_year: string;
    genre_context: string | null;
  };
}
