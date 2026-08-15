"use server";

import { revalidatePath } from "next/cache";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { uploadAudio } from "@/lib/storage/hf";
import { getClientId, getDeviceName } from "@/lib/audio/client-id";

export interface SaveAudioResult {
  id: string;
  path: string;
}

/**
 * Server action: upload audio to Hugging Face, then create the recordings row in Supabase.
 * Uses ensureUser() so it always has a valid session (anonymous sign-in if needed).
 */
export async function saveAudioRecording(formData: FormData): Promise<SaveAudioResult> {
  const { supabase, user } = await ensureUser();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("No audio file provided");
  }

  const duration = parseFloat((formData.get("duration") as string) || "0");
  const title = (formData.get("title") as string) || "";
  const context = ((formData.get("context") as string) || "lecture") as
    | "lecture"
    | "meeting"
    | "other";
  const enableDiarization = formData.get("enable_diarization") === "true";

  // 1. Upload to Hugging Face
  const recordingId = crypto.randomUUID();
  const { path, size } = await uploadAudio(user.id, recordingId, file);

  // 2. Insert row in Supabase
  const now = new Date().toISOString();
  const format = file.type.split("/")[1] || "webm";
  const { error } = await supabase.from("recordings").insert({
    id: recordingId,
    user_id: user.id,
    title: title || `Recording — ${new Date().toLocaleString()}`,
    audio_url: path,
    duration_seconds: duration,
    file_size_bytes: size,
    format,
    context,
    enable_diarization: enableDiarization,
    enable_live_transcription: true,
    status: "ready",
    device_name: getDeviceName(),
    client_id: getClientId(),
    last_modified_client: now,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  return { id: recordingId, path };
}
