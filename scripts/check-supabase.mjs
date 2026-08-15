// One-off Supabase connectivity diagnostic using node:https (mimics what
// the @huggingface/hub library does, and what the new ensureUser uses).
// Run with: `node scripts/check-supabase.mjs`

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as https from "node:https";
import { URL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

if (!existsSync(envPath)) {
  console.error("✗ .env.local not found at", envPath);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("─".repeat(60));
console.log("Supabase via node:https (bypasses fetch/undici)");
console.log("─".repeat(60));
console.log("URL:        ", url || "(missing!)");
console.log("Anon key:   ", anon ? `${anon.slice(0, 20)}… (${anon.length} chars)` : "(missing!)");

function req(fullUrl, method = "GET", body) {
  return new Promise((resolve, reject) => {
    const u = new URL(fullUrl);
    const r = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method,
        headers: body
          ? { "Content-Type": "application/json", apikey: anon, "Content-Length": Buffer.byteLength(body) }
          : { apikey: anon },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    r.on("error", reject);
    r.setTimeout(15000, () => r.destroy(new Error("timeout 15s")));
    if (body) r.write(body);
    r.end();
  });
}

async function test(name, fn) {
  process.stdout.write(`\n[ … ] ${name} … `);
  try {
    const start = Date.now();
    const r = await fn();
    console.log(`\r[ ✓ ] ${name}  (${Date.now() - start}ms)`);
    console.log("       ", r);
  } catch (err) {
    console.log(`\r[ ✗ ] ${name}`);
    console.log("       message:", err.message);
    if (err.code) console.log("       code:   ", err.code);
  }
}

await test("1. health (no key, should be 401)", async () => {
  const r = await req(url + "/auth/v1/health");
  return `${r.status} ${r.body.slice(0, 100)}`;
});

await test("2. anonymous signup (should be 200 with access_token)", async () => {
  const r = await req(url + "/auth/v1/signup?", "POST", "{}");
  const parsed = JSON.parse(r.body);
  return `${r.status} → user_id=${parsed.user?.id?.slice(0, 8)}… has_token=${!!parsed.access_token}`;
});
