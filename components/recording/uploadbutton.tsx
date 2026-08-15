"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPT = "audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm,.mp4,audio/webm,audio/mpeg,audio/wav,audio/m4a";

export function UploadButton({ onFile, disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File too large (max 500 MB).");
      e.target.value = "";
      return;
    }
    onFile(file);
    e.target.value = "";
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        onChange={handleSelect}
        className="sr-only"
        aria-label="Upload audio file"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="w-full"
      >
        <Upload className="h-4 w-4" />
        Upload audio
      </Button>
    </>
  );
}
