"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { acceptVersion } from "@/lib/summarize/actions";
import { SummaryView } from "./SummaryView";
import { SUMMARY_FORMAT_LABELS, type SummaryVersion } from "@/lib/summarize/types";

interface Props {
  recordingId: string;
  versions: SummaryVersion[];
  activeVersionId: string | null;
}

export function VersionList({ recordingId, versions, activeVersionId }: Props) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No versions yet. Generate your first summary above.
      </p>
    );
  }

  function handleAccept(versionId: string) {
    setBusyId(versionId);
    startTransition(async () => {
      const result = await acceptVersion({ recordingId, versionId });
      setBusyId(null);
      if (!result.ok) toast.error(result.error);
      else toast.success("Summary updated to this version");
    });
  }

  // Newest first
  const sorted = [...versions].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-2">
      {sorted.map((v) => {
        const isActive = v.id === activeVersionId;
        return (
          <div
            key={v.id}
            className={cn(
              "rounded-md border p-3 space-y-2",
              isActive ? "bg-primary/5 border-primary/30" : "bg-card/50"
            )}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{SUMMARY_FORMAT_LABELS[v.format]}</Badge>
                <span>
                  {formatDistanceToNow(new Date(v.created_at), {
                    addSuffix: true,
                  })}
                </span>
                {isActive && (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" />
                    Current
                  </Badge>
                )}
              </div>
              {!isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAccept(v.id)}
                  disabled={pending && busyId === v.id}
                >
                  {pending && busyId === v.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Accept"
                  )}
                </Button>
              )}
            </div>
            <details>
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Show content
              </summary>
              <div className="mt-2">
                <SummaryView content={v.content} format={v.format} />
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}