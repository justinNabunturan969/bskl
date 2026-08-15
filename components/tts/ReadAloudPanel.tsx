"use client";

import { useMemo, useState } from "react";
import { Play, Pause, Square, Volume2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

type Source = "transcript" | "summary";

interface Props {
  transcriptText: string;
  summaryText: string | null;
  language: string | null;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

export function ReadAloudPanel({
  transcriptText,
  summaryText,
  language,
}: Props) {
  const [source, setSource] = useState<Source>("transcript");
  const tts = useSpeechSynthesis({ language: language ?? "en-US" });

  const currentText = source === "transcript" ? transcriptText : summaryText ?? "";
  const sourceDisabled =
    source === "summary" && (!summaryText || summaryText.trim().length === 0);

  // Filter voice list to ones matching the language prefix (en, fil, etc.) when possible
  const filteredVoices = useMemo(() => {
    if (tts.voices.length === 0) return [];
    if (!language) return tts.voices;
    const base = language.split("-")[0].toLowerCase();
    const matched = tts.voices.filter((v) =>
      v.lang.toLowerCase().startsWith(base)
    );
    return matched.length > 0 ? matched : tts.voices;
  }, [tts.voices, language]);

  if (!tts.supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            Read aloud
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Your browser doesn&apos;t support the Web Speech API. Try Chrome,
              Edge, or Safari.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function handlePlay() {
    if (tts.state === "paused") {
      tts.resume();
      return;
    }
    if (!currentText.trim()) return;
    tts.speak(currentText);
  }

  const isPlaying = tts.state === "speaking";
  const isPaused = tts.state === "paused";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" />
          Read aloud
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source picker */}
        <div className="space-y-2">
          <Label>Source</Label>
          <div className="flex gap-1" role="radiogroup" aria-label="Read aloud source">
            <Button
              size="sm"
              variant={source === "transcript" ? "default" : "outline"}
              onClick={() => setSource("transcript")}
              disabled={!transcriptText.trim()}
              role="radio"
              aria-checked={source === "transcript"}
              className="flex-1"
            >
              Transcript
            </Button>
            <Button
              size="sm"
              variant={source === "summary" ? "default" : "outline"}
              onClick={() => setSource("summary")}
              disabled={sourceDisabled}
              role="radio"
              aria-checked={source === "summary"}
              className="flex-1"
            >
              Summary
            </Button>
          </div>
        </div>

        {/* Voice + speed */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tts-voice">Voice</Label>
            <Select
              value={tts.voiceURI ?? ""}
              onValueChange={(v) => v && tts.setVoiceURI(v)}
            >
              <SelectTrigger id="tts-voice" className="w-full">
                <SelectValue
                  placeholder={
                    tts.voices.length === 0
                      ? "Loading voices…"
                      : "Default voice"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredVoices.map((v) => (
                  <SelectItem key={v.voiceURI} value={v.voiceURI}>
                    {v.name} <span className="text-muted-foreground">({v.lang})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Speed</Label>
            <div className="flex gap-1">
              {SPEEDS.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={tts.rate === s ? "default" : "outline"}
                  onClick={() => tts.setRate(s)}
                  disabled={isPlaying}
                  className="flex-1"
                >
                  {s}×
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Controls + status */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePlay}
            disabled={!currentText.trim() || (isPlaying && !isPaused)}
            className="flex-1"
            size="lg"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            ) : isPlaying ? (
              <>
                <Pause className="h-4 w-4" />
                Playing…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Play
              </>
            )}
          </Button>
          <Button
            onClick={isPaused ? tts.resume : tts.pause}
            disabled={!isPlaying && !isPaused}
            variant="outline"
            size="icon"
            aria-label={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button
            onClick={tts.stop}
            disabled={tts.state === "idle"}
            variant="outline"
            size="icon"
            aria-label="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        <p
          className={cn(
            "text-xs",
            tts.state === "speaking"
              ? "text-primary"
              : "text-muted-foreground"
          )}
          aria-live="polite"
        >
          {tts.state === "idle" && tts.totalChunks === 0 && "Ready to read."}
          {tts.state === "idle" && tts.totalChunks > 0 && "Done."}
          {tts.state === "speaking" &&
            `Speaking chunk ${tts.currentChunk} of ${tts.totalChunks}…`}
          {tts.state === "paused" &&
            `Paused at chunk ${tts.currentChunk} of ${tts.totalChunks}.`}
        </p>
      </CardContent>
    </Card>
  );
}