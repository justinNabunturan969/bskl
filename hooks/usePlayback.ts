"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UsePlaybackResult {
  buffer: AudioBuffer | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  skip: (delta: number) => void;
}

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) ?? null;
}

export function usePlayback(blob: Blob | null): UsePlaybackResult {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0); // context time when current playback started
  const offsetRef = useRef(0); // seconds into the buffer where playback started
  const rafRef = useRef<number | null>(null);

  // Acquire (or reuse) a single AudioContext. Created lazily so SSR doesn't break.
  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!contextRef.current) {
      const Ctor = getAudioContextClass();
      if (!Ctor) return null;
      contextRef.current = new Ctor();
    }
    return contextRef.current;
  }, []);

  // Decode blob into an AudioBuffer whenever the input changes.
  useEffect(() => {
    if (!blob) {
      setBuffer(null);
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
      return;
    }

    let cancelled = false;
    setCurrentTime(0);
    setIsPlaying(false);

    const ctx = getContext();
    if (!ctx) return;

    blob
      .arrayBuffer()
      .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
      .then((decoded) => {
        if (cancelled) return;
        setBuffer(decoded);
        setDuration(decoded.duration);
        setCurrentTime(0);
      })
      .catch(() => {
        if (cancelled) return;
        setBuffer(null);
        setDuration(0);
      });

    return () => {
      cancelled = true;
    };
  }, [blob, getContext]);

  const stopSource = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Stop any in-flight source when the buffer is replaced or the component unmounts.
  useEffect(() => {
    return () => {
      stopSource();
    };
  }, [stopSource]);

  // Keep currentTime in sync with the active source while playing.
  const tick = useCallback(() => {
    const ctx = contextRef.current;
    if (!ctx || !sourceRef.current) return;
    const elapsed = ctx.currentTime - startTimeRef.current;
    const t = Math.min(offsetRef.current + elapsed, duration);
    setCurrentTime(t);
    if (t >= duration) {
      // Playback reached the end.
      stopSource();
      setIsPlaying(false);
      offsetRef.current = 0;
      setCurrentTime(duration);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [duration, stopSource]);

  const play = useCallback(() => {
    const ctx = getContext();
    if (!ctx || !buffer) return;
    // If we were at the end, restart from 0.
    let offset = offsetRef.current >= duration ? 0 : offsetRef.current;
    if (currentTime >= duration) offset = 0;

    // Resume the context if it was suspended (autoplay policy).
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    stopSource();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      // Only react to natural end, not manual stops.
      if (sourceRef.current !== source) return;
      sourceRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setIsPlaying(false);
    };
    source.start(0, offset);
    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime;
    offsetRef.current = offset;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [buffer, currentTime, duration, getContext, stopSource, tick]);

  const pause = useCallback(() => {
    const ctx = contextRef.current;
    if (!ctx || !sourceRef.current) return;
    const elapsed = ctx.currentTime - startTimeRef.current;
    const t = Math.min(offsetRef.current + elapsed, duration);
    offsetRef.current = t;
    setCurrentTime(t);
    stopSource();
    setIsPlaying(false);
  }, [duration, stopSource]);

  const seek = useCallback(
    (time: number) => {
      const ctx = contextRef.current;
      if (!buffer) return;
      const clamped = Math.max(0, Math.min(time, duration));
      const wasPlaying = isPlaying;
      stopSource();
      offsetRef.current = clamped;
      setCurrentTime(clamped);
      if (wasPlaying && ctx) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          if (sourceRef.current !== source) return;
          sourceRef.current = null;
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setIsPlaying(false);
        };
        source.start(0, clamped);
        sourceRef.current = source;
        startTimeRef.current = ctx.currentTime;
        setIsPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
      }
    },
    [buffer, duration, isPlaying, stopSource, tick]
  );

  const skip = useCallback(
    (delta: number) => {
      seek(currentTime + delta);
    },
    [currentTime, seek]
  );

  return { buffer, isPlaying, currentTime, duration, play, pause, seek, skip };
}
