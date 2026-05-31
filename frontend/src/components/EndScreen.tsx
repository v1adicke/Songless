// EndScreen — reveal album art, track info, stats and a shareable grid.

import { useRef, useState } from "react";
import {
  MAX_ATTEMPTS,
  UNLOCK_SECONDS,
  type Answer,
  type GuessEntry,
} from "../types.ts";
import { buildShareText } from "../share.ts";
import { Button, Card, cx } from "./ui.tsx";

interface Props {
  won: boolean;
  answer: Answer | null;
  guesses: GuessEntry[];
  previewUrl: string | null;
  onPlayAgain: () => void;
}

const SQUARE: Record<string, string> = {
  correct: "🟩",
  wrong: "🟨",
  skip: "⬛",
  empty: "⬜",
};

// Full clip length in seconds (last value in unlock schedule).
const FULL_SECONDS = UNLOCK_SECONDS[MAX_ATTEMPTS - 1];

export default function EndScreen({
  won,
  answer,
  guesses,
  previewUrl,
  onPlayAgain,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const squares: string[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const g = guesses[i];
    squares.push(g ? SQUARE[g.outcome] : SQUARE.empty);
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.currentTime = 0;
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }

  function handleEnded() {
    setPlaying(false);
  }

  async function share() {
    const text = buildShareText(guesses, won);
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // user cancelled share, or clipboard blocked — ignore
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-5 animate-scale-in">
      {/* Hidden audio element for full-track playback on end screen */}
      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          preload="auto"
          crossOrigin="anonymous"
          onEnded={handleEnded}
        />
      )}

      <Card className="overflow-hidden">
        {/* Album art header */}
        <div className="relative aspect-square w-full bg-noir-800">
          {answer?.album_image ? (
            <img
              src={answer.album_image}
              alt={answer.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-(--color-noir-500)">
              No artwork
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-noir-900 via-noir-900/70 to-transparent p-6 pt-16">
            <div
              className={cx(
                "mb-2 inline-block rounded-full px-3 py-1 text-xs font-medium tracking-wide",
                won
                  ? "bg-correct/20 text-correct"
                  : "bg-close/20 text-close"
              )}
            >
              {won
                ? `Solved in ${guesses.filter(g => g.outcome !== "skip").length}/${MAX_ATTEMPTS}`
                : "Out of attempts"}
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold tracking-tight leading-tight">
                  {answer?.name ?? "Unknown track"}
                </h2>
                <p className="text-sm text-accent-dim">
                  {answer?.artists.join(", ")}
                  {answer?.release_year ? ` · ${answer.release_year}` : ""}
                </p>
              </div>
              {/* Play full 30s preview button */}
              {previewUrl && (
                <button
                  onClick={togglePlay}
                  className={cx(
                    "shrink-0 flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-200 active:scale-95",
                    "border-line-strong bg-noir-800/80 hover:bg-noir-700",
                    playing && "animate-pulse-ring"
                  )}
                  aria-label={playing ? "Pause" : "Play full preview"}
                >
                  {playing ? (
                    <span className="flex gap-1">
                      <span className="h-4 w-0.75 rounded-sm bg-accent" />
                      <span className="h-4 w-0.75 rounded-sm bg-accent" />
                    </span>
                  ) : (
                    <span className="ml-0.5 h-0 w-0 border-y-8 border-l-14 border-y-transparent border-l-accent" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Share grid */}
        <div className="p-6 space-y-5">
          <div className="text-center text-2xl tracking-[0.2em] select-all">
            {squares.join("")}
          </div>

          <div className="flex gap-3">
            <Button variant="subtle" className="flex-1" onClick={share}>
              {copied ? "Copied ✓" : "Share result"}
            </Button>
            <Button variant="primary" className="flex-1" onClick={onPlayAgain}>
              Play again
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
