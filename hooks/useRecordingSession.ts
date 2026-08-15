"use client";

import { useCallback, useState } from "react";

export interface Clip {
  id: string;
  type: "recording" | "upload";
  blob: Blob;
  url: string;
  duration: number;
  mimeType: string;
  createdAt: number;
}

export function useRecordingSession() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const addClip = useCallback((clip: Omit<Clip, "id" | "createdAt">) => {
    const newClip: Clip = {
      ...clip,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setClips((prev) => [...prev, newClip]);
    setActiveClipId(newClip.id);
    return newClip;
  }, []);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const next = prev.filter((c) => c.id !== id);
      if (activeClipId === id) {
        setActiveClipId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  }, [activeClipId]);

  const setActive = useCallback((id: string) => {
    setActiveClipId(id);
  }, []);

  const clear = useCallback(() => {
    clips.forEach((c) => URL.revokeObjectURL(c.url));
    setClips([]);
    setActiveClipId(null);
  }, [clips]);

  const activeClip = clips.find((c) => c.id === activeClipId) ?? null;

  return { clips, activeClip, activeClipId, addClip, removeClip, setActive, clear };
}