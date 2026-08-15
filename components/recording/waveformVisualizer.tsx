"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  buffer?: AudioBuffer | null;
  analyser?: AnalyserNode | null;
  isLive?: boolean;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  className?: string;
}

export function WaveformVisualizer({
  buffer,
  analyser,
  isLive = false,
  currentTime = 0,
  duration = 0,
  onSeek,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const peaksRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!buffer) {
      peaksRef.current = null;
      return;
    }
    const channel = buffer.getChannelData(0);
    const samples = 1000;
    const blockSize = Math.floor(channel.length / samples);
    const peaks = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(channel[i * blockSize + j] || 0);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    peaksRef.current = peaks;
  }, [buffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const liveData = analyser ? new Uint8Array(analyser.fftSize) : null;
    const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function getAmplitude(i: number, total: number): number {
      if (analyser && liveData) {
        analyser!.getByteTimeDomainData(liveData);
        const idx = Math.floor((i / total) * liveData.length);
        return Math.abs((liveData[idx] || 128) - 128) / 128;
      }
      if (peaksRef.current) {
        const peaks = peaksRef.current;
        const idx = Math.floor((i / total) * peaks.length);
        return peaks[idx] || 0;
      }
      return 0;
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);
      const barWidth = 2;
      const gap = 1;
      const total = Math.max(1, Math.floor(w / (barWidth + gap)));
      const mid = h / 2;
      for (let i = 0; i < total; i++) {
        const x = i * (barWidth + gap);
        const amp = getAmplitude(i, total);
        const barH = Math.max(2, amp * h * 0.9);
        const isPlayed = (i / total) <= progress;
        const isFuture = !isLive && (i / total) > progress;
        const color = isFuture
          ? "rgba(120,120,120,0.45)"
          : isLive
          ? "rgb(239,68,68)"
          : "rgb(59,130,246)";
        ctx.fillStyle = color;
        ctx.fillRect(x, mid - barH / 2, barWidth, barH);
      }
      if (isLive && analyser) {
        animRef.current = requestAnimationFrame(draw);
      }
    }

    draw();
    if (isLive && analyser) {
      animRef.current = requestAnimationFrame(draw);
    }

    return () => {
      ro.disconnect();
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [analyser, buffer, currentTime, duration, isLive]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onSeek || !duration || isLive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(((e.clientX - rect.left) / rect.width) * duration);
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Audio waveform, click to seek" : "Audio waveform"}
      tabIndex={onSeek ? 0 : undefined}
      className={cn("w-full h-full cursor-pointer", className)}
    />
  );
}
