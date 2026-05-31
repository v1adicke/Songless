// FiltersScreen — choose genre / decade / artist before a round.

import { useEffect, useRef, useState } from "react";
import { searchArtists } from "../api.ts";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";
import {
  DECADES,
  GENRES,
  type ArtistCandidate,
  type Filters,
} from "../types.ts";
import { Button, Card, Chip, cx } from "./ui.tsx";

interface Props {
  onStart: (filters: Filters) => void;
  error: string | null;
}

export default function FiltersScreen({ onStart, error }: Props) {
  const [genres, setGenres] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [artist, setArtist] = useState<ArtistCandidate | null>(null);

  const [artistQuery, setArtistQuery] = useState("");
  const [results, setResults] = useState<ArtistCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const debounced = useDebouncedValue(artistQuery, 280);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.trim() || artist) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchArtists(debounced)
      .then((r) => {
        if (!cancelled) {
          setResults(r);
          setOpen(true);
        }
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setSearching(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, artist]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function chooseArtist(a: ArtistCandidate) {
    setArtist(a);
    setArtistQuery(a.name);
    setOpen(false);
  }

  function clearArtist() {
    setArtist(null);
    setArtistQuery("");
    setResults([]);
  }

  function toggleGenre(g: string) {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  function toggleYear(y: string) {
    setYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]
    );
  }

  function handleStart() {
    onStart({
      genres,
      years,
      artist: artist?.name ?? null,
    });
  }

  return (
    <div className="w-full max-w-xl mx-auto px-5 animate-fade-in">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-semibold tracking-tighter mb-3">
          Songless
        </h1>
        <p className="text-[var(--color-accent-dim)] text-sm tracking-tight">
          Guess the track from progressively longer snippets.
        </p>
      </header>

      <Card className="p-7 space-y-8">
        {/* Genre (multi-select) */}
        <section>
          <label className="block text-xs uppercase tracking-[0.18em] text-[var(--color-accent-dim)] mb-3">
            Genre <span className="lowercase tracking-normal">· pick any</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip active={genres.length === 0} onClick={() => setGenres([])}>
              Any
            </Chip>
            {GENRES.map((g) => (
              <Chip
                key={g}
                active={genres.includes(g)}
                onClick={() => toggleGenre(g)}
              >
                {g}
              </Chip>
            ))}
          </div>
        </section>

        {/* Decade (multi-select) */}
        <section>
          <label className="block text-xs uppercase tracking-[0.18em] text-[var(--color-accent-dim)] mb-3">
            Era <span className="lowercase tracking-normal">· pick any</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Chip active={years.length === 0} onClick={() => setYears([])}>
              Any
            </Chip>
            {DECADES.map((d) => (
              <Chip
                key={d.value}
                active={years.includes(d.value)}
                onClick={() => toggleYear(d.value)}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </section>

        {/* Artist autocomplete */}
        <section ref={boxRef} className="relative">
          <label className="block text-xs uppercase tracking-[0.18em] text-[var(--color-accent-dim)] mb-3">
            Artist (optional)
          </label>
          <div className="relative">
            <input
              value={artistQuery}
              onChange={(e) => {
                setArtistQuery(e.target.value);
                if (artist) setArtist(null);
              }}
              onFocus={() => results.length && setOpen(true)}
              placeholder="Search an artist…"
              className={cx(
                "w-full rounded-xl bg-[var(--color-noir-800)] border px-4 py-3 text-sm outline-none transition-colors",
                "border-[var(--color-line)] focus:border-[var(--color-line-strong)] placeholder:text-[var(--color-noir-500)]",
                artist && "pr-10"
              )}
            />
            {artist && (
              <button
                onClick={clearArtist}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-accent-dim)] hover:text-[var(--color-accent)]"
                aria-label="Clear artist"
              >
                ✕
              </button>
            )}
          </div>

          {open && (results.length > 0 || searching) && (
            <div className="absolute z-20 mt-2 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-noir-850)]/95 backdrop-blur-xl overflow-hidden shadow-2xl">
              {searching && results.length === 0 && (
                <div className="px-4 py-3 text-sm text-[var(--color-accent-dim)]">
                  Searching…
                </div>
              )}
              {results.map((a) => (
                <button
                  key={a.id}
                  onClick={() => chooseArtist(a)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-noir-700)] transition-colors"
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--color-noir-700)]">
                    {a.image && (
                      <img
                        src={a.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <span className="text-sm">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {error && (
          <p className="text-sm text-[var(--color-close)] animate-fade-in">
            {error}
          </p>
        )}

        <Button variant="primary" className="w-full py-4" onClick={handleStart}>
          Start Game
        </Button>
      </Card>

      <p className="mt-6 text-center text-xs text-[var(--color-noir-500)]">
        Powered by Spotify previews · No account required
      </p>
    </div>
  );
}
