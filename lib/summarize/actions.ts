"use server";

import { revalidatePath } from "next/cache";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { getClientId } from "@/lib/audio/client-id";
import { summarizeWithGroq } from "./groq";
import { summaryContentFromString, type SummaryFormat } from "./types";

export type GenerateSummaryResult =
  | { ok: true; versionId: string }
  | { ok: false; error: string };

export async function generateSummary(input: {
  recordingId: string;
  format: SummaryFormat;
}): Promise<GenerateSummaryResult> {
  const { supabase, user } = await ensureUser();

  // Load the latest transcript for this recording
  const { data: transcript, error: tErr } = await supabase
    .from("transcripts")
    .select("id, full_text, language")
    .eq("recording_id", input.recordingId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tErr) return { ok: false, error: tErr.message };
  if (!transcript?.full_text) {
    return {
      ok: false,
      error: "No transcript yet. Wait for transcription to finish.",
    };
  }

  let result;
  try {
    result = await summarizeWithGroq({
      transcript: transcript.full_text,
      format: input.format,
      language: transcript.language,
    });
  } catch (err: any) {
    return { ok: false, error: err?.message || "Summarization failed" };
  }

  const now = new Date().toISOString();
  const content = summaryContentFromString(result.content);

  const { data: latest } = await supabase
    .from("summary_versions")
    .select("version_number")
    .eq("recording_id", input.recordingId)
    .eq("format", input.format)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = (latest?.version_number ?? 0) + 1;

  await supabase
    .from("summary_versions")
    .update({ is_current: false })
    .eq("recording_id", input.recordingId)
    .eq("format", input.format);

  const { data: version, error: vErr } = await supabase
    .from("summary_versions")
    .insert({
      recording_id: input.recordingId,
      user_id: user.id,
      format: input.format,
      content,
      version_number: versionNumber,
      source: "ai",
      is_current: true,
      client_id: getClientId(),
      last_modified_client: now,
    })
    .select("id")
    .single();

  if (vErr || !version) {
    return { ok: false, error: vErr?.message || "Failed to save summary" };
  }

  const { data: existingDraft } = await supabase
    .from("summary_drafts")
    .select("id")
    .eq("recording_id", input.recordingId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingDraft) {
    const { error: dErr } = await supabase
      .from("summary_drafts")
      .update({
        format: input.format,
        content,
        based_on_version_id: version.id,
        status: "pending",
      })
      .eq("id", existingDraft.id);
    if (dErr) return { ok: false, error: dErr.message };
  } else {
    const { error: dErr } = await supabase.from("summary_drafts").insert({
      recording_id: input.recordingId,
      user_id: user.id,
      format: input.format,
      content,
      based_on_version_id: version.id,
      status: "pending",
    });
    if (dErr) return { ok: false, error: dErr.message };
  }

  revalidatePath(`/notes/${input.recordingId}`);
  return { ok: true, versionId: version.id };
}

export type AcceptVersionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function acceptVersion(input: {
  recordingId: string;
  versionId: string;
}): Promise<AcceptVersionResult> {
  const { supabase, user } = await ensureUser();

  const { data: version, error: vErr } = await supabase
    .from("summary_versions")
    .select("id, format, content")
    .eq("id", input.versionId)
    .eq("recording_id", input.recordingId)
    .maybeSingle();

  if (vErr) return { ok: false, error: vErr.message };
  if (!version) return { ok: false, error: "Version not found" };

  const now = new Date().toISOString();

  await supabase
    .from("summary_versions")
    .update({ is_current: false })
    .eq("recording_id", input.recordingId)
    .eq("format", version.format);

  const { error: currentErr } = await supabase
    .from("summary_versions")
    .update({ is_current: true, last_modified_client: now })
    .eq("id", input.versionId);

  if (currentErr) return { ok: false, error: currentErr.message };

  const { data: existingDraft } = await supabase
    .from("summary_drafts")
    .select("id")
    .eq("recording_id", input.recordingId)
    .maybeSingle();

  if (existingDraft) {
    const { error: uErr } = await supabase
      .from("summary_drafts")
      .update({
        format: version.format,
        content: version.content,
        based_on_version_id: input.versionId,
        status: "accepted",
      })
      .eq("id", existingDraft.id);
    if (uErr) return { ok: false, error: uErr.message };
  } else {
    const { error: iErr } = await supabase.from("summary_drafts").insert({
      recording_id: input.recordingId,
      user_id: user.id,
      format: version.format,
      content: version.content,
      based_on_version_id: input.versionId,
      status: "accepted",
    });
    if (iErr) return { ok: false, error: iErr.message };
  }

  revalidatePath(`/notes/${input.recordingId}`);
  return { ok: true };
}
