"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, FileText, Mic } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useRecorder } from "@/hooks/useRecorder";
import { usePlayback } from "@/hooks/usePlayback";
import { useRecordingSession } from "@/hooks/useRecordingSession";
import { useWebSpeech } from "@/hooks/useWebSpeech";
import { mimeToExtension } from "@/lib/audio/format";
import { saveAudioRecording } from "@/lib/storage/actions";
import { languageToLocale } from "@/lib/stt/language";

import { TranscriptView } from "@/components/transcript/TranscriptView";

import { WaveformVisualizer } from "./waveformVisualizer";
import { RecordingControls } from "./recordingControls";
import { PlaybackControls } from "./playbackControls";
import { ClipList } from "./ClipList";
import { DeviceSelector } from "./deviceSelector";
import { UploadButton } from "./uploadbutton";
import { ErrorBanner } from "./errorbanner";

export function RecordingPanel() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState<"lecture" | "meeting" | "other">("lecture");
  const [enableDiarization, setEnableDiarization] = useState(false);
  const [saving, setSaving] = useState(false);
  const liveAnalyserRef = useRef<AnalyserNode | null>(null);

  const recorder = useRecorder({ deviceId: deviceId ?? undefined });
  const session = useRecordingSession();
  const playback = usePlayback(session.activeClip?.blob ?? null);
  const speech = useWebSpeech({ language: languageToLocale("en") });

  // Keep analyser ref in sync
  useEffect(() => {
    liveAnalyserRef.current = recorder.analyser ?? null;
  }, [recorder.analyser]);

  // Start/stop live transcription when recording starts/stops
  useEffect(() => {
    if (recorder.state === "recording") {
      if (speech.state === "idle" || speech.state === "error") {
        speech.start();
      }
    } else if (recorder.state === "idle" || recorder.state === "stopped" || recorder.state === "error") {
      if (speech.state === "listening" || speech.state === "starting") {
        speech.stop();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.state]);

  // When recording stops, finalize the clip
  async function handleStop() {
    const blob = await recorder.stop();
    speech.stop();
    if (blob) {
      session.addClip({
        type: "recording",
        blob,
        url: URL.createObjectURL(blob),
        duration: recorder.duration,
        mimeType: recorder.mimeType,
      });
    }
  }

  // When user uploads a file
  async function handleUpload(file: File) {
    try {
      // Probe duration by loading into an audio element
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("Could not read audio file")), { once: true });
      });
      const duration = isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);

      session.addClip({
        type: "upload",
        blob: file,
        url: URL.createObjectURL(file),
        duration,
        mimeType: file.type || "audio/webm",
      });
      toast.success(`Added: ${file.name}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not read audio file");
    }
  }

  // Save the active clip → upload to Hugging Face + create row in Supabase
  async function handleSave() {
    const clip = session.activeClip;
    if (!clip) {
      toast.error("No clip to save");
      return;
    }
    setSaving(true);
    try {
      const ext = mimeToExtension(clip.mimeType);
      const formData = new FormData();
      formData.append("file", clip.blob, `recording.${ext}`);
      formData.append("duration", clip.duration.toString());
      formData.append("title", title);
      formData.append("context", context);
      formData.append("enable_diarization", String(enableDiarization));

      const result = await saveAudioRecording(formData);

      toast.success("Recording saved!");
      session.clear();
      recorder.reset();
      setTitle("");
      router.push(`/notes/${result.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  const isRecording = recorder.state === "recording";
  const isPaused = recorder.state === "paused";
  const isLive = isRecording || isPaused;
  const totalDuration = session.clips.reduce((sum, c) => sum + c.duration, 0);

  return (
    <div className="space-y-4">
      {/* Title + context */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g. CS 101 Lecture — Sept 14"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLive}
              />
            </div>
            <div className="space-y-2">
              <Label>Context</Label>
              <div className="flex gap-1" role="radiogroup" aria-label="Recording context">
                {(["lecture", "meeting", "other"] as const).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant={context === c ? "default" : "outline"}
                    size="sm"
                    onClick={() => setContext(c)}
                    disabled={isLive}
                    role="radio"
                    aria-checked={context === c}
                    className="flex-1 capitalize"
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {context === "meeting" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enableDiarization}
                onChange={(e) => setEnableDiarization(e.target.checked)}
                disabled={isLive}
                className="h-4 w-4"
              />
              Identify speakers (uses free Hugging Face tier)
            </label>
          )}
        </CardContent>
      </Card>

      {/* Waveform + controls */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {recorder.error && (
            <ErrorBanner
              message={recorder.error}
              onRetry={() => {
                recorder.reset();
                recorder.start();
              }}
              onDismiss={() => recorder.reset()}
            />
          )}

          <div className="h-32 md:h-40 rounded-md bg-muted/30 p-2">
            <WaveformVisualizer
              buffer={isLive ? null : playback.buffer}
              analyser={isLive ? recorder.analyser : null}
              isLive={isLive}
              currentTime={playback.currentTime}
              duration={playback.duration}
              onSeek={playback.seek}
            />
          </div>

          {isLive ? (
            <RecordingControls
              state={recorder.state}
              duration={recorder.duration}
              onStart={recorder.start}
              onPause={recorder.pause}
              onResume={recorder.resume}
              onStop={handleStop}
            />
          ) : session.activeClip ? (
            <PlaybackControls
              isPlaying={playback.isPlaying}
              currentTime={playback.currentTime}
              duration={playback.duration}
              onPlay={playback.play}
              onPause={playback.pause}
              onSeek={playback.seek}
              onSkip={playback.skip}
            />
          ) : (
            <RecordingControls
              state={recorder.state}
              duration={recorder.duration}
              onStart={recorder.start}
              onPause={recorder.pause}
              onResume={recorder.resume}
              onStop={handleStop}
            />
          )}
        </CardContent>
      </Card>

      {/* Live transcript (only visible while recording or after stopping) */}
      {(isLive || speech.finalSegments.length > 0) && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Live transcript
                {speech.state === "listening" && (
                  <span className="inline-flex h-2 w-2 rounded-full bg-red-600 animate-pulse" aria-label="Listening" />
                )}
              </h3>
              {speech.state === "unsupported" && (
                <span className="text-xs text-muted-foreground">
                  Web Speech not supported — batch transcription will run on save
                </span>
              )}
            </div>
            <TranscriptView
              finalSegments={speech.finalSegments}
              interimText={speech.interimText}
              language={speech.detectedLanguage}
              isLive={isLive}
            />
          </CardContent>
        </Card>
      )}

      {/* Device + Upload (desktop sidebar) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <DeviceSelector value={deviceId} onChange={setDeviceId} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <UploadButton onFile={handleUpload} disabled={isLive} />
            <p className="text-xs text-muted-foreground mt-2">
              MP3, WAV, M4A, OGG, WebM, FLAC — up to 500 MB.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clips */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Clips in this session</h3>
              {session.clips.length > 0 && (
                <Badge variant="secondary">{session.clips.length}</Badge>
              )}
            </div>
            {totalDuration > 0 && (
              <span className="text-xs text-muted-foreground">
                Total: {Math.floor(totalDuration / 60)}m {Math.floor(totalDuration % 60)}s
              </span>
            )}
          </div>
          <Separator />
          <ClipList
            clips={session.clips}
            activeId={session.activeClipId}
            onSelect={session.setActive}
            onRemove={session.removeClip}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleSave} disabled={!session.activeClip || saving} size="lg" className="flex-1">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save & continue"}
        </Button>
      </div>
    </div>
  );
}