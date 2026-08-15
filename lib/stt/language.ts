export const SUPPORTED_LANGUAGES = [
  "en", "fil", "ceb", "es", "fr", "de", "it", "pt", "ja", "ko", "zh",
  "ru", "ar", "hi", "id", "ms", "th", "vi",
] as const;

export function languageToLocale(code: string | null): string {
  if (!code) return "en-US";
  const c = code.toLowerCase();
  if (c === "en") return "en-US";
  if (c === "fil" || c === "tl") return "fil-PH";
  if (c === "ceb") return "ceb-PH";
  return `${c}-${c.toUpperCase()}`;
}