import { Suspense } from "react";
import Link from "next/link";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, FileText, Clock, Sparkles } from "lucide-react";
import { ensureUser } from "@/lib/supabase/ensure-user";

export const dynamic = "force-dynamic";

function formatRecordingDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface RecordingRow {
  id: string;
  title: string;
  context: string;
  status: string;
  created_at: string;
  duration_seconds: number | null;
}

async function RecentRecordings() {
  let recordings: RecordingRow[] = [];

  try {
    const { supabase, user } = await ensureUser();
    const { data, error } = await supabase
      .from("recordings")
      .select("id, title, context, status, created_at, duration_seconds")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) recordings = data;
  } catch (err) {
    console.error("[dashboard] failed to load recordings:", err);
  }

  if (recordings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your notes will appear here once you record something.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {recordings.map((recording) => (
        <li key={recording.id}>
          <Link
            href={`/notes/${recording.id}`}
            className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{recording.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatRecordingDate(recording.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="capitalize">
                {recording.context}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {recording.status}
              </Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DashboardInner() {
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your recordings and notes at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-5 w-5 text-primary" /> Start recording
            </CardTitle>
            <CardDescription>Capture lectures or meetings in real-time</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/record">New recording</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" /> Recent notes
            </CardTitle>
            <CardDescription>Your saved recordings and generated notes</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
              <RecentRecordings />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" /> Activity
            </CardTitle>
            <CardDescription>Sync status and recent activity</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Sync status coming in Phase 11.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" /> Welcome to BSKL
          </CardTitle>
          <CardDescription>BrainScribe Knowledge Lab</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Record audio, get transcripts, and generate AI-powered study notes — all free, no sign-up required.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
