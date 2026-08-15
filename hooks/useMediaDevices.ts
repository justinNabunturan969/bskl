"use client";

import { useCallback, useEffect, useState } from "react";

export type MediaPermission = "granted" | "denied" | "prompt";

interface UseMediaDevicesResult {
  devices: MediaDeviceInfo[];
  permission: MediaPermission;
  requestPermission: () => Promise<MediaPermission>;
}

function hasMediaDevicesApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.enumerateDevices === "function"
  );
}

async function readPermissionState(): Promise<MediaPermission> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "prompt";
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
  } catch {
    // Some browsers reject "microphone" as a permission name — fall through.
  }
  return "prompt";
}

function inferPermissionFromDevices(devices: MediaDeviceInfo[]): MediaPermission {
  // Labels are only populated when the user has granted mic access at least once.
  const inputs = devices.filter((d) => d.kind === "audioinput");
  if (inputs.length === 0) return "prompt";
  return inputs.some((d) => d.label.length > 0) ? "granted" : "prompt";
}

export function useMediaDevices(): UseMediaDevicesResult {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permission, setPermission] = useState<MediaPermission>("prompt");

  const refresh = useCallback(async () => {
    if (!hasMediaDevicesApi()) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list);

      // Don't override an explicit "denied" — the user has blocked us, and re-querying
      // would just flicker the state.
      setPermission((prev) => {
        if (prev === "denied") return prev;
        // Initial best-effort: if any input has a label, treat as granted; else prompt.
        return inferPermissionFromDevices(list);
      });

      const explicit = await readPermissionState();
      if (explicit === "denied") setPermission("denied");
      else if (explicit === "granted") setPermission("granted");
    } catch {
      // enumerateDevices shouldn't really throw — leave state alone.
    }
  }, []);

  useEffect(() => {
    if (!hasMediaDevicesApi()) return;

    refresh();

    const handleChange = () => {
      refresh();
    };
    navigator.mediaDevices.addEventListener("devicechange", handleChange);

    let permissionStatus: PermissionStatus | null = null;
    let handlePermissionChange: (() => void) | null = null;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          permissionStatus = status;
          setPermission(status.state as MediaPermission);
          handlePermissionChange = () => setPermission(status.state as MediaPermission);
          status.addEventListener("change", handlePermissionChange);
        })
        .catch(() => {
          // Permission API not supported for microphone; infer from labels.
        });
    }

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleChange);
      if (permissionStatus && handlePermissionChange) {
        permissionStatus.removeEventListener("change", handlePermissionChange);
      }
    };
  }, [refresh]);

  const requestPermission = useCallback(async (): Promise<MediaPermission> => {
    if (!hasMediaDevicesApi() || !navigator.mediaDevices.getUserMedia) {
      return "denied";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We just needed the grant — release the tracks immediately.
      stream.getTracks().forEach((track) => track.stop());
      setPermission("granted");
      refresh();
      return "granted";
    } catch {
      setPermission("denied");
      return "denied";
    }
  }, [refresh]);

  return { devices, permission, requestPermission };
}
