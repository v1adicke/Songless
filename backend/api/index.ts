// Vercel serverless entry for the Hono backend.
//
// Vercel runs this file as a single Node serverless function. We build the
// same Hono app (routes + CORS) as local dev, but WITHOUT the Bun-only
// static file serving or `Bun.serve` port binding — Vercel owns the HTTP
// lifecycle and the frontend is deployed as a separate project.
//
// `vercel.json` rewrites every `/api/*` request to this function. The Hono
// app keeps its routes mounted under `/api/*`, so `c.req.path` still matches
// (e.g. `/api/game/generate`).

import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import gameRoutes from "../src/routes/game.js";
import searchRoutes from "../src/routes/search";

export const config = {
  runtime: "nodejs",
};

const app = new Hono().basePath("/api");

// Allow the deployed frontend (and local dev) to call this API cross-origin.
// CORS_ORIGIN can be a comma-separated allowlist; defaults to "*".
const rawOrigin = process.env.CORS_ORIGIN ?? "*";
const originList = rawOrigin
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  "/*",
  cors({
    origin: (incoming) => {
      if (originList.includes("*")) return incoming || "*";
      return originList.includes(incoming) ? incoming : originList[0] ?? "";
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/game", gameRoutes);
app.route("/search", searchRoutes);

// Export Vercel-compatible handlers for each HTTP method we use.
export default handle(app);