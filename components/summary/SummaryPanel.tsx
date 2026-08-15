"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { generateSummary } from "@/lib/summarize/actions";
import { SummaryView } from "./SummaryView";
import { VersionList } from "./VersionList";
import {
  SUMMARY_FORMATS,
  SUMMARY_FORMAT_LABELS,
  type SummaryFormat,
  type SummaryVersion,
} from "@/lib/summarize/types";

interface Props {
  recordingId: string;
  hasTranscript: boolean;
  draftContent: string | null;
  draftFormat: SummaryFormat | null;
  activeVersionId: string | null;
  versions: SummaryVersion[];
}

export function SummaryPanel({
  recordingId,
  hasTranscript,
  draftContent,
  draftFormat,
  activeVersionId,
  versions,
}: Props) {
  const [format, setFormat] = useState<SummaryFormat>("outline");
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    if (!hasTranscript) {
      toast.error("No transcript yet — wait for transcription to finish first");
      return;
    }
    startTransition(async () => {
      const result = await generateSummary({ recordingId, format });
      if (!result.ok) toast.error(result.error);
      else toast.success("Summary generated");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Format selector + generate button */}
        <div className="space-y-2">
          <div
            className="flex flex-wrap gap-1"
            role="radiogroup"
            aria-label="Summary format"
          >
            {SUMMARY_FORMATS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={format === f ? "default" : "outline"}
                onClick={() => setFormat(f)}
                disabled={pending}
                role="radio"
                aria-checked={format === f}
                className="flex-1 sm:flex-none"
              >
                {SUMMARY_FORMAT_LABELS[f]}
              </Button>
            ))}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={pending || !hasTranscript}
            className="w-full"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {versions.length === 0 ? "Generate summary" : "Regenerate"}
          </Button>
        </div>

        {/* Current draft */}
        {draftContent && draftFormat ? (
          <div className="rounded-md border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current summary
              </span>
              <span className="text-xs text-muted-foreground">
                {SUMMARY_FORMAT_LABELS[draftFormat]}
              </span>
            </div>
            <SummaryView content={draftContent} format={draftFormat} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {hasTranscript
              ? "No summary yet. Pick a format and click Generate."
              : "Transcript is still processing — come back in a moment."}
          </p>
        )}

        {/* Version history */}
        {versions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">
              Version history ({versions.length})
            </h4>
            <VersionList
              recordingId={recordingId}
              versions={versions}
              activeVersionId={activeVersionId}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}