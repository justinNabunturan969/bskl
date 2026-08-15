"use server";

import { ensureUser } from "./ensure-user";

/** Ensures an anonymous Supabase session exists. Safe to call from the client on mount. */
export async function bootstrapSession(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await ensureUser();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Session bootstrap failed" };
  }
}
