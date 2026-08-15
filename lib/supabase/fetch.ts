// No static imports of `node:https` / `node:url` here — this file is also
// loaded by the Edge runtime (middleware), where those modules don't exist.
// We use a dynamic import inside the function so the module loads in
// both runtimes; the Edge path falls back to global `fetch` if the
// dynamic import fails.

export async function nodeHttpsFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  let httpsMod: typeof import("node:https") | null = null;
  try {
    httpsMod = await import("node:https");
  } catch {
    // Edge runtime (or any environment without node:https) — fall back
    // to the runtime's built-in fetch. In Next 16's edge sandbox this
    // typically doesn't have the same AV-intercepted TLS issue.
    return fetch(input, init);
  }

  // From here on we're in Node.js — `httpsMod` and global `URL` are available.
  const https = httpsMod;

  const urlString =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : (input as Request).url;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch (e: any) {
    throw new Error(`Invalid URL: ${urlString} (${e.message})`);
  }
  if (url.protocol !== "https:") {
    throw new Error(
      `nodeHttpsFetch only supports https://, got ${url.protocol}`
    );
  }

  const headers: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => (headers[k] = v));
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) headers[k] = v;
    } else {
      Object.assign(headers, init.headers);
    }
  }

  return new Promise<Response>((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: init?.method ?? "GET",
        headers,
      },
      (res) => {
        const responseHeaders = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) {
            v.forEach((val) => responseHeaders.append(k, val));
          } else if (v != null) {
            responseHeaders.set(k, v);
          }
        }

        // Node IncomingMessage → Web ReadableStream
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Readable } = require("node:stream") as typeof import("node:stream");
        const body = Readable.toWeb(res) as unknown as ReadableStream;

        resolve(
          new Response(body, {
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            headers: responseHeaders,
          })
        );
      }
    );

    req.on("error", (err) => reject(err));
    req.setTimeout(30_000, () => {
      req.destroy(new Error("nodeHttpsFetch timed out after 30s"));
    });

    if (init?.body) {
      const body = init.body;
      if (typeof body === "string") {
        req.write(body);
      } else if (body instanceof ArrayBuffer) {
        req.write(Buffer.from(body));
      } else if (body instanceof Uint8Array) {
        req.write(Buffer.from(body));
      } else if (body instanceof URLSearchParams) {
        req.write(body.toString());
      } else {
        // FormData / Blob / ReadableStream — best-effort string fallback
        try {
          req.write(String(body));
        } catch (e: any) {
          reject(
            new Error(`nodeHttpsFetch: unsupported body type (${e.message})`)
          );
          return;
        }
      }
    }
    req.end();
  });
}
