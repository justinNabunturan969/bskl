import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as https from "node:https";
import { URL } from "node:url";
import type { User } from "@supabase/supabase-js";
import { nodeHttpsFetch } from "./fetch";

export interface SessionContext {
  supabase: ReturnType<typeof createServerClient>;
  user: User;
  /** True if this request was the one that bootstrapped the anonymous session. */
  freshlySignedIn: boolean;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[ensureUser] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing"
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid URL)";
  }
}

function isClientError(status: number | undefined): boolean {
  return typeof status === "number" && status >= 400 && status < 500;
}

/**
 * Direct HTTPS request that bypasses the global `fetch` (undici) entirely.
 * We've observed `fetch` failing in Next.js dev with Turbopack on Windows
 * ("TypeError: fetch failed") while `node:https` works fine. This is the
 * same approach the @huggingface/hub library uses, which is why the
 * audio upload succeeds but the Supabase sign-in doesn't.
 */
function httpsRequest(
  fullUrl: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(fullUrl);
    } catch (e: any) {
      reject(new Error(`Invalid URL: ${fullUrl} (${e.message})`));
      return;
    }
    if (url.protocol !== "https:") {
      reject(new Error(`httpsRequest only supports https://, got ${url.protocol}`));
      return;
    }

    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: options.method ?? "GET",
        headers: options.headers ?? {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: data });
        });
        res.on("error", reject);
      }
    );

    req.on("error", (err) => reject(err));
    req.setTimeout(15000, () => {
      req.destroy(new Error("httpsRequest timed out after 15s"));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

interface SupabaseAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: User;
}

async function signInAnonymouslyViaHttps(attempt: number): Promise<SupabaseAuthResponse> {
  const fullUrl = `${SUPABASE_URL}/auth/v1/signup?`;
  console.log(
    `[ensureUser] direct signin attempt ${attempt} → ${fullUrl}`
  );

  const res = await httpsRequest(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: "{}",
  });

  if (res.status !== 200) {
    throw new Error(
      `Direct sign-in HTTP ${res.status}: ${res.body.slice(0, 200)}`
    );
  }

  const data = JSON.parse(res.body);
  if (!data?.access_token || !data?.user) {
    throw new Error("Direct sign-in returned no access_token or user");
  }
  return data;
}

export async function ensureUser(): Promise<SessionContext> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env vars are not set. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and restart the dev server."
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — silently ignore.
        }
      },
    },
    global: {
      // Use node:https instead of the global fetch — bypasses the AV's
      // HTTPS interception that's mangling POSTs to Supabase.
      fetch: nodeHttpsFetch,
    },
  });

  // 1. Try existing session
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      return { supabase, user: data.user, freshlySignedIn: false };
    }
  } catch (err: any) {
    console.warn(
      "[ensureUser] getUser() via supabase-js failed:",
      err?.message ?? err
    );
  }

  // 2. No session — try supabase-js first (uses nodeHttpsFetch), then raw https.
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data.user) {
      return { supabase, user: data.user, freshlySignedIn: true };
    }
    if (error) {
      console.warn("[ensureUser] signInAnonymously() failed:", error.message);
    }
  } catch (err: any) {
    console.warn("[ensureUser] signInAnonymously() threw:", err?.message ?? err);
  }

  const MAX_ATTEMPTS = 3;
  let lastErr: any = null;
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await signInAnonymouslyViaHttps(attempt);
      console.log(
        `[ensureUser] ✓ direct signin succeeded on attempt ${attempt} ` +
          `(user_id=${result.user.id.slice(0, 8)}…, expires_in=${result.expires_in}s)`
      );

      // Persist via @supabase/ssr so getUser() can read the session on later requests.
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });

      if (sessionErr || !sessionData.user) {
        throw new Error(sessionErr?.message ?? "setSession failed after direct sign-in");
      }

      return {
        supabase,
        user: sessionData.user,
        freshlySignedIn: true,
      };
    } catch (err: any) {
      lastErr = err;
      // Try to surface the HTTP status if it's our own Error message
      const m = /HTTP (\d{3})/.exec(err?.message ?? "");
      if (m) lastStatus = parseInt(m[1], 10);
      console.error(
        `[ensureUser] ✗ direct signin attempt ${attempt} failed:`,
        err?.message ?? err
      );
      // Log the full error (including any non-enumerable properties)
      try {
        console.error(
          `[ensureUser]   full error: ${JSON.stringify(
            err,
            Object.getOwnPropertyNames(err),
            2
          )}`
        );
      } catch {
        // ignore JSON.stringify errors
      }

      if (isClientError(lastStatus)) break; // 4xx — no point retrying
      if (attempt < MAX_ATTEMPTS) {
        await sleep(200 * Math.pow(4, attempt - 1)); // 200ms, 800ms
      }
    }
  }

  throw new Error(
    `Could not establish a session after ${MAX_ATTEMPTS} attempts: ` +
      (lastErr?.message ?? "unknown error") +
      ` (url host: ${safeHost(SUPABASE_URL)})`
  );
}
