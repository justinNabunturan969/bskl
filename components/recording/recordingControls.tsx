"use client";

import { Mic, Pause, Square, Disc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/audio/format";
import type { RecorderState } from "@/hooks/useRecorder";

interface Props {
  state: RecorderState;
  duration: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function RecordingControls({ state, duration, onStart, onPause, onResume, onStop }: Props) {
  const isRecording = state === "recording";
  const isPaused = state === "paused";
  const isActive = isRecording || isPaused;
  const isBusy = state === "requesting";

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        className={cn(
          "text-4xl md:text-5xl font-mono font-semibold tabular-nums tracking-tight",
          isRecording && "text-red-600"
        )}
        aria-live="polite"
      >
        {formatDuration(duration)}
      </div>
      <div className="flex items-center gap-3" role="group" aria-label="Recording controls">
        {isActive && (
          <Button
            variant="outline"
            size="icon"
            onClick={isPaused ? onResume : onPause}
            className="h-11 w-11 md:h-12 md:w-12"
            aria-label={isPaused ? "Resume recording" : "Pause recording"}
          >
            {isPaused ? <Mic className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </Button>
        )}
        <Button
          onClick={isActive ? onStop : onStart}
          disabled={isBusy}
          size="icon"
          className={cn(
            "h-16 w-16 md:h-20 md:w-20 rounded-full",
            isRecording && "bg-red-600 hover:bg-red-700 animate-pulse"
          )}
          aria-label={isActive ? "Stop recording" : "Start recording"}
        >
          {isActive ? <Square className="h-6 w-6 md:h-8 md:w-8 fill-current" /> : <Disc className="h-7 w-7 md:h-9 md:w-9" />}
        </Button>
        {state === "idle" && (
          <Button
            variant="outline"
            size="icon"
            disabled
            className="h-11 w-11 md:h-12 md:w-12 invisible"
            aria-hidden="true"
          >
            <Disc className="h-5 w-5" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {isRecording && "Recording… tap to stop"}
        {isPaused && "Paused — tap mic to resume"}
        {state === "idle" && "Tap to record"}
        {state === "requesting" && "Requesting microphone…"}
        {state === "stopped" && "Clip ready"}
        {state === "error" && "Error — try again"}
      </p>
    </div>
  );
}
