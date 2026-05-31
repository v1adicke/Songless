// Vercel serverless entry for the Hono backend.
//
// Vercel turns this file into a single Node serverless function (the
// @vercel/node builder bundles it together with everything it imports from
// `../src`). We build the same Hono app (routes + CORS) as local dev, but
// WITHOUT the Bun-only static serving / `Bun.serve` port binding — Vercel
// owns the HTTP lifecycle and the frontend is a separate project.
//
// `vercel.json` rewrites every `/api/*` request to this function, and the
// Hono app is mounted at basePath("/api"), so paths line up exactly
// (e.g. GET /api/game/generate).

import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import gameRoutes from "../src/routes/game";
import searchRoutes from "../src/routes/search";

const app = new Hono().basePath("/api");

// Allow the deployed frontend (and local dev) to call this API cross-origin.
// CORS_ORIGIN can be a comma-separated allowlist, or "*" (default).
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

// Vercel invokes the function per HTTP method. Export a handler for each
// method the API actually uses (handle() wraps the same Hono app).
export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);
