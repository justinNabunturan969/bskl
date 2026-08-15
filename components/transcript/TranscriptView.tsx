"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DisplaySegment {
  start?: number;
  end?: number;
  text: string;
  is_final?: boolean;
  is_interim?: boolean;
  speaker?: string;
}

interface Props {
  finalSegments: DisplaySegment[];
  interimText?: string;
  language?: string | null;
  isLive?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function TranscriptView({
  finalSegments,
  interimText,
  language,
  isLive = false,
  emptyMessage = "Transcript will appear here as you record…",
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [finalSegments, interimText]);

  if (finalSegments.length === 0 && !interimText) {
    return (
      <div
        className={cn(
          "rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground",
          className
        )}
        role="status"
        aria-live="polite"
      >
        {isLive ? emptyMessage : "No transcript yet."}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "rounded-md border bg-muted/30 p-4 text-sm leading-relaxed max-h-96 overflow-y-auto",
        className
      )}
      role="log"
      aria-live="polite"
      aria-label="Transcription"
    >
      {language && (
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Detected: <span className="font-mono">{language}</span>
        </div>
      )}

      <div className="space-y-1.5">
        {finalSegments.map((seg, i) => (
          <span key={i} className="inline">
            {/* Non-color cue: bold for finalized (per WCAG 1.4.1) */}
            <span
              className={cn(
                seg.speaker && "font-medium"
              )}
              style={seg.speaker ? { color: undefined } : undefined}
            >
              {seg.speaker && (
                <span className="mr-1 text-xs font-semibold uppercase text-primary">
                  {seg.speaker}:
                </span>
              )}
              {seg.text}
            </span>
            {" "}
          </span>
        ))}

        {interimText && (
          <span
            className="italic text-muted-foreground"
            aria-label="Interim transcription, may change"
          >
            {interimText}
          </span>
        )}
      </div>
    </div>
  );
}
