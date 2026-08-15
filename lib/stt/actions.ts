"use server";

import { revalidatePath } from "next/cache";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { transcribeWithGroq, type TranscriptionResult } from "@/lib/stt/groq";
import { fetchAudioBlob } from "@/lib/storage/hf";
import { getClientId } from "@/lib/audio/client-id";

export interface TranscribeAndSaveResult {
  transcriptId: string;
  text: string;
  language: string | null;
  duration: number | null;
  segmentCount: number;
}

export interface TranscribeInput {
  recordingId: string;
}

/**
 * Server action: transcribe an existing recording (audio_url) with Groq Whisper
 * and save the transcript to Supabase. The audio lives in Hugging Face.
 */
export async function transcribeRecording(
  input: TranscribeInput
): Promise<TranscribeAndSaveResult> {
  const { supabase, user } = await ensureUser();

  // 1. Get the recording to verify ownership and grab the audio URL
  const { data: recording, error: rErr } = await supabase
    .from("recordings")
    .select("id, audio_url")
    .eq("id", input.recordingId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (rErr || !recording) {
    throw new Error("Recording not found");
  }
  if (!recording.audio_url) {
    throw new Error("Recording has no audio file");
  }

  // 2. Download audio from Hugging Face (server-to-server)
  const audioBlob = await fetchAudioBlob(recording.audio_url);

  // 3. Send to Groq Whisper
  const ext = recording.audio_url.split(".").pop() || "webm";
  const result: TranscriptionResult = await transcribeWithGroq(
    audioBlob,
    `audio.${ext}`
  );

  // 4. Upsert transcript
  const now = new Date().toISOString();
  const transcriptRow = {
    recording_id: recording.id,
    user_id: user.id,
    full_text: result.text,
    language: result.language,
    segments: result.segments,
    speaker_count: 0,
    provider: "groq-whisper" as const,
    client_id: getClientId(),
    last_modified_client: now,
  };

  const { data: existing } = await supabase
    .from("transcripts")
    .select("id")
    .eq("recording_id", recording.id)
    .is("deleted_at", null)
    .maybeSingle();

  let transcriptId: string;

  if (existing) {
    const { error: uErr } = await supabase
      .from("transcripts")
      .update(transcriptRow)
      .eq("id", existing.id);
    if (uErr) throw new Error(uErr.message);
    transcriptId = existing.id;
  } else {
    const { data: inserted, error: iErr } = await supabase
      .from("transcripts")
      .insert(transcriptRow)
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);
    transcriptId = inserted.id;
  }

  // 5. Update recording status to "ready" (transcription done)
  await supabase
    .from("recordings")
    .update({ status: "ready", last_modified_client: now })
    .eq("id", recording.id);

  revalidatePath(`/notes/${recording.id}`);

  return {
    transcriptId,
    text: result.text,
    language: result.language,
    duration: result.duration,
    segmentCount: result.segments.length,
  };
}
