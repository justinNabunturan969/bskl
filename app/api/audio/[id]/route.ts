import { NextRequest, NextResponse } from "next/server";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { fetchAudio } from "@/lib/storage/hf";

/**
 * GET /api/audio/[id]
 * Streams audio for a recording the current user owns. Verifies ownership
 * and proxies the file from Hugging Face (private dataset) so the client
 * never needs the HF token.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ensureUser signs in anonymously if needed; throws otherwise.
  const { supabase, user } = await ensureUser();

  // Look up the recording to verify ownership and get the HF path
  const { data: recording, error } = await supabase
    .from("recordings")
    .select("audio_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !recording || !recording.audio_url) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const upstream = await fetchAudio(recording.audio_url);

    // Forward the upstream headers (Content-Type, Content-Length, Content-Range)
    // and add our own Cache-Control.
    const headers = new Headers();
    const ct = upstream.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    const cl = upstream.headers.get("Content-Length");
    if (cl) headers.set("Content-Length", cl);
    const cr = upstream.headers.get("Content-Range");
    if (cr) headers.set("Content-Range", cr);
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("Accept-Ranges", "bytes");

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (err: any) {
    console.error("[audio proxy] error:", err);
    return new NextResponse("Error fetching audio", { status: 502 });
  }
}
