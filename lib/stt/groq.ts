import Groq from "groq-sdk";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn("[stt/groq] GROQ_API_KEY is not set");
}

export const groq = new Groq({ apiKey: GROQ_API_KEY });

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  is_final?: boolean;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  language: string | null;
  duration: number | null;
  segments: TranscriptSegment[];
}

const MODEL = "whisper-large-v3";

export async function transcribeWithGroq(
  blob: Blob,
  filename = "audio.webm"
): Promise<TranscriptionResult> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const file = new File([await blob.arrayBuffer()], filename, { type: blob.type || "audio/webm" });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: MODEL,
    response_format: "verbose_json",
  });

  const rawSegments = (transcription as any).segments || [];
  const segments: TranscriptSegment[] = rawSegments.map((s: any) => ({
    start: s.start ?? 0,
    end: s.end ?? 0,
    text: (s.text ?? "").trim(),
    is_final: true,
  }));

  const detected = (transcription as any).language ?? null;
  const text = (transcription.text ?? "").trim();
  const duration = (transcription as any).duration ?? null;

  return { text, language: detected, duration, segments };
}