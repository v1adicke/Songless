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
  // Always-current ref so async callbacks never read stale closure state.
  const stateRef = useRef<GameState>(initialState);
  stateRef.current = state;

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
      // Read from ref — never stale, even in async callbacks or rapid clicks.
      const s0 = stateRef.current;
      if (s0.phase !== "playing" || s0.busy || !s0.roundId) return;
      const roundId = s0.roundId;
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
    [loseRound] // no state.* deps — always reads from stateRef
  );

  const skip = useCallback(() => {
    const s0 = stateRef.current;
    if (s0.phase !== "playing" || s0.busy || !s0.roundId) return;
    const roundId = s0.roundId;
    // On the final attempt, skipping ends the round (reveal) instead of
    // incrementing attempts indefinitely.
    if (s0.attempt + 1 >= MAX_ATTEMPTS) {
      const guesses = [
        ...s0.guesses,
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
  }, [loseRound]); // no state.* deps — always reads from stateRef

  const giveUp = useCallback(() => {
    const s0 = stateRef.current;
    if (s0.phase !== "playing" || !s0.roundId) return;
    const guesses = [...s0.guesses];
    // Fill remaining rows as skips for the share grid.
    while (guesses.length < MAX_ATTEMPTS) {
      guesses.push({ outcome: "skip", label: "Skipped" });
    }
    loseRound(s0.roundId, guesses);
  }, [loseRound]); // no state.* deps — always reads from stateRef

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
