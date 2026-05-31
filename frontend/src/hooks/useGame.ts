// useGame — the game state machine. Owns round lifecycle, attempts,
// guess history, and win/lose resolution. Audio is handled separately
// by useAudioSnippet (driven by the current unlock window).

import { useCallback, useRef, useState } from "react";
import {
  generateRound,
  guess as apiGuess,
  reveal as apiReveal,
} from "../api.ts";
import {
  MAX_ATTEMPTS,
  UNLOCK_SECONDS,
  type Answer,
  type Filters,
  type GuessEntry,
  type TrackCandidate,
} from "../types.ts";

export type Phase = "filters" | "loading" | "playing" | "won" | "lost";

interface GameState {
  phase: Phase;
  roundId: string | null;
  previewUrl: string | null;
  hintYear: string | null;
  hintGenre: string | null;
  usedFallback: boolean;
  attempt: number; // 0-based index into UNLOCK_SECONDS
  guesses: GuessEntry[];
  answer: Answer | null;
  error: string | null;
  busy: boolean; // guard against concurrent guess/skip submits
}

const initialState: GameState = {
  phase: "filters",
  roundId: null,
  previewUrl: null,
  hintYear: null,
  hintGenre: null,
  usedFallback: false,
  attempt: 0,
  guesses: [],
  answer: null,
  error: null,
  busy: false,
};

export function useGame() {
  const [state, setState] = useState<GameState>(initialState);
  // Ensures the reveal/lose transition fires at most once per round
  // (guards against React StrictMode double-invocation in dev).
  const resolvedRound = useRef<string | null>(null);

  const currentLimit = UNLOCK_SECONDS[Math.min(state.attempt, MAX_ATTEMPTS - 1)];

  const start = useCallback(async (filters: Filters) => {
    resolvedRound.current = null;
    setState((s) => ({ ...s, phase: "loading", error: null }));
    try {
      const data = await generateRound(filters);
      setState({
        ...initialState,
        phase: "playing",
        roundId: data.round_id,
        previewUrl: data.preview_url,
        hintYear: data.hint.release_year,
        hintGenre: data.hint.genre_context,
        usedFallback: data.fallback,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "filters",
        error: err instanceof Error ? err.message : "Failed to start game",
      }));
    }
  }, []);

  // Resolve the round as lost: reveal the answer from the server.
  const loseRound = useCallback(
    async (roundId: string, finalGuesses: GuessEntry[]) => {
      if (resolvedRound.current === roundId) return; // already resolving/resolved
      resolvedRound.current = roundId;
      try {
        const answer = await apiReveal(roundId);
        setState((s) => ({
          ...s,
          phase: "lost",
          answer,
          guesses: finalGuesses,
          busy: false,
        }));
      } catch {
        setState((s) => ({
          ...s,
          phase: "lost",
          guesses: finalGuesses,
          busy: false,
        }));
      }
    },
    []
  );

  const submitGuess = useCallback(
    async (candidate: TrackCandidate) => {
      if (state.phase !== "playing" || state.busy || !state.roundId) return;
      const roundId = state.roundId;
      setState((s) => ({ ...s, busy: true }));

      try {
        const result = await apiGuess(roundId, {
          track_id: candidate.id,
          title: candidate.name,
        });

        if (result.correct) {
          resolvedRound.current = roundId;
          setState((s) => ({
            ...s,
            phase: "won",
            answer: result.answer ?? null,
            guesses: [
              ...s.guesses,
              { outcome: "correct", label: candidate.name },
            ],
            busy: false,
          }));
          return;
        }

        // Wrong guess: record it and advance attempt (or lose).
        let lose: GuessEntry[] | null = null;
        setState((s) => {
          const guesses = [
            ...s.guesses,
            {
              outcome: "wrong" as const,
              label: `${candidate.name} — ${candidate.artists.join(", ")}`,
            },
          ];
          const nextAttempt = s.attempt + 1;
          if (nextAttempt >= MAX_ATTEMPTS) {
            lose = guesses;
            return { ...s, guesses, attempt: nextAttempt };
          }
          return { ...s, guesses, attempt: nextAttempt, busy: false };
        });
        if (lose) await loseRound(roundId, lose);
      } catch (err) {
        setState((s) => ({
          ...s,
          busy: false,
          error: err instanceof Error ? err.message : "Guess failed",
        }));
      }
    },
    [state.phase, state.busy, state.roundId, loseRound]
  );

  const skip = useCallback(() => {
    if (state.phase !== "playing" || state.busy || !state.roundId) return;
    const roundId = state.roundId;
    // On the final attempt, skipping ends the round (reveal) instead of
    // incrementing attempts indefinitely.
    if (state.attempt + 1 >= MAX_ATTEMPTS) {
      const guesses = [
        ...state.guesses,
        { outcome: "skip" as const, label: "Skipped" },
      ];
      while (guesses.length < MAX_ATTEMPTS) {
        guesses.push({ outcome: "skip", label: "Skipped" });
      }
      setState((s) => ({ ...s, guesses }));
      loseRound(roundId, guesses);
      return;
    }
    setState((s) => {
      const guesses = [
        ...s.guesses,
        { outcome: "skip" as const, label: "Skipped" },
      ];
      return { ...s, guesses, attempt: s.attempt + 1 };
    });
  }, [state.phase, state.busy, state.roundId, state.attempt, state.guesses, loseRound]);

  const giveUp = useCallback(() => {
    if (state.phase !== "playing" || !state.roundId) return;
    const guesses = [...state.guesses];
    // Fill remaining rows as skips for the share grid.
    while (guesses.length < MAX_ATTEMPTS) {
      guesses.push({ outcome: "skip", label: "Skipped" });
    }
    loseRound(state.roundId, guesses);
  }, [state.phase, state.roundId, state.guesses, loseRound]);

  const reset = useCallback(() => {
    resolvedRound.current = null;
    setState(initialState);
  }, []);

  return {
    state,
    currentLimit,
    start,
    submitGuess,
    skip,
    giveUp,
    reset,
  };
}
