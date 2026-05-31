// EndScreen — reveal album art, track info, stats and a shareable grid.

import { useState } from "react";
import {
  MAX_ATTEMPTS,
  type Answer,
  type GuessEntry,
} from "../types.ts";
import { buildShareText } from "../share.ts";
import { Button, Card, cx } from "./ui.tsx";

interface Props {
  won: boolean;
  answer: Answer | null;
  guesses: GuessEntry[];
  onPlayAgain: () => void;
}

const SQUARE: Record<string, string> = {
  correct: "🟩",
  wrong: "🟨",
  skip: "⬛",
  empty: "⬜",
};

export default function EndScreen({
  won,
  answer,
  guesses,
  onPlayAgain,
}: Props) {
  const [copied, setCopied] = useState(false);

  const squares: string[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const g = guesses[i];
    squares.push(g ? SQUARE[g.outcome] : SQUARE.empty);
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
      <Card className="overflow-hidden">
        {/* Album art header */}
        <div className="relative aspect-square w-full bg-[var(--color-noir-800)]">
          {answer?.album_image ? (
            <img
              src={answer.album_image}
              alt={answer.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--color-noir-500)]">
              No artwork
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--color-noir-900)] via-[var(--color-noir-900)]/70 to-transparent p-6 pt-16">
            <div
              className={cx(
                "mb-2 inline-block rounded-full px-3 py-1 text-xs font-medium tracking-wide",
                won
                  ? "bg-[var(--color-correct)]/20 text-[var(--color-correct)]"
                  : "bg-[var(--color-close)]/20 text-[var(--color-close)]"
              )}
            >
              {won
                ? `Solved in ${guesses.length}/${MAX_ATTEMPTS}`
                : "Out of attempts"}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight leading-tight">
              {answer?.name ?? "Unknown track"}
            </h2>
            <p className="text-sm text-[var(--color-accent-dim)]">
              {answer?.artists.join(", ")}
              {answer?.release_year ? ` · ${answer.release_year}` : ""}
            </p>
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
