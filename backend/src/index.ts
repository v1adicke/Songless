// Backend entrypoint for local Bun dev.
// На Vercel используется api/index.ts — этот файл там не запускается.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { isSpotifyConfigured } from "./spotify/token";
import gameRoutes from "./routes/game";
import searchRoutes from "./routes/search";

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

// В локальном dev статика не нужна (фронт живёт на :5173 с Vite).
// serveStatic из hono/bun намеренно убран — Bun-специфичный импорт
// ломает сборку на Vercel Node-рантайме.

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
