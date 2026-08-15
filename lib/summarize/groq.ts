import Groq from "groq-sdk";
import type { SummaryFormat } from "./types";
import { SYSTEM_PROMPTS } from "./prompts";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn("[summarize/groq] GROQ_API_KEY is not set");
}

export const groq = new Groq({ apiKey: GROQ_API_KEY });

const MODEL = process.env.GROQ_SUMMARY_MODEL || "llama-3.1-8b-instant";

export interface SummarizeParams {
  transcript: string;
  format: SummaryFormat;
  language?: string | null;
}

export interface SummarizeResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export async function summarizeWithGroq({
  transcript,
  format,
  language,
}: SummarizeParams): Promise<SummarizeResult> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  if (!transcript.trim()) {
    throw new Error("Transcript is empty");
  }

  const system = SYSTEM_PROMPTS[format];

  // Cap transcript to avoid hitting token limits on the free tier.
  // llama-3.1-8b-instant context = 128k, but we want to leave room for output.
  const MAX_CHARS = 60_000;
  const trimmed =
    transcript.length > MAX_CHARS
      ? transcript.slice(0, MAX_CHARS) + "\n\n[transcript truncated]"
      : transcript;

  const userPrompt = language
    ? `Transcript language: ${language}\n\n---\n\n${trimmed}`
    : trimmed;

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3, // focused, less hallucination
    max_tokens: 1500,
  });

  const choice = completion.choices[0];
  const content = (choice?.message?.content || "").trim();

  if (!content) {
    throw new Error("Groq returned an empty summary");
  }

  return {
    content,
    model: completion.model,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
}