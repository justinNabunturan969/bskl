import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as https from "node:https";
import { URL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function req(fullUrl, { method = "GET", body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(fullUrl);
    const headers = { apikey: anon };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    const r = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

const recId = "4889aeb1-8c8e-49b0-b5de-94396afa3484";
const ownerUserId = "f1d3adee-540f-4c0c-87eb-3f0804e6440d";

const select = [
  "id,title,audio_url,context,status,duration_seconds,format,created_at",
  "transcripts(id,full_text,language,segments,provider,updated_at)",
  "summary_drafts(id,format,content,status,based_on_version_id,created_at)",
  "summary_versions(id,recording_id,format,content,version_number,is_current,created_at)",
].join(",");

const sign = await req(`${baseUrl}/auth/v1/signup?`, { method: "POST", body: "{}" });
const auth = JSON.parse(sign.body);
const token = auth.access_token;

console.log("Signed in as:", auth.user.id.slice(0, 8) + "…");

const ownerQuery = await req(
  `${baseUrl}/rest/v1/recordings?select=${encodeURIComponent(select)}&id=eq.${recId}&user_id=eq.${ownerUserId}&deleted_at=is.null`,
  { token: auth.access_token }
);
console.log("\nQuery as different user (expect empty):", ownerQuery.status, ownerQuery.body.slice(0, 120));

const badQuery = await req(
  `${baseUrl}/rest/v1/recordings?select=${encodeURIComponent("id,summary_drafts(summary_version_id,updated_at)")}&id=eq.${recId}`,
  { token }
);
console.log("\nOld broken query:", badQuery.status, badQuery.body.slice(0, 200));

const goodQuery = await req(
  `${baseUrl}/rest/v1/recordings?select=${encodeURIComponent(select)}&id=eq.${recId}&user_id=eq.${ownerUserId}&deleted_at=is.null`,
  { token: auth.access_token }
);
console.log("\nFixed query shape (status only, wrong user):", goodQuery.status, goodQuery.body.slice(0, 120));
