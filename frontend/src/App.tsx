// App — top-level orchestration of phases + audio binding.

import { useCallback, useEffect } from "react";
import { useGame } from "./hooks/useGame.ts";
import { useAudioSnippet } from "./hooks/useAudioSnippet.ts";
import { MAX_ATTEMPTS } from "./types.ts";
import FiltersScreen from "./components/FiltersScreen.tsx";
import Player from "./components/Player.tsx";
import GuessInput from "./components/GuessInput.tsx";
import GuessHistory from "./components/GuessHistory.tsx";
import EndScreen from "./components/EndScreen.tsx";
import { Card } from "./components/ui.tsx";

export default function App() {
  const { state, currentLimit, start, submitGuess, skip, giveUp, reset } =
    useGame();

  const audio = useAudioSnippet(state.previewUrl, currentLimit);

  // Pause audio whenever the round ends.
  useEffect(() => {
    if (state.phase === "won" || state.phase === "lost") {
      audio.pause();
    }
  }, [state.phase, audio]);

  // Returning to the filters screen: stop and reset any playing audio,
  // then reset the game state.
  const handleBackToFilters = useCallback(() => {
    audio.reset();
    reset();
  }, [audio, reset]);

  // Is this the final attempt? After this one there are no more tries,
  // so we offer "Give up & reveal" instead of "Skip".
  const isFinalAttempt = state.attempt + 1 >= MAX_ATTEMPTS;

  return (
    <div className="flex min-h-full items-center justify-center py-10">
      {/* Single persistent audio element bound to the hook. */}
      <audio
        ref={audio.audioRef as React.RefObject<HTMLAudioElement>}
        src={state.previewUrl ?? undefined}
        preload="auto"
        crossOrigin="anonymous"
      />

      {state.phase === "filters" && (
        <FiltersScreen onStart={start} error={state.error} />
      )}

      {state.phase === "loading" && (
        <div className="flex flex-col items-center gap-4 text-[var(--color-accent-dim)] animate-fade-in">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-accent)]" />
          <p className="text-sm tracking-tight">Finding a track…</p>
        </div>
      )}

      {state.phase === "playing" && (
        <div className="w-full max-w-md mx-auto px-5 animate-fade-in">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={handleBackToFilters}
              className="text-sm text-[var(--color-accent-dim)] hover:text-[var(--color-accent)] transition-colors"
            >
              ← Filters
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              {state.hintGenre && (
                <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[var(--color-accent-dim)]">
                  {state.hintGenre}
                </span>
              )}
              {state.hintYear && state.hintYear !== "Unknown" && (
                <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[var(--color-accent-dim)]">
                  {state.hintYear}
                </span>
              )}
            </div>
          </div>

          {state.usedFallback && (
            <p className="mb-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-noir-800)] px-3 py-2 text-center text-xs text-[var(--color-accent-dim)]">
              No previewable tracks matched your filters — playing a popular pick
              instead.
            </p>
          )}

          <Card className="p-6 space-y-7">
            <Player
              status={audio.status}
              position={audio.position}
              limitSeconds={currentLimit}
              attempt={state.attempt}
              isReady={audio.isReady}
              onPlay={audio.play}
              onPause={audio.pause}
            />

            <GuessInput
              busy={state.busy}
              onGuess={submitGuess}
              onSkip={isFinalAttempt ? giveUp : skip}
              skipLabel={isFinalAttempt ? "Give up" : "Skip (+time)"}
              skipVariant={isFinalAttempt ? "danger" : "ghost"}
            />
          </Card>

          <div className="mt-5">
            <GuessHistory guesses={state.guesses} />
          </div>

          {audio.status === "error" && (
            <p className="mt-4 text-center text-xs text-[var(--color-close)]">
              Audio failed to load. This preview may be unavailable — try
              skipping or starting a new round.
            </p>
          )}
        </div>
      )}

      {(state.phase === "won" || state.phase === "lost") && (
        <EndScreen
          won={state.phase === "won"}
          answer={state.answer}
          guesses={state.guesses}
          onPlayAgain={reset}
        />
      )}
    </div>
  );
}
