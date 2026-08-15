import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import { SummaryPanel } from "@/components/summary/SummaryPanel";
import { ReadAloudPanel } from "@/components/tts/ReadAloudPanel";
import { transcribeRecording } from "@/lib/stt/actions";
import { ExportPanel } from "@/components/export/ExportPanel";
import {
  summaryContentToString,
  type SummaryFormat,
  type SummaryVersion,
} from "@/lib/summarize/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function NotesPageInner({ id }: { id: string }) {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Notes</h1>
      </div>
      <NotesContent id={id} />
    </div>
  );
}

async function NotesContent({ id }: { id: string }) {
  let supabase;
  let user;
  try {
    ({ supabase, user } = await ensureUser());
  } catch (err) {
    console.error("[notes] session bootstrap failed:", err);
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Couldn&apos;t connect to the server. Try refreshing in a moment.
      </div>
    );
  }

  const { data: recording, error: rErr } = await supabase
    .from("recordings")
    .select(`
      id, title, audio_url, context, status, duration_seconds, format, created_at,
      transcripts (
        id, full_text, language, segments, provider, updated_at
      ),
      summary_drafts (
        id, format, content, status, based_on_version_id, created_at
      ),
      summary_versions (
        id, recording_id, format, content, version_number, is_current, created_at
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (rErr) {
    console.error("[notes] failed to load recording:", rErr);
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Couldn&apos;t load this note ({rErr.message}). Try refreshing.
      </div>
    );
  }
  if (!recording) {
    return (
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          This recording wasn&apos;t found. It may have been deleted, or it belongs to a
          different browser session.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  let transcriptRow = Array.isArray(recording.transcripts)
    ? recording.transcripts[0]
    : recording.transcripts;

  if (!transcriptRow && recording.audio_url) {
    try {
      await transcribeRecording({ recordingId: recording.id });
      const { data: refreshed } = await supabase
        .from("transcripts")
        .select("id, full_text, language, segments, provider, updated_at")
        .eq("recording_id", recording.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (refreshed) transcriptRow = refreshed;
    } catch (err) {
      console.error("Auto-transcription failed:", err);
    }
  }
  const drafts: Array<{
    id: string;
    format: string;
    content: unknown;
    status: string;
    based_on_version_id: string | null;
    created_at: string;
  }> = Array.isArray(recording.summary_drafts)
    ? recording.summary_drafts
    : recording.summary_drafts
    ? [recording.summary_drafts]
    : [];

  const versionsRaw: Array<{
    id: string;
    recording_id: string;
    format: string;
    content: unknown;
    version_number: number;
    is_current: boolean;
    created_at: string;
  }> = Array.isArray(recording.summary_versions)
    ? recording.summary_versions
    : recording.summary_versions
    ? [recording.summary_versions]
    : [];

  const pendingDraft =
    drafts.find((draft) => draft.status === "pending") ?? null;
  const currentVersion =
    versionsRaw.find((version) => version.is_current) ?? null;

  const segments = (transcriptRow?.segments ?? []) as Array<{
    start: number;
    end: number;
    text: string;
  }>;

  const draftContent = pendingDraft
    ? summaryContentToString(pendingDraft.content)
    : currentVersion
    ? summaryContentToString(currentVersion.content)
    : null;
  const draftFormat =
    (pendingDraft?.format as SummaryFormat | undefined) ??
    (currentVersion?.format as SummaryFormat | undefined) ??
    null;
  const activeVersionId =
    currentVersion?.id ?? pendingDraft?.based_on_version_id ?? null;

  const versions: SummaryVersion[] = versionsRaw.map((version) => ({
    id: version.id,
    recording_id: version.recording_id,
    format: version.format as SummaryFormat,
    content: summaryContentToString(version.content),
    created_at: version.created_at,
    is_current: version.is_current,
  }));
  const hasTranscript = !!transcriptRow?.full_text;

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <h2 className="text-xl font-semibold">{recording.title}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="capitalize">
            {recording.context}
          </Badge>
          <span>·</span>
          <span className="capitalize">{recording.status}</span>
          <span>·</span>
          <span>{new Date(recording.created_at).toLocaleString()}</span>
        </div>
        {recording.audio_url && (
          // eslint-disable-next-line jsx-a11y/media-captions
          <audio
            controls
            src={`/api/audio/${recording.id}`}
            className="w-full mt-2"
            preload="metadata"
          />
        )}
      </div>

      <TranscriptPanel
        recordingId={recording.id}
        initialSegments={segments}
        initialText={transcriptRow?.full_text ?? ""}
        initialLanguage={transcriptRow?.language ?? null}
        hasAudio={!!recording.audio_url}
      />

      <SummaryPanel
        recordingId={recording.id}
        hasTranscript={hasTranscript}
        draftContent={draftContent}
        draftFormat={draftFormat}
        activeVersionId={activeVersionId}
        versions={versions}
      />

      <ReadAloudPanel
        transcriptText={transcriptRow?.full_text ?? ""}
        summaryText={draftContent}
        language={transcriptRow?.language ?? null}
      />

      <ExportPanel
        title={recording.title}
        context={recording.context}
        createdAt={recording.created_at}
        transcriptText={transcriptRow?.full_text ?? null}
        summaryContent={draftContent}
        summaryFormat={draftFormat}
/>
    </>
  );
}

export default async function NotesPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <NotesPageInner id={id} />
    </Suspense>
  );
}