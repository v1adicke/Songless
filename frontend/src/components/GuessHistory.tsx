// GuessHistory — vertical list of attempt rows (skip/wrong/correct + empty).

import { MAX_ATTEMPTS, type GuessEntry } from "../types.ts";
import { cx } from "./ui.tsx";

export default function GuessHistory({ guesses }: { guesses: GuessEntry[] }) {
  const rows: (GuessEntry | null)[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    rows.push(guesses[i] ?? null);
  }

  return (
    <ul className="space-y-2">
      {rows.map((row, i) => (
        <li
          key={i}
          className={cx(
            "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
            row
              ? "border-[var(--color-line)] bg-[var(--color-noir-800)]"
              : "border-dashed border-[var(--color-line)] bg-transparent"
          )}
        >
          <span
            className={cx(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              row?.outcome === "correct" && "bg-[var(--color-correct)]",
              row?.outcome === "wrong" && "bg-[var(--color-close)]",
              row?.outcome === "skip" && "bg-[var(--color-wrong)]",
              !row && "bg-[var(--color-noir-700)]"
            )}
          />
          <span
            className={cx(
              "truncate",
              row ? "text-[var(--color-accent)]" : "text-[var(--color-noir-500)]"
            )}
          >
            {row ? row.label : `Attempt ${i + 1}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
