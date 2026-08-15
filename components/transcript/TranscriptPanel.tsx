"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { TranscriptView, type DisplaySegment } from "./TranscriptView";
import { transcribeRecording } from "@/lib/stt/actions";

interface Props {
  recordingId: string;
  initialSegments: DisplaySegment[];
  initialText: string;
  initialLanguage: string | null;
  hasAudio: boolean;
}

export function TranscriptPanel({
  recordingId,
  initialSegments,
  initialText,
  initialLanguage,
  hasAudio,
}: Props) {
  const [segments, setSegments] = useState<DisplaySegment[]>(initialSegments);
  const [text, setText] = useState(initialText);
  const [language, setLanguage] = useState<string | null>(initialLanguage);
  const [isPending, startTransition] = useTransition();

  function handleReTranscribe() {
    if (!hasAudio) {
      toast.error("No audio file to transcribe");
      return;
    }
    startTransition(async () => {
      try {
        toast.info("Transcribing with Groq Whisper…");
        const result = await transcribeRecording({ recordingId });
        setText(result.text);
        setLanguage(result.language);
        // We don't get the segments back in this minimal server action; full version will.
        toast.success(`Transcript updated (${result.segmentCount} segments, ${result.language ?? "auto-detected"})`);
      } catch (err: any) {
        toast.error(err?.message || "Transcription failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Transcript
            </CardTitle>
            <CardDescription>
              {text
                ? `${text.split(/\s+/).filter(Boolean).length} words`
                : "Auto-generated from your recording"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {language && (
              <Badge variant="secondary" className="font-mono">
                {language}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReTranscribe}
              disabled={isPending || !hasAudio}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Re-transcribe
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TranscriptView
          finalSegments={segments}
          language={language}
          emptyMessage="No transcript yet. Click Re-transcribe to generate one."
        />
      </CardContent>
    </Card>
  );
}
