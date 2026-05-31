// In-memory store of active game rounds.
// Keyed by an opaque round_id so the client never learns the answer
// until /guess or /reveal. Rounds auto-expire to bound memory usage.

import type { GameRound } from "../types.ts";

const rounds = new Map<string, GameRound>();

// Rounds live for 1 hour max.
const ROUND_TTL_MS = 60 * 60 * 1000;

function makeId(): string {
  // crypto.randomUUID is available in Bun.
  return crypto.randomUUID();
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, round] of rounds) {
    if (now - round.createdAt > ROUND_TTL_MS) {
      rounds.delete(id);
    }
  }
}

export function createRound(data: Omit<GameRound, "createdAt">): string {
  pruneExpired();
  const id = makeId();
  rounds.set(id, { ...data, createdAt: Date.now() });
  return id;
}

export function getRound(id: string): GameRound | undefined {
  const round = rounds.get(id);
  if (!round) return undefined;
  if (Date.now() - round.createdAt > ROUND_TTL_MS) {
    rounds.delete(id);
    return undefined;
  }
  return round;
}

export function deleteRound(id: string): void {
  rounds.delete(id);
}
