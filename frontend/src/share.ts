// Build the emoji-square result grid for sharing (Wordle/Heardle-style).

import { MAX_ATTEMPTS, type GuessEntry } from "./types.ts";

const SQUARE: Record<string, string> = {
  correct: "🟩",
  wrong: "🟨",
  skip: "⬛",
  empty: "⬜",
};

export function buildShareText(
  guesses: GuessEntry[],
  won: boolean
): string {
  const squares: string[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const g = guesses[i];
    squares.push(g ? SQUARE[g.outcome] : SQUARE.empty);
  }
  const score = won ? `${guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  return `Songless ${score}\n${squares.join("")}`;
}
