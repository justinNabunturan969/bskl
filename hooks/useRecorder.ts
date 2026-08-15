"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRecordingMimeType } from "@/lib/audio/format";

export type RecorderState = "idle" | "requesting" | "recording" | "paused" | "stopped" | "error";

interface UseRecorderOptions {
  deviceId?: string;
}

export function useRecorder(options: UseRecorderOptions = {}) {
  const { deviceId } = options;

  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("audio/webm");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTick();
      cleanupStream();
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset device when deviceId changes (only if idle)
  useEffect(() => {
    if (state === "idle") {
      cleanupStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  function startTick() {
    stopTick();
    const tick = () => {
      const now = Date.now();
      const total = (now - startedAtRef.current - pausedAccumRef.current) / 1000;
      setDuration(total);
      tickRef.current = requestAnimationFrame(tick);
    };
    tickRef.current = requestAnimationFrame(tick);
  }

  function stopTick() {
    if (tickRef.current !== null) {
      cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
  }

  function cleanupStream() {
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }

  async function start(): Promise<void> {
    if (state === "recording" || state === "requesting") return;
    setError(null);
    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Audio context for waveform
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      sourceRef.current = source;
      analyserRef.current = analyser;

      const mt = getRecordingMimeType();
      setMimeType(mt);
      const recorder = new MediaRecorder(stream, { mimeType: mt });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mt });
        setBlob(finalBlob);
        if (url) URL.revokeObjectURL(url);
        setUrl(URL.createObjectURL(finalBlob));
        setState("stopped");
        stopTick();
        cleanupStream();
      };

      recorder.onerror = (e: any) => {
        setError(e?.error?.message || "Recording error");
        setState("error");
        stopTick();
        cleanupStream();
      };

      startedAtRef.current = Date.now();
      pausedAccumRef.current = 0;
      setDuration(0);
      recorder.start(100); // emit chunks every 100ms
      setState("recording");
      startTick();
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow microphone access in your browser settings."
          : err?.name === "NotFoundError"
          ? "No microphone found. Please connect a microphone and try again."
          : err?.message || "Could not start recording.";
      setError(msg);
      setState("error");
      cleanupStream();
    }
  }

  function pause() {
    const r = recorderRef.current;
    if (r && r.state === "recording") {
      r.pause();
      pausedAtRef.current = Date.now();
      stopTick();
      setState("paused");
    }
  }

  function resume() {
    const r = recorderRef.current;
    if (r && r.state === "paused") {
      r.resume();
      pausedAccumRef.current += Date.now() - pausedAtRef.current;
      startTick();
      setState("recording");
    }
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const r = recorderRef.current;
      if (!r || r.state === "inactive") {
        resolve(blob);
        return;
      }
      const prevOnStop = r.onstop;
      r.onstop = (e) => {
        if (prevOnStop) (prevOnStop as any).call(r, e);
        resolve(recorderRef.current ? new Blob(chunksRef.current, { type: mimeType }) : null);
      };
      r.stop();
    });
  }

  function reset() {
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    setDuration(0);
    setError(null);
    setState("idle");
    chunksRef.current = [];
    stopTick();
    cleanupStream();
  }

  return {
    state,
    blob,
    url,
    duration,
    error,
    mimeType,
    stream: streamRef.current,
    analyser: analyserRef.current,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}