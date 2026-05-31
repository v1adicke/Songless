// Spotify Token Manager — Client Credentials Flow.
// Requests, caches (in memory) and auto-refreshes the app access token.

const TOKEN_URL = "https://accounts.spotify.com/api/token";

interface CachedToken {
  accessToken: string;
  // Absolute epoch ms at which we consider the token expired.
  expiresAt: number;
}

let cached: CachedToken | null = null;
// Tracks an in-flight refresh so concurrent requests don't all hit Spotify.
let inflight: Promise<string> | null = null;

// Safety margin: refresh 60s before the real expiry to avoid edge races.
const EXPIRY_MARGIN_MS = 60_000;

function getCredentials(): { id: string; secret: string } {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET. Copy backend/.env.example to backend/.env and fill in your credentials."
    );
  }
  return { id, secret };
}

/**
 * Whether Spotify credentials are configured. When false, the app skips
 * Spotify entirely and uses the iTunes catalog (no credentials required).
 */
export function isSpotifyConfigured(): boolean {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
  );
}

async function fetchNewToken(): Promise<string> {
  const { id, secret } = getCredentials();
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number; // seconds
  };

  cached = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cached.accessToken;
}

/**
 * Returns a valid access token, refreshing if needed.
 * Concurrent callers share a single in-flight refresh.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached && now < cached.expiresAt - EXPIRY_MARGIN_MS) {
    return cached.accessToken;
  }

  if (inflight) return inflight;

  inflight = fetchNewToken().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Force-invalidate the cached token (e.g. after a 401). */
export function invalidateToken(): void {
  cached = null;
}
