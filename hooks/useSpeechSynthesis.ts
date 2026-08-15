"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TtsState = "idle" | "speaking" | "paused" | "unsupported";

export interface UseSpeechSynthesisOptions {
  /** BCP-47 language tag, e.g. "en-US", "fil-PH". Used to pick a default voice. */
  language?: string | null;
}

export interface UseSpeechSynthesisResult {
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  state: TtsState;
  currentChunk: number;
  totalChunks: number;
  voiceURI: string | null;
  setVoiceURI: (uri: string) => void;
  rate: number;
  setRate: (r: number) => void;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/** Split text into ≤maxChar chunks, preferring sentence boundaries. */
function chunkText(text: string, maxChar = 250): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChar) return [cleaned];

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    if (sentence.length > maxChar) {
      flush();
      // hard-split long sentence by words
      const words = sentence.split(/\s+/);
      for (const w of words) {
        if ((buf + " " + w).trim().length > maxChar) flush();
        buf = buf ? buf + " " + w : w;
      }
    } else if ((buf + " " + sentence).trim().length > maxChar) {
      flush();
      buf = sentence;
    } else {
      buf = buf ? buf + " " + sentence : sentence;
    }
  }
  flush();
  return chunks;
}

/** Pick the best voice for a given language tag from the available list. */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  language: string | null | undefined,
  preferredURI: string | null
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  if (!language) return voices.find((v) => v.default) ?? voices[0] ?? null;

  const exact = voices.find((v) => v.lang.toLowerCase() === language.toLowerCase());
  if (exact) return exact;
  const base = language.split("-")[0].toLowerCase();
  const partial = voices.find((v) => v.lang.toLowerCase().startsWith(base + "-"));
  if (partial) return partial;
  return voices.find((v) => v.default) ?? voices[0] ?? null;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisResult {
  const { language = "en-US" } = options;

  const [supported, setSupported] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [state, setState] = useState<TtsState>("idle");
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [rate, setRate] = useState(1);

  // Use refs so the speak loop always sees the latest values without re-binding.
  const voiceURIRef = useRef(voiceURI);
  const rateRef = useRef(rate);
  const languageRef = useRef(language);
  useEffect(() => {
    voiceURIRef.current = voiceURI;
  }, [voiceURI]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Detect support + load voices (async on Chrome/Edge)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      setState("unsupported");
      return;
    }
    const synth = window.speechSynthesis;

    const load = () => {
      const v = synth.getVoices();
      if (v.length) setVoices(v);
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
    };
  }, []);

  // Strip markdown-ish markers so TTS doesn't read them out loud
  const stripMarkdown = (s: string) =>
    s
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/^\s*-\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .trim();

  const chunksRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      const plain = stripMarkdown(text);
      const chunks = chunkText(plain);
      if (chunks.length === 0) return;

      chunksRef.current = chunks;
      indexRef.current = 0;
      setTotalChunks(chunks.length);
      setCurrentChunk(0);

      const voice = pickVoice(voices, languageRef.current, voiceURIRef.current);

      const speakNext = () => {
        const i = indexRef.current;
        if (i >= chunksRef.current.length) {
          setState("idle");
          setCurrentChunk(0);
          return;
        }
        const utt = new SpeechSynthesisUtterance(chunksRef.current[i]);
        if (voice) utt.voice = voice;
        utt.rate = rateRef.current;
        utt.pitch = 1;
        utt.onstart = () => {
          setState("speaking");
          setCurrentChunk(i + 1);
        };
        utt.onend = () => {
          indexRef.current = i + 1;
          speakNext();
        };
        utt.onerror = () => {
          // Don't crash on a single bad chunk — try the next one
          indexRef.current = i + 1;
          speakNext();
        };
        synth.speak(utt);
      };
      speakNext();
    },
    [supported, voices]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    if (state === "speaking") {
      window.speechSynthesis.pause();
      setState("paused");
    }
  }, [supported, state]);

  const resume = useCallback(() => {
    if (!supported) return;
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("speaking");
    }
  }, [supported, state]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    indexRef.current = chunksRef.current.length; // halt the queue
    setState("idle");
    setCurrentChunk(0);
  }, [supported]);

  return {
    supported,
    voices,
    state,
    currentChunk,
    totalChunks,
    voiceURI,
    setVoiceURI,
    rate,
    setRate,
    speak,
    pause,
    resume,
    stop,
  };
}