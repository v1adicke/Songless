// useAudioSnippet — controls a single <audio> element, playing only the
// first `limitSeconds` of the preview and pausing precisely at the limit.
//
// Guards against:
//  - rapid repeated play clicks (re-entrancy)
//  - playing past the unlocked window (timeupdate + setTimeout belt & braces)
//  - stale timers after the limit changes or the clip resets

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface UseAudioSnippet {
  status: AudioStatus;
  /** seconds elapsed in the current playback (for progress UI) */
  position: number;
  duration: number;
  isReady: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function useAudioSnippet(
  src: string | null,
  limitSeconds: number
): UseAudioSnippet {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  // Prevents overlapping play() calls from rapid clicks.
  const playPending = useRef(false);

  const [status, setStatus] = useState<AudioStatus>("idle");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const clearTimers = useCallback(() => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    const el = audioRef.current;
    clearTimers();
    if (el && !el.paused) el.pause();
    setStatus((s) => (s === "playing" ? "paused" : s));
  }, [clearTimers]);

  // Smoothly track playback position; hard-stop at the limit.
  const trackPosition = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const pos = el.currentTime;
    setPosition(pos);
    if (pos >= limitSeconds) {
      el.pause();
      el.currentTime = 0;
      clearTimers();
      setPosition(0);
      setStatus("paused");
      return;
    }
    rafRef.current = requestAnimationFrame(trackPosition);
  }, [limitSeconds, clearTimers]);

  const play = useCallback(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (playPending.current) return; // re-entrancy guard
    if (status === "playing") return;

    playPending.current = true;
    clearTimers();
    try {
      el.currentTime = 0;
    } catch {
      /* may throw if not seekable yet; ignore */
    }
    setPosition(0);
    setStatus("loading");

    el.play()
      .then(() => {
        setStatus("playing");
        // Belt & braces: a timeout as a hard ceiling in addition to rAF.
        stopTimer.current = setTimeout(
          () => {
            const a = audioRef.current;
            if (a) {
              a.pause();
              a.currentTime = 0;
            }
            clearTimers();
            setPosition(0);
            setStatus("paused");
          },
          limitSeconds * 1000 + 60
        );
        rafRef.current = requestAnimationFrame(trackPosition);
      })
      .catch(() => {
        setStatus("error");
      })
      .finally(() => {
        playPending.current = false;
      });
  }, [src, status, limitSeconds, clearTimers, trackPosition]);

  const reset = useCallback(() => {
    const el = audioRef.current;
    clearTimers();
    if (el) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    setPosition(0);
    setStatus("idle");
  }, [clearTimers]);

  // Wire up element lifecycle events whenever the src changes.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    setIsReady(false);
    setStatus("idle");
    setPosition(0);

    const onLoaded = () => {
      setDuration(el.duration || 0);
      setIsReady(true);
    };
    const onError = () => setStatus("error");
    const onEnded = () => {
      clearTimers();
      setPosition(0);
      setStatus("paused");
    };

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("canplaythrough", onLoaded);
    el.addEventListener("error", onError);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("canplaythrough", onLoaded);
      el.removeEventListener("error", onError);
      el.removeEventListener("ended", onEnded);
      clearTimers();
    };
  }, [src, clearTimers]);

  // Cleanup on unmount.
  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    status,
    position,
    duration,
    isReady,
    play,
    pause,
    reset,
    audioRef,
  };
}
