import { NextResponse } from "next/server";
import * as https from "node:https";
import { URL } from "node:url";

/**
 * GET /api/diag
 * Diagnostic endpoint. Uses BOTH `fetch` (undici) and `node:https` to call
 * Supabase so you can see which one works in your dev server's environment.
 *
 * Usage: open http://localhost:3000/api/diag in your browser
 */
export const dynamic = "force-dynamic";

function httpsRequest(
  fullUrl: string,
  method: string = "GET",
  body?: string
): Promise<{ status: number; body: string; ms: number }> {
  return new Promise((resolve, reject) => {
    const url = new URL(fullUrl);
    if (url.protocol !== "https:") {
      reject(new Error(`expected https, got ${url.protocol}`));
      return;
    }
    const start = Date.now();
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method,
        headers: body
          ? { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" }
          : { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: data, ms: Date.now() - start })
        );
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout 15s")));
    if (body) req.write(body);
    req.end();
  });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(missing)";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "(missing)";

  const env = {
    NEXT_PUBLIC_SUPABASE_URL_host: safeHost(url),
    NEXT_PUBLIC_SUPABASE_ANON_KEY_length: anon.startsWith("eyJ")
      ? anon.length
      : "(missing or wrong format)",
    nodeVersion: process.version,
  };

  const out: any = { env, tests: {} };

  // 1. fetch (undici) health
  try {
    const start = Date.now();
    const r = await fetch(`${url}/auth/v1/health`);
    const body = await r.text();
    out.tests.fetch_health = { ok: r.status === 401, status: r.status, ms: Date.now() - start, body: body.slice(0, 100) };
  } catch (err: any) {
    out.tests.fetch_health = { ok: false, error: err.message, code: err?.cause?.code };
  }

  // 2. fetch (undici) anon signup
  try {
    const start = Date.now();
    const r = await fetch(`${url}/auth/v1/signup?`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon },
      body: "{}",
    });
    const body = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(body); } catch {}
    out.tests.fetch_anonymousSignup = {
      ok: r.status === 200 && !!parsed?.access_token,
      status: r.status,
      ms: Date.now() - start,
      hasAccessToken: !!parsed?.access_token,
      userId: parsed?.user?.id?.slice(0, 12),
      body: body.slice(0, 200),
    };
  } catch (err: any) {
    out.tests.fetch_anonymousSignup = {
      ok: false,
      error: err.message,
      code: err?.cause?.code,
      stack: err?.stack?.split("\n").slice(0, 3).join("\n"),
    };
  }

  // 3. node:https health
  try {
    const res = await httpsRequest(`${url}/auth/v1/health`);
    out.tests.https_health = { ok: res.status === 401, status: res.status, ms: res.ms, body: res.body.slice(0, 100) };
  } catch (err: any) {
    out.tests.https_health = { ok: false, error: err.message, code: err?.code };
  }

  // 4. node:https anonymous signup
  try {
    const res = await httpsRequest(`${url}/auth/v1/signup?`, "POST", "{}");
    let parsed: any = null;
    try { parsed = JSON.parse(res.body); } catch {}
    out.tests.https_anonymousSignup = {
      ok: res.status === 200 && !!parsed?.access_token,
      status: res.status,
      ms: res.ms,
      hasAccessToken: !!parsed?.access_token,
      userId: parsed?.user?.id?.slice(0, 12),
      body: res.body.slice(0, 200),
    };
  } catch (err: any) {
    out.tests.https_anonymousSignup = {
      ok: false,
      error: err.message,
      code: err?.code,
    };
  }

  return NextResponse.json(out, { status: 200 });
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid URL)";
  }
}
