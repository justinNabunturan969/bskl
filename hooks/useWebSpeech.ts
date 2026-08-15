"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface WebSpeechSegment {
  text: string;
  timestamp: number;
  isInterim: boolean;
  confidence: number;
}

export type WebSpeechState = "idle" | "starting" | "listening" | "stopping" | "error" | "unsupported";

interface SpeechRecognitionResultAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionResultAlternative;
  item(index: number): SpeechRecognitionResultAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
  item(index: number): SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface UseWebSpeechOptions {
  language?: string; // BCP-47, e.g. "en-US", "fil-PH"
  continuous?: boolean;
}

export function useWebSpeech(options: UseWebSpeechOptions = {}) {
  const { language = "en-US", continuous = true } = options;

  const [state, setState] = useState<WebSpeechState>("idle");
  const [interimText, setInterimText] = useState("");
  const [finalSegments, setFinalSegments] = useState<WebSpeechSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setState("unsupported");
    }
  }, []);

  const start = useCallback(
    (lang?: string) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError("Web Speech API not supported in this browser. Use Chrome or Edge.");
        setState("unsupported");
        return;
      }
      if (state === "listening" || state === "starting") return;

      try {
        setError(null);
        setInterimText("");
        setState("starting");
        const rec = new Ctor();
        rec.lang = lang || language;
        rec.continuous = continuous;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          startedAtRef.current = Date.now();
          setState("listening");
        };

        rec.onresult = (event) => {
          let interim = "";
          const newFinals: WebSpeechSegment[] = [];
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const alt = result[0];
            const text = alt.transcript;
            if (result.isFinal) {
              newFinals.push({
                text: text.trim(),
                timestamp: Date.now() - startedAtRef.current,
                isInterim: false,
                confidence: alt.confidence,
              });
            } else {
              interim += text;
            }
          }
          if (newFinals.length) {
            setFinalSegments((prev) => [...prev, ...newFinals]);
          }
          setInterimText(interim);
        };

        rec.onerror = (event) => {
          setError(`Speech recognition error: ${event.error}`);
          setState("error");
        };

        rec.onend = () => {
          setState((prev) => (prev === "stopping" ? "idle" : prev));
          setInterimText("");
        };

        recognitionRef.current = rec;
        rec.start();
        setDetectedLanguage(rec.lang);
      } catch (err: any) {
        setError(err?.message || "Failed to start speech recognition");
        setState("error");
      }
    },
    [language, continuous, state]
  );

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    setState("stopping");
    try {
      rec.stop();
    } catch {
      // already stopped
    }
    recognitionRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setFinalSegments([]);
    setInterimText("");
    setError(null);
    setState("idle");
  }, []);

  const fullText = [
    ...finalSegments.map((s) => s.text),
    interimText.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    state,
    interimText,
    finalSegments,
    fullText,
    error,
    detectedLanguage,
    start,
    stop,
    reset,
  };
}
