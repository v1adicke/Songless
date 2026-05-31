// Backend entrypoint: Hono app on Bun.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { isSpotifyConfigured } from "./spotify/token.ts";
import gameRoutes from "./routes/game.ts";
import searchRoutes from "./routes/search.ts";

const app = new Hono();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

app.use(
  "/api/*",
  cors({
    origin: FRONTEND_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/game", gameRoutes);
app.route("/api/search", searchRoutes);

// In production, serve the built frontend (frontend/dist) as static files.
// Harmless in dev (the folder simply won't exist).
app.use("/*", serveStatic({ root: "../frontend/dist" }));
app.get("/*", serveStatic({ path: "../frontend/dist/index.html" }));

const port = Number(process.env.PORT ?? 3000);

console.log(`🎵 Songless backend running on http://localhost:${port}`);
console.log(
  isSpotifyConfigured()
    ? "   Catalog: Spotify (with iTunes fallback) · Audio: iTunes previews"
    : "   Catalog: iTunes (Spotify not configured) · Audio: iTunes previews"
);

export default {
  port,
  fetch: app.fetch,
};
