export type SummaryFormat = "outline" | "bullets" | "paragraph";

export const SUMMARY_FORMATS: SummaryFormat[] = [
  "outline",
  "bullets",
  "paragraph",
];

export const SUMMARY_FORMAT_LABELS: Record<SummaryFormat, string> = {
  outline: "Outline",
  bullets: "Bullet list",
  paragraph: "Paragraph",
};

export interface SummaryVersion {
  id: string;
  recording_id: string;
  format: SummaryFormat;
  content: string;
  created_at: string;
  is_current?: boolean;
}

export interface SummaryDraft {
  id: string;
  recording_id: string;
  based_on_version_id: string | null;
  format: SummaryFormat;
  content: unknown;
  status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string;
}

/** Normalize summary content stored as jsonb in Supabase. */
export function summaryContentToString(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object" && content !== null && "text" in content) {
    const text = (content as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }
  return "";
}

export function summaryContentFromString(text: string): { text: string } {
  return { text };
}