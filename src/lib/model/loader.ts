import { MODEL_CACHE, MODEL_URL } from "@/lib/detection/constants";

export type LoadProgress =
  | { phase: "checking" }
  | { phase: "downloading"; received: number; total: number }
  | { phase: "compiling" }
  | { phase: "ready"; fromCache: boolean }
  | { phase: "error"; message: string };

/**
 * Fetch the model with first-visit download progress, then keep it in Cache
 * Storage so every later visit (and offline use) loads instantly. The buffer
 * is handed to the inference worker; nothing model-related touches a server
 * after this.
 */
export async function fetchModelBuffer(
  onProgress: (p: LoadProgress) => void,
): Promise<{ buffer: ArrayBuffer; fromCache: boolean }> {
  onProgress({ phase: "checking" });

  let cache: Cache | null = null;
  try {
    cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(MODEL_URL);
    if (hit) {
      const buffer = await hit.arrayBuffer();
      onProgress({ phase: "ready", fromCache: true });
      return { buffer, fromCache: true };
    }
  } catch {
    // Cache Storage unavailable (rare; e.g. some private modes) — plain fetch.
  }

  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) {
    throw new Error(`model download failed: HTTP ${res.status}`);
  }
  const total = Number(res.headers.get("content-length") ?? 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress({ phase: "downloading", received, total });
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  if (cache) {
    try {
      await cache.put(
        MODEL_URL,
        new Response(buffer.slice().buffer, {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      );
    } catch {
      // Quota or private mode — model still works this session.
    }
  }

  onProgress({ phase: "compiling" });
  return { buffer: buffer.buffer, fromCache: false };
}
