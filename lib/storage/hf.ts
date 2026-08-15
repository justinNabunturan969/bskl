import { uploadFile, downloadFile } from "@huggingface/hub";

const HF_TOKEN = process.env.HF_API_KEY;
const HF_USERNAME = process.env.HF_USERNAME;
const HF_DATASET = process.env.HF_DATASET ?? `${HF_USERNAME}/bskl-audio-storage`;

if (!HF_TOKEN) console.warn("[storage/hf] HF_API_KEY is not set");
if (!HF_USERNAME) console.warn("[storage/hf] HF_USERNAME is not set");

function getRepo() {
  return { type: "dataset" as const, name: HF_DATASET! };
}

function getCredentials() {
  if (!HF_TOKEN) throw new Error("Hugging Face credentials are not configured");
  return { accessToken: HF_TOKEN };
}

function guessExtension(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  return "bin";
}

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "bin";
  switch (ext) {
    case "webm":
      return "audio/webm";
    case "mp4":
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}

export interface UploadResult {
  path: string;
  size: number;
}

/**
 * Upload an audio blob to the Hugging Face dataset.
 * Path convention: {userId}/{recordingId}.{ext}
 */
export async function uploadAudio(
  userId: string,
  recordingId: string,
  blob: Blob
): Promise<UploadResult> {
  const ext = guessExtension(blob.type);
  const path = `${userId}/${recordingId}.${ext}`;

  await uploadFile({
    repo: getRepo(),
    file: { path, content: blob },
    credentials: getCredentials(),
  });

  return { path, size: blob.size };
}

/**
 * Download an audio file as a Blob. Used by the STT server action which
 * then uploads the bytes to Groq Whisper.
 */
export async function fetchAudioBlob(path: string): Promise<Blob> {
  const result = await downloadFile({
    repo: getRepo(),
    path,
    credentials: getCredentials(),
  });
  if (!result) throw new Error(`File not found in HF: ${path}`);
  if (result instanceof Response) {
    return await result.blob();
  }
  return result as Blob;
}

/**
 * Download an audio file and return it as a streaming Response with proper
 * Content-Type, Content-Length, and Cache-Control headers. Used by the
 * /api/audio/[id] proxy route so the browser can play it.
 */
export async function fetchAudio(path: string): Promise<Response> {
  const result = await downloadFile({
    repo: getRepo(),
    path,
    credentials: getCredentials(),
  });

  if (!result) throw new Error(`File not found in HF: ${path}`);

  // Some versions of @huggingface/hub return a Response with full headers
  // (including Content-Range for seekable playback). Pass it through.
  if (result instanceof Response) {
    return result;
  }

  // Otherwise we got a raw Blob — wrap it in a Response with sensible headers.
  const blob = result as Blob;
  return new Response(blob, {
    headers: {
      "Content-Type": contentTypeFor(path),
      "Content-Length": blob.size.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
