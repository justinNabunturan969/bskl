"use client";

import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/audio/format";

interface Props {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSkip: (delta: number) => void;
}

export function PlaybackControls({ isPlaying, currentTime, duration, onPlay, onPause, onSeek, onSkip }: Props) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono tabular-nums w-12 text-right" aria-label="Current time">
          {formatDuration(currentTime)}
        </span>
        <Slider
          value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
          max={100}
          step={0.1}
          onValueChange={(values) => {
            const v = Array.isArray(values) ? values[0] : values;
            onSeek((v / 100) * duration);
          }}
          aria-label="Seek"
          className="flex-1"
        />
        <span className="text-xs font-mono tabular-nums w-12" aria-label="Duration">
          {formatDuration(duration)}
        </span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onSkip(-5)}
          className="h-10 w-10"
          aria-label="Skip back 5 seconds"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          onClick={isPlaying ? onPause : onPlay}
          size="icon"
          className="h-12 w-12"
          aria-label={isPlaying ? "Pause playback" : "Play"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onSkip(5)}
          className="h-10 w-10"
          aria-label="Skip forward 5 seconds"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
