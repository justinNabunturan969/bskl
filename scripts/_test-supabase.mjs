// One-off connectivity test — delete after
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = readFileSync(join(tmpdir(), "bskl_url.txt"), "utf8").trim();
const anon = readFileSync(join(tmpdir(), "bskl_anon.txt"), "utf8").trim();

console.log("URL:", url);
console.log("Anon length:", anon.length);

async function test(name, fn) {
  try {
    const start = Date.now();
    const result = await fn();
    console.log(`[OK ${Date.now() - start}ms] ${name}:`, result);
  } catch (err) {
    console.log(`[FAIL] ${name}: ${err.message}`);
    if (err.cause) console.log("  cause:", err.cause.message || err.cause);
    if (err.code) console.log("  code:", err.code);
  }
}

await test("health (no key)", async () => {
  const r = await fetch(url + "/auth/v1/health");
  return `${r.status} ${(await r.text()).slice(0, 80)}`;
});

await test("health (with key)", async () => {
  const r = await fetch(url + "/auth/v1/health", { headers: { apikey: anon } });
  return `${r.status} ${(await r.text()).slice(0, 80)}`;
});

await test("anonymous signin", async () => {
  const r = await fetch(url + "/auth/v1/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon },
    body: JSON.stringify({}),
  });
  const body = await r.text();
  return `${r.status} ${body.slice(0, 200)}`;
});
