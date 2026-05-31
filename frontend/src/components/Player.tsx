// Player — audio control with a segmented timeline showing unlocked windows.

import { UNLOCK_SECONDS, MAX_ATTEMPTS } from "../types.ts";
import type { AudioStatus } from "../hooks/useAudioSnippet.ts";
import { Equalizer, cx } from "./ui.tsx";

interface Props {
  status: AudioStatus;
  position: number;
  limitSeconds: number;
  attempt: number; // 0-based
  isReady: boolean;
  onPlay: () => void;
  onPause: () => void;
}

const TOTAL = UNLOCK_SECONDS[MAX_ATTEMPTS - 1]; // 30s full clip

export default function Player({
  status,
  position,
  limitSeconds,
  attempt,
  isReady,
  onPlay,
  onPause,
}: Props) {
  const playing = status === "playing";
  const loading = status === "loading" || !isReady;
  const unlockedPct = (limitSeconds / TOTAL) * 100;
  const positionPct = (position / TOTAL) * 100;

  return (
    <div className="space-y-6">
      {/* Segmented timeline */}
      <div className="space-y-2">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-noir-800)]">
          {/* Unlocked region */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-noir-600)] transition-[width] duration-500 ease-out"
            style={{ width: `${unlockedPct}%` }}
          />
          {/* Live playback position */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-accent)]"
            style={{ width: `${Math.min(positionPct, unlockedPct)}%` }}
          />
          {/* Segment ticks */}
          {UNLOCK_SECONDS.map((s, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-[var(--color-noir-950)]"
              style={{ left: `${(s / TOTAL) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] tabular-nums text-[var(--color-noir-500)]">
          <span>0:00</span>
          <span className="text-[var(--color-accent-dim)]">
            {limitSeconds < 1
              ? `${limitSeconds.toFixed(1)}s unlocked`
              : `${limitSeconds}s unlocked`}
          </span>
          <span>0:30</span>
        </div>
      </div>

      {/* Play / Pause */}
      <div className="flex items-center justify-center">
        <button
          onClick={playing ? onPause : onPlay}
          disabled={loading && !playing}
          className={cx(
            "group relative flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-200 active:scale-95",
            "border-[var(--color-line-strong)] bg-[var(--color-noir-800)] hover:bg-[var(--color-noir-700)]",
            playing && "animate-pulse-ring"
          )}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading && !playing ? (
            <span className="text-[var(--color-accent-dim)]">
              <Equalizer active />
            </span>
          ) : playing ? (
            // Pause icon
            <span className="flex gap-1.5">
              <span className="h-6 w-[5px] rounded-sm bg-[var(--color-accent)]" />
              <span className="h-6 w-[5px] rounded-sm bg-[var(--color-accent)]" />
            </span>
          ) : (
            // Play icon
            <span className="ml-1 h-0 w-0 border-y-[12px] border-l-[20px] border-y-transparent border-l-[var(--color-accent)]" />
          )}
        </button>
      </div>

      <p className="text-center text-xs text-[var(--color-accent-dim)]">
        Attempt {attempt + 1} of {MAX_ATTEMPTS}
      </p>
    </div>
  );
}
