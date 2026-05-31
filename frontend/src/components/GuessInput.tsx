// GuessInput — track autocomplete for submitting an answer.

import { useEffect, useRef, useState } from "react";
import { searchTracks } from "../api.ts";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";
import type { TrackCandidate } from "../types.ts";
import { Button, cx } from "./ui.tsx";

interface Props {
  disabled?: boolean;
  busy?: boolean;
  onGuess: (track: TrackCandidate) => void;
  onSkip: () => void;
  skipLabel: string;
  skipVariant?: "primary" | "ghost" | "subtle" | "danger";
}

export default function GuessInput({
  disabled,
  busy,
  onGuess,
  onSkip,
  skipLabel,
  skipVariant = "ghost",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TrackCandidate | null>(null);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const debounced = useDebouncedValue(query, 250);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.trim() || selected) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTracks(debounced)
      .then((r) => {
        if (!cancelled) {
          setResults(r);
          setHighlight(0);
          setOpen(true);
        }
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setSearching(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, selected]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(track: TrackCandidate) {
    setSelected(track);
    setQuery(`${track.name} — ${track.artists.join(", ")}`);
    setOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  function submit() {
    if (selected && !disabled && !busy) {
      onGuess(selected);
      clearSelection();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === "Enter" && selected) submit();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-3">
      <div ref={boxRef} className="relative">
        <div className="relative">
          <input
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selected) setSelected(null);
            }}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Know it? Search the title…"
            className={cx(
              "w-full rounded-xl bg-[var(--color-noir-800)] border px-4 py-3.5 text-sm outline-none transition-colors",
              "border-[var(--color-line)] focus:border-[var(--color-line-strong)] placeholder:text-[var(--color-noir-500)]",
              "disabled:opacity-40",
              selected && "pr-10 border-[var(--color-line-strong)]"
            )}
          />
          {selected && (
            <button
              onClick={clearSelection}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-accent-dim)] hover:text-[var(--color-accent)]"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
        </div>

        {open && (results.length > 0 || searching) && (
          <div className="absolute bottom-full z-20 mb-2 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-noir-850)]/95 backdrop-blur-xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto">
            {searching && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-[var(--color-accent-dim)]">
                Searching…
              </div>
            )}
            {results.map((t, i) => (
              <button
                key={t.id}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(t)}
                className={cx(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  i === highlight
                    ? "bg-[var(--color-noir-700)]"
                    : "hover:bg-[var(--color-noir-700)]"
                )}
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[var(--color-noir-700)]">
                  {t.album_image && (
                    <img
                      src={t.album_image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm">{t.name}</div>
                  <div className="truncate text-xs text-[var(--color-accent-dim)]">
                    {t.artists.join(", ")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant={skipVariant}
          className="flex-1"
          onClick={onSkip}
          disabled={disabled || busy}
        >
          {skipLabel}
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={submit}
          disabled={!selected || disabled || busy}
        >
          {busy ? "Checking…" : "Submit"}
        </Button>
      </div>
    </div>
  );
}
