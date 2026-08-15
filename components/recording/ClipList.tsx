"use client";

import { Mic, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/audio/format";
import type { Clip } from "@/hooks/useRecordingSession";

interface Props {
  clips: Clip[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ClipList({ clips, activeId, onSelect, onRemove }: Props) {
  if (clips.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No clips yet. Record or upload to start.</p>;
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Clips in this session">
      {clips.map((clip, i) => {
        const isActive = clip.id === activeId;
        return (
          <div key={clip.id} role="tab" aria-selected={isActive}
            className={cn("flex items-center gap-2 rounded-md border px-3 py-2 shrink-0 cursor-pointer transition-colors min-w-[140px]",
              isActive ? "border-primary bg-primary/5" : "hover:bg-muted")}
            onClick={() => onSelect(clip.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(clip.id); } }}
            tabIndex={0}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {clip.type === "recording" ? <Mic className="h-4 w-4 text-primary shrink-0" /> : <Upload className="h-4 w-4 text-primary shrink-0" />}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">Clip {i + 1}</span>
                <span className="text-xs text-muted-foreground">{formatDuration(clip.duration)}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
              onClick={(e) => { e.stopPropagation(); onRemove(clip.id); }}
              aria-label={`Remove clip ${i + 1}`}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}