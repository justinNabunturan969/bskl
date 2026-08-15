"use client";

import { useState, useMemo } from "react";
import { Mic, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { toast } from "sonner";

interface Props {
  value: string | null;
  onChange: (id: string) => void;
}

export function DeviceSelector({ value, onChange }: Props) {
  const { devices, permission, requestPermission } = useMediaDevices();
  const [requested, setRequested] = useState(false);

  // Only audio inputs, deduped by deviceId (browsers sometimes repeat the same id).
  const uniqueDevices = useMemo(() => {
    const inputs = devices.filter((d) => d.kind === "audioinput");
    const seen = new Set<string>();
    const out: typeof inputs = [];
    for (const d of inputs) {
      // Use a stable synthetic key when deviceId is empty (permission not granted yet)
      const key = d.deviceId || `__no_id_${d.label || "mic"}_${out.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
    return out;
  }, [devices]);

  function handleChange(id: string | null) {
    if (!id) return;
    if (!requested && permission !== "granted") {
      requestPermission().then((result) => {
        setRequested(true);
        if (result !== "granted") {
          toast.error("Microphone permission required to use a device");
          return;
        }
        onChange(id);
      });
    } else {
      onChange(id);
    }
  }

  if (permission === "denied") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Microphone access blocked</p>
          <p className="text-muted-foreground text-xs">Enable microphone permission in your browser settings to record.</p>
        </div>
      </div>
    );
  }

  // Build the items as a single array with unique keys/values — no "default" sentinel anywhere.
  const items = uniqueDevices.length === 0
    ? [{ key: "__no_devices__", value: "__no_devices__", label: "No devices detected", disabled: true }]
    : uniqueDevices.map((d, i) => ({
        key: d.deviceId || `__mic_${i}`,
        value: d.deviceId || `__mic_${i}`,
        label: d.label || `Microphone ${i + 1}`,
        disabled: false,
      }));

  return (
    <div className="flex items-center gap-2">
      <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={value ?? ""} onValueChange={handleChange}>
        <SelectTrigger className="flex-1" aria-label="Select microphone">
          <SelectValue placeholder="Select microphone" />
        </SelectTrigger>
        <SelectContent>
          {items.map((it) => (
            <SelectItem key={it.key} value={it.value} disabled={it.disabled}>
              {it.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}