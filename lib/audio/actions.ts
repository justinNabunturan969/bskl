"use server";

import { revalidatePath } from "next/cache";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { getClientId, getDeviceName } from "@/lib/audio/client-id";

export interface CreateRecordingInput {
  audio_url: string;
  duration_seconds: number;
  file_size_bytes: number;
  format: string;
  title?: string;
  context?: "lecture" | "meeting" | "other";
  enable_diarization?: boolean;
  enable_live_transcription?: boolean;
}

/**
 * Legacy server action used by the older client→HF→Supabase-Storage flow.
 * Prefer `saveAudioRecording` in `lib/storage/actions.ts` which does the
 * server-side upload directly. Kept here for backwards compatibility.
 */
export async function createRecording(input: CreateRecordingInput) {
  const { supabase, user } = await ensureUser();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("recordings")
    .insert({
      user_id: user.id,
      title: input.title || `Recording — ${new Date().toLocaleString()}`,
      audio_url: input.audio_url,
      duration_seconds: input.duration_seconds,
      file_size_bytes: input.file_size_bytes,
      format: input.format,
      context: input.context ?? "lecture",
      enable_diarization: input.enable_diarization ?? false,
      enable_live_transcription: input.enable_live_transcription ?? true,
      status: "ready",
      device_name: getDeviceName(),
      client_id: getClientId(),
      last_modified_client: now,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  return data.id;
}
